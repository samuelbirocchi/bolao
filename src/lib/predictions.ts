export type RawPredictionPair = {
  matchId: string;
  home: string;
  away: string;
  penaltyWinner?: string | null;
};

export type PredictionEntry = {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  penaltyWinner: "home" | "away" | null;
};

function parseGoals(value: string, matchId: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new Error(`Goals for match ${matchId} must be a non-negative integer.`);
  }
  return parsed;
}

// A penalty-winner pick is only meaningful for a draw prediction (a knockout
// match level on goals goes to a shootout). It is dropped for non-draw
// predictions; a non-empty value that isn't 'home'/'away' throws.
export function parsePenaltyWinner(
  value: string | null | undefined,
  isDraw: boolean,
  matchId: string,
): "home" | "away" | null {
  if (!isDraw) {
    return null;
  }

  const trimmed = (value ?? "").trim();
  if (trimmed === "") {
    return null;
  }
  if (trimmed !== "home" && trimmed !== "away") {
    throw new Error(`Penalty winner for match ${matchId} must be 'home' or 'away'.`);
  }
  return trimmed;
}

// Turns raw {matchId, home, away, penaltyWinner} string pairs into validated
// prediction entries. A pair with either side blank (or both) is skipped — a
// partially filled match is simply not saved. Non-blank values that aren't
// non-negative integers throw.
export function buildPredictionEntries(rawPairs: RawPredictionPair[]): PredictionEntry[] {
  const entries: PredictionEntry[] = [];

  for (const pair of rawPairs) {
    const home = pair.home.trim();
    const away = pair.away.trim();

    if (home === "" || away === "") {
      continue;
    }

    const homeGoals = parseGoals(home, pair.matchId);
    const awayGoals = parseGoals(away, pair.matchId);

    entries.push({
      matchId: pair.matchId,
      homeGoals,
      awayGoals,
      penaltyWinner: parsePenaltyWinner(
        pair.penaltyWinner,
        homeGoals === awayGoals,
        pair.matchId,
      ),
    });
  }

  return entries;
}
