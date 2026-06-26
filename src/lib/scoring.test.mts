import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KNOCKOUT_START_MATCH_NUMBER,
  calculateBasePoints,
  calculatePredictionScore,
  defaultScoreWeights,
  isKnockoutMatch,
} from "./scoring.ts";

test("probability base score is linear, rounded, and clamped", () => {
  assert.equal(calculateBasePoints(0.15, defaultScoreWeights), 20);
  assert.equal(calculateBasePoints(0.9, defaultScoreWeights), 5);
  assert.equal(calculateBasePoints(0.525, defaultScoreWeights), 13);
  assert.equal(calculateBasePoints(0.05, defaultScoreWeights), 20);
  assert.equal(calculateBasePoints(0.95, defaultScoreWeights), 5);
  assert.equal(calculateBasePoints(null, defaultScoreWeights), 5);
  assert.equal(
    calculateBasePoints(0.5, {
      ...defaultScoreWeights,
      baseFloorProbability: 0.5,
      baseCeilingProbability: 0.5,
    }),
    5,
  );
});

test("draw base score uses draw probability and falls back to minimum", () => {
  assert.equal(calculateBasePoints(0.3, defaultScoreWeights), 17);
  assert.equal(calculateBasePoints(null, defaultScoreWeights), defaultScoreWeights.baseMinPoints);
});

test("exact score blocks winner goals, goal difference, and loser goals bonuses", () => {
  const score = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 1 },
    { homeGoals: 2, awayGoals: 1, resolution: "regular" },
    defaultScoreWeights,
    { homeWinProbability: 0.5, drawProbability: 0.25, awayWinProbability: 0.25 },
  );

  assert.equal(score.exactScore, true);
  assert.equal(score.winnerGoals, false);
  assert.equal(score.goalDifference, false);
  assert.equal(score.loserGoals, false);
  assert.equal(score.bonusPoints, defaultScoreWeights.exactScoreBonusPoints);
});

test("non-exact score can earn each score-shape bonus independently", () => {
  const winnerGoals = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 1 },
    { homeGoals: 2, awayGoals: 0, resolution: "regular" },
    defaultScoreWeights,
    null,
  );
  const goalDifference = calculatePredictionScore(
    { homeGoals: 3, awayGoals: 0 },
    { homeGoals: 5, awayGoals: 2, resolution: "regular" },
    defaultScoreWeights,
    null,
  );
  const loserGoals = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 1 },
    { homeGoals: 3, awayGoals: 1, resolution: "regular" },
    defaultScoreWeights,
    null,
  );

  assert.equal(winnerGoals.winnerGoals, true);
  assert.equal(goalDifference.goalDifference, true);
  assert.equal(loserGoals.loserGoals, true);
});

test("rout and extra-time bonuses can coexist with exact score", () => {
  const score = calculatePredictionScore(
    { homeGoals: 4, awayGoals: 0 },
    { homeGoals: 4, awayGoals: 0, resolution: "extra_time" },
    defaultScoreWeights,
    null,
  );

  assert.equal(score.exactScore, true);
  assert.equal(score.rout, true);
  assert.equal(score.extraTime, true);
  assert.equal(
    score.bonusPoints,
    defaultScoreWeights.exactScoreBonusPoints +
      defaultScoreWeights.routBonusPoints +
      defaultScoreWeights.extraTimeBonusPoints,
  );
});

test("penalty match is a draw on goals: a winner-pick scores nothing", () => {
  const score = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 1 },
    {
      homeGoals: 1,
      awayGoals: 1,
      homePenalties: 5,
      awayPenalties: 4,
      resolution: "penalties",
    },
    defaultScoreWeights,
    null,
  );

  // 1-1 (level on goals) is a draw; predicting 2-1 is the wrong outcome.
  assert.equal(score.correctWinner, false);
  assert.equal(score.correctDraw, false);
  assert.equal(score.penalties, false);
  assert.equal(score.points, 0);
});

test("penalty match: draw prediction with correct shootout pick earns base + penalties bonus", () => {
  const score = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 2, penaltyWinner: "home" },
    {
      homeGoals: 1,
      awayGoals: 1,
      homePenalties: 5,
      awayPenalties: 4,
      resolution: "penalties",
    },
    defaultScoreWeights,
    { homeWinProbability: 0.4, drawProbability: 0.2, awayWinProbability: 0.4 },
  );

  assert.equal(score.correctDraw, true);
  assert.equal(score.penalties, true);
  assert.equal(score.basePoints, calculateBasePoints(0.2, defaultScoreWeights));
  // Non-exact draw with matching goal difference (0) + correct shootout pick.
  assert.equal(
    score.bonusPoints,
    defaultScoreWeights.goalDifferenceBonusPoints + defaultScoreWeights.penaltiesBonusPoints,
  );
});

test("penalty match: draw prediction with wrong shootout pick earns no penalties bonus", () => {
  const score = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 2, penaltyWinner: "away" },
    {
      homeGoals: 1,
      awayGoals: 1,
      homePenalties: 5,
      awayPenalties: 4,
      resolution: "penalties",
    },
    defaultScoreWeights,
    { homeWinProbability: 0.4, drawProbability: 0.2, awayWinProbability: 0.4 },
  );

  assert.equal(score.correctDraw, true);
  assert.equal(score.penalties, false);
  assert.equal(score.bonusPoints, defaultScoreWeights.goalDifferenceBonusPoints);
});

test("penalty match: draw prediction without a shootout pick earns no penalties bonus", () => {
  const score = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 2 },
    {
      homeGoals: 1,
      awayGoals: 1,
      homePenalties: 5,
      awayPenalties: 4,
      resolution: "penalties",
    },
    defaultScoreWeights,
    { homeWinProbability: 0.4, drawProbability: 0.2, awayWinProbability: 0.4 },
  );

  assert.equal(score.correctDraw, true);
  assert.equal(score.penalties, false);
  assert.equal(score.bonusPoints, defaultScoreWeights.goalDifferenceBonusPoints);
});

test("knockout matches double the whole score (base + bonuses)", () => {
  const prediction = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1, resolution: "regular" as const };
  const probabilities = {
    homeWinProbability: 0.5,
    drawProbability: 0.25,
    awayWinProbability: 0.25,
  };

  const group = calculatePredictionScore(prediction, result, defaultScoreWeights, probabilities, false);
  const knockout = calculatePredictionScore(prediction, result, defaultScoreWeights, probabilities, true);

  assert.ok(group.points > 0);
  assert.equal(knockout.basePoints, group.basePoints * defaultScoreWeights.knockoutMultiplier);
  assert.equal(knockout.bonusPoints, group.bonusPoints * defaultScoreWeights.knockoutMultiplier);
  assert.equal(knockout.points, group.points * defaultScoreWeights.knockoutMultiplier);
  assert.equal(knockout.points, knockout.basePoints + knockout.bonusPoints);
});

test("knockout base-points preview formula matches awarded base points", () => {
  // The bet page previews calculateBasePoints(prob) * knockoutMultiplier per
  // outcome. That formula must equal what a knockout match actually awards,
  // including the doubled minimum used when no odds were synced.
  const prediction = { homeGoals: 2, awayGoals: 0 };
  const result = { homeGoals: 2, awayGoals: 0, resolution: "regular" as const };
  const probabilities = {
    homeWinProbability: 0.5,
    drawProbability: 0.25,
    awayWinProbability: 0.25,
  };

  const withOdds = calculatePredictionScore(
    prediction,
    result,
    defaultScoreWeights,
    probabilities,
    true,
  );
  assert.equal(
    withOdds.basePoints,
    calculateBasePoints(probabilities.homeWinProbability, defaultScoreWeights) *
      defaultScoreWeights.knockoutMultiplier,
  );

  const withoutOdds = calculatePredictionScore(
    prediction,
    result,
    defaultScoreWeights,
    null,
    true,
  );
  assert.equal(
    withoutOdds.basePoints,
    calculateBasePoints(null, defaultScoreWeights) * defaultScoreWeights.knockoutMultiplier,
  );
  assert.equal(
    withoutOdds.basePoints,
    defaultScoreWeights.baseMinPoints * defaultScoreWeights.knockoutMultiplier,
  );
});

test("knockout multiplier is configurable and a multiplier of 1 is a no-op", () => {
  const prediction = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1, resolution: "regular" as const };

  const group = calculatePredictionScore(prediction, result, defaultScoreWeights, null, false);
  const tripled = calculatePredictionScore(
    prediction,
    result,
    { ...defaultScoreWeights, knockoutMultiplier: 3 },
    null,
    true,
  );
  const noop = calculatePredictionScore(
    prediction,
    result,
    { ...defaultScoreWeights, knockoutMultiplier: 1 },
    null,
    true,
  );

  assert.equal(tripled.points, group.points * 3);
  assert.equal(noop.points, group.points);
});

test("isKnockoutMatch keys off match number 73", () => {
  assert.equal(KNOCKOUT_START_MATCH_NUMBER, 73);
  assert.equal(isKnockoutMatch(72), false);
  assert.equal(isKnockoutMatch(73), true);
  assert.equal(isKnockoutMatch(104), true);
});

test("draw prediction with different scoreline earns base points and goal-difference bonus", () => {
  const score = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 2 },
    { homeGoals: 1, awayGoals: 1, resolution: "regular" },
    defaultScoreWeights,
    { homeWinProbability: 0.4, drawProbability: 0.2, awayWinProbability: 0.4 },
  );

  assert.equal(score.correctDraw, true);
  assert.equal(score.correctWinner, false);
  assert.equal(score.exactScore, false);
  assert.equal(score.basePoints, calculateBasePoints(0.2, defaultScoreWeights));
  assert.equal(score.goalDifference, true);
  assert.equal(score.winnerGoals, false);
  assert.equal(score.loserGoals, false);
  assert.equal(
    score.bonusPoints,
    defaultScoreWeights.goalDifferenceBonusPoints,
  );
  assert.equal(score.points, score.basePoints + score.bonusPoints);
});

test("exact draw prediction earns exact-score bonus", () => {
  const score = calculatePredictionScore(
    { homeGoals: 1, awayGoals: 1 },
    { homeGoals: 1, awayGoals: 1, resolution: "regular" },
    defaultScoreWeights,
    null,
  );

  assert.equal(score.correctDraw, true);
  assert.equal(score.exactScore, true);
  assert.equal(score.bonusPoints, defaultScoreWeights.exactScoreBonusPoints);
  assert.equal(score.goalDifference, false);
});

test("draw prediction against non-draw result earns no points", () => {
  const score = calculatePredictionScore(
    { homeGoals: 1, awayGoals: 1 },
    { homeGoals: 2, awayGoals: 1, resolution: "regular" },
    defaultScoreWeights,
    null,
  );

  assert.equal(score.correctDraw, false);
  assert.equal(score.correctWinner, false);
  assert.equal(score.basePoints, 0);
  assert.equal(score.bonusPoints, 0);
  assert.equal(score.points, 0);
});

test("draw prediction with draw result in extra time earns extra-time bonus", () => {
  const score = calculatePredictionScore(
    { homeGoals: 2, awayGoals: 2 },
    { homeGoals: 1, awayGoals: 1, resolution: "extra_time" },
    defaultScoreWeights,
    null,
  );

  assert.equal(score.correctDraw, true);
  assert.equal(score.extraTime, true);
  assert.equal(score.basePoints, defaultScoreWeights.baseMinPoints);
  assert.equal(
    score.bonusPoints,
    defaultScoreWeights.goalDifferenceBonusPoints + defaultScoreWeights.extraTimeBonusPoints,
  );
});
