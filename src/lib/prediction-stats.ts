export type PredictionStatsInput = {
  match_id: string;
  home_goals: number;
  away_goals: number;
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
};

export type MatchPredictionStats = {
  total: number;
  outcomes: PredictionOutcomeStats;
  scorelines: PredictionScorelineStats[];
};

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
  }

  return statsByMatch;
}
