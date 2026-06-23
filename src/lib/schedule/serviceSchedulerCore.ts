export type Logger = Pick<Console, "error" | "info" | "warn">;

export type ScheduledSyncState = {
  isRunning: boolean;
};

export type ScheduledMatchSync = () => Promise<{
  syncedMatchCount: number;
  syncedResultCount: number;
}>;

export type ScheduledOddsSync = () => Promise<unknown>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown sync error.";
}

export function createScheduledWc2026SyncRunner(
  state: ScheduledSyncState,
  syncMatches: ScheduledMatchSync,
  syncOdds: ScheduledOddsSync,
  logger: Logger,
  env: NodeJS.ProcessEnv,
) {
  return async function runScheduledWc2026Sync() {
    if (state.isRunning) {
      logger.warn("Skipping scheduled WC2026 sync because the previous run is still active.");
      return;
    }

    state.isRunning = true;

    try {
      const matchSummary = await syncMatches();

      if (env.ODDS_API_KEY) {
        try {
          await syncOdds();
        } catch (oddsError) {
          logger.error(`Scheduled odds sync failed: ${errorMessage(oddsError)}`);
        }
      }

      logger.info(
        `Scheduled WC2026 sync completed: ${matchSummary.syncedMatchCount} matches, ` +
          `${matchSummary.syncedResultCount} results.`,
      );
    } catch (error) {
      logger.error(`Scheduled WC2026 sync failed: ${errorMessage(error)}`);
    } finally {
      state.isRunning = false;
    }
  };
}
