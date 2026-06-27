import type { ExternalMatch } from "@/lib/schedule/types";
import { matchNumberForEspnEvent } from "./espnWc2026MatchNumbers.ts";

const ESPN_WC2026_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

type EspnTeam = {
  displayName?: string;
  isActive?: boolean;
};

type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  shootoutScore?: string;
  team?: EspnTeam;
};

type EspnStatus = {
  period?: number;
  type?: {
    name?: string;
    state?: "pre" | "in" | "post";
    completed?: boolean;
    detail?: string;
    shortDetail?: string;
  };
};

type EspnCompetition = {
  competitors?: EspnCompetitor[];
  status?: EspnStatus;
  venue?: { fullName?: string };
  altGameNote?: string;
};

type EspnEvent = {
  id?: string;
  date?: string;
  season?: { slug?: string };
  competitions?: EspnCompetition[];
  status?: EspnStatus;
  venue?: { displayName?: string };
};

type EspnScoreboard = {
  events?: EspnEvent[];
};

function normalizeStatus(status: EspnStatus | undefined): ExternalMatch["status"] {
  const statusName = status?.type?.name ?? "";

  if (statusName.includes("POSTPONED") || statusName.includes("CANCELED")) {
    return "postponed";
  }

  if (status?.type?.completed) {
    return "completed";
  }

  if (status?.type?.state === "in") {
    return "live";
  }

  return "scheduled";
}

function score(value: string | undefined) {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeResolution(
  status: EspnStatus | undefined,
  homePenalties: number | null,
  awayPenalties: number | null,
): ExternalMatch["resultResolution"] {
  if (homePenalties !== null && awayPenalties !== null) {
    return "penalties";
  }

  const detail = `${status?.type?.name ?? ""} ${status?.type?.detail ?? ""}`;
  if ((status?.period ?? 0) > 2 || detail.includes("EXTRA_TIME") || detail.includes("AET")) {
    return "extra_time";
  }

  return "regular";
}

function groupName(note: string | undefined) {
  return note?.match(/Group ([A-L])/i)?.[1]?.toUpperCase() ?? null;
}

function teamFields(competitor: EspnCompetitor | undefined) {
  const name = competitor?.team?.displayName ?? null;
  const isPlaceholder = competitor?.team?.isActive === false;

  return {
    name: isPlaceholder ? null : name,
    placeholder: isPlaceholder ? name : null,
  };
}

function resultScore(competitor: EspnCompetitor | undefined, status: ExternalMatch["status"]) {
  return status === "live" || status === "completed" ? score(competitor?.score) : null;
}

function parseEvent(event: EspnEvent): ExternalMatch {
  const eventId = event.id;
  const matchNumber = eventId ? matchNumberForEspnEvent(eventId) : null;
  if (!eventId || matchNumber === null) {
    throw new Error(`ESPN returned an unknown WC2026 event id: ${eventId ?? "missing"}.`);
  }

  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((competitor) => competitor.homeAway === "home");
  const away = competition?.competitors?.find((competitor) => competitor.homeAway === "away");
  const homeTeam = teamFields(home);
  const awayTeam = teamFields(away);
  const statusSource = competition?.status ?? event.status;
  const status = normalizeStatus(statusSource);
  const homePenalties = score(home?.shootoutScore);
  const awayPenalties = score(away?.shootoutScore);

  if (
    !event.date ||
    (!homeTeam.name && !homeTeam.placeholder) ||
    (!awayTeam.name && !awayTeam.placeholder)
  ) {
    throw new Error(`ESPN returned an incomplete WC2026 event: ${eventId}.`);
  }

  return {
    matchNumber,
    round: event.season?.slug ?? "group-stage",
    groupName: groupName(competition?.altGameNote),
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    homeTeamPlaceholder: homeTeam.placeholder,
    awayTeamPlaceholder: awayTeam.placeholder,
    stadium: competition?.venue?.fullName ?? event.venue?.displayName ?? null,
    kickoffUtc: event.date,
    status,
    phase: statusSource?.type?.shortDetail ?? statusSource?.type?.detail ?? null,
    resultHomeGoals: resultScore(home, status),
    resultAwayGoals: resultScore(away, status),
    resultHomePenalties: homePenalties,
    resultAwayPenalties: awayPenalties,
    resultResolution: normalizeResolution(statusSource, homePenalties, awayPenalties),
  };
}

export async function fetchWc2026Matches(): Promise<ExternalMatch[]> {
  const url = new URL(ESPN_WC2026_SCOREBOARD_URL);
  url.searchParams.set("dates", "20260611-20260719");
  url.searchParams.set("limit", "200");
  const response = await fetch(url, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`ESPN WC2026 scoreboard returned ${response.status}.`);
  }

  const payload = (await response.json()) as EspnScoreboard;
  if (!payload.events?.length) {
    throw new Error("ESPN WC2026 scoreboard returned no events.");
  }

  return (payload.events ?? []).map(parseEvent).sort((a, b) => a.matchNumber - b.matchNumber);
}
