import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCompletedResultRows, buildMatchRows } from "./syncRows.ts";
import { selectPostMatchSyncCandidates } from "./postmatch.ts";
import type { ExternalMatch } from "./types.ts";

function externalMatch(overrides: Partial<ExternalMatch> = {}): ExternalMatch {
  return {
    matchNumber: 1,
    round: "Group stage",
    groupName: "A",
    homeTeamName: "Brazil",
    awayTeamName: "Argentina",
    homeTeamPlaceholder: null,
    awayTeamPlaceholder: null,
    stadium: "Maracanã",
    kickoffUtc: "2026-06-23T18:00:00.000Z",
    status: "completed",
    phase: null,
    resultHomeGoals: 2,
    resultAwayGoals: 1,
    resultHomePenalties: null,
    resultAwayPenalties: null,
    resultResolution: "regular",
    ...overrides,
  };
}

test("buildCompletedResultRows writes results for completed matches", () => {
  const matchIdByNumber = new Map([[1, "match-1"]]);
  const rows = buildCompletedResultRows([externalMatch()], matchIdByNumber, null);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].match_id, "match-1");
  assert.equal(rows[0].home_goals, 2);
  assert.equal(rows[0].away_goals, 1);
});

test("buildCompletedResultRows skips live matches even when goals are present", () => {
  const matchIdByNumber = new Map([[1, "match-1"]]);
  const rows = buildCompletedResultRows(
    [externalMatch({ status: "live", resultHomeGoals: 1, resultAwayGoals: 0 })],
    matchIdByNumber,
    null,
  );

  assert.equal(rows.length, 0);
});

test("buildCompletedResultRows skips completed matches without goals", () => {
  const matchIdByNumber = new Map([[1, "match-1"]]);
  const rows = buildCompletedResultRows(
    [externalMatch({ status: "completed", resultHomeGoals: null, resultAwayGoals: null })],
    matchIdByNumber,
    null,
  );

  assert.equal(rows.length, 0);
});

test("buildMatchRows resolves knockout placeholder teams when names are unknown", () => {
  const rows = buildMatchRows([
    externalMatch({
      matchNumber: 73,
      round: "Round of 32",
      groupName: null,
      homeTeamName: null,
      awayTeamName: null,
      homeTeamPlaceholder: "Winner Group A",
      awayTeamPlaceholder: "Runner-up Group B",
      status: "scheduled",
      resultHomeGoals: null,
      resultAwayGoals: null,
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].home_team_name, "Winner Group A");
  assert.equal(rows[0].away_team_name, "Runner-up Group B");
  assert.equal(rows[0].home_team_placeholder, "Winner Group A");
  assert.equal(rows[0].away_team_placeholder, "Runner-up Group B");
});

test("scheduled sync syncs all match rows but only recent results", () => {
  const now = new Date("2026-06-23T20:00:00.000Z");
  const recentlyCompleted = externalMatch({
    matchNumber: 40,
    status: "completed",
    kickoffUtc: "2026-06-23T18:00:00.000Z",
  });
  const upcomingKnockout = externalMatch({
    matchNumber: 73,
    round: "Round of 32",
    groupName: null,
    homeTeamName: null,
    awayTeamName: null,
    homeTeamPlaceholder: "Winner Group A",
    awayTeamPlaceholder: "Runner-up Group B",
    status: "scheduled",
    kickoffUtc: "2026-06-30T18:00:00.000Z",
    resultHomeGoals: null,
    resultAwayGoals: null,
  });
  const externalMatches = [recentlyCompleted, upcomingKnockout];

  // Mirrors syncExternalMatches: schedule rows cover every match, results only
  // the post-match candidates.
  const resultMatches = selectPostMatchSyncCandidates(externalMatches, now);
  const matchRows = buildMatchRows(externalMatches);
  const matchIdByNumber = new Map([
    [40, "match-40"],
    [73, "match-73"],
  ]);
  const resultRows = buildCompletedResultRows(resultMatches, matchIdByNumber, null);

  assert.equal(matchRows.length, 2);
  assert.deepEqual(
    resultRows.map((row) => row.match_id),
    ["match-40"],
  );
});
