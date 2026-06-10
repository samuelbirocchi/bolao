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
      { matchId: "a", homeGoals: 2, awayGoals: 1 },
      { matchId: "b", homeGoals: 0, awayGoals: 0 },
    ],
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
