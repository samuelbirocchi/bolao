import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingChart, type RankingChartLine } from "@/components/RankingChart";
import { UserAvatar } from "@/components/UserAvatar";
import { PlayerDetailTabs } from "@/components/PlayerDetailTabs";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getMatchRankingData, type LeaderboardEntry } from "@/lib/data";
import { displayName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { buildRanking, type PerMatchEntry, type RankingMatch } from "@/lib/ranking";

function formatDayShort(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function rankDelta(delta: number) {
  if (delta > 0) {
    return <span className="rank-delta up">▲ {delta}</span>;
  }
  if (delta < 0) {
    return <span className="rank-delta down">▼ {Math.abs(delta)}</span>;
  }
  return <span className="rank-delta flat">–</span>;
}

function matchTitle(
  matchNumber: number,
  home: string,
  away: string,
  matchLabel: string,
  fallbackTeam: string,
  versus: string,
) {
  return `${matchLabel} ${matchNumber} · ${displayName(home, fallbackTeam)} ${versus} ${displayName(away, fallbackTeam)}`;
}

type PlayerDetailPageProps = {
  params: Promise<{ groupId: string; userId: string }>;
};

export default async function PlayerDetailPage({ params }: PlayerDetailPageProps) {
  const { user } = await requireUser();
  const { groupId, userId } = await params;

  const [group, data, locale, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getMatchRankingData(groupId),
    getLocale(),
    getDictionary(),
  ]);

  if (!group) {
    notFound();
  }

  const model = buildRanking(data.matches, data.scores, data.members);
  const membersById = new Map<string, LeaderboardEntry>(
    data.members.map((member) => [member.user_id, member]),
  );
  const nameFor = (uid: string) =>
    membersById.get(uid)?.display_name ?? t.leaderboard.player;

  const playerMember = membersById.get(userId);
  if (!playerMember) {
    notFound();
  }

  const currentStanding = model.currentStandings.find((entry) => entry.userId === userId);
  if (!currentStanding) {
    notFound();
  }

  const maxRank = Math.max(1, model.members.length);

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
    label: formatDayShort(day.date, locale),
  }));
  const dayLines: RankingChartLine[] = model.members.map((member) => ({
    userId: member.user_id,
    name: nameFor(member.user_id),
    ranks: model.byDay.map(
      (day) => day.standings.find((entry) => entry.userId === member.user_id)?.rank ?? maxRank,
    ),
  }));

  const playerPerMatch = [...model.perMatch]
    .reverse()
    .map((breakdown) => {
      const entry = breakdown.entries.find((e) => e.userId === userId);
      if (!entry) return null;
      return { match: breakdown.match, entry };
    })
    .filter((item): item is { match: RankingMatch; entry: PerMatchEntry } => item !== null);

  const byMatchChart = (
    <RankingChart
      steps={matchSteps}
      lines={matchLines}
      currentUserId={userId}
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
      currentUserId={userId}
      maxRank={maxRank}
      title={t.ranking.historyByDay}
      emptyLabel={t.ranking.noData}
      xAxisLabel={t.ranking.chartXAxisDay}
    />
  );

  const pointsByGame = (
    <section className="card player-points" aria-label={t.ranking.pointsByGame}>
      <h2>{t.ranking.pointsByGame}</h2>
      {playerPerMatch.length > 0 ? (
        <div className="stack">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>{t.ranking.matchNumber}</th>
                <th>{t.matches.versus}</th>
                <th>{t.ranking.matchPoints}</th>
                <th>{t.ranking.total}</th>
                <th>{t.ranking.positionAfterMatch}</th>
                <th>{t.ranking.change}</th>
              </tr>
            </thead>
            <tbody>
              {playerPerMatch.map((item) => (
                <tr key={item.match.id}>
                  <td>{item.match.match_number}</td>
                  <td>
                    {matchTitle(
                      item.match.match_number,
                      item.match.home_team_name,
                      item.match.away_team_name,
                      t.matches.match,
                      t.matches.fallbackTeam,
                      t.matches.versus,
                    )}
                  </td>
                  <td>{item.entry.matchPoints}</td>
                  <td>{item.entry.cumulativePoints}</td>
                  <td>#{item.entry.rank}</td>
                  <td>{rankDelta(item.entry.rankDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">{t.ranking.noData}</div>
      )}
    </section>
  );

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>{t.ranking.playerDetail}</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>{t.group.overview}</Link>
        <Link href={`/groups/${group.id}/matches`}>{t.group.matches}</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>{t.group.leaderboard}</Link>
      </div>

      <section className="card ranking-current" aria-label={t.ranking.playerDetail}>
        <div className="ranking-current-body">
          <span className="rank">{currentStanding.rank}</span>
          <UserAvatar
            name={playerMember.display_name}
            seed={userId}
            url={playerMember.avatar_url}
          />
          <div>
            <strong>{displayName(playerMember.display_name, t.leaderboard.player)}</strong>
            <p className="muted">
              {t.ranking.rank} {currentStanding.rank}/{model.members.length} · {t.ranking.exact}{" "}
              {currentStanding.exactScoreCount} · {t.ranking.winners} {currentStanding.winnerCount}
            </p>
          </div>
          <span className="points">{currentStanding.cumulativePoints}</span>
        </div>
      </section>

      <PlayerDetailTabs
        rankingEvolutionLabel={t.ranking.rankingEvolution}
        pointsByGameLabel={t.ranking.pointsByGame}
        byMatchLabel={t.ranking.byMatch}
        byDayLabel={t.ranking.byDay}
        showAllLabel={t.ranking.showAll}
        showLessLabel={t.ranking.showLess}
        byMatchChart={byMatchChart}
        byDayChart={byDayChart}
        pointsByGame={pointsByGame}
      />
    </main>
  );
}
