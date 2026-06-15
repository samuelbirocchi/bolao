import { canonicalTeamName } from "./teamFlags.ts";
import type { OutcomeProbabilities } from "@/lib/scoring";

const DEFAULT_ODDS_API_BASE_URL = "https://api.the-odds-api.com";
const DEFAULT_ODDS_API_REGIONS = "eu";
const WORLD_CUP_SPORT_KEY = "soccer_fifa_world_cup";

type OddsOutcome = {
  name: string;
  price: number;
};

type OddsMarket = {
  key: string;
  outcomes?: OddsOutcome[];
};

type OddsBookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets?: OddsMarket[];
};

export type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsBookmaker[];
};

export type MatchForOdds = {
  id: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_utc: string;
};

export type OddsSnapshot = OutcomeProbabilities & {
  matchId: string;
  oddsEventId: string;
  source: string;
  bookmakerCount: number;
  capturedAt: string;
};

export type OddsSyncResult = {
  snapshots: OddsSnapshot[];
  matchedCount: number;
  unmatchedMatches: Array<{ matchId: string; homeTeam: string; awayTeam: string }>;
  unmatchedEvents: Array<{ eventId: string; homeTeam: string; awayTeam: string }>;
};

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(the|men|women|national|team)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchTeamName(name: string): string {
  return canonicalTeamName(name);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function isDrawOutcome(name: string) {
  const normalized = normalizeName(name);
  return normalized === "draw" || normalized === "tie";
}

function calculateFairProbabilities(
  outcomes: OddsOutcome[],
  homeTeam: string,
  awayTeam: string,
): OutcomeProbabilities | null {
  const homeName = matchTeamName(homeTeam);
  const awayName = matchTeamName(awayTeam);
  const home = outcomes.find((outcome) => matchTeamName(outcome.name) === homeName);
  const away = outcomes.find((outcome) => matchTeamName(outcome.name) === awayName);
  const draw = outcomes.find((outcome) => isDrawOutcome(outcome.name));

  if (!home || !away || home.price <= 1 || away.price <= 1) {
    return null;
  }

  const implied = {
    home: 1 / home.price,
    draw: draw && draw.price > 1 ? 1 / draw.price : null,
    away: 1 / away.price,
  };
  const total = implied.home + implied.away + (implied.draw ?? 0);

  if (total <= 0) {
    return null;
  }

  return {
    homeWinProbability: implied.home / total,
    drawProbability: implied.draw === null ? null : implied.draw / total,
    awayWinProbability: implied.away / total,
  };
}

export function aggregateEventProbabilities(event: OddsEvent) {
  const homeProbabilities: number[] = [];
  const drawProbabilities: number[] = [];
  const awayProbabilities: number[] = [];

  for (const bookmaker of event.bookmakers ?? []) {
    const h2h = bookmaker.markets?.find((market) => market.key === "h2h");
    const probabilities = h2h?.outcomes
      ? calculateFairProbabilities(h2h.outcomes, event.home_team, event.away_team)
      : null;

    if (!probabilities) {
      continue;
    }

    homeProbabilities.push(probabilities.homeWinProbability ?? 0);
    awayProbabilities.push(probabilities.awayWinProbability ?? 0);

    if (probabilities.drawProbability !== null) {
      drawProbabilities.push(probabilities.drawProbability);
    }
  }

  if (homeProbabilities.length === 0 || awayProbabilities.length === 0) {
    return null;
  }

  return {
    homeWinProbability: median(homeProbabilities),
    drawProbability: median(drawProbabilities),
    awayWinProbability: median(awayProbabilities),
    bookmakerCount: homeProbabilities.length,
  };
}

type MatchedOddsEvent = {
  event: OddsEvent;
  reversed: boolean;
};

function findMatchingEvent(match: MatchForOdds, events: OddsEvent[]): MatchedOddsEvent | null {
  const homeName = matchTeamName(match.home_team_name);
  const awayName = matchTeamName(match.away_team_name);
  const kickoffTime = new Date(match.kickoff_utc).getTime();

  for (const event of events) {
    const eventHomeName = matchTeamName(event.home_team);
    const eventAwayName = matchTeamName(event.away_team);
    const eventTime = new Date(event.commence_time).getTime();
    const withinOneDay = Math.abs(eventTime - kickoffTime) <= 24 * 60 * 60 * 1000;

    if (!withinOneDay) {
      continue;
    }

    if (eventHomeName === homeName && eventAwayName === awayName) {
      return { event, reversed: false };
    }

    if (eventHomeName === awayName && eventAwayName === homeName) {
      return { event, reversed: true };
    }
  }

  return null;
}

export function buildOddsSnapshots(
  matches: MatchForOdds[],
  events: OddsEvent[],
): OddsSyncResult {
  const capturedAt = new Date().toISOString();
  const matchedEventIds = new Set<string>();
  const unmatchedMatches: OddsSyncResult["unmatchedMatches"] = [];
  const snapshots: OddsSnapshot[] = [];

  for (const match of matches) {
    const matchEvent = findMatchingEvent(match, events);

    if (!matchEvent) {
      unmatchedMatches.push({
        matchId: match.id,
        homeTeam: match.home_team_name,
        awayTeam: match.away_team_name,
      });
      continue;
    }

    matchedEventIds.add(matchEvent.event.id);

    const probabilities = aggregateEventProbabilities(matchEvent.event);
    if (!probabilities) {
      unmatchedMatches.push({
        matchId: match.id,
        homeTeam: match.home_team_name,
        awayTeam: match.away_team_name,
      });
      continue;
    }

    const homeWinProbability = matchEvent.reversed
      ? probabilities.awayWinProbability
      : probabilities.homeWinProbability;
    const awayWinProbability = matchEvent.reversed
      ? probabilities.homeWinProbability
      : probabilities.awayWinProbability;

    snapshots.push({
      matchId: match.id,
      oddsEventId: matchEvent.event.id,
      source: "the-odds-api",
      bookmakerCount: probabilities.bookmakerCount,
      capturedAt,
      homeWinProbability,
      drawProbability: probabilities.drawProbability,
      awayWinProbability,
    });
  }

  const unmatchedEvents = events
    .filter((event) => !matchedEventIds.has(event.id))
    .map((event) => ({
      eventId: event.id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
    }));

  return {
    snapshots,
    matchedCount: snapshots.length,
    unmatchedMatches,
    unmatchedEvents,
  };
}

export async function fetchWorldCupOdds(): Promise<OddsEvent[]> {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    throw new Error("ODDS_API_KEY is not configured.");
  }

  const baseUrl = process.env.ODDS_API_BASE_URL ?? DEFAULT_ODDS_API_BASE_URL;
  const url = new URL(`/v4/sports/${WORLD_CUP_SPORT_KEY}/odds`, baseUrl);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const bookmakers = process.env.ODDS_API_BOOKMAKERS?.trim();
  if (bookmakers) {
    url.searchParams.set("bookmakers", bookmakers);
  } else {
    url.searchParams.set("regions", process.env.ODDS_API_REGIONS ?? DEFAULT_ODDS_API_REGIONS);
  }

  const response = await fetch(url, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`The Odds API returned ${response.status}.`);
  }

  return (await response.json()) as OddsEvent[];
}
