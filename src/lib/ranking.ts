// Pure, dependency-free derivation of ranking evolution from per-match scores.
// No Supabase, no React — unit-testable per repo convention (src/lib/*.test.mts).
//
// Single source of scoring truth is the SQL view match_prediction_scores; this
// module only walks those per-match rows to derive cumulative standings,
// rank-over-time, per-day grouping, and performance stats. Tiebreakers mirror
// the leaderboard exactly: total desc -> exact desc -> winner desc -> joined_at asc.

export type RankingMatch = {
  id: string;
  match_number: number;
  kickoff_utc: string;
  phase: string | null;
  home_team_name: string;
  away_team_name: string;
};

export type RankingScore = {
  user_id: string;
  match_id: string;
  base_points: number;
  bonus_points: number;
  exact_score: boolean;
  correct_winner: boolean;
  correct_draw: boolean;
  // Enrichment fields (match_prediction_scores, migration 008). Optional so the
  // live-match view can keep constructing scores without the per-match detail.
  prediction_home_goals?: number | null;
  prediction_away_goals?: number | null;
  result_home_goals?: number | null;
  result_away_goals?: number | null;
  winner_goals_bonus?: boolean;
  goal_difference_bonus?: boolean;
  loser_goals_bonus?: boolean;
  rout_bonus?: boolean;
  extra_time_bonus?: boolean;
  penalties_bonus?: boolean;
};

export type RankingMember = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  gravatar_hash: string | null;
  joined_at: string;
};

export type StandingEntry = {
  userId: string;
  cumulativePoints: number;
  exactScoreCount: number;
  winnerCount: number;
  rank: number;
};

export type TimelineStep = {
  match: RankingMatch;
  standings: StandingEntry[];
};

export type SeriesPoint = {
  matchId: string;
  cumulativePoints: number;
  rank: number;
};

export type MemberSeries = {
  userId: string;
  points: SeriesPoint[];
};

export type PerMatchEntry = {
  userId: string;
  matchPoints: number;
  exact: boolean;
  correctWinner: boolean;
  correctDraw: boolean;
  cumulativePoints: number;
  rank: number;
  rankDelta: number;
  predictionHomeGoals: number | null;
  predictionAwayGoals: number | null;
  resultHomeGoals: number | null;
  resultAwayGoals: number | null;
  winnerGoals: boolean;
  goalDifference: boolean;
  loserGoals: boolean;
  routBonus: boolean;
  extraTime: boolean;
  penalties: boolean;
};

export type PerMatchBreakdown = {
  match: RankingMatch;
  entries: PerMatchEntry[];
};

export type DayGroup = {
  date: string;
  matchIds: string[];
  standings: StandingEntry[];
};

export type PerformanceStat = {
  userId: string;
  bestMatchPoints: number;
  worstMatchPoints: number;
  exactScoreCount: number;
  winnerCount: number;
  currentRank: number;
  currentPoints: number;
  bestRank: number;
  biggestClimb: number;
};

export type RankingModel = {
  members: RankingMember[];
  matches: RankingMatch[];
  timeline: TimelineStep[];
  series: MemberSeries[];
  perMatch: PerMatchBreakdown[];
  byDay: DayGroup[];
  performance: PerformanceStat[];
  currentStandings: StandingEntry[];
};

type CumulativeState = {
  cumulativePoints: number;
  exactScoreCount: number;
  winnerCount: number;
};

function dayKey(kickoffUtc: string): string {
  return new Date(kickoffUtc).toISOString().slice(0, 10);
}

function sortMatches(matches: RankingMatch[]): RankingMatch[] {
  return [...matches].sort((a, b) => {
    const at = new Date(a.kickoff_utc).getTime();
    const bt = new Date(b.kickoff_utc).getTime();
    if (at !== bt) {
      return at - bt;
    }
    return a.match_number - b.match_number;
  });
}

// Same tiebreakers as getLeaderboard: total desc, exact desc, winner desc,
// joined_at asc; user_id as a final deterministic tiebreak.
function makeComparator(joinedAt: Map<string, string>) {
  return (a: StandingEntry, b: StandingEntry): number => {
    if (b.cumulativePoints !== a.cumulativePoints) {
      return b.cumulativePoints - a.cumulativePoints;
    }
    if (b.exactScoreCount !== a.exactScoreCount) {
      return b.exactScoreCount - a.exactScoreCount;
    }
    if (b.winnerCount !== a.winnerCount) {
      return b.winnerCount - a.winnerCount;
    }
    const aJoined = joinedAt.get(a.userId) ?? "";
    const bJoined = joinedAt.get(b.userId) ?? "";
    if (aJoined !== bJoined) {
      return aJoined < bJoined ? -1 : 1;
    }
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  };
}

function isPointsTied(a: StandingEntry, b: StandingEntry): boolean {
  return a.cumulativePoints === b.cumulativePoints;
}

function rankStandings(
  members: RankingMember[],
  cumulative: Map<string, CumulativeState>,
  compare: (a: StandingEntry, b: StandingEntry) => number,
): StandingEntry[] {
  const standings: StandingEntry[] = members.map((member) => {
    const state = cumulative.get(member.user_id)!;
    return {
      userId: member.user_id,
      cumulativePoints: state.cumulativePoints,
      exactScoreCount: state.exactScoreCount,
      winnerCount: state.winnerCount,
      rank: 0,
    };
  });
  standings.sort(compare);
  standings.forEach((entry, index) => {
    if (index === 0) {
      entry.rank = 1;
    } else {
      const prev = standings[index - 1];
      if (isPointsTied(prev, entry)) {
        entry.rank = prev.rank;
      } else {
        entry.rank = index + 1;
      }
    }
  });
  return standings;
}

export function buildRanking(
  matches: RankingMatch[],
  scores: RankingScore[],
  members: RankingMember[],
): RankingModel {
  const orderedMatches = sortMatches(matches);
  const joinedAt = new Map(members.map((member) => [member.user_id, member.joined_at]));
  const compare = makeComparator(joinedAt);
  const memberIds = new Set(members.map((member) => member.user_id));

  // scoresByMatch[matchId][userId] = score row (members only).
  const scoresByMatch = new Map<string, Map<string, RankingScore>>();
  for (const score of scores) {
    if (!memberIds.has(score.user_id)) {
      continue;
    }
    let byUser = scoresByMatch.get(score.match_id);
    if (!byUser) {
      byUser = new Map();
      scoresByMatch.set(score.match_id, byUser);
    }
    byUser.set(score.user_id, score);
  }

  const cumulative = new Map<string, CumulativeState>(
    members.map((member) => [
      member.user_id,
      { cumulativePoints: 0, exactScoreCount: 0, winnerCount: 0 },
    ]),
  );

  const baseline = rankStandings(members, cumulative, compare);

  const timeline: TimelineStep[] = [];
  for (const match of orderedMatches) {
    const matchScores = scoresByMatch.get(match.id);
    for (const member of members) {
      const score = matchScores?.get(member.user_id);
      if (!score) {
        continue;
      }
      const state = cumulative.get(member.user_id)!;
      state.cumulativePoints += score.base_points + score.bonus_points;
      state.exactScoreCount += score.exact_score ? 1 : 0;
      state.winnerCount += score.correct_winner || score.correct_draw ? 1 : 0;
    }
    timeline.push({ match, standings: rankStandings(members, cumulative, compare) });
  }

  const currentStandings = timeline.length > 0 ? timeline[timeline.length - 1]!.standings : baseline;

  // Per-step rank lookups, used for series and rank deltas.
  const rankByStep = timeline.map((step) => {
    const map = new Map<string, StandingEntry>();
    for (const entry of step.standings) {
      map.set(entry.userId, entry);
    }
    return map;
  });

  const series: MemberSeries[] = members.map((member) => ({
    userId: member.user_id,
    points: timeline.map((step, index) => {
      const entry = rankByStep[index]!.get(member.user_id)!;
      return {
        matchId: step.match.id,
        cumulativePoints: entry.cumulativePoints,
        rank: entry.rank,
      };
    }),
  }));

  const perMatch: PerMatchBreakdown[] = timeline.map((step, index) => {
    const matchScores = scoresByMatch.get(step.match.id);
    const previous = index > 0 ? rankByStep[index - 1]! : null;
    const entries: PerMatchEntry[] = step.standings.map((entry) => {
      const score = matchScores?.get(entry.userId);
      const previousRank = previous ? previous.get(entry.userId)!.rank : entry.rank;
      return {
        userId: entry.userId,
        matchPoints: score ? score.base_points + score.bonus_points : 0,
        exact: score?.exact_score ?? false,
        correctWinner: score?.correct_winner ?? false,
        correctDraw: score?.correct_draw ?? false,
        cumulativePoints: entry.cumulativePoints,
        rank: entry.rank,
        rankDelta: previousRank - entry.rank,
        predictionHomeGoals: score?.prediction_home_goals ?? null,
        predictionAwayGoals: score?.prediction_away_goals ?? null,
        resultHomeGoals: score?.result_home_goals ?? null,
        resultAwayGoals: score?.result_away_goals ?? null,
        winnerGoals: score?.winner_goals_bonus ?? false,
        goalDifference: score?.goal_difference_bonus ?? false,
        loserGoals: score?.loser_goals_bonus ?? false,
        routBonus: score?.rout_bonus ?? false,
        extraTime: score?.extra_time_bonus ?? false,
        penalties: score?.penalties_bonus ?? false,
      };
    });
    return { match: step.match, entries };
  });

  // Same-day matches are contiguous in timeline (ordered by kickoff), so group
  // sequentially and snapshot standings at the last match of each day.
  const byDay: DayGroup[] = [];
  for (const step of timeline) {
    const date = dayKey(step.match.kickoff_utc);
    const last = byDay[byDay.length - 1];
    if (last && last.date === date) {
      last.matchIds.push(step.match.id);
      last.standings = step.standings;
    } else {
      byDay.push({ date, matchIds: [step.match.id], standings: step.standings });
    }
  }

  const performance: PerformanceStat[] = members.map((member) => {
    const current = currentStandings.find((entry) => entry.userId === member.user_id)!;
    const participatedPoints: number[] = [];
    for (const match of orderedMatches) {
      const score = scoresByMatch.get(match.id)?.get(member.user_id);
      if (score) {
        participatedPoints.push(score.base_points + score.bonus_points);
      }
    }
    const ranks = series
      .find((s) => s.userId === member.user_id)!
      .points.map((point) => point.rank);
    const climbs = perMatch.map(
      (breakdown) =>
        breakdown.entries.find((entry) => entry.userId === member.user_id)!.rankDelta,
    );
    return {
      userId: member.user_id,
      bestMatchPoints: participatedPoints.length > 0 ? Math.max(...participatedPoints) : 0,
      worstMatchPoints: participatedPoints.length > 0 ? Math.min(...participatedPoints) : 0,
      exactScoreCount: current.exactScoreCount,
      winnerCount: current.winnerCount,
      currentRank: current.rank,
      currentPoints: current.cumulativePoints,
      bestRank: ranks.length > 0 ? Math.min(...ranks) : current.rank,
      biggestClimb: climbs.length > 0 ? Math.max(...climbs) : 0,
    };
  });

  return {
    members,
    matches: orderedMatches,
    timeline,
    series,
    perMatch,
    byDay,
    performance,
    currentStandings,
  };
}
