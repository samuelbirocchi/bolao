import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { defaultScoreWeights } from "@/lib/scoring";

export type GroupSummary = {
  id: string;
  name: string;
  created_at: string;
  role: string;
  invite_code: string | null;
};

export type GroupDetail = {
  id: string;
  name: string;
  created_at: string;
  role: string;
  invite_code: string | null;
};

export type MatchWithPrediction = {
  id: string;
  match_number: number;
  round: string;
  group_name: string | null;
  home_team_name: string;
  away_team_name: string;
  home_team_placeholder: string | null;
  away_team_placeholder: string | null;
  stadium: string | null;
  kickoff_utc: string;
  status: string;
  prediction_home_goals: number | null;
  prediction_away_goals: number | null;
  result_home_goals: number | null;
  result_away_goals: number | null;
};

export type LeaderboardEntry = {
  group_id: string;
  user_id: string;
  display_name: string | null;
  joined_at: string;
  total_points: number;
  exact_score_count: number;
  outcome_count: number;
  team_goal_count: number;
};

export type AdminMatch = {
  id: string;
  match_number: number;
  round: string;
  group_name: string | null;
  home_team_name: string;
  away_team_name: string;
  stadium: string | null;
  kickoff_utc: string;
  status: string;
  result_home_goals: number | null;
  result_away_goals: number | null;
};

export async function getMyGroups(userId: string): Promise<GroupSummary[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("group_memberships")
    .select("group_id, role, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  if (groupIds.length === 0) {
    return [];
  }

  const [{ data: groups }, { data: invites }] = await Promise.all([
    supabase.from("groups").select("id, name, created_at").in("id", groupIds),
    supabase
      .from("invite_codes")
      .select("group_id, code")
      .in("group_id", groupIds)
      .is("revoked_at", null),
  ]);

  return groupIds
    .map((groupId) => {
      const group = groups?.find((item) => item.id === groupId);
      const membership = memberships?.find((item) => item.group_id === groupId);

      if (!group || !membership) {
        return null;
      }

      return {
        id: group.id,
        name: group.name,
        created_at: group.created_at,
        role: membership.role,
        invite_code: invites?.find((invite) => invite.group_id === group.id)?.code ?? null,
      };
    })
    .filter(Boolean) as GroupSummary[];
}

export async function getGroupDetail(groupId: string, userId: string): Promise<GroupDetail | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const [{ data: group }, { data: membership }, { data: invite }] = await Promise.all([
    supabase.from("groups").select("id, name, created_at").eq("id", groupId).single(),
    supabase
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("invite_codes")
      .select("code")
      .eq("group_id", groupId)
      .is("revoked_at", null)
      .maybeSingle(),
  ]);

  if (!group || !membership) {
    return null;
  }

  return {
    id: group.id,
    name: group.name,
    created_at: group.created_at,
    role: membership.role,
    invite_code: invite?.code ?? null,
  };
}

export async function getMatchesWithPredictions(
  groupId: string,
  userId: string,
): Promise<MatchWithPrediction[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const [{ data: matches }, { data: predictions }, { data: results }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, match_number, round, group_name, home_team_name, away_team_name, home_team_placeholder, away_team_placeholder, stadium, kickoff_utc, status",
      )
      .order("match_number", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, home_goals, away_goals")
      .eq("group_id", groupId)
      .eq("user_id", userId),
    supabase.from("match_results").select("match_id, home_goals, away_goals"),
  ]);

  return (matches ?? []).map((match) => {
    const prediction = predictions?.find((item) => item.match_id === match.id);
    const result = results?.find((item) => item.match_id === match.id);

    return {
      ...match,
      prediction_home_goals: prediction?.home_goals ?? null,
      prediction_away_goals: prediction?.away_goals ?? null,
      result_home_goals: result?.home_goals ?? null,
      result_away_goals: result?.away_goals ?? null,
    };
  }) as MatchWithPrediction[];
}

export async function getLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("leaderboard_entries")
    .select(
      "group_id, user_id, display_name, joined_at, total_points, exact_score_count, outcome_count, team_goal_count",
    )
    .eq("group_id", groupId)
    .order("total_points", { ascending: false })
    .order("exact_score_count", { ascending: false })
    .order("outcome_count", { ascending: false })
    .order("joined_at", { ascending: true });

  return (data ?? []) as LeaderboardEntry[];
}

export async function getScoringSettings() {
  if (!hasSupabaseEnv()) {
    return defaultScoreWeights;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("scoring_settings")
    .select("exact_score_points, team_goal_points, outcome_points")
    .eq("id", true)
    .single();

  return {
    exactScorePoints: data?.exact_score_points ?? defaultScoreWeights.exactScorePoints,
    teamGoalPoints: data?.team_goal_points ?? defaultScoreWeights.teamGoalPoints,
    outcomePoints: data?.outcome_points ?? defaultScoreWeights.outcomePoints,
  };
}

export async function getAdminMatches(): Promise<AdminMatch[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const [{ data: matches }, { data: results }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, match_number, round, group_name, home_team_name, away_team_name, stadium, kickoff_utc, status",
      )
      .order("match_number", { ascending: true }),
    supabase.from("match_results").select("match_id, home_goals, away_goals"),
  ]);

  return (matches ?? []).map((match) => {
    const result = results?.find((item) => item.match_id === match.id);
    return {
      ...match,
      result_home_goals: result?.home_goals ?? null,
      result_away_goals: result?.away_goals ?? null,
    };
  }) as AdminMatch[];
}
