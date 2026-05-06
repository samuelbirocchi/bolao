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
  result_home_penalties: number | null;
  result_away_penalties: number | null;
  result_resolution: string | null;
};

export type LeaderboardEntry = {
  group_id: string;
  user_id: string;
  display_name: string | null;
  joined_at: string;
  total_points: number;
  base_points: number;
  bonus_points: number;
  exact_score_count: number;
  winner_count: number;
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
  result_home_penalties: number | null;
  result_away_penalties: number | null;
  result_resolution: string | null;
  phase: string | null;
  odds_captured_at: string | null;
  odds_bookmaker_count: number | null;
  odds_home_win_probability: number | null;
  odds_draw_probability: number | null;
  odds_away_win_probability: number | null;
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
    supabase
      .from("match_results")
      .select("match_id, home_goals, away_goals, home_penalties, away_penalties, resolution"),
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
      result_home_penalties: result?.home_penalties ?? null,
      result_away_penalties: result?.away_penalties ?? null,
      result_resolution: result?.resolution ?? null,
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
      "group_id, user_id, display_name, joined_at, total_points, base_points, bonus_points, exact_score_count, winner_count",
    )
    .eq("group_id", groupId)
    .order("total_points", { ascending: false })
    .order("exact_score_count", { ascending: false })
    .order("winner_count", { ascending: false })
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
    .select(
      "base_min_points, base_max_points, base_floor_probability, base_ceiling_probability, exact_score_bonus_points, winner_goals_bonus_points, goal_difference_bonus_points, loser_goals_bonus_points, rout_bonus_points, extra_time_bonus_points, penalties_bonus_points",
    )
    .eq("id", true)
    .single();

  return {
    baseMinPoints: data?.base_min_points ?? defaultScoreWeights.baseMinPoints,
    baseMaxPoints: data?.base_max_points ?? defaultScoreWeights.baseMaxPoints,
    baseFloorProbability:
      data?.base_floor_probability ?? defaultScoreWeights.baseFloorProbability,
    baseCeilingProbability:
      data?.base_ceiling_probability ?? defaultScoreWeights.baseCeilingProbability,
    exactScoreBonusPoints:
      data?.exact_score_bonus_points ?? defaultScoreWeights.exactScoreBonusPoints,
    winnerGoalsBonusPoints:
      data?.winner_goals_bonus_points ?? defaultScoreWeights.winnerGoalsBonusPoints,
    goalDifferenceBonusPoints:
      data?.goal_difference_bonus_points ?? defaultScoreWeights.goalDifferenceBonusPoints,
    loserGoalsBonusPoints:
      data?.loser_goals_bonus_points ?? defaultScoreWeights.loserGoalsBonusPoints,
    routBonusPoints: data?.rout_bonus_points ?? defaultScoreWeights.routBonusPoints,
    extraTimeBonusPoints:
      data?.extra_time_bonus_points ?? defaultScoreWeights.extraTimeBonusPoints,
    penaltiesBonusPoints:
      data?.penalties_bonus_points ?? defaultScoreWeights.penaltiesBonusPoints,
  };
}

export async function getAdminMatches(): Promise<AdminMatch[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const [{ data: matches }, { data: results }, { data: oddsSnapshots }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, match_number, round, group_name, home_team_name, away_team_name, stadium, kickoff_utc, status, phase",
      )
      .order("match_number", { ascending: true }),
    supabase
      .from("match_results")
      .select("match_id, home_goals, away_goals, home_penalties, away_penalties, resolution"),
    supabase
      .from("match_odds_snapshots")
      .select(
        "match_id, captured_at, bookmaker_count, home_win_probability, draw_probability, away_win_probability",
      ),
  ]);

  return (matches ?? []).map((match) => {
    const result = results?.find((item) => item.match_id === match.id);
    const odds = oddsSnapshots?.find((item) => item.match_id === match.id);
    return {
      ...match,
      result_home_goals: result?.home_goals ?? null,
      result_away_goals: result?.away_goals ?? null,
      result_home_penalties: result?.home_penalties ?? null,
      result_away_penalties: result?.away_penalties ?? null,
      result_resolution: result?.resolution ?? null,
      odds_captured_at: odds?.captured_at ?? null,
      odds_bookmaker_count: odds?.bookmaker_count ?? null,
      odds_home_win_probability: odds?.home_win_probability ?? null,
      odds_draw_probability: odds?.draw_probability ?? null,
      odds_away_win_probability: odds?.away_win_probability ?? null,
    };
  }) as AdminMatch[];
}
