export type ExternalMatch = {
  matchNumber: number;
  round: string;
  groupName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamPlaceholder: string | null;
  awayTeamPlaceholder: string | null;
  stadium: string | null;
  kickoffUtc: string;
  status: "scheduled" | "live" | "completed" | "postponed";
  phase: string | null;
  resultHomeGoals: number | null;
  resultAwayGoals: number | null;
  resultHomePenalties: number | null;
  resultAwayPenalties: number | null;
  resultResolution: "regular" | "extra_time" | "penalties";
};
