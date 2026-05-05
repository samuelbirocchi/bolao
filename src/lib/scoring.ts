export type ScoreWeights = {
  baseMinPoints: number;
  baseMaxPoints: number;
  baseFloorProbability: number;
  baseCeilingProbability: number;
  exactScoreBonusPoints: number;
  winnerGoalsBonusPoints: number;
  goalDifferenceBonusPoints: number;
  loserGoalsBonusPoints: number;
  routBonusPoints: number;
  extraTimeBonusPoints: number;
  penaltiesBonusPoints: number;
};

export type ScoreLine = {
  homeGoals: number;
  awayGoals: number;
};

export type MatchResolution = "regular" | "extra_time" | "penalties";

export type ResultScoreLine = ScoreLine & {
  homePenalties?: number | null;
  awayPenalties?: number | null;
  resolution?: MatchResolution;
};

export type OutcomeSide = "home" | "away";

export type OutcomeProbabilities = {
  homeWinProbability: number | null;
  drawProbability: number | null;
  awayWinProbability: number | null;
};

export type PredictionScore = {
  points: number;
  basePoints: number;
  bonusPoints: number;
  exactScore: boolean;
  correctWinner: boolean;
  predictedWinner: OutcomeSide | null;
  resultWinner: OutcomeSide | null;
  winnerGoals: boolean;
  goalDifference: boolean;
  loserGoals: boolean;
  rout: boolean;
  extraTime: boolean;
  penalties: boolean;
  usedFallbackProbability: boolean;
};

export const defaultScoreWeights: ScoreWeights = {
  baseMinPoints: 5,
  baseMaxPoints: 20,
  baseFloorProbability: 0.15,
  baseCeilingProbability: 0.9,
  exactScoreBonusPoints: 5,
  winnerGoalsBonusPoints: 3,
  goalDifferenceBonusPoints: 2,
  loserGoalsBonusPoints: 1,
  routBonusPoints: 1,
  extraTimeBonusPoints: 3,
  penaltiesBonusPoints: 3,
};

function scoreWinner(score: ScoreLine): OutcomeSide | null {
  if (score.homeGoals > score.awayGoals) {
    return "home";
  }

  if (score.awayGoals > score.homeGoals) {
    return "away";
  }

  return null;
}

export function resultWinner(result: ResultScoreLine): OutcomeSide | null {
  if (
    result.resolution === "penalties" &&
    result.homePenalties !== null &&
    result.homePenalties !== undefined &&
    result.awayPenalties !== null &&
    result.awayPenalties !== undefined
  ) {
    return scoreWinner({
      homeGoals: result.homePenalties,
      awayGoals: result.awayPenalties,
    });
  }

  return scoreWinner(result);
}

function goalsForSide(score: ScoreLine, side: OutcomeSide) {
  return side === "home" ? score.homeGoals : score.awayGoals;
}

function goalsAgainstSide(score: ScoreLine, side: OutcomeSide) {
  return side === "home" ? score.awayGoals : score.homeGoals;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateBasePoints(probability: number | null, weights: ScoreWeights) {
  if (probability === null) {
    return weights.baseMinPoints;
  }

  const floor = Math.min(weights.baseFloorProbability, weights.baseCeilingProbability);
  const ceiling = Math.max(weights.baseFloorProbability, weights.baseCeilingProbability);
  const span = ceiling - floor;

  if (span <= 0) {
    return weights.baseMinPoints;
  }

  const normalized = (clamp(probability, floor, ceiling) - floor) / span;
  const points = weights.baseMaxPoints - normalized * (weights.baseMaxPoints - weights.baseMinPoints);

  return Math.round(points);
}

function probabilityForWinner(
  winner: OutcomeSide,
  probabilities: OutcomeProbabilities | null | undefined,
) {
  if (!probabilities) {
    return null;
  }

  return winner === "home"
    ? probabilities.homeWinProbability
    : probabilities.awayWinProbability;
}

export function calculatePredictionScore(
  prediction: ScoreLine,
  result: ResultScoreLine,
  weights: ScoreWeights,
  probabilities?: OutcomeProbabilities | null,
): PredictionScore {
  const exactScore =
    prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals;
  const predictedWinner = scoreWinner(prediction);
  const finalWinner = resultWinner(result);
  const correctWinner = predictedWinner !== null && predictedWinner === finalWinner;
  const pickedProbability =
    predictedWinner === null ? null : probabilityForWinner(predictedWinner, probabilities);
  const basePoints = correctWinner ? calculateBasePoints(pickedProbability, weights) : 0;

  const winnerGoals =
    !exactScore &&
    correctWinner &&
    predictedWinner !== null &&
    goalsForSide(prediction, predictedWinner) === goalsForSide(result, predictedWinner);
  const goalDifference =
    !exactScore &&
    correctWinner &&
    Math.abs(prediction.homeGoals - prediction.awayGoals) ===
      Math.abs(result.homeGoals - result.awayGoals);
  const loserGoals =
    !exactScore &&
    correctWinner &&
    predictedWinner !== null &&
    goalsAgainstSide(prediction, predictedWinner) === goalsAgainstSide(result, predictedWinner);
  const rout =
    correctWinner &&
    predictedWinner !== null &&
    goalsForSide(prediction, predictedWinner) >= 4 &&
    goalsForSide(result, predictedWinner) >= 4;
  const extraTime = correctWinner && result.resolution === "extra_time";
  const penalties = correctWinner && result.resolution === "penalties";

  const bonusPoints =
    (exactScore ? weights.exactScoreBonusPoints : 0) +
    (winnerGoals ? weights.winnerGoalsBonusPoints : 0) +
    (goalDifference ? weights.goalDifferenceBonusPoints : 0) +
    (loserGoals ? weights.loserGoalsBonusPoints : 0) +
    (rout ? weights.routBonusPoints : 0) +
    (extraTime ? weights.extraTimeBonusPoints : 0) +
    (penalties ? weights.penaltiesBonusPoints : 0);

  return {
    points: basePoints + bonusPoints,
    basePoints,
    bonusPoints,
    exactScore,
    correctWinner,
    predictedWinner,
    resultWinner: finalWinner,
    winnerGoals,
    goalDifference,
    loserGoals,
    rout,
    extraTime,
    penalties,
    usedFallbackProbability: correctWinner && pickedProbability === null,
  };
}
