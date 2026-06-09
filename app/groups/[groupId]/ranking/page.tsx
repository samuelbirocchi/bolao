import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingChart, type RankingChartLine } from "@/components/RankingChart";
import { UserAvatar } from "@/components/UserAvatar";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getMatchRankingData, type LeaderboardEntry } from "@/lib/data";
import { displayName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { buildRanking, type PerMatchEntry } from "@/lib/ranking";

type RankingPageProps = {
  params: Promise<{ groupId: string }>;
};

function formatDayLong(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

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

export default async function RankingPage({ params }: RankingPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
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
  const nameFor = (userId: string) =>
    membersById.get(userId)?.display_name ?? t.leaderboard.player;

  const maxRank = Math.max(1, model.members.length);
  const hasMatches = model.timeline.length > 0;
  const current = model.currentStandings.find((entry) => entry.userId === user.id) ?? null;
  const performanceSorted = [...model.performance].sort((a, b) => a.currentRank - b.currentRank);

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

  // Most-recent match first for the breakdown tables.
  const perMatchRecent = [...model.perMatch].reverse();

  const matchTitle = (matchNumber: number, home: string, away: string) =>
    `${t.matches.match} ${matchNumber} · ${displayName(home, t.matches.fallbackTeam)} ${t.matches.versus} ${displayName(away, t.matches.fallbackTeam)}`;

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>{t.ranking.title}</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>{t.group.overview}</Link>
        <Link href={`/groups/${group.id}/matches`}>{t.group.matches}</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>{t.group.leaderboard}</Link>
        <Link href={`/groups/${group.id}/ranking`}>{t.group.ranking}</Link>
      </div>

      <section className="card ranking-current" aria-label={t.ranking.currentPosition}>
        <h2>{t.ranking.currentPosition}</h2>
        {current ? (
          <div className="ranking-current-body">
            <span className="rank">{current.rank}</span>
            <UserAvatar
              name={membersById.get(user.id)?.display_name ?? null}
              seed={user.id}
              url={membersById.get(user.id)?.avatar_url ?? null}
            />
            <div>
              <strong>{membersById.get(user.id)?.display_name ?? t.leaderboard.player}</strong>
              <p className="muted">
                {t.ranking.rank} {current.rank}/{model.members.length} · {t.ranking.exact}{" "}
                {current.exactScoreCount} · {t.ranking.winners} {current.winnerCount}
              </p>
            </div>
            <span className="points">{current.cumulativePoints}</span>
          </div>
        ) : (
          <div className="empty">{t.ranking.noData}</div>
        )}
      </section>

      <RankingChart
        steps={matchSteps}
        lines={matchLines}
        currentUserId={user.id}
        maxRank={maxRank}
        title={t.ranking.historyByMatch}
        emptyLabel={t.ranking.noData}
        xAxisLabel={t.ranking.chartXAxisMatch}
      />

      <RankingChart
        steps={daySteps}
        lines={dayLines}
        currentUserId={user.id}
        maxRank={maxRank}
        title={t.ranking.historyByDay}
        emptyLabel={t.ranking.noData}
        xAxisLabel={t.ranking.chartXAxisDay}
      />

      <section aria-label={t.ranking.performance}>
        <h2 className="section-heading">{t.ranking.performance}</h2>
        {hasMatches ? (
          <div className="grid three perf-grid">
            {performanceSorted.map((stat) => (
              <article className="perf-card" key={stat.userId}>
                <div className="perf-card-head">
                  <UserAvatar
                    name={membersById.get(stat.userId)?.display_name ?? null}
                    seed={stat.userId}
                    url={membersById.get(stat.userId)?.avatar_url ?? null}
                  />
                  <div>
                    <strong>{nameFor(stat.userId)}</strong>
                    <p className="muted">
                      {t.ranking.rank} {stat.currentRank} · {stat.currentPoints} {t.ranking.points}
                    </p>
                  </div>
                </div>
                <dl className="perf-stats">
                  <div>
                    <dt>{t.ranking.bestMatch}</dt>
                    <dd>{stat.bestMatchPoints}</dd>
                  </div>
                  <div>
                    <dt>{t.ranking.worstMatch}</dt>
                    <dd>{stat.worstMatchPoints}</dd>
                  </div>
                  <div>
                    <dt>{t.ranking.bestRank}</dt>
                    <dd>#{stat.bestRank}</dd>
                  </div>
                  <div>
                    <dt>{t.ranking.climb}</dt>
                    <dd>{stat.biggestClimb > 0 ? `▲ ${stat.biggestClimb}` : "–"}</dd>
                  </div>
                  <div>
                    <dt>{t.ranking.exact}</dt>
                    <dd>{stat.exactScoreCount}</dd>
                  </div>
                  <div>
                    <dt>{t.ranking.winners}</dt>
                    <dd>{stat.winnerCount}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">{t.ranking.noData}</div>
        )}
      </section>

      <section aria-label={t.ranking.perMatch}>
        <h2 className="section-heading">{t.ranking.perMatch}</h2>
        {hasMatches ? (
          <div className="stack">
            {perMatchRecent.map((breakdown) => (
              <article className="card ranking-breakdown" key={breakdown.match.id}>
                <h3>
                  {matchTitle(
                    breakdown.match.match_number,
                    breakdown.match.home_team_name,
                    breakdown.match.away_team_name,
                  )}
                </h3>
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t.ranking.player}</th>
                      <th>{t.ranking.matchPoints}</th>
                      <th>{t.ranking.total}</th>
                      <th>{t.ranking.change}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.entries.map((entry: PerMatchEntry) => (
                      <tr key={entry.userId} className={entry.userId === user.id ? "current" : undefined}>
                        <td>{entry.rank}</td>
                        <td>
                          {nameFor(entry.userId)}
                          {entry.exact ? <span className="badge-exact">{t.ranking.exactTag}</span> : null}
                        </td>
                        <td>{entry.matchPoints}</td>
                        <td>{entry.cumulativePoints}</td>
                        <td>{rankDelta(entry.rankDelta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">{t.ranking.noData}</div>
        )}
      </section>

      <section aria-label={t.ranking.perDay}>
        <h2 className="section-heading">{t.ranking.perDay}</h2>
        {hasMatches ? (
          <div className="stack">
            {model.byDay.map((day) => (
              <article className="card ranking-day" key={day.date}>
                <h3 className="ranking-day-head">{formatDayLong(day.date, locale)}</h3>
                <section className="leaderboard">
                  {day.standings.map((entry) => (
                    <div
                      className={entry.userId === user.id ? "leader-row current" : "leader-row"}
                      key={entry.userId}
                    >
                      <span className="rank">{entry.rank}</span>
                      <UserAvatar
                        name={membersById.get(entry.userId)?.display_name ?? null}
                        seed={entry.userId}
                        url={membersById.get(entry.userId)?.avatar_url ?? null}
                      />
                      <div>
                        <strong>{nameFor(entry.userId)}</strong>
                        <p className="muted">
                          {t.ranking.exact} {entry.exactScoreCount} · {t.ranking.winners}{" "}
                          {entry.winnerCount}
                        </p>
                      </div>
                      <span className="points">{entry.cumulativePoints}</span>
                    </div>
                  ))}
                </section>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">{t.ranking.noData}</div>
        )}
      </section>
    </main>
  );
}
