export type ScoreWeights = {
  exactScorePoints: number;
  teamGoalPoints: number;
  outcomePoints: number;
};

export type ScoreLine = {
  homeGoals: number;
  awayGoals: number;
};

export type PredictionScore = {
  points: number;
  exactScore: boolean;
  correctOutcome: boolean;
  correctTeamGoals: number;
};

const outcome = (score: ScoreLine) => Math.sign(score.homeGoals - score.awayGoals);

export function calculatePredictionScore(
  prediction: ScoreLine,
  result: ScoreLine,
  weights: ScoreWeights,
): PredictionScore {
  const exactScore =
    prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals;
  const correctOutcome = outcome(prediction) === outcome(result);
  const correctTeamGoals =
    Number(prediction.homeGoals === result.homeGoals) +
    Number(prediction.awayGoals === result.awayGoals);

  if (exactScore) {
    return {
      points: weights.exactScorePoints,
      exactScore,
      correctOutcome,
      correctTeamGoals,
    };
  }

  return {
    points:
      correctTeamGoals * weights.teamGoalPoints +
      (correctOutcome ? weights.outcomePoints : 0),
    exactScore,
    correctOutcome,
    correctTeamGoals,
  };
}

export const defaultScoreWeights: ScoreWeights = {
  exactScorePoints: 5,
  teamGoalPoints: 1,
  outcomePoints: 2,
};
