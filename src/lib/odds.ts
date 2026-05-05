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

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(the|men|women|national|team)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  const homeName = normalizeName(homeTeam);
  const awayName = normalizeName(awayTeam);
  const home = outcomes.find((outcome) => normalizeName(outcome.name) === homeName);
  const away = outcomes.find((outcome) => normalizeName(outcome.name) === awayName);
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

function findMatchingEvent(match: MatchForOdds, events: OddsEvent[]) {
  const homeName = normalizeName(match.home_team_name);
  const awayName = normalizeName(match.away_team_name);
  const kickoffTime = new Date(match.kickoff_utc).getTime();

  return events.find((event) => {
    const eventHomeName = normalizeName(event.home_team);
    const eventAwayName = normalizeName(event.away_team);
    const eventTime = new Date(event.commence_time).getTime();
    const withinOneDay = Math.abs(eventTime - kickoffTime) <= 24 * 60 * 60 * 1000;

    return eventHomeName === homeName && eventAwayName === awayName && withinOneDay;
  });
}

export function buildOddsSnapshots(matches: MatchForOdds[], events: OddsEvent[]): OddsSnapshot[] {
  const capturedAt = new Date().toISOString();

  return matches
    .map((match) => {
      const event = findMatchingEvent(match, events);
      const probabilities = event ? aggregateEventProbabilities(event) : null;

      if (!event || !probabilities) {
        return null;
      }

      return {
        matchId: match.id,
        oddsEventId: event.id,
        source: "the-odds-api",
        bookmakerCount: probabilities.bookmakerCount,
        capturedAt,
        homeWinProbability: probabilities.homeWinProbability,
        drawProbability: probabilities.drawProbability,
        awayWinProbability: probabilities.awayWinProbability,
      };
    })
    .filter(Boolean) as OddsSnapshot[];
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
