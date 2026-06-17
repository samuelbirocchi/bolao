import assert from "node:assert/strict";
import { test } from "node:test";
import {
  splitMatchesByKickoff,
  getMatchDateKey,
  getUniqueMatchDates,
  filterMatchesByDate,
  formatMatchDateKey,
} from "./matches.ts";

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

test("splitMatchesByKickoff sorts upcoming matches by kickoff ascending (earliest first)", () => {
  const now = new Date("2026-06-14T12:00:00.000Z").getTime();
  const matches = [
    { id: "late", kickoff_utc: "2026-06-20T20:00:00.000Z" },
    { id: "early", kickoff_utc: "2026-06-14T20:00:00.000Z" },
    { id: "mid", kickoff_utc: "2026-06-17T16:00:00.000Z" },
  ];

  const grouped = splitMatchesByKickoff(matches, now);

  assert.deepEqual(
    grouped.upcomingMatches.map((match) => match.id),
    ["early", "mid", "late"],
  );
});

test("getMatchDateKey extracts YYYY-MM-DD from an ISO string", () => {
  assert.equal(getMatchDateKey("2026-06-14T20:00:00.000Z"), "2026-06-14");
  assert.equal(getMatchDateKey("2026-06-01T01:30:00.000Z"), "2026-06-01");
});

test("getUniqueMatchDates returns sorted unique date keys", () => {
  const matches = [
    { id: "a", kickoff_utc: "2026-06-15T20:00:00.000Z" },
    { id: "b", kickoff_utc: "2026-06-14T16:00:00.000Z" },
    { id: "c", kickoff_utc: "2026-06-14T20:00:00.000Z" },
    { id: "d", kickoff_utc: "2026-06-16T12:00:00.000Z" },
  ];

  assert.deepEqual(getUniqueMatchDates(matches), [
    "2026-06-14",
    "2026-06-15",
    "2026-06-16",
  ]);
});

test("filterMatchesByDate keeps only matches on the given date", () => {
  const matches = [
    { id: "a", kickoff_utc: "2026-06-15T20:00:00.000Z" },
    { id: "b", kickoff_utc: "2026-06-14T16:00:00.000Z" },
    { id: "c", kickoff_utc: "2026-06-14T20:00:00.000Z" },
  ];

  const filtered = filterMatchesByDate(matches, "2026-06-14");
  assert.deepEqual(filtered.map((m) => m.id), ["b", "c"]);
});

test("formatMatchDateKey formats a date key for display", () => {
  assert.equal(formatMatchDateKey("2026-06-14", "en"), "Jun 14");
  assert.equal(formatMatchDateKey("2026-06-14", "pt-BR"), "14 de jun.");
  assert.equal(formatMatchDateKey("2026-06-14", "es"), "14 jun");
});
