import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchWc2026Matches } from "./schedule/wc2026.ts";

const originalApiKey = process.env.WC2026_API_KEY;
const originalBaseUrl = process.env.WC2026_API_BASE_URL;
const originalFetch = globalThis.fetch;

function restoreEnv(name: "WC2026_API_KEY" | "WC2026_API_BASE_URL", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function mockMatchesResponse(payload: unknown) {
  process.env.WC2026_API_KEY = "test-key";
  process.env.WC2026_API_BASE_URL = "https://wc2026.example";
  globalThis.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

afterEach(() => {
  restoreEnv("WC2026_API_KEY", originalApiKey);
  restoreEnv("WC2026_API_BASE_URL", originalBaseUrl);
  globalThis.fetch = originalFetch;
});

test("fetchWc2026Matches prefers final goals over stale score fields", async () => {
  mockMatchesResponse([
    {
      id: 2,
      round: "group",
      home_team: "Brazil",
      away_team: "Serbia",
      kickoff_utc: "2026-06-13T20:00:00Z",
      status: "completed",
      home_score: 0,
      away_score: 1,
      home_goals: 2,
      away_goals: 1,
    },
  ]);

  const [match] = await fetchWc2026Matches();

  assert.equal(match.resultHomeGoals, 2);
  assert.equal(match.resultAwayGoals, 1);
});

test("fetchWc2026Matches falls back to score fields when final goals are missing", async () => {
  mockMatchesResponse([
    {
      id: 3,
      round: "group",
      home_team: "Mexico",
      away_team: "Canada",
      kickoff_utc: "2026-06-14T20:00:00Z",
      status: "completed",
      home_score: 1,
      away_score: 0,
    },
  ]);

  const [match] = await fetchWc2026Matches();

  assert.equal(match.resultHomeGoals, 1);
  assert.equal(match.resultAwayGoals, 0);
});
