import type { ExternalMatch } from "@/lib/schedule/types";

type Wc2026Match = {
  id?: number;
  match_number?: number;
  round?: string;
  group_name?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_team_name?: string | null;
  away_team_name?: string | null;
  home_placeholder?: string | null;
  away_placeholder?: string | null;
  stadium?: string | null;
  kickoff_utc?: string;
  status?: string;
  phase?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  home_goals?: number | null;
  away_goals?: number | null;
  home_pen?: number | null;
  away_pen?: number | null;
};

function normalizeStatus(status: string | undefined): ExternalMatch["status"] {
  if (status === "live" || status === "completed" || status === "postponed") {
    return status;
  }

  return "scheduled";
}

function normalizeResolution(
  phase: string | null | undefined,
  homePenalties: number | null | undefined,
  awayPenalties: number | null | undefined,
): ExternalMatch["resultResolution"] {
  if (homePenalties !== null && homePenalties !== undefined && awayPenalties !== null && awayPenalties !== undefined) {
    return "penalties";
  }

  if (phase?.includes("ET")) {
    return "extra_time";
  }

  return "regular";
}

export async function fetchWc2026Matches(): Promise<ExternalMatch[]> {
  const apiKey = process.env.WC2026_API_KEY;
  const baseUrl = process.env.WC2026_API_BASE_URL ?? "https://api.wc2026api.com";

  if (!apiKey) {
    throw new Error("WC2026_API_KEY is not configured.");
  }

  const response = await fetch(`${baseUrl}/matches`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`WC2026 API returned ${response.status}.`);
  }

  const payload = (await response.json()) as Wc2026Match[] | { data?: Wc2026Match[] };
  const matches = Array.isArray(payload) ? payload : (payload.data ?? []);

  return matches
    .filter((match) => match.match_number || match.id)
    .map((match) => ({
      matchNumber: match.match_number ?? match.id!,
      round: match.round ?? "group",
      groupName: match.group_name ?? null,
      homeTeamName: match.home_team_name ?? match.home_team ?? null,
      awayTeamName: match.away_team_name ?? match.away_team ?? null,
      homeTeamPlaceholder: match.home_placeholder ?? null,
      awayTeamPlaceholder: match.away_placeholder ?? null,
      stadium: match.stadium ?? null,
      kickoffUtc: match.kickoff_utc ?? new Date(0).toISOString(),
      status: normalizeStatus(match.status),
      phase: match.phase ?? null,
      resultHomeGoals: match.home_score ?? match.home_goals ?? null,
      resultAwayGoals: match.away_score ?? match.away_goals ?? null,
      resultHomePenalties: match.home_pen ?? null,
      resultAwayPenalties: match.away_pen ?? null,
      resultResolution: normalizeResolution(match.phase, match.home_pen, match.away_pen),
    }));
}
