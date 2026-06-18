import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getLocalDateKey,
  groupUpcomingByDate,
  isMatchLocked,
  splitMatchesByKickoff,
} from "./matches.ts";

test("isMatchLocked returns true once kickoff has passed and false for future matches", () => {
  const now = new Date("2026-06-11T16:00:00.000Z").getTime();

  assert.equal(isMatchLocked("2026-06-11T12:00:00.000Z", now), true);
  assert.equal(isMatchLocked("2026-06-11T20:00:00.000Z", now), false);
});

test("isMatchLocked treats the exact kickoff moment as locked (boundary is inclusive)", () => {
  const now = new Date("2026-06-11T16:00:00.000Z").getTime();

  assert.equal(isMatchLocked("2026-06-11T16:00:00.000Z", now), true);
});

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

test("getLocalDateKey returns the date in the given timezone (cross-midnight)", () => {
  // 02:00 UTC is still the previous calendar day in America/Sao_Paulo (UTC-3).
  assert.equal(
    getLocalDateKey("2026-06-15T02:00:00.000Z", "America/Sao_Paulo"),
    "2026-06-14",
  );
  assert.equal(getLocalDateKey("2026-06-15T02:00:00.000Z", "UTC"), "2026-06-15");
});

test("getLocalDateKey keeps a late-night BRT kickoff on the local day (issue #64)", () => {
  // 19/06 21:30 GMT-3 = 20/06 00:30 UTC. UTC grouping would place this on
  // 20/06, but America/Sao_Paulo keeps it on 19/06 — the day a Brazil-based
  // user sees the kickoff.
  assert.equal(
    getLocalDateKey("2026-06-20T00:30:00.000Z", "America/Sao_Paulo"),
    "2026-06-19",
  );
  assert.equal(getLocalDateKey("2026-06-20T00:30:00.000Z", "UTC"), "2026-06-20");
});

test("groupUpcomingByDate buckets same-date matches and sorts ascending", () => {
  const matches = [
    { id: "b", kickoff_utc: "2026-06-15T20:00:00.000Z" },
    { id: "a1", kickoff_utc: "2026-06-14T13:00:00.000Z" },
    { id: "a2", kickoff_utc: "2026-06-14T19:00:00.000Z" },
  ];

  const groups = groupUpcomingByDate(matches, "UTC", "en-US");

  assert.deepEqual(
    groups.map((group) => group.dateKey),
    ["2026-06-14", "2026-06-15"],
  );
  assert.deepEqual(
    groups[0].matches.map((match) => match.id),
    ["a1", "a2"],
  );
  assert.deepEqual(
    groups[1].matches.map((match) => match.id),
    ["b"],
  );
});

test("groupUpcomingByDate with app timezone buckets cross-midnight matches on the local day (issue #64)", () => {
  // 21:30 GMT-3 on 19/06 (00:30 UTC on 20/06) and 12:00 GMT-3 on 19/06 both
  // fall on 19/06 in America/Sao_Paulo. With UTC they split across 19/06 and
  // 20/06 — the bug from issue #64.
  const matches = [
    { id: "noon", kickoff_utc: "2026-06-19T15:00:00.000Z" },
    { id: "late", kickoff_utc: "2026-06-20T00:30:00.000Z" },
  ];

  const groups = groupUpcomingByDate(matches, "America/Sao_Paulo", "pt-BR");

  assert.deepEqual(
    groups.map((group) => group.dateKey),
    ["2026-06-19"],
  );
  assert.deepEqual(
    groups[0].matches.map((match) => match.id),
    ["noon", "late"],
  );

  // Contrast: with UTC the late match lands on 20/06 (the bug).
  const utcGroups = groupUpcomingByDate(matches, "UTC", "pt-BR");
  assert.deepEqual(
    utcGroups.map((group) => group.dateKey),
    ["2026-06-19", "2026-06-20"],
  );
});

test("groupUpcomingByDate handles empty input", () => {
  assert.deepEqual(groupUpcomingByDate([], "UTC", "en-US"), []);
});

test("groupUpcomingByDate handles a single date", () => {
  const matches = [
    { id: "a", kickoff_utc: "2026-06-14T13:00:00.000Z" },
    { id: "b", kickoff_utc: "2026-06-14T19:00:00.000Z" },
  ];

  const groups = groupUpcomingByDate(matches, "UTC", "en-US");

  assert.equal(groups.length, 1);
  assert.equal(groups[0].dateKey, "2026-06-14");
  assert.deepEqual(
    groups[0].matches.map((match) => match.id),
    ["a", "b"],
  );
});
