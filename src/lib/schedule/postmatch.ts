import type { ExternalMatch } from "./types.ts";

export const POST_MATCH_SYNC_LOOKBACK_HOURS = 8;
export const POST_MATCH_SYNC_LOOKAHEAD_HOURS = 1;

type PostMatchSyncOptions = {
  lookbackHours?: number;
  lookaheadHours?: number;
};

function hoursToMs(hours: number) {
  return hours * 60 * 60 * 1000;
}

function kickoffTime(match: Pick<ExternalMatch, "kickoffUtc">) {
  const timestamp = Date.parse(match.kickoffUtc);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isPostMatchSyncCandidate(
  match: ExternalMatch,
  now: Date,
  options: PostMatchSyncOptions = {},
) {
  const kickoff = kickoffTime(match);

  if (kickoff === null) {
    return false;
  }

  const lookbackHours = options.lookbackHours ?? POST_MATCH_SYNC_LOOKBACK_HOURS;
  const lookaheadHours = options.lookaheadHours ?? POST_MATCH_SYNC_LOOKAHEAD_HOURS;
  const lowerBound = now.getTime() - hoursToMs(lookbackHours);
  const upperBound = now.getTime() + hoursToMs(lookaheadHours);

  if (kickoff < lowerBound || kickoff > upperBound) {
    return false;
  }

  return (
    match.status === "live" ||
    match.status === "completed" ||
    (match.resultHomeGoals !== null && match.resultAwayGoals !== null)
  );
}

export function selectPostMatchSyncCandidates(
  matches: ExternalMatch[],
  now: Date,
  options: PostMatchSyncOptions = {},
) {
  return matches.filter((match) => isPostMatchSyncCandidate(match, now, options));
}
