import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { syncOddsForCron, syncRecentWc2026Matches } from "@/lib/schedule/sync";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown sync error.";
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const matchSummary = await syncRecentWc2026Matches();

    let oddsSummary: Awaited<ReturnType<typeof syncOddsForCron>> | null = null;
    if (process.env.ODDS_API_KEY) {
      try {
        oddsSummary = await syncOddsForCron();
      } catch (oddsError) {
        // Odds sync is best-effort; log but don't fail the whole cron.
        console.error("Odds sync failed during cron:", oddsError);
      }
    }

    return NextResponse.json({
      ok: true,
      ...matchSummary,
      odds: oddsSummary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: errorMessage(error),
      },
      { status: 500 },
    );
  }
}
