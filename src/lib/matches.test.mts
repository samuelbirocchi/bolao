import assert from "node:assert/strict";
import { test } from "node:test";
import { splitMatchesByKickoff } from "./matches.ts";

test("splitMatchesByKickoff groups started matches separately from upcoming matches", () => {
  const now = new Date("2026-06-11T16:00:00.000Z").getTime();
  const matches = [
    { id: "earlier-today", kickoff_utc: "2026-06-11T12:00:00.000Z" },
    { id: "starting-now", kickoff_utc: "2026-06-11T16:00:00.000Z" },
    { id: "later-today", kickoff_utc: "2026-06-11T20:00:00.000Z" },
  ];

  const grouped = splitMatchesByKickoff(matches, now);

  assert.deepEqual(
    grouped.pastMatches.map((match) => match.id),
    ["earlier-today", "starting-now"],
  );
  assert.deepEqual(
    grouped.upcomingMatches.map((match) => match.id),
    ["later-today"],
  );
});
