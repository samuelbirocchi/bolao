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

  return { pastMatches, upcomingMatches };
}
