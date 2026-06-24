import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCompletedResultRows } from "./syncRows.ts";
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
