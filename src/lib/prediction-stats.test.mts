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
    { homeGoals: 2, awayGoals: 1, count: 3, participants: [] },
    { homeGoals: 1, awayGoals: 0, count: 2, participants: [] },
    { homeGoals: 0, awayGoals: 0, count: 1, participants: [] },
  ]);
});

test("buildMatchPredictionStats groups participants per scoreline and sorts by name", () => {
  const stats = buildMatchPredictionStats([
    { match_id: "m1", home_goals: 2, away_goals: 0, user_id: "u-a", display_name: "Alice", avatar_url: null },
    { match_id: "m1", home_goals: 2, away_goals: 0, user_id: "u-b", display_name: "Bob", avatar_url: "https://example.com/b.png" },
    { match_id: "m1", home_goals: 2, away_goals: 0, user_id: "u-c", display_name: null, avatar_url: null },
    { match_id: "m1", home_goals: 1, away_goals: 0, user_id: "u-d", display_name: "Dana", avatar_url: null },
  ]);

  const scorelines = stats.m1?.scorelines ?? [];
  assert.equal(scorelines.length, 2);

  const top = scorelines[0]!;
  assert.equal(top.homeGoals, 2);
  assert.equal(top.awayGoals, 0);
  assert.equal(top.count, 3);
  assert.deepEqual(
    top.participants.map((p) => p.userId),
    ["u-c", "u-a", "u-b"],
  );
  assert.equal(top.participants[1]?.displayName, "Alice");
  assert.equal(top.participants[1]?.avatarUrl, null);
  assert.equal(top.participants[2]?.avatarUrl, "https://example.com/b.png");

  const other = scorelines[1]!;
  assert.equal(other.count, 1);
  assert.equal(other.participants.length, 1);
  assert.equal(other.participants[0]?.userId, "u-d");
});

test("buildMatchPredictionStats leaves participants empty when user_id is absent", () => {
  const stats = buildMatchPredictionStats([
    { match_id: "m1", home_goals: 1, away_goals: 0 },
  ]);

  assert.deepEqual(stats.m1?.scorelines, [
    { homeGoals: 1, awayGoals: 0, count: 1, participants: [] },
  ]);
});
