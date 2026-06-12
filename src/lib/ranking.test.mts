import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRanking,
  type RankingMatch,
  type RankingMember,
  type RankingScore,
} from "./ranking.ts";

const alice: RankingMember = {
  user_id: "alice",
  display_name: "Alice",
  avatar_url: null,
  joined_at: "2026-01-01T00:00:00Z",
};
const bob: RankingMember = {
  user_id: "bob",
  display_name: "Bob",
  avatar_url: null,
  joined_at: "2026-01-02T00:00:00Z",
};
const carol: RankingMember = {
  user_id: "carol",
  display_name: "Carol",
  avatar_url: null,
  joined_at: "2026-01-03T00:00:00Z",
};

function match(id: string, matchNumber: number, kickoff: string): RankingMatch {
  return {
    id,
    match_number: matchNumber,
    kickoff_utc: kickoff,
    phase: null,
    home_team_name: `${id} home`,
    away_team_name: `${id} away`,
  };
}

function score(
  userId: string,
  matchId: string,
  base: number,
  bonus: number,
  exact: boolean,
  winner: boolean,
): RankingScore {
  return {
    user_id: userId,
    match_id: matchId,
    base_points: base,
    bonus_points: bonus,
    exact_score: exact,
    correct_winner: winner,
  };
}

const m1 = match("m1", 1, "2026-06-11T16:00:00Z");
const m2 = match("m2", 2, "2026-06-11T20:00:00Z");
const m3 = match("m3", 3, "2026-06-12T16:00:00Z");

test("tiebreaker: equal points fall to exact-score count before winner count", () => {
  // alice 10pts from one exact; bob 10pts from two winners, no exact.
  const scores = [
    score("alice", "m1", 5, 5, true, true),
    score("bob", "m1", 5, 0, false, true),
    score("bob", "m2", 5, 0, false, true),
  ];
  const { currentStandings } = buildRanking([m1, m2], scores, [alice, bob, carol]);

  assert.equal(currentStandings[0]!.userId, "alice");
  assert.equal(currentStandings[0]!.cumulativePoints, 10);
  assert.equal(currentStandings[1]!.userId, "bob");
  assert.equal(currentStandings[1]!.cumulativePoints, 10);
  assert.equal(currentStandings[2]!.userId, "carol");
});

test("tiebreaker: equal points and exact fall to winner count", () => {
  const scores = [
    score("alice", "m1", 5, 0, false, true),
    score("alice", "m2", 5, 0, false, true),
    score("bob", "m1", 10, 0, false, true),
  ];
  const { currentStandings } = buildRanking([m1, m2], scores, [alice, bob]);

  // Both 10pts, both 0 exact; alice has 2 winners vs bob's 1.
  assert.equal(currentStandings[0]!.userId, "alice");
  assert.equal(currentStandings[0]!.winnerCount, 2);
  assert.equal(currentStandings[1]!.userId, "bob");
  assert.equal(currentStandings[1]!.winnerCount, 1);
});

test("tiebreaker: fully tied entries fall to joined_at ascending", () => {
  const scores = [
    score("bob", "m1", 5, 0, false, true),
    score("alice", "m1", 5, 0, false, true),
  ];
  const { currentStandings } = buildRanking([m1], scores, [bob, alice]);

  // Identical points/exact/winner; alice joined earlier so ranks first.
  assert.equal(currentStandings[0]!.userId, "alice");
  assert.equal(currentStandings[1]!.userId, "bob");
});

test("cumulative carry-forward: missing predictions hold prior totals", () => {
  const scores = [
    score("alice", "m1", 10, 0, false, true),
    // carol does not predict m1, predicts m2.
    score("carol", "m2", 8, 0, false, true),
    // alice does not predict m2.
  ];
  const { series, timeline } = buildRanking([m1, m2], scores, [alice, carol]);

  const aliceSeries = series.find((s) => s.userId === "alice")!;
  assert.deepEqual(
    aliceSeries.points.map((p) => p.cumulativePoints),
    [10, 10], // carried forward unchanged through m2
  );
  const carolSeries = series.find((s) => s.userId === "carol")!;
  assert.deepEqual(
    carolSeries.points.map((p) => p.cumulativePoints),
    [0, 8], // zero at m1 (no prediction), then 8
  );
  assert.equal(timeline.length, 2);
});

test("rank deltas: climbing yields a positive delta, first step is zero", () => {
  const scores = [
    // After m1: alice 15 (rank1), bob 5 (rank2).
    score("alice", "m1", 10, 5, true, true),
    score("bob", "m1", 5, 0, false, true),
    // m2: bob surges past alice. alice no prediction.
    score("bob", "m2", 15, 0, false, true),
  ];
  const { perMatch } = buildRanking([m1, m2], scores, [alice, bob]);

  // First match: delta 0 for everyone.
  for (const entry of perMatch[0]!.entries) {
    assert.equal(entry.rankDelta, 0);
  }

  const bobAtM2 = perMatch[1]!.entries.find((e) => e.userId === "bob")!;
  assert.equal(bobAtM2.rank, 1);
  assert.equal(bobAtM2.rankDelta, 1); // 2 -> 1 = climbed one place

  const aliceAtM2 = perMatch[1]!.entries.find((e) => e.userId === "alice")!;
  assert.equal(aliceAtM2.rank, 2);
  assert.equal(aliceAtM2.rankDelta, -1); // 1 -> 2 = dropped
  assert.equal(aliceAtM2.matchPoints, 0); // no prediction for m2
});

test("per-day grouping snapshots standings at the last match of each UTC day", () => {
  const scores = [
    score("alice", "m1", 10, 0, false, true),
    score("bob", "m2", 12, 0, false, true),
    score("carol", "m3", 20, 0, false, true),
  ];
  const { byDay } = buildRanking([m1, m2, m3], scores, [alice, bob, carol]);

  assert.equal(byDay.length, 2);
  assert.equal(byDay[0]!.date, "2026-06-11");
  assert.deepEqual(byDay[0]!.matchIds, ["m1", "m2"]);
  // End of day 1: bob 12, alice 10, carol 0.
  assert.equal(byDay[0]!.standings[0]!.userId, "bob");
  assert.equal(byDay[0]!.standings[0]!.cumulativePoints, 12);

  assert.equal(byDay[1]!.date, "2026-06-12");
  assert.deepEqual(byDay[1]!.matchIds, ["m3"]);
  // End of day 2: carol 20, bob 12, alice 10.
  assert.equal(byDay[1]!.standings[0]!.userId, "carol");
  assert.equal(byDay[1]!.standings[0]!.cumulativePoints, 20);
});

test("performance stats summarise best/worst/climb across the tournament", () => {
  const scores = [
    score("alice", "m1", 10, 5, true, true), // 15
    score("alice", "m2", 3, 0, false, true), // 3
    score("bob", "m1", 5, 0, false, true), // 5
    score("bob", "m2", 18, 0, false, true), // 18, overtakes
  ];
  const { performance } = buildRanking([m1, m2], scores, [alice, bob]);

  const alicePerf = performance.find((p) => p.userId === "alice")!;
  assert.equal(alicePerf.bestMatchPoints, 15);
  assert.equal(alicePerf.worstMatchPoints, 3);
  assert.equal(alicePerf.exactScoreCount, 1);
  assert.equal(alicePerf.winnerCount, 2);
  assert.equal(alicePerf.currentPoints, 18);
  assert.equal(alicePerf.bestRank, 1); // led after m1

  const bobPerf = performance.find((p) => p.userId === "bob")!;
  assert.equal(bobPerf.currentPoints, 23);
  assert.equal(bobPerf.currentRank, 1);
  assert.equal(bobPerf.biggestClimb, 1); // 2 -> 1 at m2
});

test("empty case: no completed matches ranks members by joined_at with zeros", () => {
  const model = buildRanking([], [], [carol, alice, bob]);

  assert.equal(model.timeline.length, 0);
  assert.equal(model.perMatch.length, 0);
  assert.equal(model.byDay.length, 0);
  assert.deepEqual(
    model.series.map((s) => s.points.length),
    [0, 0, 0],
  );

  // Baseline standings: everyone 0, ordered by joined_at (alice, bob, carol).
  assert.deepEqual(
    model.currentStandings.map((e) => e.userId),
    ["alice", "bob", "carol"],
  );
  assert.equal(model.currentStandings[0]!.cumulativePoints, 0);

  const alicePerf = model.performance.find((p) => p.userId === "alice")!;
  assert.equal(alicePerf.currentRank, 1);
  assert.equal(alicePerf.bestMatchPoints, 0);
  assert.equal(alicePerf.worstMatchPoints, 0);
  assert.equal(alicePerf.biggestClimb, 0);
  assert.equal(alicePerf.bestRank, 1);
});

test("competition ranking: tied scores share the same rank", () => {
  const scores = [
    score("alice", "m1", 10, 0, false, true),
    score("bob", "m1", 10, 0, false, true),
  ];
  const { currentStandings } = buildRanking([m1], scores, [alice, bob, carol]);

  assert.equal(currentStandings[0]!.userId, "alice");
  assert.equal(currentStandings[0]!.rank, 1);
  assert.equal(currentStandings[1]!.userId, "bob");
  assert.equal(currentStandings[1]!.rank, 1);
  assert.equal(currentStandings[2]!.userId, "carol");
  assert.equal(currentStandings[2]!.rank, 3);
});

test("competition ranking: two-way tie skips next rank (10, 10, 8 → 1, 1, 3)", () => {
  const scores = [
    score("alice", "m1", 10, 0, false, true),
    score("bob", "m1", 10, 0, false, true),
    score("carol", "m1", 8, 0, false, true),
  ];
  const { currentStandings } = buildRanking([m1], scores, [alice, bob, carol]);

  assert.equal(currentStandings[0]!.rank, 1);
  assert.equal(currentStandings[1]!.rank, 1);
  assert.equal(currentStandings[2]!.rank, 3);
});

test("competition ranking: three-way tie gives all rank 1", () => {
  const scores = [
    score("alice", "m1", 5, 0, false, true),
    score("bob", "m1", 5, 0, false, true),
    score("carol", "m1", 5, 0, false, true),
  ];
  const { currentStandings } = buildRanking([m1], scores, [alice, bob, carol]);

  assert.equal(currentStandings[0]!.rank, 1);
  assert.equal(currentStandings[1]!.rank, 1);
  assert.equal(currentStandings[2]!.rank, 1);
});

test("competition ranking: rank delta is zero when tied after a match", () => {
  const scores = [
    // After m1: alice 10 (rank 1), bob 5 (rank 2).
    score("alice", "m1", 10, 0, false, true),
    score("bob", "m1", 5, 0, false, true),
    // m2: bob catches up. alice no prediction.
    score("bob", "m2", 5, 0, false, true),
  ];
  const { perMatch } = buildRanking([m1, m2], scores, [alice, bob]);

  const bobAtM2 = perMatch[1]!.entries.find((e) => e.userId === "bob")!;
  assert.equal(bobAtM2.rank, 1);
  assert.equal(bobAtM2.rankDelta, 1); // 2 -> 1

  const aliceAtM2 = perMatch[1]!.entries.find((e) => e.userId === "alice")!;
  assert.equal(aliceAtM2.rank, 1);
  assert.equal(aliceAtM2.rankDelta, 0); // 1 -> 1 (tied, no change)
});

test("competition ranking: tiebreaker preserves order within same rank", () => {
  const scores = [
    score("alice", "m1", 10, 0, true, true),  // alice: 10pts, 1 exact
    score("bob", "m1", 10, 0, false, true),  // bob: 10pts, 0 exact
  ];
  const { currentStandings } = buildRanking([m1], scores, [alice, bob]);

  // Alice has more exact scores, so she sorts first, but both get rank 1.
  assert.equal(currentStandings[0]!.userId, "alice");
  assert.equal(currentStandings[0]!.rank, 1);
  assert.equal(currentStandings[1]!.userId, "bob");
  assert.equal(currentStandings[1]!.rank, 1);
});
