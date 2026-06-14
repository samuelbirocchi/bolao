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
    ["starting-now", "earlier-today"],
  );
  assert.deepEqual(
    grouped.upcomingMatches.map((match) => match.id),
    ["later-today"],
  );
});

test("splitMatchesByKickoff sorts past matches by kickoff descending (newest first)", () => {
  const now = new Date("2026-06-14T12:00:00.000Z").getTime();
  const matches = [
    { id: "day1", kickoff_utc: "2026-06-10T20:00:00.000Z" },
    { id: "day2", kickoff_utc: "2026-06-11T16:00:00.000Z" },
    { id: "day3", kickoff_utc: "2026-06-12T20:00:00.000Z" },
    { id: "day4", kickoff_utc: "2026-06-13T16:00:00.000Z" },
    { id: "day5", kickoff_utc: "2026-06-14T20:00:00.000Z" },
  ];

  const grouped = splitMatchesByKickoff(matches, now);

  assert.deepEqual(
    grouped.pastMatches.map((match) => match.id),
    ["day4", "day3", "day2", "day1"],
  );
  assert.deepEqual(
    grouped.upcomingMatches.map((match) => match.id),
    ["day5"],
  );
});
