import type { ExternalMatch } from "./types";

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
    .filter(
      (match) =>
        match.status === "completed" &&
        match.resultHomeGoals !== null &&
        match.resultAwayGoals !== null,
    )
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
