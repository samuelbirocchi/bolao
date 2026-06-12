import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { syncRecentWc2026Matches } from "@/lib/schedule/sync";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown sync error.";
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await syncRecentWc2026Matches();

    return NextResponse.json({
      ok: true,
      ...summary,
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
