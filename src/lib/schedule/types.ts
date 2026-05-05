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
  resultHomeGoals: number | null;
  resultAwayGoals: number | null;
};
