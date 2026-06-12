import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalKickoff } from "@/components/LocalKickoff";
import { TeamName } from "@/components/TeamName";
import { UserAvatar } from "@/components/UserAvatar";
import { requireUser } from "@/lib/auth";
import { getClosedMatchDetail, getGroupDetail } from "@/lib/data";
import { displayName } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { LiveMatchCriterion } from "@/lib/liveMatch";

type MatchDetailPageProps = {
  params: Promise<{ groupId: string; matchId: string }>;
};

function rankDelta(delta: number) {
  if (delta > 0) return <span className="rank-delta up">▲ {delta}</span>;
  if (delta < 0) return <span className="rank-delta down">▼ {Math.abs(delta)}</span>;
  return <span className="rank-delta flat">-</span>;
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { user } = await requireUser();
  const { groupId, matchId } = await params;
  const [group, detail, locale, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getClosedMatchDetail(groupId, matchId, user.id),
    getLocale(),
    getDictionary(),
  ]);

  if (!group || !detail) {
    notFound();
  }

  const { match, view } = detail;
  const homeName = displayName(
    match.home_team_name,
    match.home_team_placeholder ?? t.matches.fallbackTeam,
  );
  const awayName = displayName(
    match.away_team_name,
    match.away_team_placeholder ?? t.matches.fallbackTeam,
  );
  const criteriaLabels: Record<LiveMatchCriterion, string> = {
    correctWinner: t.matches.correctWinner,
    winnerGoals: t.matches.winnerGoals,
    goalDifference: t.matches.goalDifference,
    loserGoals: t.matches.loserGoals,
    exactScore: t.matches.exactScore,
    rout: t.matches.rout,
    extraTime: t.matches.extraTime,
    penalties: t.matches.penalties,
  };

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>{t.matches.details}</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>{t.group.overview}</Link>
        <Link href={`/groups/${group.id}/matches`}>{t.group.matches}</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>{t.group.leaderboard}</Link>
        <Link href={`/groups/${group.id}/ranking`}>{t.group.ranking}</Link>
      </div>

      <section className="card live-match-hero">
        <div className="row">
          <span className="muted">
            {t.matches.match} {match.match_number} · {match.group_name ?? match.round}
          </span>
          <span className="muted">
            <LocalKickoff iso={match.kickoff_utc} locale={locale} />
          </span>
        </div>
        <div className="match-title">
          <TeamName canonicalName={match.home_team_name} className="team" name={homeName} />
          <span className="muted">{t.matches.versus}</span>
          <TeamName canonicalName={match.away_team_name} className="team" name={awayName} />
        </div>
        {match.result_home_goals !== null && match.result_away_goals !== null ? (
          <div className="live-score">
            <span>{match.result_home_goals}</span>
            <span>{t.matches.versus}</span>
            <span>{match.result_away_goals}</span>
          </div>
        ) : (
          <div className="notice">{t.matches.noOfficialScore}</div>
        )}
      </section>

      <section className="grid two live-match-summary">
        <article className="card">
          <h2>{t.matches.groupPickDistribution}</h2>
          <div className="pick-distribution">
            <div>
              <strong>{view.distribution.home}</strong>
              <span>{t.matches.home}</span>
            </div>
            <div>
              <strong>{view.distribution.draw}</strong>
              <span>{t.matches.draw}</span>
            </div>
            <div>
              <strong>{view.distribution.away}</strong>
              <span>{t.matches.away}</span>
            </div>
          </div>
        </article>

        <article className="card">
          <h2>{t.matches.yourMovement}</h2>
          {view.currentUserMovement ? (
            <div className="movement-summary">
              <div>
                <span className="muted">{t.matches.preMatchRank}</span>
                <strong>#{view.currentUserMovement.preMatchRank}</strong>
              </div>
              <div>
                <span className="muted">{t.matches.liveRank}</span>
                <strong>#{view.currentUserMovement.liveRank}</strong>
              </div>
              <div>
                <span className="muted">{t.matches.rankChange}</span>
                {rankDelta(view.currentUserMovement.rankDelta)}
              </div>
            </div>
          ) : (
            <p className="muted">{t.matches.noUserMovement}</p>
          )}
        </article>
      </section>

      <section aria-label={t.matches.participants}>
        <h2 className="section-heading">{t.matches.participants}</h2>
        {view.participants.length > 0 ? (
          <div className="card ranking-breakdown live-picks-card">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.matches.player}</th>
                  <th>{t.matches.prediction}</th>
                  <th>{t.matches.partialPoints}</th>
                  <th>{t.matches.criteria}</th>
                  <th>{t.matches.rankChange}</th>
                </tr>
              </thead>
              <tbody>
                {view.participants.map((participant) => (
                  <tr
                    className={participant.userId === user.id ? "current" : undefined}
                    key={participant.userId}
                  >
                    <td>{participant.liveRank}</td>
                    <td>
                      <span className="live-pick-player">
                        <UserAvatar
                          name={participant.displayName}
                          seed={participant.userId}
                          size={30}
                          url={participant.avatarUrl}
                        />
                        {participant.displayName ?? t.matches.player}
                      </span>
                    </td>
                    <td>
                      {participant.prediction.homeGoals} {t.matches.versus}{" "}
                      {participant.prediction.awayGoals}
                    </td>
                    <td>{participant.points}</td>
                    <td>
                      {participant.criteria.length > 0 ? (
                        <span className="criteria-list">
                          {participant.criteria.map((criterion) => (
                            <span className="criterion-pill" key={criterion}>
                              {criteriaLabels[criterion]}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="muted">{t.matches.noCriteria}</span>
                      )}
                    </td>
                    <td>{rankDelta(participant.rankDelta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">{t.matches.noPredictions}</div>
        )}
      </section>
    </main>
  );
}
