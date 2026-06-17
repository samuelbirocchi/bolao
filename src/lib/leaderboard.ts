import type { LeaderboardEntry } from "@/lib/data";

export type RankedEntry = { entry: LeaderboardEntry; rank: number };

export type PodiumZones = {
  topZone: RankedEntry[];
  bottomZone: RankedEntry[];
};

// Splits ranked entries into a top-3 and bottom-3 zone for podium highlights.
// Only produces zones when there are enough entries (>= 4) for the split to
// mean something. The bottom zone excludes any user already in the top zone so
// the same player never appears twice in small groups.
export function getPodiumZones(rankedEntries: RankedEntry[]): PodiumZones {
  if (rankedEntries.length < 4) {
    return { topZone: [], bottomZone: [] };
  }

  const topZone = rankedEntries.slice(0, 3);
  const topIds = new Set(topZone.map(({ entry }) => entry.user_id));
  const bottomZone = rankedEntries
    .slice(-3)
    .filter(({ entry }) => !topIds.has(entry.user_id));

  return { topZone, bottomZone };
}
