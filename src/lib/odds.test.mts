import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOddsSnapshots } from "./odds.ts";

const kickoff = "2026-06-11T20:00:00Z";

test("buildOddsSnapshots maps odds when teams are in the same home/away order", () => {
  const [snapshot] = buildOddsSnapshots(
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

  assert.ok(snapshot);
  assert.equal(snapshot.homeWinProbability, 0.5);
  assert.equal(snapshot.drawProbability, 0.25);
  assert.equal(snapshot.awayWinProbability, 0.25);
});

test("buildOddsSnapshots swaps probabilities when odds event home/away is reversed", () => {
  const [snapshot] = buildOddsSnapshots(
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

  assert.ok(snapshot);
  assert.equal(snapshot.homeWinProbability, 0.5);
  assert.equal(snapshot.drawProbability, 0.25);
  assert.equal(snapshot.awayWinProbability, 0.25);
});
