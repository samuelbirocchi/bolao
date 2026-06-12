import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPostMatchSyncCandidate,
  selectPostMatchSyncCandidates,
} from "./schedule/postmatch.ts";
import type { ExternalMatch } from "./schedule/types.ts";

function match(overrides: Partial<ExternalMatch>): ExternalMatch {
  return {
    matchNumber: 1,
    round: "group",
    groupName: "A",
    homeTeamName: "Home",
    awayTeamName: "Away",
    homeTeamPlaceholder: null,
    awayTeamPlaceholder: null,
    stadium: null,
    kickoffUtc: "2026-06-12T15:00:00.000Z",
    status: "scheduled",
    phase: null,
    resultHomeGoals: null,
    resultAwayGoals: null,
    resultHomePenalties: null,
    resultAwayPenalties: null,
    resultResolution: "regular",
    ...overrides,
  };
}

test("post-match sync selects recently completed matches with results", () => {
  const now = new Date("2026-06-12T18:00:00.000Z");
  const selected = isPostMatchSyncCandidate(
    match({
      status: "completed",
      resultHomeGoals: 2,
      resultAwayGoals: 1,
    }),
    now,
  );

  assert.equal(selected, true);
});

test("post-match sync keeps old completed matches out of the cron window", () => {
  const now = new Date("2026-06-13T12:00:00.000Z");
  const selected = isPostMatchSyncCandidate(
    match({
      status: "completed",
      kickoffUtc: "2026-06-12T15:00:00.000Z",
      resultHomeGoals: 2,
      resultAwayGoals: 1,
    }),
    now,
  );

  assert.equal(selected, false);
});

test("post-match sync includes live matches but not unrelated scheduled fixtures", () => {
  const now = new Date("2026-06-12T18:00:00.000Z");
  const matches = [
    match({ matchNumber: 1, status: "live" }),
    match({ matchNumber: 2, status: "scheduled" }),
    match({
      matchNumber: 3,
      status: "scheduled",
      resultHomeGoals: 0,
      resultAwayGoals: 0,
    }),
  ];

  assert.deepEqual(
    selectPostMatchSyncCandidates(matches, now).map((candidate) => candidate.matchNumber),
    [1, 3],
  );
});
