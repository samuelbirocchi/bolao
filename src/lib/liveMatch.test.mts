import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLiveMatchView } from "./liveMatch.ts";
import type { RankingMatch, RankingMember, RankingScore } from "./ranking.ts";
import { calculateBasePoints, defaultScoreWeights } from "./scoring.ts";

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
    correct_draw: false,
  };
}

test("buildLiveMatchView scores closed-match picks and rank movement against pre-game ranking", () => {
  const view = buildLiveMatchView({
    currentMatch: match("m2", 2, "2026-06-11T20:00:00Z"),
    currentUserId: "bob",
    members: [alice, bob, carol],
    predictions: [
      { user_id: "alice", home_goals: 2, away_goals: 1 },
      { user_id: "bob", home_goals: 1, away_goals: 1 },
      { user_id: "carol", home_goals: 0, away_goals: 2 },
    ],
    previousMatches: [match("m1", 1, "2026-06-11T16:00:00Z")],
    previousScores: [
      // alice leads pre-m2 at 27; bob trails at 5. After m2's correct draw bob
      // earns base(0.3)+exact = 22, landing on 27 — a genuine tie with alice.
      score("alice", "m1", 27, 0, false, true),
      score("bob", "m1", 5, 0, false, true),
    ],
    probabilities: {
      homeWinProbability: 0.5,
      drawProbability: 0.3,
      awayWinProbability: 0.5,
    },
    result: { homeGoals: 1, awayGoals: 1, resolution: "regular" },
    weights: defaultScoreWeights,
  });

  assert.deepEqual(view.distribution, { home: 1, draw: 1, away: 1 });
  assert.equal(view.hasOfficialScore, true);

  const bobEntry = view.participants.find((participant) => participant.userId === "bob")!;
  assert.equal(
    bobEntry.points,
    calculateBasePoints(0.3, defaultScoreWeights) + defaultScoreWeights.exactScoreBonusPoints,
  );
  assert.deepEqual(bobEntry.criteria, ["correctDraw", "exactScore"]);
  assert.equal(bobEntry.preMatchRank, 2);
  assert.equal(bobEntry.liveRank, 1);
  assert.equal(bobEntry.rankDelta, 1);
  assert.deepEqual(view.currentUserMovement, {
    preMatchRank: 2,
    liveRank: 1,
    rankDelta: 1,
  });

  const aliceEntry = view.participants.find((participant) => participant.userId === "alice")!;
  assert.equal(aliceEntry.points, 0);
  assert.equal(aliceEntry.rankDelta, 0); // tied with bob after m2, no rank change
});

test("buildLiveMatchView opens the closed-match view before the first official score", () => {
  const view = buildLiveMatchView({
    currentMatch: match("m1", 1, "2026-06-11T16:00:00Z"),
    currentUserId: "alice",
    members: [alice, bob],
    predictions: [
      { user_id: "alice", home_goals: 2, away_goals: 0 },
      { user_id: "bob", home_goals: 1, away_goals: 1 },
    ],
    previousMatches: [],
    previousScores: [],
    probabilities: null,
    result: null,
    weights: defaultScoreWeights,
  });

  assert.equal(view.hasOfficialScore, false);
  assert.deepEqual(view.distribution, { home: 1, draw: 1, away: 0 });
  assert.deepEqual(
    view.participants.map((participant) => ({
      userId: participant.userId,
      points: participant.points,
      criteria: participant.criteria,
    })),
    [
      { userId: "alice", points: 0, criteria: [] },
      { userId: "bob", points: 0, criteria: [] },
    ],
  );
});
