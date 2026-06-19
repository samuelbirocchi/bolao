import assert from "node:assert/strict";
import { test } from "node:test";
import type { LeaderboardEntry } from "./data.ts";
import { getPodiumZones, type RankedEntry } from "./leaderboard.ts";

function makeRanked(count: number): RankedEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const entry = {
      group_id: "g",
      user_id: `u${i + 1}`,
      display_name: `Player ${i + 1}`,
      avatar_url: null,
      gravatar_hash: null,
      joined_at: "2026-01-01T00:00:00Z",
      total_points: 100 - i,
      base_points: 0,
      bonus_points: 0,
      exact_score_count: 0,
      winner_count: 0,
    } satisfies LeaderboardEntry;
    return { entry, rank: i + 1 };
  });
}

test("fewer than 4 entries produce no zones", () => {
  for (const count of [0, 1, 2, 3]) {
    const zones = getPodiumZones(makeRanked(count));
    assert.deepEqual(zones.topZone, []);
    assert.deepEqual(zones.bottomZone, []);
  }
});

test("exactly 4 entries: top 3, bottom excludes the overlap (just the 4th)", () => {
  const zones = getPodiumZones(makeRanked(4));
  assert.deepEqual(
    zones.topZone.map(({ entry }) => entry.user_id),
    ["u1", "u2", "u3"],
  );
  assert.deepEqual(
    zones.bottomZone.map(({ entry }) => entry.user_id),
    ["u4"],
  );
});

test("8 entries: top 3 + bottom 3, no user in both zones", () => {
  const zones = getPodiumZones(makeRanked(8));
  assert.deepEqual(
    zones.topZone.map(({ entry }) => entry.user_id),
    ["u1", "u2", "u3"],
  );
  assert.deepEqual(
    zones.bottomZone.map(({ entry }) => entry.user_id),
    ["u6", "u7", "u8"],
  );

  const topIds = new Set(zones.topZone.map(({ entry }) => entry.user_id));
  for (const { entry } of zones.bottomZone) {
    assert.ok(!topIds.has(entry.user_id), `${entry.user_id} appears in both zones`);
  }
});
