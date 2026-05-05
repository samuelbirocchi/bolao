"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGlobalAdmin, requireUser } from "@/lib/auth";
import { fetchWc2026Matches } from "@/lib/schedule/wc2026";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

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

export async function signInWithEmail(formData: FormData) {
  requireSupabaseConfig();

  const email = readString(formData, "email");
  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  if (!email) {
    redirect("/login?message=Email is required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Check your email for a magic link");
}

export async function signOut() {
  requireSupabaseConfig();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
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
  const { data: invite, error: inviteError } = await supabase
    .from("invite_codes")
    .select("group_id")
    .eq("code", code)
    .is("revoked_at", null)
    .single();

  if (inviteError || !invite) {
    throw new Error("Invite code was not found.");
  }

  const { error } = await supabase.from("group_memberships").upsert(
    {
      group_id: invite.group_id,
      user_id: user.id,
      role: "member",
    },
    { onConflict: "group_id,user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/groups");
  redirect(`/groups/${invite.group_id}`);
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
  const exactScorePoints = readInteger(formData, "exactScorePoints");
  const teamGoalPoints = readInteger(formData, "teamGoalPoints");
  const outcomePoints = readInteger(formData, "outcomePoints");

  const supabase = await createClient();
  const { error } = await supabase.from("scoring_settings").upsert({
    id: true,
    exact_score_points: exactScorePoints,
    team_goal_points: teamGoalPoints,
    outcome_points: outcomePoints,
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

  const supabase = await createClient();
  const { error: resultError } = await supabase.from("match_results").upsert(
    {
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
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
