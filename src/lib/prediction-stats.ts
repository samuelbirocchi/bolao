export type ScorelineParticipant = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  gravatarHash: string | null;
};

export type PredictionStatsInput = {
  match_id: string;
  home_goals: number;
  away_goals: number;
  user_id?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  gravatar_hash?: string | null;
};

export type PredictionOutcomeStats = {
  home: number;
  draw: number;
  away: number;
};

export type PredictionScorelineStats = {
  homeGoals: number;
  awayGoals: number;
  count: number;
  participants: ScorelineParticipant[];
};

export type MatchPredictionStats = {
  total: number;
  outcomes: PredictionOutcomeStats;
  scorelines: PredictionScorelineStats[];
};

function compareParticipants(a: ScorelineParticipant, b: ScorelineParticipant) {
  const aName = a.displayName ?? "";
  const bName = b.displayName ?? "";
  if (aName !== bName) {
    return aName.localeCompare(bName);
  }
  return a.userId.localeCompare(b.userId);
}

export function buildMatchPredictionStats(
  predictions: PredictionStatsInput[],
): Record<string, MatchPredictionStats> {
  const statsByMatch: Record<string, MatchPredictionStats> = {};

  for (const prediction of predictions) {
    statsByMatch[prediction.match_id] ??= {
      total: 0,
      outcomes: { home: 0, draw: 0, away: 0 },
      scorelines: [],
    };

    const stats = statsByMatch[prediction.match_id]!;
    stats.total += 1;

    if (prediction.home_goals > prediction.away_goals) {
      stats.outcomes.home += 1;
    } else if (prediction.away_goals > prediction.home_goals) {
      stats.outcomes.away += 1;
    } else {
      stats.outcomes.draw += 1;
    }

    const scoreline = stats.scorelines.find(
      (item) =>
        item.homeGoals === prediction.home_goals && item.awayGoals === prediction.away_goals,
    );

    if (scoreline) {
      scoreline.count += 1;
    } else {
      stats.scorelines.push({
        homeGoals: prediction.home_goals,
        awayGoals: prediction.away_goals,
        count: 1,
        participants: [],
      });
    }

    if (prediction.user_id) {
      const target = stats.scorelines.find(
        (item) =>
          item.homeGoals === prediction.home_goals && item.awayGoals === prediction.away_goals,
      );
      target?.participants.push({
        userId: prediction.user_id,
        displayName: prediction.display_name ?? null,
        avatarUrl: prediction.avatar_url ?? null,
        gravatarHash: prediction.gravatar_hash ?? null,
      });
    }
  }

  for (const stats of Object.values(statsByMatch)) {
    stats.scorelines.sort(
      (a, b) =>
        b.count - a.count ||
        a.homeGoals + a.awayGoals - (b.homeGoals + b.awayGoals) ||
        a.homeGoals - b.homeGoals ||
        a.awayGoals - b.awayGoals,
    );
    for (const scoreline of stats.scorelines) {
      scoreline.participants.sort(compareParticipants);
    }
  }

  return statsByMatch;
}
