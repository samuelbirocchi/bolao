import {
  calculatePredictionScore,
  type MatchResolution,
  type OutcomeProbabilities,
  type PredictionScore,
  type ResultScoreLine,
  type ScoreLine,
  type ScoreWeights,
} from "./scoring.ts";
import { buildRanking, type RankingMatch, type RankingMember, type RankingScore } from "./ranking.ts";
import { buildMatchPredictionStats, type PredictionScorelineStats } from "./prediction-stats.ts";

export type MatchPickDistribution = {
  home: number;
  draw: number;
  away: number;
};

export type LiveMatchPredictionInput = {
  user_id: string;
  home_goals: number;
  away_goals: number;
};

export type LiveMatchCriterion =
  | "correctWinner"
  | "correctDraw"
  | "winnerGoals"
  | "goalDifference"
  | "loserGoals"
  | "exactScore"
  | "rout"
  | "extraTime"
  | "penalties";

export type LiveMatchParticipant = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  prediction: ScoreLine;
  points: number;
  criteria: LiveMatchCriterion[];
  preMatchRank: number;
  liveRank: number;
  rankDelta: number;
};

export type LiveMatchView = {
  participants: LiveMatchParticipant[];
  distribution: MatchPickDistribution;
  scorelines: PredictionScorelineStats[];
  currentUserMovement: {
    preMatchRank: number;
    liveRank: number;
    rankDelta: number;
  } | null;
  hasOfficialScore: boolean;
};

function pickOutcome(prediction: ScoreLine): keyof MatchPickDistribution {
  if (prediction.homeGoals > prediction.awayGoals) return "home";
  if (prediction.awayGoals > prediction.homeGoals) return "away";
  return "draw";
}

function scoreCriteria(score: PredictionScore): LiveMatchCriterion[] {
  const criteria: LiveMatchCriterion[] = [];
  if (score.correctWinner) criteria.push("correctWinner");
  if (score.correctDraw) criteria.push("correctDraw");
  if (score.winnerGoals) criteria.push("winnerGoals");
  if (score.goalDifference) criteria.push("goalDifference");
  if (score.loserGoals) criteria.push("loserGoals");
  if (score.exactScore) criteria.push("exactScore");
  if (score.rout) criteria.push("rout");
  if (score.extraTime) criteria.push("extraTime");
  if (score.penalties) criteria.push("penalties");
  return criteria;
}

function ranksByUser(entries: { userId: string; rank: number }[]) {
  return new Map(entries.map((entry) => [entry.userId, entry.rank]));
}

export function buildLiveMatchView({
  currentMatch,
  currentUserId,
  members,
  predictions,
  previousMatches,
  previousScores,
  probabilities,
  result,
  weights,
}: {
  currentMatch: RankingMatch;
  currentUserId: string;
  members: RankingMember[];
  predictions: LiveMatchPredictionInput[];
  previousMatches: RankingMatch[];
  previousScores: RankingScore[];
  probabilities?: OutcomeProbabilities | null;
  result: (ResultScoreLine & { resolution?: MatchResolution }) | null;
  weights: ScoreWeights;
}): LiveMatchView {
  const distribution = predictions.reduce<MatchPickDistribution>(
    (counts, prediction) => {
      counts[pickOutcome({ homeGoals: prediction.home_goals, awayGoals: prediction.away_goals })] += 1;
      return counts;
    },
    { home: 0, draw: 0, away: 0 },
  );
  const preMatchRanks = ranksByUser(
    buildRanking(previousMatches, previousScores, members).currentStandings,
  );
  const partialScores: RankingScore[] = result
    ? predictions.map((prediction) => {
        const score = calculatePredictionScore(
          { homeGoals: prediction.home_goals, awayGoals: prediction.away_goals },
          result,
          weights,
          probabilities,
        );
        return {
          user_id: prediction.user_id,
          match_id: currentMatch.id,
          base_points: score.basePoints,
          bonus_points: score.bonusPoints,
          exact_score: score.exactScore,
          correct_winner: score.correctWinner,
          correct_draw: score.correctDraw,
        };
      })
    : [];
  const liveRanks = ranksByUser(
    buildRanking(
      [...previousMatches, currentMatch],
      [...previousScores, ...partialScores],
      members,
    ).currentStandings,
  );
  const membersById = new Map(members.map((member) => [member.user_id, member]));

  const participants = predictions
    .map<LiveMatchParticipant>((prediction) => {
      const score = result
        ? calculatePredictionScore(
            { homeGoals: prediction.home_goals, awayGoals: prediction.away_goals },
            result,
            weights,
            probabilities,
          )
        : null;
      const member = membersById.get(prediction.user_id);
      const preMatchRank = preMatchRanks.get(prediction.user_id) ?? members.length;
      const liveRank = liveRanks.get(prediction.user_id) ?? preMatchRank;
      return {
        userId: prediction.user_id,
        displayName: member?.display_name ?? null,
        avatarUrl: member?.avatar_url ?? null,
        prediction: { homeGoals: prediction.home_goals, awayGoals: prediction.away_goals },
        points: score?.points ?? 0,
        criteria: score ? scoreCriteria(score) : [],
        preMatchRank,
        liveRank,
        rankDelta: preMatchRank - liveRank,
      };
    })
    .sort((a, b) => {
      if (a.liveRank !== b.liveRank) return a.liveRank - b.liveRank;
      if (b.points !== a.points) return b.points - a.points;
      return a.displayName?.localeCompare(b.displayName ?? "") ?? a.userId.localeCompare(b.userId);
    });
  const currentUser = participants.find((participant) => participant.userId === currentUserId);

  const predictionStatsInput = predictions.map((p) => ({
    match_id: currentMatch.id,
    home_goals: p.home_goals,
    away_goals: p.away_goals,
  }));
  const scorelinesByMatch = buildMatchPredictionStats(predictionStatsInput);
  const scorelines = scorelinesByMatch[currentMatch.id]?.scorelines ?? [];

  return {
    participants,
    distribution,
    scorelines,
    currentUserMovement: currentUser
      ? {
          preMatchRank: currentUser.preMatchRank,
          liveRank: currentUser.liveRank,
          rankDelta: currentUser.rankDelta,
        }
      : null,
    hasOfficialScore: result !== null,
  };
}
