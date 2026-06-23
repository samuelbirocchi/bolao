import assert from "node:assert/strict";
import { test } from "node:test";
import { createScheduledWc2026SyncRunner } from "./serviceSchedulerCore.ts";

function logger() {
  return {
    errors: [] as unknown[],
    infos: [] as unknown[],
    warnings: [] as unknown[],
    error(...args: unknown[]) {
      this.errors.push(args);
    },
    info(...args: unknown[]) {
      this.infos.push(args);
    },
    warn(...args: unknown[]) {
      this.warnings.push(args);
    },
  };
}

test("scheduled WC2026 sync skips overlapping runs", async () => {
  const log = logger();
  const state = { isRunning: false };
  let releaseSync: (() => void) | null = null;
  let matchSyncCount = 0;
  const syncMatches = async () => {
    matchSyncCount += 1;
    await new Promise<void>((resolve) => {
      releaseSync = resolve;
    });
    return {
      fetchedCount: 1,
      selectedCount: 1,
      syncedMatchCount: 1,
      syncedResultCount: 0,
    };
  };
  const syncOdds = async () => ({
    matchedCount: 0,
    unmatchedCount: 0,
    unmatchedMatches: [],
  });
  const run = createScheduledWc2026SyncRunner(
    state,
    syncMatches,
    syncOdds,
    log,
    {},
  );

  const firstRun = run();
  await run();

  assert.equal(matchSyncCount, 1);
  assert.equal(log.warnings.length, 1);

  releaseSync?.();
  await firstRun;
});

test("scheduled WC2026 sync runs odds only when configured", async () => {
  const log = logger();
  const state = { isRunning: false };
  let oddsSyncCount = 0;
  const syncMatches = async () => ({
    fetchedCount: 1,
    selectedCount: 1,
    syncedMatchCount: 1,
    syncedResultCount: 1,
  });
  const syncOdds = async () => {
    oddsSyncCount += 1;
    return {
      matchedCount: 0,
      unmatchedCount: 0,
      unmatchedMatches: [],
    };
  };
  const run = createScheduledWc2026SyncRunner(
    state,
    syncMatches,
    syncOdds,
    log,
    { ODDS_API_KEY: "test-key" },
  );

  await run();

  assert.equal(oddsSyncCount, 1);
  assert.equal(log.errors.length, 0);
});
