import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOddsSnapshots, fetchWorldCupOdds, type OddsSyncResult } from "@/lib/odds";
import { selectPostMatchSyncCandidates } from "./postmatch";
import type { ExternalMatch } from "./types";
import { fetchWc2026Matches } from "./wc2026";
import { createClient, createServiceClient, hasSupabaseEnv, hasSupabaseServiceEnv } from "@/lib/supabase/server";

type SyncSupabaseClient = Pick<SupabaseClient, "from">;

export type Wc2026SyncSummary = {
  fetchedCount: number;
  selectedCount: number;
  syncedMatchCount: number;
  syncedResultCount: number;
};

export function buildMatchRows(externalMatches: ExternalMatch[]) {
  return externalMatches.map((match) => ({
    match_number: match.matchNumber,
    round: match.round,
    group_name: match.groupName,
    home_team_name: match.homeTeamName ?? match.homeTeamPlaceholder ?? "TBD",
    away_team_name: match.awayTeamName ?? match.awayTeamPlaceholder ?? "TBD",
    home_team_placeholder: match.homeTeamPlaceholder,
    away_team_placeholder: match.awayTeamPlaceholder,
    stadium: match.stadium,
    kickoff_utc: match.kickoffUtc,
    status: match.status,
    phase: match.phase,
  }));
}

export function buildCompletedResultRows(
  externalMatches: ExternalMatch[],
  matchIdByNumber: Map<number, string>,
  updatedBy: string | null,
) {
  return externalMatches
    .filter((match) => match.resultHomeGoals !== null && match.resultAwayGoals !== null)
    .map((match) => ({
      match_id: matchIdByNumber.get(match.matchNumber),
      home_goals: match.resultHomeGoals!,
      away_goals: match.resultAwayGoals!,
      home_penalties:
        match.resultResolution === "penalties" ? match.resultHomePenalties : null,
      away_penalties:
        match.resultResolution === "penalties" ? match.resultAwayPenalties : null,
      resolution: match.resultResolution,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    }))
    .filter((result): result is Omit<typeof result, "match_id"> & { match_id: string } =>
      Boolean(result.match_id),
    );
}

export async function syncExternalMatches(
  supabase: SyncSupabaseClient,
  externalMatches: ExternalMatch[],
  updatedBy: string | null,
): Promise<Wc2026SyncSummary> {
  if (externalMatches.length === 0) {
    return {
      fetchedCount: 0,
      selectedCount: 0,
      syncedMatchCount: 0,
      syncedResultCount: 0,
    };
  }

  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .upsert(buildMatchRows(externalMatches), { onConflict: "match_number" })
    .select("id, match_number");

  if (matchError || !matches) {
    throw new Error(matchError?.message ?? "Could not sync matches.");
  }

  const matchIdByNumber = new Map(
    matches.map((match) => [match.match_number as number, match.id as string]),
  );
  const completedResults = buildCompletedResultRows(externalMatches, matchIdByNumber, updatedBy);

  if (completedResults.length > 0) {
    const { error: resultError } = await supabase
      .from("match_results")
      .upsert(completedResults, { onConflict: "match_id" });

    if (resultError) {
      throw new Error(resultError.message);
    }
  }

  return {
    fetchedCount: externalMatches.length,
    selectedCount: externalMatches.length,
    syncedMatchCount: matches.length,
    syncedResultCount: completedResults.length,
  };
}

export function revalidateMatchSyncPaths() {
  revalidatePath("/admin/matches");
  revalidatePath("/groups", "layout");
}

export async function syncWc2026MatchesForAdmin(updatedBy: string) {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase is not configured. Copy .env.example to .env.local first.");
  }

  const externalMatches = await fetchWc2026Matches();
  const supabase = await createClient();
  const summary = await syncExternalMatches(supabase, externalMatches, updatedBy);
  revalidateMatchSyncPaths();

  return summary;
}

export async function syncRecentWc2026Matches(now = new Date()) {
  if (!hasSupabaseServiceEnv()) {
    throw new Error("Supabase service environment variables are not configured.");
  }

  const externalMatches = await fetchWc2026Matches();
  const selectedMatches = selectPostMatchSyncCandidates(externalMatches, now);

  if (selectedMatches.length === 0) {
    return {
      fetchedCount: externalMatches.length,
      selectedCount: 0,
      syncedMatchCount: 0,
      syncedResultCount: 0,
    };
  }

  const supabase = createServiceClient();
  const summary = await syncExternalMatches(supabase, selectedMatches, null);
  revalidateMatchSyncPaths();

  return {
    ...summary,
    fetchedCount: externalMatches.length,
    selectedCount: selectedMatches.length,
  };
}

export type OddsSyncSummary = {
  matchedCount: number;
  unmatchedCount: number;
  unmatchedMatches: OddsSyncResult["unmatchedMatches"];
};

export async function syncOddsForCron(): Promise<OddsSyncSummary> {
  if (!hasSupabaseServiceEnv()) {
    throw new Error("Supabase service environment variables are not configured.");
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const [{ data: matches, error: matchError }, oddsEvents] = await Promise.all([
    supabase
      .from("matches")
      .select("id, home_team_name, away_team_name, kickoff_utc")
      .gt("kickoff_utc", now),
    fetchWorldCupOdds(),
  ]);

  if (matchError || !matches) {
    throw new Error(matchError?.message ?? "Could not load matches for odds sync.");
  }

  const result = buildOddsSnapshots(matches, oddsEvents);
  const rows = result.snapshots.map((snapshot) => ({
    match_id: snapshot.matchId,
    odds_event_id: snapshot.oddsEventId,
    source: snapshot.source,
    bookmaker_count: snapshot.bookmakerCount,
    home_win_probability: snapshot.homeWinProbability,
    draw_probability: snapshot.drawProbability,
    away_win_probability: snapshot.awayWinProbability,
    captured_at: snapshot.capturedAt,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("match_odds_snapshots")
      .upsert(rows, { onConflict: "match_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/matches");
  revalidatePath("/groups", "layout");

  return {
    matchedCount: result.matchedCount,
    unmatchedCount: result.unmatchedMatches.length,
    unmatchedMatches: result.unmatchedMatches,
  };
}
