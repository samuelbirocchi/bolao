// WC2026 has 72 group-stage matches; knockout matches start at match number 73.
// The SQL scoring view (migration 011) hardcodes 73 to mirror this constant.
export const KNOCKOUT_START_MATCH_NUMBER = 73;

export function isKnockoutMatch(matchNumber: number): boolean {
  return matchNumber >= KNOCKOUT_START_MATCH_NUMBER;
}

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
  knockoutMultiplier: number;
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

export type PredictionLine = ScoreLine & {
  // Shootout pick for a draw prediction on a knockout match. Gates the
  // penalties bonus; ignored when the prediction is not a draw.
  penaltyWinner?: OutcomeSide | null;
};

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
  correctDraw: boolean;
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
  knockoutMultiplier: 2,
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

// The match's win/draw outcome is judged purely on the goals scored (including
// extra time). A knockout match decided on penalties is level on goals, so it
// counts as a DRAW; the shootout winner is a separate sub-prediction (see
// penaltyShootoutWinner) that only gates the penalties bonus.
export function resultWinner(result: ResultScoreLine): OutcomeSide | null {
  return scoreWinner(result);
}

// The team that won the penalty shootout, or null when no shootout was recorded.
export function penaltyShootoutWinner(result: ResultScoreLine): OutcomeSide | null {
  if (
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

  return null;
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
  prediction: PredictionLine,
  result: ResultScoreLine,
  weights: ScoreWeights,
  probabilities?: OutcomeProbabilities | null,
  isKnockout = false,
): PredictionScore {
  const exactScore =
    prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals;
  const predictedWinner = scoreWinner(prediction);
  const finalWinner = resultWinner(result);
  const correctWinner = predictedWinner !== null && predictedWinner === finalWinner;
  const correctDraw = predictedWinner === null && finalWinner === null;
  const pickedProbability =
    predictedWinner === null
      ? (probabilities?.drawProbability ?? null)
      : probabilityForWinner(predictedWinner, probabilities);
  const basePoints = correctWinner || correctDraw
    ? calculateBasePoints(pickedProbability, weights)
    : 0;

  const winnerGoals =
    !exactScore &&
    correctWinner &&
    predictedWinner !== null &&
    goalsForSide(prediction, predictedWinner) === goalsForSide(result, predictedWinner);
  const goalDifference =
    !exactScore &&
    (correctWinner || correctDraw) &&
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
  const extraTime = (correctWinner || correctDraw) && result.resolution === "extra_time";
  // A penalty shootout decides a match that was level on goals, so the goal
  // outcome is a draw. The penalties bonus is earned by correctly predicting the
  // draw AND picking the team that won the shootout.
  const shootoutWinner = penaltyShootoutWinner(result);
  const penalties =
    result.resolution === "penalties" &&
    correctDraw &&
    prediction.penaltyWinner != null &&
    prediction.penaltyWinner === shootoutWinner;

  const rawBasePoints = basePoints;
  const rawBonusPoints =
    (exactScore ? weights.exactScoreBonusPoints : 0) +
    (winnerGoals ? weights.winnerGoalsBonusPoints : 0) +
    (goalDifference ? weights.goalDifferenceBonusPoints : 0) +
    (loserGoals ? weights.loserGoalsBonusPoints : 0) +
    (rout ? weights.routBonusPoints : 0) +
    (extraTime ? weights.extraTimeBonusPoints : 0) +
    (penalties ? weights.penaltiesBonusPoints : 0);

  // Knockout matches are worth a configurable multiple. Apply it to both the
  // base and the bonus so `points === basePoints + bonusPoints` still holds and
  // the Base/Bônus breakdown reflects the doubling.
  const multiplier = isKnockout ? weights.knockoutMultiplier : 1;
  const finalBasePoints = rawBasePoints * multiplier;
  const finalBonusPoints = rawBonusPoints * multiplier;

  return {
    points: finalBasePoints + finalBonusPoints,
    basePoints: finalBasePoints,
    bonusPoints: finalBonusPoints,
    exactScore,
    correctWinner,
    correctDraw,
    predictedWinner,
    resultWinner: finalWinner,
    winnerGoals,
    goalDifference,
    loserGoals,
    rout,
    extraTime,
    penalties,
    usedFallbackProbability: (correctWinner || correctDraw) && pickedProbability === null,
  };
}
