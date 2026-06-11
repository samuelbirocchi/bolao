import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMatchPredictionStats } from "./prediction-stats.ts";

test("buildMatchPredictionStats aggregates winner shares by match", () => {
  const stats = buildMatchPredictionStats([
    { match_id: "m1", home_goals: 2, away_goals: 1 },
    { match_id: "m1", home_goals: 0, away_goals: 1 },
    { match_id: "m1", home_goals: 1, away_goals: 1 },
    { match_id: "m1", home_goals: 3, away_goals: 0 },
    { match_id: "m2", home_goals: 0, away_goals: 0 },
  ]);

  assert.equal(stats.m1?.total, 4);
  assert.deepEqual(stats.m1?.outcomes, { home: 2, draw: 1, away: 1 });
  assert.equal(stats.m2?.total, 1);
  assert.deepEqual(stats.m2?.outcomes, { home: 0, draw: 1, away: 0 });
});

test("buildMatchPredictionStats sorts common scorelines by count", () => {
  const stats = buildMatchPredictionStats([
    { match_id: "m1", home_goals: 1, away_goals: 0 },
    { match_id: "m1", home_goals: 2, away_goals: 1 },
    { match_id: "m1", home_goals: 2, away_goals: 1 },
    { match_id: "m1", home_goals: 0, away_goals: 0 },
    { match_id: "m1", home_goals: 1, away_goals: 0 },
    { match_id: "m1", home_goals: 2, away_goals: 1 },
  ]);

  assert.deepEqual(stats.m1?.scorelines, [
    { homeGoals: 2, awayGoals: 1, count: 3 },
    { homeGoals: 1, awayGoals: 0, count: 2 },
    { homeGoals: 0, awayGoals: 0, count: 1 },
  ]);
});
