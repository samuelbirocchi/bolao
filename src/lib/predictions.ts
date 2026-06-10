export type RawPredictionPair = {
  matchId: string;
  home: string;
  away: string;
};

export type PredictionEntry = {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
};

function parseGoals(value: string, matchId: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new Error(`Goals for match ${matchId} must be a non-negative integer.`);
  }
  return parsed;
}

// Turns raw {matchId, home, away} string pairs into validated prediction
// entries. A pair with either side blank (or both) is skipped — a partially
// filled match is simply not saved. Non-blank values that aren't
// non-negative integers throw.
export function buildPredictionEntries(rawPairs: RawPredictionPair[]): PredictionEntry[] {
  const entries: PredictionEntry[] = [];

  for (const pair of rawPairs) {
    const home = pair.home.trim();
    const away = pair.away.trim();

    if (home === "" || away === "") {
      continue;
    }

    entries.push({
      matchId: pair.matchId,
      homeGoals: parseGoals(home, pair.matchId),
      awayGoals: parseGoals(away, pair.matchId),
    });
  }

  return entries;
}
