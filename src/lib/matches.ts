export type MatchKickoff = {
  kickoff_utc: string;
};

export function splitMatchesByKickoff<TMatch extends MatchKickoff>(
  matches: TMatch[],
  now: number,
) {
  const pastMatches: TMatch[] = [];
  const upcomingMatches: TMatch[] = [];

  for (const match of matches) {
    if (new Date(match.kickoff_utc).getTime() <= now) {
      pastMatches.push(match);
    } else {
      upcomingMatches.push(match);
    }
  }

  pastMatches.sort(
    (a, b) => new Date(b.kickoff_utc).getTime() - new Date(a.kickoff_utc).getTime(),
  );

  upcomingMatches.sort(
    (a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
  );

  return { pastMatches, upcomingMatches };
}

/**
 * Extract a "YYYY-MM-DD" date key from an ISO kickoff string (UTC date).
 */
export function getMatchDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Return sorted unique date keys ("YYYY-MM-DD") from a list of matches.
 */
export function getUniqueMatchDates<TMatch extends MatchKickoff>(
  matches: TMatch[],
): string[] {
  const dates = new Set<string>();
  for (const match of matches) {
    dates.add(getMatchDateKey(match.kickoff_utc));
  }
  return [...dates].sort();
}

/**
 * Filter matches whose kickoff falls on the given "YYYY-MM-DD" date key.
 */
export function filterMatchesByDate<TMatch extends MatchKickoff>(
  matches: TMatch[],
  dateKey: string,
): TMatch[] {
  return matches.filter((m) => getMatchDateKey(m.kickoff_utc) === dateKey);
}

/**
 * Format a "YYYY-MM-DD" date key for display in the calendar bar.
 * Uses the UTC date to avoid timezone shifts on the server.
 */
export function formatMatchDateKey(dateKey: string, locale: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
