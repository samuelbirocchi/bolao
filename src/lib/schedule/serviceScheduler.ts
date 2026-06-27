import { syncOddsForCron, syncRecentWc2026Matches } from "./sync";
import {
  createScheduledWc2026SyncRunner,
  type Logger,
  type ScheduledSyncState,
} from "./serviceSchedulerCore";

export const WC2026_SYNC_INTERVAL_MS = 15 * 60 * 1000;

type SchedulerGlobal = typeof globalThis & {
  __wc2026SyncScheduler?: {
    timer: ReturnType<typeof setInterval>;
    startedAt: string;
  };
};

function hasSchedulerEnvironment() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function startWc2026SyncScheduler(logger: Logger = console) {
  const schedulerGlobal = globalThis as SchedulerGlobal;

  if (schedulerGlobal.__wc2026SyncScheduler) {
    return schedulerGlobal.__wc2026SyncScheduler;
  }

  if (!hasSchedulerEnvironment()) {
    logger.info(
      "WC2026 sync scheduler not started because the Supabase service env is incomplete.",
    );
    return null;
  }

  const state: ScheduledSyncState = { isRunning: false };
  const runner = createScheduledWc2026SyncRunner(
    state,
    syncRecentWc2026Matches,
    syncOddsForCron,
    logger,
    process.env,
  );
  const timer = setInterval(runner, WC2026_SYNC_INTERVAL_MS);

  timer.unref?.();
  schedulerGlobal.__wc2026SyncScheduler = {
    timer,
    startedAt: new Date().toISOString(),
  };

  void runner();
  logger.info("WC2026 sync scheduler started with a 15-minute interval.");

  return schedulerGlobal.__wc2026SyncScheduler;
}
