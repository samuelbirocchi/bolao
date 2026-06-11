import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { defaultScoreWeights, type MatchResolution } from "@/lib/scoring";
import {
  buildMatchPredictionStats,
  type MatchPredictionStats,
  type PredictionStatsInput,
} from "@/lib/prediction-stats";
import { buildLiveMatchView, type LiveMatchView } from "@/lib/liveMatch";
import type { RankingMatch, RankingMember, RankingScore } from "@/lib/ranking";

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
  odds_captured_at: string | null;
  odds_home_win_probability: number | null;
  odds_draw_probability: number | null;
  odds_away_win_probability: number | null;
  prediction_stats: MatchPredictionStats | null;
};

export type LeaderboardEntry = {
  group_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  total_points: number;
  base_points: number;
  bonus_points: number;
  exact_score_count: number;
  winner_count: number;
};

export type MatchRankingRow = {
  user_id: string;
  match_id: string;
  base_points: number;
  bonus_points: number;
  exact_score: boolean;
  correct_winner: boolean;
};

export type RankingMatchMeta = {
  id: string;
  match_number: number;
  kickoff_utc: string;
  phase: string | null;
  home_team_name: string;
  away_team_name: string;
  status: string;
};

export type MatchRankingData = {
  scores: MatchRankingRow[];
  members: LeaderboardEntry[];
  matches: RankingMatchMeta[];
};

export type ClosedMatchDetail = {
  match: MatchWithPrediction;
  view: LiveMatchView;
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
  const [
    { data: matches },
    { data: predictions },
    { data: groupPredictions },
    { data: results },
    { data: oddsSnapshots },
  ] = await Promise.all([
      supabase
        .from("matches")
        .select(
          "id, match_number, round, group_name, home_team_name, away_team_name, home_team_placeholder, away_team_placeholder, stadium, kickoff_utc, status",
        )
        .order("kickoff_utc", { ascending: true })
        .order("match_number", { ascending: true }),
      supabase
        .from("predictions")
        .select("match_id, home_goals, away_goals")
        .eq("group_id", groupId)
        .eq("user_id", userId),
      supabase
        .from("predictions")
        .select("match_id, home_goals, away_goals")
        .eq("group_id", groupId),
      supabase
        .from("match_results")
        .select("match_id, home_goals, away_goals, home_penalties, away_penalties, resolution"),
      supabase
        .from("match_odds_snapshots")
        .select(
          "match_id, captured_at, home_win_probability, draw_probability, away_win_probability",
        ),
    ]);

  const predictionStatsByMatch = buildMatchPredictionStats(
    (groupPredictions ?? []) as PredictionStatsInput[],
  );

  return (matches ?? []).map((match) => {
    const prediction = predictions?.find((item) => item.match_id === match.id);
    const result = results?.find((item) => item.match_id === match.id);
    const odds = oddsSnapshots?.find((item) => item.match_id === match.id);

    return {
      ...match,
      prediction_home_goals: prediction?.home_goals ?? null,
      prediction_away_goals: prediction?.away_goals ?? null,
      result_home_goals: result?.home_goals ?? null,
      result_away_goals: result?.away_goals ?? null,
      result_home_penalties: result?.home_penalties ?? null,
      result_away_penalties: result?.away_penalties ?? null,
      result_resolution: result?.resolution ?? null,
      odds_captured_at: odds?.captured_at ?? null,
      odds_home_win_probability: odds?.home_win_probability ?? null,
      odds_draw_probability: odds?.draw_probability ?? null,
      odds_away_win_probability: odds?.away_win_probability ?? null,
      prediction_stats: predictionStatsByMatch[match.id] ?? null,
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
      "group_id, user_id, display_name, avatar_url, joined_at, total_points, base_points, bonus_points, exact_score_count, winner_count",
    )
    .eq("group_id", groupId)
    .order("total_points", { ascending: false })
    .order("exact_score_count", { ascending: false })
    .order("winner_count", { ascending: false })
    .order("joined_at", { ascending: true });

  return (data ?? []) as LeaderboardEntry[];
}

export async function getMatchRankingData(groupId: string): Promise<MatchRankingData> {
  if (!hasSupabaseEnv()) {
    return { scores: [], members: [], matches: [] };
  }

  const supabase = await createClient();
  const [{ data: scores }, members, { data: matches }, { data: results }] = await Promise.all([
    supabase
      .from("match_prediction_scores")
      .select("user_id, match_id, base_points, bonus_points, exact_score, correct_winner")
      .eq("group_id", groupId),
    getLeaderboard(groupId),
    supabase
      .from("matches")
      .select("id, match_number, kickoff_utc, phase, home_team_name, away_team_name, status")
      .order("kickoff_utc", { ascending: true })
      .order("match_number", { ascending: true }),
    supabase.from("match_results").select("match_id"),
  ]);

  // Only completed matches (those with a result) belong on the timeline. Derive
  // the set from match_results so a completed match with zero predictions still
  // appears (everyone carried forward at 0), not just matches present in scores.
  const completedMatchIds = new Set((results ?? []).map((row) => row.match_id));
  const completedMatches = (matches ?? []).filter((match) => completedMatchIds.has(match.id));

  return {
    scores: (scores ?? []) as MatchRankingRow[],
    members,
    matches: completedMatches as RankingMatchMeta[],
  };
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

export async function getClosedMatchDetail(
  groupId: string,
  matchId: string,
  currentUserId: string,
): Promise<ClosedMatchDetail | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, match_number, round, group_name, home_team_name, away_team_name, home_team_placeholder, away_team_placeholder, stadium, kickoff_utc, status, phase",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (!match || new Date(match.kickoff_utc).getTime() > Date.now()) {
    return null;
  }

  const [
    { data: predictions },
    { data: currentResult },
    { data: odds },
    { data: memberships },
    { data: allMatches },
    { data: allResults },
    { data: allScores },
    weights,
  ] = await Promise.all([
    supabase
      .from("predictions")
      .select("user_id, home_goals, away_goals")
      .eq("group_id", groupId)
      .eq("match_id", matchId),
    supabase
      .from("match_results")
      .select("match_id, home_goals, away_goals, home_penalties, away_penalties, resolution")
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase
      .from("match_odds_snapshots")
      .select("match_id, captured_at, home_win_probability, draw_probability, away_win_probability")
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase.from("group_memberships").select("user_id, joined_at").eq("group_id", groupId),
    supabase
      .from("matches")
      .select("id, match_number, kickoff_utc, phase, home_team_name, away_team_name, status")
      .order("kickoff_utc", { ascending: true })
      .order("match_number", { ascending: true }),
    supabase.from("match_results").select("match_id"),
    supabase
      .from("match_prediction_scores")
      .select("user_id, match_id, base_points, bonus_points, exact_score, correct_winner")
      .eq("group_id", groupId),
    getScoringSettings(),
  ]);

  const memberIds = (memberships ?? []).map((membership) => membership.user_id);
  const { data: profiles } =
    memberIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", memberIds)
      : { data: [] };
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const members: RankingMember[] = (memberships ?? []).map((membership) => {
    const profile = profilesById.get(membership.user_id);
    return {
      user_id: membership.user_id,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      joined_at: membership.joined_at,
    };
  });

  const resultMatchIds = new Set((allResults ?? []).map((result) => result.match_id));
  const currentKickoff = new Date(match.kickoff_utc).getTime();
  const previousMatches = ((allMatches ?? []) as RankingMatch[]).filter(
    (item) =>
      item.id !== matchId &&
      resultMatchIds.has(item.id) &&
      new Date(item.kickoff_utc).getTime() < currentKickoff,
  );
  const previousMatchIds = new Set(previousMatches.map((item) => item.id));
  const previousScores = ((allScores ?? []) as RankingScore[]).filter((score) =>
    previousMatchIds.has(score.match_id),
  );
  const result =
    currentResult?.home_goals !== null &&
    currentResult?.home_goals !== undefined &&
    currentResult.away_goals !== null &&
    currentResult.away_goals !== undefined
      ? {
          homeGoals: currentResult.home_goals,
          awayGoals: currentResult.away_goals,
          homePenalties: currentResult.home_penalties,
          awayPenalties: currentResult.away_penalties,
          resolution: currentResult.resolution as MatchResolution,
        }
      : null;
  const currentPrediction = predictions?.find((prediction) => prediction.user_id === currentUserId);
  const view = buildLiveMatchView({
    currentMatch: {
      id: match.id,
      match_number: match.match_number,
      kickoff_utc: match.kickoff_utc,
      phase: match.phase,
      home_team_name: match.home_team_name,
      away_team_name: match.away_team_name,
    },
    currentUserId,
    members,
    predictions: predictions ?? [],
    previousMatches,
    previousScores,
    probabilities: {
      homeWinProbability: odds?.home_win_probability ?? null,
      drawProbability: odds?.draw_probability ?? null,
      awayWinProbability: odds?.away_win_probability ?? null,
    },
    result,
    weights,
  });

  return {
    match: {
      ...match,
      prediction_home_goals: currentPrediction?.home_goals ?? null,
      prediction_away_goals: currentPrediction?.away_goals ?? null,
      result_home_goals: currentResult?.home_goals ?? null,
      result_away_goals: currentResult?.away_goals ?? null,
      result_home_penalties: currentResult?.home_penalties ?? null,
      result_away_penalties: currentResult?.away_penalties ?? null,
      result_resolution: currentResult?.resolution ?? null,
      odds_captured_at: odds?.captured_at ?? null,
      odds_home_win_probability: odds?.home_win_probability ?? null,
      odds_draw_probability: odds?.draw_probability ?? null,
      odds_away_win_probability: odds?.away_win_probability ?? null,
    } as MatchWithPrediction,
    view,
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
