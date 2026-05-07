"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGlobalAdmin, requireUser } from "@/lib/auth";
import { validateAvatarUrl } from "@/lib/avatar";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { redeemInviteCode } from "@/lib/invites";
import { buildOddsSnapshots, fetchWorldCupOdds } from "@/lib/odds";
import { fetchWc2026Matches } from "@/lib/schedule/wc2026";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const DISPLAY_NAME_MAX_LENGTH = 80;

const INVITE_CODE_PATTERN = /^[A-Z0-9]{1,32}$/;

function requireSupabaseConfig() {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase is not configured. Copy .env.example to .env.local first.");
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readInteger(formData: FormData, key: string) {
  const value = readString(formData, key);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer.`);
  }
  return parsed;
}

function readOptionalInteger(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer.`);
  }

  return parsed;
}

function readProbability(formData: FormData, key: string) {
  const value = readString(formData, key);
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${key} must be a percentage between 0 and 100.`);
  }

  return parsed / 100;
}

function readResolution(formData: FormData) {
  const resolution = readString(formData, "resolution");

  if (resolution === "regular" || resolution === "extra_time" || resolution === "penalties") {
    return resolution;
  }

  throw new Error("resolution must be regular, extra_time, or penalties.");
}

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

function configuredSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return normalizeOrigin(configured);
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (vercelProductionUrl) {
    return normalizeOrigin(`https://${vercelProductionUrl}`);
  }

  const vercelDeploymentUrl = process.env.VERCEL_URL?.trim();

  if (vercelDeploymentUrl) {
    return normalizeOrigin(`https://${vercelDeploymentUrl}`);
  }

  return null;
}

export async function signInWithEmail(formData: FormData) {
  requireSupabaseConfig();

  const email = readString(formData, "email");
  const rawInviteCode = readString(formData, "inviteCode").toUpperCase();
  const inviteCode = INVITE_CODE_PATTERN.test(rawInviteCode) ? rawInviteCode : "";
  const requestOrigin = (await headers()).get("origin");
  const origin =
    configuredSiteOrigin() ??
    (requestOrigin ? normalizeOrigin(requestOrigin) : null) ??
    "http://localhost:3000";

  const formPath = inviteCode ? `/groups/join/${inviteCode}` : "/login";

  if (!email) {
    redirect(`${formPath}?message=${encodeURIComponent("Email is required")}`);
  }

  const callbackUrl = inviteCode
    ? `${origin}/auth/callback?invite=${inviteCode}`
    : `${origin}/auth/callback`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });

  if (error) {
    redirect(`${formPath}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`${formPath}?message=${encodeURIComponent("Check your email for a magic link")}`);
}

export async function signOut() {
  requireSupabaseConfig();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function setLocaleAction(formData: FormData) {
  const locale = readString(formData, "locale");
  const fallbackPath = "/";
  const redirectTo = readString(formData, "redirectTo") || fallbackPath;

  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : fallbackPath);
}

export async function createGroupAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireUser();
  const name = readString(formData, "name");

  if (!name) {
    throw new Error("Group name is required.");
  }

  const supabase = await createClient();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();

  if (groupError || !group) {
    throw new Error(groupError?.message ?? "Could not create group.");
  }

  const code = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();

  const [{ error: membershipError }, { error: inviteError }] = await Promise.all([
    supabase
      .from("group_memberships")
      .insert({ group_id: group.id, user_id: user.id, role: "owner" }),
    supabase.from("invite_codes").insert({ group_id: group.id, code, created_by: user.id }),
  ]);

  if (membershipError || inviteError) {
    throw new Error(membershipError?.message ?? inviteError?.message ?? "Could not set up group.");
  }

  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export async function joinGroupAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireUser();
  const code = readString(formData, "code").toUpperCase();

  if (!code) {
    throw new Error("Invite code is required.");
  }

  const supabase = await createClient();
  const result = await redeemInviteCode(supabase, user.id, code);

  if (!result.ok) {
    throw new Error(result.message);
  }

  revalidatePath("/groups");
  redirect(`/groups/${result.groupId}`);
}

export async function savePredictionAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireUser();
  const groupId = readString(formData, "groupId");
  const matchId = readString(formData, "matchId");
  const homeGoals = readInteger(formData, "homeGoals");
  const awayGoals = readInteger(formData, "awayGoals");

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_utc")
    .eq("id", matchId)
    .single();

  if (!match || new Date(match.kickoff_utc).getTime() <= Date.now()) {
    throw new Error("Predictions are locked for this match.");
  }

  const { error } = await supabase.from("predictions").upsert(
    {
      group_id: groupId,
      match_id: matchId,
      user_id: user.id,
      home_goals: homeGoals,
      away_goals: awayGoals,
    },
    { onConflict: "group_id,user_id,match_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/groups/${groupId}/matches`);
}

export async function updateScoringSettingsAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireGlobalAdmin();
  const baseMinPoints = readInteger(formData, "baseMinPoints");
  const baseMaxPoints = readInteger(formData, "baseMaxPoints");
  const baseFloorProbability = readProbability(formData, "baseFloorProbability");
  const baseCeilingProbability = readProbability(formData, "baseCeilingProbability");

  if (baseFloorProbability === baseCeilingProbability) {
    throw new Error("Base probability thresholds must be different.");
  }

  const exactScoreBonusPoints = readInteger(formData, "exactScoreBonusPoints");
  const winnerGoalsBonusPoints = readInteger(formData, "winnerGoalsBonusPoints");
  const goalDifferenceBonusPoints = readInteger(formData, "goalDifferenceBonusPoints");
  const loserGoalsBonusPoints = readInteger(formData, "loserGoalsBonusPoints");
  const routBonusPoints = readInteger(formData, "routBonusPoints");
  const extraTimeBonusPoints = readInteger(formData, "extraTimeBonusPoints");
  const penaltiesBonusPoints = readInteger(formData, "penaltiesBonusPoints");

  const supabase = await createClient();
  const { error } = await supabase.from("scoring_settings").upsert({
    id: true,
    base_min_points: baseMinPoints,
    base_max_points: baseMaxPoints,
    base_floor_probability: baseFloorProbability,
    base_ceiling_probability: baseCeilingProbability,
    exact_score_bonus_points: exactScoreBonusPoints,
    winner_goals_bonus_points: winnerGoalsBonusPoints,
    goal_difference_bonus_points: goalDifferenceBonusPoints,
    loser_goals_bonus_points: loserGoalsBonusPoints,
    rout_bonus_points: routBonusPoints,
    extra_time_bonus_points: extraTimeBonusPoints,
    penalties_bonus_points: penaltiesBonusPoints,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/scoring");
  revalidatePath("/groups", "layout");
}

export async function updateMatchResultAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireGlobalAdmin();
  const matchId = readString(formData, "matchId");
  const homeGoals = readInteger(formData, "homeGoals");
  const awayGoals = readInteger(formData, "awayGoals");
  const homePenalties = readOptionalInteger(formData, "homePenalties");
  const awayPenalties = readOptionalInteger(formData, "awayPenalties");
  const resolution = readResolution(formData);

  if (resolution === "penalties" && (homePenalties === null || awayPenalties === null)) {
    throw new Error("Penalty scores are required when the match is decided on penalties.");
  }

  const supabase = await createClient();
  const { error: resultError } = await supabase.from("match_results").upsert(
    {
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      home_penalties: resolution === "penalties" ? homePenalties : null,
      away_penalties: resolution === "penalties" ? awayPenalties : null,
      resolution,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_id" },
  );

  if (resultError) {
    throw new Error(resultError.message);
  }

  const { error: matchError } = await supabase
    .from("matches")
    .update({ status: "completed" })
    .eq("id", matchId);

  if (matchError) {
    throw new Error(matchError.message);
  }

  revalidatePath("/admin/matches");
  revalidatePath("/groups", "layout");
}

export async function syncMatchesAction() {
  requireSupabaseConfig();
  const { user } = await requireGlobalAdmin();
  const externalMatches = await fetchWc2026Matches();
  const supabase = await createClient();

  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .upsert(
      externalMatches.map((match) => ({
        match_number: match.matchNumber,
        round: match.round,
        group_name: match.groupName,
        home_team_name: match.homeTeamName ?? match.homeTeamPlaceholder ?? "TBD",
        away_team_name: match.awayTeamName ?? match.awayTeamPlaceholder ?? "TBD",
        home_team_placeholder: match.homeTeamPlaceholder,
        away_team_placeholder: match.awayTeamPlaceholder,
        stadium: match.stadium,
        kickoff_utc: match.kickoffUtc,
        status: match.status,
        phase: match.phase,
      })),
      { onConflict: "match_number" },
    )
    .select("id, match_number");

  if (matchError || !matches) {
    throw new Error(matchError?.message ?? "Could not sync matches.");
  }

  const matchIdByNumber = new Map(matches.map((match) => [match.match_number, match.id]));
  const completedResults = externalMatches
    .filter((match) => match.resultHomeGoals !== null && match.resultAwayGoals !== null)
    .map((match) => ({
      match_id: matchIdByNumber.get(match.matchNumber),
      home_goals: match.resultHomeGoals!,
      away_goals: match.resultAwayGoals!,
      home_penalties:
        match.resultResolution === "penalties" ? match.resultHomePenalties : null,
      away_penalties:
        match.resultResolution === "penalties" ? match.resultAwayPenalties : null,
      resolution: match.resultResolution,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }))
    .filter((result) => result.match_id);

  if (completedResults.length > 0) {
    const { error: resultError } = await supabase
      .from("match_results")
      .upsert(completedResults, { onConflict: "match_id" });

    if (resultError) {
      throw new Error(resultError.message);
    }
  }

  revalidatePath("/admin/matches");
  revalidatePath("/groups", "layout");
}

export async function syncOddsAction() {
  requireSupabaseConfig();
  await requireGlobalAdmin();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: matches, error: matchError }, oddsEvents] = await Promise.all([
    supabase
      .from("matches")
      .select("id, home_team_name, away_team_name, kickoff_utc")
      .gt("kickoff_utc", now),
    fetchWorldCupOdds(),
  ]);

  if (matchError || !matches) {
    throw new Error(matchError?.message ?? "Could not load matches for odds sync.");
  }

  const snapshots = buildOddsSnapshots(matches, oddsEvents).map((snapshot) => ({
    match_id: snapshot.matchId,
    odds_event_id: snapshot.oddsEventId,
    source: snapshot.source,
    bookmaker_count: snapshot.bookmakerCount,
    home_win_probability: snapshot.homeWinProbability,
    draw_probability: snapshot.drawProbability,
    away_win_probability: snapshot.awayWinProbability,
    captured_at: snapshot.capturedAt,
  }));

  if (snapshots.length > 0) {
    const { error } = await supabase
      .from("match_odds_snapshots")
      .upsert(snapshots, { onConflict: "match_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/matches");
  revalidatePath("/groups", "layout");
}

function avatarObjectPath(userId: string) {
  return `${userId}/avatar`;
}

export async function updateProfileAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireUser();

  const displayName = readString(formData, "displayName");
  if (!displayName) {
    throw new Error("Display name is required.");
  }
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`);
  }

  const supabase = await createClient();
  const update: { display_name: string; avatar_url?: string | null } = {
    display_name: displayName,
  };

  const fileEntry = formData.get("avatarFile");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  if (file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Avatar file must be an image.");
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new Error("Avatar file must be 2 MB or smaller.");
    }

    const path = avatarObjectPath(user.id);
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    update.avatar_url = `${publicUrlData.publicUrl}?v=${Date.now()}`;
  } else {
    const rawUrl = readString(formData, "avatarUrl");
    const validated = validateAvatarUrl(rawUrl);
    if (validated !== null) {
      update.avatar_url = validated;
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  revalidatePath("/settings");
  revalidatePath("/groups", "layout");
}

export async function removeAvatarAction() {
  requireSupabaseConfig();
  const { user } = await requireUser();

  const supabase = await createClient();
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarObjectPath(user.id)]);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/groups", "layout");
}
