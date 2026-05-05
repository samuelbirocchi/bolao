import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateBasePoints,
  calculatePredictionScore,
  defaultScoreWeights,
} from "./scoring.ts";

test("probability base score is linear, rounded, and clamped", () => {
  assert.equal(calculateBasePoints(0.15, defaultScoreWeights), 20);
  assert.equal(calculateBasePoints(0.9, defaultScoreWeights), 5);
  assert.equal(calculateBasePoints(0.525, defaultScoreWeights), 13);
  assert.equal(calculateBasePoints(0.05, defaultScoreWeights), 20);
  assert.equal(calculateBasePoints(0.95, defaultScoreWeights), 5);
  assert.equal(calculateBasePoints(null, defaultScoreWeights), 5);
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

test("penalty shootout resolves tied goals to the shootout winner", () => {
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

  assert.equal(score.correctWinner, true);
  assert.equal(score.basePoints, defaultScoreWeights.baseMinPoints);
  assert.equal(score.penalties, true);
});
