import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOddsSnapshots } from "./odds.ts";

const kickoff = "2026-06-11T20:00:00Z";

test("buildOddsSnapshots maps odds when teams are in the same home/away order", () => {
  const result = buildOddsSnapshots(
    [
      {
        id: "match-1",
        home_team_name: "Brazil",
        away_team_name: "Argentina",
        kickoff_utc: kickoff,
      },
    ],
    [
      {
        id: "event-1",
        home_team: "Brazil",
        away_team: "Argentina",
        commence_time: kickoff,
        bookmakers: [
          {
            key: "book",
            title: "Book",
            last_update: kickoff,
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Brazil", price: 2 },
                  { name: "Draw", price: 4 },
                  { name: "Argentina", price: 4 },
                ],
              },
            ],
          },
        ],
      },
    ],
  );

  const [snapshot] = result.snapshots;
  assert.ok(snapshot);
  assert.equal(snapshot.homeWinProbability, 0.5);
  assert.equal(snapshot.drawProbability, 0.25);
  assert.equal(snapshot.awayWinProbability, 0.25);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.unmatchedMatches.length, 0);
});

test("buildOddsSnapshots swaps probabilities when odds event home/away is reversed", () => {
  const result = buildOddsSnapshots(
    [
      {
        id: "match-1",
        home_team_name: "Brazil",
        away_team_name: "Argentina",
        kickoff_utc: kickoff,
      },
    ],
    [
      {
        id: "event-1",
        home_team: "Argentina",
        away_team: "Brazil",
        commence_time: kickoff,
        bookmakers: [
          {
            key: "book",
            title: "Book",
            last_update: kickoff,
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Argentina", price: 4 },
                  { name: "Draw", price: 4 },
                  { name: "Brazil", price: 2 },
                ],
              },
            ],
          },
        ],
      },
    ],
  );

  const [snapshot] = result.snapshots;
  assert.ok(snapshot);
  assert.equal(snapshot.homeWinProbability, 0.5);
  assert.equal(snapshot.drawProbability, 0.25);
  assert.equal(snapshot.awayWinProbability, 0.25);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.unmatchedMatches.length, 0);
});

test("buildOddsSnapshots matches teams via aliases (USA vs United States)", () => {
  const result = buildOddsSnapshots(
    [
      {
        id: "match-1",
        home_team_name: "United States",
        away_team_name: "England",
        kickoff_utc: kickoff,
      },
    ],
    [
      {
        id: "event-1",
        home_team: "USA",
        away_team: "England",
        commence_time: kickoff,
        bookmakers: [
          {
            key: "book",
            title: "Book",
            last_update: kickoff,
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "USA", price: 3 },
                  { name: "Draw", price: 3 },
                  { name: "England", price: 2.5 },
                ],
              },
            ],
          },
        ],
      },
    ],
  );

  const [snapshot] = result.snapshots;
  assert.ok(snapshot);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.unmatchedMatches.length, 0);
});

test("buildOddsSnapshots matches teams via Korea Republic alias", () => {
  const result = buildOddsSnapshots(
    [
      {
        id: "match-1",
        home_team_name: "South Korea",
        away_team_name: "Brazil",
        kickoff_utc: kickoff,
      },
    ],
    [
      {
        id: "event-1",
        home_team: "Korea Republic",
        away_team: "Brazil",
        commence_time: kickoff,
        bookmakers: [
          {
            key: "book",
            title: "Book",
            last_update: kickoff,
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Korea Republic", price: 4 },
                  { name: "Draw", price: 3.5 },
                  { name: "Brazil", price: 2 },
                ],
              },
            ],
          },
        ],
      },
    ],
  );

  const [snapshot] = result.snapshots;
  assert.ok(snapshot);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.unmatchedMatches.length, 0);
});

test("buildOddsSnapshots matches Bosnia-Herzegovina via alias", () => {
  const result = buildOddsSnapshots(
    [
      {
        id: "match-81",
        home_team_name: "United States",
        away_team_name: "Bosnia-Herzegovina",
        kickoff_utc: kickoff,
      },
    ],
    [
      {
        id: "event-81",
        home_team: "USA",
        away_team: "Bosnia & Herzegovina",
        commence_time: kickoff,
        bookmakers: [
          {
            key: "book",
            title: "Book",
            last_update: kickoff,
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "USA", price: 1.5 },
                  { name: "Draw", price: 4 },
                  { name: "Bosnia & Herzegovina", price: 8 },
                ],
              },
            ],
          },
        ],
      },
    ],
  );

  assert.equal(result.matchedCount, 1);
  assert.equal(result.unmatchedMatches.length, 0);
  assert.equal(result.unmatchedEvents.length, 0);
});

test("buildOddsSnapshots reports unmatched matches and events", () => {
  const result = buildOddsSnapshots(
    [
      {
        id: "match-1",
        home_team_name: "Brazil",
        away_team_name: "Argentina",
        kickoff_utc: kickoff,
      },
      {
        id: "match-2",
        home_team_name: "Japan",
        away_team_name: "Germany",
        kickoff_utc: kickoff,
      },
    ],
    [
      {
        id: "event-1",
        home_team: "Brazil",
        away_team: "Argentina",
        commence_time: kickoff,
        bookmakers: [
          {
            key: "book",
            title: "Book",
            last_update: kickoff,
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Brazil", price: 2 },
                  { name: "Draw", price: 4 },
                  { name: "Argentina", price: 4 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "event-2",
        home_team: "Italy",
        away_team: "Spain",
        commence_time: kickoff,
        bookmakers: [
          {
            key: "book",
            title: "Book",
            last_update: kickoff,
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Italy", price: 2.5 },
                  { name: "Draw", price: 3 },
                  { name: "Spain", price: 3 },
                ],
              },
            ],
          },
        ],
      },
    ],
  );

  assert.equal(result.matchedCount, 1);
  assert.equal(result.unmatchedMatches.length, 1);
  assert.equal(result.unmatchedMatches[0].matchId, "match-2");
  assert.equal(result.unmatchedMatches[0].homeTeam, "Japan");
  assert.equal(result.unmatchedEvents.length, 1);
  assert.equal(result.unmatchedEvents[0].eventId, "event-2");
  assert.equal(result.unmatchedEvents[0].homeTeam, "Italy");
});
