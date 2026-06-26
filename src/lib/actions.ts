"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGlobalAdmin, requireUser } from "@/lib/auth";
import {
  normalizeInviteCode,
  safeInternalRedirectPath,
  validatePasswordSetup,
} from "@/lib/authForms";
import { avatarObjectPath, avatarStoragePathFromPublicUrl, validateAvatarUrl } from "@/lib/avatar";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { redeemInviteCode } from "@/lib/invites";
import { assertNotOwner } from "@/lib/membership";
import { buildOddsSnapshots, fetchWorldCupOdds } from "@/lib/odds";
import { buildPredictionEntries, parsePenaltyWinner } from "@/lib/predictions";
import { pathWithSaveFeedback } from "@/lib/saveFeedback";
import { syncWc2026MatchesForAdmin } from "@/lib/schedule/sync";
import { configuredSiteOriginFromEnv, normalizeOrigin } from "@/lib/siteOrigin";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const DISPLAY_NAME_MAX_LENGTH = 80;

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

function configuredSiteOrigin() {
  return configuredSiteOriginFromEnv({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}

export async function signInWithEmail(formData: FormData) {
  requireSupabaseConfig();

  const email = readString(formData, "email");
  const inviteCode = normalizeInviteCode(readString(formData, "inviteCode"));
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

  redirect(`${formPath}?message=${encodeURIComponent("Check your email for a sign-in/setup link")}`);
}

export async function signInWithPasswordAction(formData: FormData) {
  requireSupabaseConfig();

  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const inviteCode = normalizeInviteCode(readString(formData, "inviteCode"));
  const formPath = inviteCode ? `/groups/join/${inviteCode}` : "/login";

  if (!email || !password) {
    redirect(`${formPath}?message=${encodeURIComponent("Email and password are required")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(
      `${formPath}?message=${encodeURIComponent(error?.message ?? "Could not sign in")}`,
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ password_set_at: new Date().toISOString() })
    .eq("id", data.user.id);

  if (profileError) {
    redirect(`${formPath}?message=${encodeURIComponent(profileError.message)}`);
  }

  if (!inviteCode) {
    redirect("/groups");
  }

  const result = await redeemInviteCode(supabase, data.user.id, inviteCode);

  if (!result.ok) {
    redirect(`/groups?message=${encodeURIComponent(result.message)}`);
  }

  redirect(`/groups/${result.groupId}`);
}

export async function createPasswordAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireUser();

  const password = readString(formData, "password");
  const confirmation = readString(formData, "confirmPassword");
  const nextPath = safeInternalRedirectPath(readString(formData, "next"));
  const validation = validatePasswordSetup(password, confirmation);

  if (!validation.ok) {
    redirect(
      `/settings?setupPassword=1&next=${encodeURIComponent(nextPath)}&message=${encodeURIComponent(
        validation.message,
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      `/settings?setupPassword=1&next=${encodeURIComponent(nextPath)}&message=${encodeURIComponent(
        error.message,
      )}`,
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ password_set_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) {
    redirect(
      `/settings?setupPassword=1&next=${encodeURIComponent(nextPath)}&message=${encodeURIComponent(
        profileError.message,
      )}`,
    );
  }

  revalidatePath("/settings");
  redirect(nextPath);
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
  const penaltyWinner = parsePenaltyWinner(
    readString(formData, "penaltyWinner"),
    homeGoals === awayGoals,
    matchId,
  );

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
      penalty_winner: penaltyWinner,
    },
    { onConflict: "group_id,user_id,match_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/groups/${groupId}/matches`);
  redirect(pathWithSaveFeedback(`/groups/${groupId}/matches`, "predictions"));
}

export async function saveAllPredictionsAction(formData: FormData) {
  requireSupabaseConfig();
  const { user } = await requireUser();
  const groupId = readString(formData, "groupId");
  const matchIds = readString(formData, "matchIds")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const entries = buildPredictionEntries(
    matchIds.map((matchId) => ({
      matchId,
      home: readString(formData, `home-${matchId}`),
      away: readString(formData, `away-${matchId}`),
      penaltyWinner: readString(formData, `penalty-${matchId}`),
    })),
  );

  if (entries.length === 0) {
    return;
  }

  const supabase = await createClient();
  const { data: openMatches } = await supabase
    .from("matches")
    .select("id, kickoff_utc")
    .in(
      "id",
      entries.map((entry) => entry.matchId),
    );

  const now = Date.now();
  const unlocked = new Set(
    (openMatches ?? [])
      .filter((match) => new Date(match.kickoff_utc).getTime() > now)
      .map((match) => match.id),
  );

  const rows = entries
    .filter((entry) => unlocked.has(entry.matchId))
    .map((entry) => ({
      group_id: groupId,
      match_id: entry.matchId,
      user_id: user.id,
      home_goals: entry.homeGoals,
      away_goals: entry.awayGoals,
      penalty_winner: entry.penaltyWinner,
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "group_id,user_id,match_id" });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/groups/${groupId}/matches`);
  redirect(pathWithSaveFeedback(`/groups/${groupId}/matches`, "predictions"));
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
  const knockoutMultiplier = readInteger(formData, "knockoutMultiplier");

  if (knockoutMultiplier < 1) {
    throw new Error("Knockout multiplier must be at least 1.");
  }

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
    knockout_multiplier: knockoutMultiplier,
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

export async function removeUserFromGroupAction(formData: FormData) {
  requireSupabaseConfig();
  await requireGlobalAdmin();
  const groupId = readString(formData, "groupId");
  const userId = readString(formData, "userId");

  if (!groupId || !userId) {
    throw new Error("groupId and userId are required.");
  }

  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    throw new Error(membershipError?.message ?? "Membership not found.");
  }

  assertNotOwner(membership.role);

  const { data: deleted, error: deleteError } = await supabase
    .from("group_memberships")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .select("user_id");

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (!deleted || deleted.length === 0) {
    throw new Error("Could not remove the member. The removal may have been blocked.");
  }

  revalidatePath("/admin/groups");
  revalidatePath(`/admin/groups/${groupId}`);
  revalidatePath("/groups", "layout");
}

export async function syncMatchesAction() {
  const { user } = await requireGlobalAdmin();
  await syncWc2026MatchesForAdmin(user.id);
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

  const result = buildOddsSnapshots(matches, oddsEvents);
  const rows = result.snapshots.map((snapshot) => ({
    match_id: snapshot.matchId,
    odds_event_id: snapshot.oddsEventId,
    source: snapshot.source,
    bookmaker_count: snapshot.bookmakerCount,
    home_win_probability: snapshot.homeWinProbability,
    draw_probability: snapshot.drawProbability,
    away_win_probability: snapshot.awayWinProbability,
    captured_at: snapshot.capturedAt,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("match_odds_snapshots")
      .upsert(rows, { onConflict: "match_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/matches");
  revalidatePath("/groups", "layout");
}

// The @supabase/ssr server client does not forward the cookie-derived JWT to
// the storage namespace's Authorization header, so storage RLS evaluates as
// `anon` and rejects the request. Hit the storage REST API directly with the
// user's access token instead.
async function storageObjectRequest(
  method: "POST" | "DELETE",
  path: string,
  accessToken: string,
  init?: { body?: BodyInit; contentType?: string },
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const headers: Record<string, string> = {
    apikey: anonKey,
    authorization: `Bearer ${accessToken}`,
  };
  if (init?.contentType) headers["content-type"] = init.contentType;
  return fetch(`${supabaseUrl}/storage/v1/object/${AVATAR_BUCKET}/${path}`, {
    method,
    headers,
    body: init?.body,
  });
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
  let previousAvatarPath: string | null = null;
  let uploadedAvatarPath: string | null = null;
  let accessTokenForCleanup: string | null = null;

  const fileEntry = formData.get("avatarFile");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  if (file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Avatar file must be an image.");
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new Error("Avatar file must be 2 MB or smaller.");
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    previousAvatarPath = avatarStoragePathFromPublicUrl(currentProfile?.avatar_url, AVATAR_BUCKET);
    const path = avatarObjectPath(user.id, file.type);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("Not authenticated.");
    }
    accessTokenForCleanup = accessToken;

    const uploadRes = await storageObjectRequest("POST", path, accessToken, {
      body: file,
      contentType: file.type,
    });

    if (!uploadRes.ok) {
      const message = await uploadRes.text().catch(() => uploadRes.statusText);
      throw new Error(`Avatar upload failed: ${message || uploadRes.statusText}`);
    }

    const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    update.avatar_url = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    uploadedAvatarPath = path;
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

  if (
    previousAvatarPath &&
    uploadedAvatarPath &&
    previousAvatarPath !== uploadedAvatarPath &&
    accessTokenForCleanup
  ) {
    await storageObjectRequest("DELETE", previousAvatarPath, accessTokenForCleanup);
  }

  revalidatePath("/settings");
  revalidatePath("/groups", "layout");
  redirect(pathWithSaveFeedback("/settings", "profile"));
}

export async function removeAvatarAction() {
  requireSupabaseConfig();
  const { user } = await requireUser();

  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Not authenticated.");
  }
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const currentAvatarPath = avatarStoragePathFromPublicUrl(
    currentProfile?.avatar_url,
    AVATAR_BUCKET,
  );

  if (currentAvatarPath) {
    await storageObjectRequest("DELETE", currentAvatarPath, accessToken);
  }

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
