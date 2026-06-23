export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWc2026SyncScheduler } = await import("./src/lib/schedule/serviceScheduler");
    startWc2026SyncScheduler();
  }
}
