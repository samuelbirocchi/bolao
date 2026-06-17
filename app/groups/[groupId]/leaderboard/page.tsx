import Link from "next/link";
import { notFound } from "next/navigation";
import { type RankingChartLine } from "@/components/RankingChart";
import { PlayerDetailToggle, type PlayerMatchEntry } from "@/components/PlayerDetailToggle";
import { PodiumHighlights } from "@/components/PodiumHighlights";
import { UserAvatar } from "@/components/UserAvatar";
import { requireUser } from "@/lib/auth";
import {
  getGroupDetail,
  getLeaderboard,
  getMatchRankingData,
  getScoringSettings,
} from "@/lib/data";
import { displayName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getPodiumZones } from "@/lib/leaderboard";
import { buildRanking } from "@/lib/ranking";

type LeaderboardPageProps = {
  params: Promise<{ groupId: string }>;
};

function formatDayShort(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatLastUpdated(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, entries, rankingData, scoring, locale, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getLeaderboard(groupId),
    getMatchRankingData(groupId),
    getScoringSettings(),
    getLocale(),
    getDictionary(),
  ]);

  if (!group) {
    notFound();
  }

  const model = buildRanking(rankingData.matches, rankingData.scores, rankingData.members);
  const nameFor = (userId: string) =>
    rankingData.members.find((member) => member.user_id === userId)?.display_name ??
    t.leaderboard.player;

  const allRanks = model.series.flatMap((s) => s.points.map((p) => p.rank));
  const maxRank = Math.max(1, ...allRanks);

  const matchSteps = model.timeline.map((step) => ({
    id: step.match.id,
    label: String(step.match.match_number),
  }));
  const daySteps = model.byDay.map((day) => ({
    id: day.date,
    label: formatDayShort(day.date, locale),
  }));

  const matchLineFor = (userId: string): RankingChartLine | null => {
    const series = model.series.find((s) => s.userId === userId);
    if (!series) {
      return null;
    }
    return { userId, name: nameFor(userId), ranks: series.points.map((point) => point.rank) };
  };

  const dayLineFor = (userId: string): RankingChartLine | null => {
    // Mirror matchLineFor: a user with no ranking series has no line at all,
    // rather than being plotted in last place on the by-day chart.
    if (!model.series.some((s) => s.userId === userId)) {
      return null;
    }
    return {
      userId,
      name: nameFor(userId),
      ranks: model.byDay.map(
        (day) => day.standings.find((entry) => entry.userId === userId)?.rank ?? maxRank,
      ),
    };
  };

  const matchLabel = (matchNumber: number, home: string, away: string) =>
    `${t.matches.match} ${matchNumber} · ${displayName(home, t.matches.fallbackTeam)} ${t.matches.versus} ${displayName(away, t.matches.fallbackTeam)}`;

  // Per-player breakdown rows, most-recent match first.
  const perMatchEntriesFor = (userId: string): PlayerMatchEntry[] =>
    [...model.perMatch]
      .reverse()
      .map((breakdown) => {
        const entry = breakdown.entries.find((e) => e.userId === userId);
        if (!entry) {
          return null;
        }
        return {
          matchId: breakdown.match.id,
          label: matchLabel(
            breakdown.match.match_number,
            breakdown.match.home_team_name,
            breakdown.match.away_team_name,
          ),
          matchPoints: entry.matchPoints,
          rank: entry.rank,
          rankDelta: entry.rankDelta,
          predictionHomeGoals: entry.predictionHomeGoals,
          predictionAwayGoals: entry.predictionAwayGoals,
          resultHomeGoals: entry.resultHomeGoals,
          resultAwayGoals: entry.resultAwayGoals,
          exact: entry.exact,
          correctWinner: entry.correctWinner,
          correctDraw: entry.correctDraw,
          winnerGoals: entry.winnerGoals,
          goalDifference: entry.goalDifference,
          loserGoals: entry.loserGoals,
          routBonus: entry.routBonus,
          extraTime: entry.extraTime,
          penalties: entry.penalties,
        };
      })
      .filter((row): row is PlayerMatchEntry => row !== null);

  const perfFor = (userId: string) =>
    model.performance.find((stat) => stat.userId === userId) ?? null;

  const criteriaLabels = {
    correctWinner: t.matches.correctWinner,
    correctDraw: t.matches.correctDraw,
    winnerGoals: t.matches.winnerGoals,
    goalDifference: t.matches.goalDifference,
    loserGoals: t.matches.loserGoals,
    exactScore: t.matches.exactScore,
    rout: t.matches.rout,
    extraTime: t.matches.extraTime,
    penalties: t.matches.penalties,
  } as const;

  // Competition ranking: entries with the same total_points share the same rank,
  // and the next rank skips accordingly (1, 1, 3 not 1, 1, 2).
  const rankedEntries: { entry: (typeof entries)[number]; rank: number }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const prev = i > 0 ? rankedEntries[i - 1] : null;
    const rank = prev && prev.entry.total_points === entry.total_points ? prev.rank : i + 1;
    rankedEntries.push({ entry, rank });
  }

  const { topZone, bottomZone } = getPodiumZones(rankedEntries);

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>{t.leaderboard.title}</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>{t.group.overview}</Link>
        <Link href={`/groups/${group.id}/matches`}>{t.group.matches}</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>{t.group.leaderboard}</Link>
      </div>

      <div className="notice" style={{ marginBottom: "0.5rem" }}>
        {t.leaderboard.scoring
          .replace("{baseMin}", String(scoring.baseMinPoints))
          .replace("{baseMax}", String(scoring.baseMaxPoints))
          .replace("{exact}", String(scoring.exactScoreBonusPoints))
          .replace("{winnerGoals}", String(scoring.winnerGoalsBonusPoints))
          .replace("{goalDifference}", String(scoring.goalDifferenceBonusPoints))}
      </div>

      {rankingData.lastUpdatedAt ? (
        <p className="muted" style={{ marginBottom: "1rem" }}>
          {t.leaderboard.lastUpdated.replace("{datetime}", formatLastUpdated(rankingData.lastUpdatedAt, locale))}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <div className="empty">{t.leaderboard.empty}</div>
      ) : (
        <>
        <PodiumHighlights
          bottomLabel={t.leaderboard.bottomZoneLabel}
          bottomZone={bottomZone}
          playerFallback={t.leaderboard.player}
          topLabel={t.leaderboard.topZoneLabel}
          topZone={topZone}
        />
        <section className="leaderboard">
          {rankedEntries.map(({ entry, rank }) => {
            const stat = perfFor(entry.user_id);
            return (
              <article
                className={
                  entry.user_id === user.id ? "leader-row leader-card current" : "leader-row leader-card"
                }
                key={entry.user_id}
              >
                <details className="leader-detail">
                  <summary>
                    <div className="leader-summary">
                      <span className="rank">{rank}</span>
                      <UserAvatar
                        name={entry.display_name}
                        seed={entry.user_id}
                        url={entry.avatar_url}
                      />
                      <div>
                        <Link href={`/groups/${group.id}/ranking/${entry.user_id}`} className="leader-name-link">
                          <strong>{entry.display_name ?? t.leaderboard.player}</strong>
                        </Link>
                        <div className="scoring-badges">
                          <span className="scoring-badge">
                            {t.leaderboard.base} <strong>{entry.base_points}</strong>
                          </span>
                          <span className="scoring-badge">
                            {t.leaderboard.bonus} <strong>{entry.bonus_points}</strong>
                          </span>
                          <span className="scoring-badge">
                            {t.leaderboard.exact} <strong>{entry.exact_score_count}</strong>
                          </span>
                          <span className="scoring-badge">
                            {t.leaderboard.winners} <strong>{entry.winner_count}</strong>
                          </span>
                        </div>
                      </div>
                      <span className="points">{entry.total_points}</span>
                    </div>
                  </summary>

                  {stat ? (
                    <dl className="perf-stats">
                      <div>
                        <dt>{t.ranking.bestMatch}</dt>
                        <dd>{stat.bestMatchPoints}</dd>
                      </div>
                      <div>
                        <dt>{t.ranking.bestRank}</dt>
                        <dd>#{stat.bestRank}</dd>
                      </div>
                      <div>
                        <dt>{t.ranking.climb}</dt>
                        <dd>{stat.biggestClimb > 0 ? `▲ ${stat.biggestClimb}` : "–"}</dd>
                      </div>
                    </dl>
                  ) : null}

                  <PlayerDetailToggle
                    userId={entry.user_id}
                    maxRank={maxRank}
                    matchSteps={matchSteps}
                    matchLine={matchLineFor(entry.user_id)}
                    daySteps={daySteps}
                    dayLine={dayLineFor(entry.user_id)}
                    perMatchEntries={perMatchEntriesFor(entry.user_id)}
                    matchLabel={t.ranking.positionByMatch}
                    dayLabel={t.ranking.positionByDay}
                    pointsLabel={t.ranking.viewPointsPerMatch}
                    emptyLabel={t.ranking.noData}
                    matchXAxis={t.ranking.chartXAxisMatch}
                    dayXAxis={t.ranking.chartXAxisDay}
                    tableMatchHeader={t.matches.match}
                    tablePointsHeader={t.ranking.points}
                    tableRankHeader={t.ranking.rankAfterMatch}
                    tableChangeHeader={t.ranking.change}
                    tablePredictionHeader={t.ranking.prediction}
                    tableCriteriaHeader={t.ranking.criteria}
                    criteriaLabels={criteriaLabels}
                    versusLabel={t.matches.versus}
                    noCriteriaLabel={t.ranking.noCriteria}
                  />
                </details>
              </article>
            );
          })}
        </section>
        </>
      )}
    </main>
  );
}
