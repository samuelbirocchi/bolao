export type MatchKickoff = {
  kickoff_utc: string;
};

export type MatchResult = {
  result_home_goals: number | null;
};

/** Window after kickoff during which a result-less match is "live" (issue #73). */
export const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

export function isMatchLocked(kickoffUtc: string, now: number): boolean {
  return new Date(kickoffUtc).getTime() <= now;
}

/** Kicked off, no synced result, and within {@link LIVE_WINDOW_MS} of kickoff. */
export function isMatchLive<TMatch extends MatchKickoff & MatchResult>(
  match: TMatch,
  now: number,
): boolean {
  if (!isMatchLocked(match.kickoff_utc, now)) return false;
  if (match.result_home_goals !== null) return false;
  const elapsed = now - new Date(match.kickoff_utc).getTime();
  return elapsed < LIVE_WINDOW_MS;
}

export function splitMatchesByKickoff<TMatch extends MatchKickoff & MatchResult>(
  matches: TMatch[],
  now: number,
) {
  const liveMatches: TMatch[] = [];
  const pastMatches: TMatch[] = [];
  const upcomingMatches: TMatch[] = [];

  for (const match of matches) {
    if (!isMatchLocked(match.kickoff_utc, now)) {
      upcomingMatches.push(match);
    } else if (isMatchLive(match, now)) {
      liveMatches.push(match);
    } else {
      pastMatches.push(match);
    }
  }

  liveMatches.sort(
    (a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
  );

  pastMatches.sort(
    (a, b) => new Date(b.kickoff_utc).getTime() - new Date(a.kickoff_utc).getTime(),
  );

  return { liveMatches, pastMatches, upcomingMatches };
}

export function getLocalDateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type DateGroup<TMatch extends MatchKickoff> = {
  dateKey: string;
  label: string;
  matches: TMatch[];
};

export function groupUpcomingByDate<TMatch extends MatchKickoff>(
  matches: TMatch[],
  timeZone: string,
  locale: string,
): DateGroup<TMatch>[] {
  const labelFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone,
  });
  const groups = new Map<string, DateGroup<TMatch>>();

  for (const match of matches) {
    const dateKey = getLocalDateKey(match.kickoff_utc, timeZone);
    let group = groups.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        label: labelFormatter.format(new Date(match.kickoff_utc)),
        matches: [],
      };
      groups.set(dateKey, group);
    }
    group.matches.push(match);
  }

  return [...groups.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
