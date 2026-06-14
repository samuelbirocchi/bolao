import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingChart, type RankingChartLine } from "@/components/RankingChart";
import { RankingEvolutionTabs } from "@/components/RankingEvolutionTabs";
import { UserAvatar } from "@/components/UserAvatar";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getLeaderboard, getMatchRankingData, getScoringSettings } from "@/lib/data";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { buildRanking } from "@/lib/ranking";
import type { Locale } from "@/lib/i18n";

type LeaderboardPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, entries, scoring, rankingData, locale, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getLeaderboard(groupId),
    getScoringSettings(),
    getMatchRankingData(groupId),
    getLocale(),
    getDictionary(),
  ]);

  if (!group) {
    notFound();
  }

  const model = buildRanking(rankingData.matches, rankingData.scores, rankingData.members);
  const membersById = new Map(rankingData.members.map((m) => [m.user_id, m]));
  const nameFor = (userId: string) =>
    membersById.get(userId)?.display_name ?? t.leaderboard.player;

  const maxRank = Math.max(1, model.members.length);
  const hasMatches = model.timeline.length > 0;

  const matchSteps = model.timeline.map((step) => ({
    id: step.match.id,
    label: String(step.match.match_number),
  }));
  const matchLines: RankingChartLine[] = model.series.map((entry) => ({
    userId: entry.userId,
    name: nameFor(entry.userId),
    ranks: entry.points.map((point) => point.rank),
  }));

  const daySteps = model.byDay.map((day) => ({
    id: day.date,
    label: new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${day.date}T00:00:00Z`)),
  }));
  const dayLines: RankingChartLine[] = model.members.map((member) => ({
    userId: member.user_id,
    name: nameFor(member.user_id),
    ranks: model.byDay.map(
      (day) => day.standings.find((entry) => entry.userId === member.user_id)?.rank ?? maxRank,
    ),
  }));

  const performanceMap = new Map(model.performance.map((p) => [p.userId, p]));
  const seriesMap = new Map(model.series.map((s) => [s.userId, s]));

  const byMatchChart = (
    <RankingChart
      steps={matchSteps}
      lines={matchLines}
      currentUserId={user.id}
      maxRank={maxRank}
      title={t.ranking.historyByMatch}
      emptyLabel={t.ranking.noData}
      xAxisLabel={t.ranking.chartXAxisMatch}
    />
  );

  const byDayChart = (
    <RankingChart
      steps={daySteps}
      lines={dayLines}
      currentUserId={user.id}
      maxRank={maxRank}
      title={t.ranking.historyByDay}
      emptyLabel={t.ranking.noData}
      xAxisLabel={t.ranking.chartXAxisDay}
    />
  );

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

      <div className="notice" style={{ marginBottom: "1rem" }}>
        {t.leaderboard.scoring
          .replace("{baseMin}", String(scoring.baseMinPoints))
          .replace("{baseMax}", String(scoring.baseMaxPoints))
          .replace("{exact}", String(scoring.exactScoreBonusPoints))
          .replace("{winnerGoals}", String(scoring.winnerGoalsBonusPoints))
          .replace("{goalDifference}", String(scoring.goalDifferenceBonusPoints))}
      </div>

      {hasMatches ? (
        <RankingEvolutionTabs
          byMatchLabel={t.ranking.historyByMatch}
          byDayLabel={t.ranking.historyByDay}
          byMatchContent={byMatchChart}
          byDayContent={byDayChart}
        />
      ) : null}

      {entries.length === 0 ? (
        <div className="empty">{t.leaderboard.empty}</div>
      ) : (
        <section className="leaderboard">
          {entries.map((entry, index) => {
            const perf = performanceMap.get(entry.user_id);
            const memberSeries = seriesMap.get(entry.user_id);
            const memberRankSteps = memberSeries
              ? model.timeline.map((step) => ({
                  id: step.match.id,
                  label: String(step.match.match_number),
                }))
              : [];
            const memberRankLines: RankingChartLine[] = memberSeries
              ? [
                  {
                    userId: entry.user_id,
                    name: nameFor(entry.user_id),
                    ranks: memberSeries.points.map((p) => p.rank),
                  },
                ]
              : [];

            return (
              <details className="leader-detail" key={entry.user_id}>
                <summary className="leader-row">
                  <span className="rank">{index + 1}</span>
                  <UserAvatar
                    name={entry.display_name}
                    seed={entry.user_id}
                    url={entry.avatar_url}
                  />
                  <div>
                    <strong>{entry.display_name ?? t.leaderboard.player}</strong>
                    <p className="muted">
                      {t.leaderboard.base} {entry.base_points} · {t.leaderboard.bonus}{" "}
                      {entry.bonus_points} · {t.leaderboard.exact} {entry.exact_score_count} ·{" "}
                      {t.leaderboard.winners} {entry.winner_count}
                    </p>
                  </div>
                  <span className="points">{entry.total_points}</span>
                </summary>
                {perf ? (
                  <div className="leader-detail-body">
                    <dl className="perf-stats">
                      <div>
                        <dt>{t.ranking.bestMatch}</dt>
                        <dd>{perf.bestMatchPoints}</dd>
                      </div>
                      <div>
                        <dt>{t.ranking.bestRank}</dt>
                        <dd>#{perf.bestRank}</dd>
                      </div>
                      <div>
                        <dt>{t.ranking.climb}</dt>
                        <dd>{perf.biggestClimb > 0 ? `▲ ${perf.biggestClimb}` : "–"}</dd>
                      </div>
                    </dl>
                    {memberRankSteps.length > 0 ? (
                      <RankingChart
                        steps={memberRankSteps}
                        lines={memberRankLines}
                        currentUserId={entry.user_id}
                        maxRank={maxRank}
                        title={t.ranking.positionHistory}
                        emptyLabel={t.ranking.noData}
                        xAxisLabel={t.ranking.chartXAxisMatch}
                      />
                    ) : null}
                  </div>
                ) : null}
              </details>
            );
          })}
        </section>
      )}
    </main>
  );
}
