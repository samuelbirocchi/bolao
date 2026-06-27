import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchWc2026Matches } from "./schedule/wc2026.ts";

const originalFetch = globalThis.fetch;

type TeamInput = {
  name: string;
  active?: boolean;
  score?: string;
  shootoutScore?: string;
};

function competitor(homeAway: "home" | "away", team: TeamInput) {
  return {
    homeAway,
    score: team.score ?? "0",
    shootoutScore: team.shootoutScore,
    team: {
      displayName: team.name,
      isActive: team.active ?? true,
    },
  };
}

function event({
  id,
  home,
  away,
  state = "pre",
  completed = false,
  statusName = "STATUS_SCHEDULED",
  period,
}: {
  id: string;
  home: TeamInput;
  away: TeamInput;
  state?: "pre" | "in" | "post";
  completed?: boolean;
  statusName?: string;
  period?: number;
}) {
  const status = {
    period,
    type: {
      state,
      completed,
      name: statusName,
      detail: completed ? "Full Time" : "Scheduled",
      shortDetail: completed ? "FT" : "Scheduled",
    },
  };

  return {
    id,
    date: "2026-06-11T19:00Z",
    season: { slug: "group-stage" },
    status,
    competitions: [
      {
        status,
        competitors: [competitor("home", home), competitor("away", away)],
        venue: { fullName: "Estadio Azteca" },
        altGameNote: "FIFA World Cup, Group A",
      },
    ],
  };
}

function mockScoreboard(events: unknown[], status = 200) {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(JSON.stringify({ events }), {
      status,
      headers: { "content-type": "application/json" },
    });
  };

  return {
    requestedUrl: () => requestedUrl,
    requestedInit: () => requestedInit,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchWc2026Matches maps ESPN fixtures to stable official match numbers", async () => {
  const request = mockScoreboard([
    event({
      id: "760415",
      home: { name: "Mexico" },
      away: { name: "South Africa" },
    }),
  ]);

  const [match] = await fetchWc2026Matches();

  assert.equal(match.matchNumber, 1);
  assert.equal(match.round, "group-stage");
  assert.equal(match.groupName, "A");
  assert.equal(match.homeTeamName, "Mexico");
  assert.equal(match.awayTeamName, "South Africa");
  assert.equal(match.stadium, "Estadio Azteca");
  assert.equal(match.status, "scheduled");
  assert.equal(match.resultHomeGoals, null);
  assert.equal(match.resultAwayGoals, null);
  assert.match(request.requestedUrl(), /dates=20260611-20260719/);
  assert.match(request.requestedUrl(), /limit=200/);
  assert.equal(request.requestedInit()?.headers, undefined);
});

test("fetchWc2026Matches separates unresolved knockout placeholders from teams", async () => {
  mockScoreboard([
    event({
      id: "760495",
      home: { name: "Group L Winner", active: false },
      away: { name: "Third Place Group E/H/I/J/K", active: false },
    }),
  ]);

  const [match] = await fetchWc2026Matches();

  assert.equal(match.matchNumber, 80);
  assert.equal(match.homeTeamName, null);
  assert.equal(match.homeTeamPlaceholder, "Group L Winner");
  assert.equal(match.awayTeamName, null);
  assert.equal(match.awayTeamPlaceholder, "Third Place Group E/H/I/J/K");
});

test("fetchWc2026Matches maps live scores and penalty shootouts", async () => {
  mockScoreboard([
    event({
      id: "760502",
      home: { name: "Brazil", score: "1", shootoutScore: "4" },
      away: { name: "Mexico", score: "1", shootoutScore: "3" },
      state: "post",
      completed: true,
      statusName: "STATUS_FULL_TIME",
      period: 5,
    }),
    event({
      id: "760486",
      home: { name: "South Africa", score: "2" },
      away: { name: "Canada", score: "1" },
      state: "in",
      statusName: "STATUS_IN_PROGRESS",
      period: 2,
    }),
  ]);

  const [live, completed] = await fetchWc2026Matches();

  assert.equal(live.matchNumber, 73);
  assert.equal(live.status, "live");
  assert.equal(live.resultHomeGoals, 2);
  assert.equal(live.resultAwayGoals, 1);
  assert.equal(completed.matchNumber, 90);
  assert.equal(completed.status, "completed");
  assert.equal(completed.resultHomeGoals, 1);
  assert.equal(completed.resultAwayGoals, 1);
  assert.equal(completed.resultHomePenalties, 4);
  assert.equal(completed.resultAwayPenalties, 3);
  assert.equal(completed.resultResolution, "penalties");
});

test("fetchWc2026Matches fails closed for an unknown ESPN event", async () => {
  mockScoreboard([
    event({
      id: "999999",
      home: { name: "Mexico" },
      away: { name: "South Africa" },
    }),
  ]);

  await assert.rejects(fetchWc2026Matches(), /unknown WC2026 event id: 999999/);
});

test("fetchWc2026Matches reports ESPN HTTP failures", async () => {
  mockScoreboard([], 503);

  await assert.rejects(fetchWc2026Matches(), /ESPN WC2026 scoreboard returned 503/);
});

test("fetchWc2026Matches rejects an empty scoreboard", async () => {
  mockScoreboard([]);

  await assert.rejects(fetchWc2026Matches(), /scoreboard returned no events/);
});
