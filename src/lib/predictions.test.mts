import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPredictionEntries } from "./predictions.ts";

test("keeps valid pairs as parsed integers", () => {
  assert.deepEqual(
    buildPredictionEntries([
      { matchId: "a", home: "2", away: "1" },
      { matchId: "b", home: "0", away: "0" },
    ]),
    [
      { matchId: "a", homeGoals: 2, awayGoals: 1, penaltyWinner: null },
      { matchId: "b", homeGoals: 0, awayGoals: 0, penaltyWinner: null },
    ],
  );
});

test("keeps the penalty winner only for a draw prediction", () => {
  assert.deepEqual(
    buildPredictionEntries([
      // Draw → the shootout pick is retained.
      { matchId: "a", home: "1", away: "1", penaltyWinner: "home" },
      // Not a draw → the shootout pick is dropped.
      { matchId: "b", home: "2", away: "1", penaltyWinner: "away" },
      // Draw with no pick → null.
      { matchId: "c", home: "0", away: "0", penaltyWinner: "" },
    ]),
    [
      { matchId: "a", homeGoals: 1, awayGoals: 1, penaltyWinner: "home" },
      { matchId: "b", homeGoals: 2, awayGoals: 1, penaltyWinner: null },
      { matchId: "c", homeGoals: 0, awayGoals: 0, penaltyWinner: null },
    ],
  );
});

test("rejects an invalid penalty winner on a draw", () => {
  assert.throws(() =>
    buildPredictionEntries([{ matchId: "a", home: "1", away: "1", penaltyWinner: "neither" }]),
  );
});

test("skips fully blank pairs", () => {
  assert.deepEqual(
    buildPredictionEntries([
      { matchId: "a", home: "", away: "" },
      { matchId: "b", home: "  ", away: "" },
    ]),
    [],
  );
});

test("skips partially filled pairs (only one side)", () => {
  assert.deepEqual(
    buildPredictionEntries([
      { matchId: "a", home: "3", away: "" },
      { matchId: "b", home: "", away: "2" },
    ]),
    [],
  );
});

test("rejects negative values", () => {
  assert.throws(() => buildPredictionEntries([{ matchId: "a", home: "-1", away: "0" }]));
});

test("rejects non-integer values", () => {
  assert.throws(() => buildPredictionEntries([{ matchId: "a", home: "1.5", away: "0" }]));
  assert.throws(() => buildPredictionEntries([{ matchId: "a", home: "two", away: "0" }]));
});
