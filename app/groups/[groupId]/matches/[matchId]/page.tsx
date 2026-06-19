import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalKickoff } from "@/components/LocalKickoff";
import { TeamName } from "@/components/TeamName";
import { UserAvatar } from "@/components/UserAvatar";
import { requireUser } from "@/lib/auth";
import { getClosedMatchDetail, getGroupDetail, getScoringSettings } from "@/lib/data";
import { displayName } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { LiveMatchCriterion } from "@/lib/liveMatch";
import { calculateBasePoints } from "@/lib/scoring";

type MatchDetailPageProps = {
  params: Promise<{ groupId: string; matchId: string }>;
};

function rankDelta(delta: number) {
  if (delta > 0) return <span className="rank-delta up">▲ {delta}</span>;
  if (delta < 0) return <span className="rank-delta down">▼ {Math.abs(delta)}</span>;
  return <span className="rank-delta flat">-</span>;
}

function formatProbability(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function statsBarWidth(count: number, total: number) {
  return total === 0 ? "0%" : `${Math.max(2, Math.round((count / total) * 100))}%`;
}

function formatStatsShare(count: number, total: number, locale: string) {
  if (total === 0) {
    return "0%";
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(count / total);
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { user } = await requireUser();
  const { groupId, matchId } = await params;
  const [group, detail, scoring, locale, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getClosedMatchDetail(groupId, matchId, user.id),
    getScoringSettings(),
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
    correctDraw: t.matches.correctDraw,
    winnerGoals: t.matches.winnerGoals,
    goalDifference: t.matches.goalDifference,
    loserGoals: t.matches.loserGoals,
    exactScore: t.matches.exactScore,
    rout: t.matches.rout,
    extraTime: t.matches.extraTime,
    penalties: t.matches.penalties,
  };

  const total = view.participants.length;
  const outcomeRows = [
    { className: "home", count: view.distribution.home, label: homeName },
    { className: "draw", count: view.distribution.draw, label: t.matches.draw },
    { className: "away", count: view.distribution.away, label: awayName },
  ];
  const commonScorelines = view.scorelines.slice(0, 5);

  const homePoints = calculateBasePoints(match.odds_home_win_probability, scoring);
  const awayPoints = calculateBasePoints(match.odds_away_win_probability, scoring);
  const drawPoints = calculateBasePoints(match.odds_draw_probability, scoring);

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
      </div>

      {/* 1. Teams + status hero card */}
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

        {/* 2. Current/final result */}
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

      {/* 3. Group prediction stats */}
      <section className="card prediction-stats">
        <div className="prediction-stats-grid">
          <div>
            <h3>{t.matches.winnerStats}</h3>
            <div className="stat-bars">
              {outcomeRows.map((row) => (
                <div className="stat-bar-row" key={row.label}>
                  <span>{row.label}</span>
                  <div className="stat-bar-track" aria-hidden="true">
                    <span
                      className={`stat-bar-fill ${row.className}`}
                      style={{ width: statsBarWidth(row.count, total) }}
                    />
                  </div>
                  <strong>{formatStatsShare(row.count, total, locale)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3>{t.matches.commonScores}</h3>
            {commonScorelines.length > 0 ? (
              <ol className="scoreline-list">
                {commonScorelines.map((scoreline) => (
                  <li
                    className="stat-bar-row"
                    key={`${scoreline.homeGoals}-${scoreline.awayGoals}`}
                  >
                    <span>
                      {scoreline.homeGoals} {t.matches.versus} {scoreline.awayGoals}
                    </span>
                    <div className="stat-bar-track" aria-hidden="true">
                      <span
                        className="stat-bar-fill scoreline"
                        style={{ width: statsBarWidth(scoreline.count, total) }}
                      />
                    </div>
                    <strong>{formatStatsShare(scoreline.count, total, locale)}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">{t.matches.noStats}</p>
            )}
          </div>
        </div>
      </section>

      {/* 4. Complementary info (collapsible) */}
      <details className="card prediction-stats-details">
        <summary className="prediction-stats-summary">
          <strong>{t.matches.complementaryInfo}</strong>
        </summary>

        <div className="prediction-stats">
          {match.odds_captured_at !== null ? (
            <div>
              <h3>{t.matches.odds}</h3>
              <p className="muted">
                {t.matches.home} {formatProbability(match.odds_home_win_probability)} ·{" "}
                {t.matches.draw} {formatProbability(match.odds_draw_probability)} ·{" "}
                {t.matches.away} {formatProbability(match.odds_away_win_probability)}
              </p>
            </div>
          ) : null}

          <div>
            <h3>{t.matches.victoryPoints.points.replace("{points}", String(homePoints)).replace("{team}", "")}</h3>
            <p className="muted">
              {homeName}: {homePoints} pts · {awayName}: {awayPoints} pts ·{" "}
              {t.matches.draw}: {drawPoints} pts
            </p>
          </div>

          {view.currentUserMovement ? (
            <div>
              <h3>{t.matches.yourMovement}</h3>
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
            </div>
          ) : (
            <p className="muted">{t.matches.noUserMovement}</p>
          )}
        </div>
      </details>

      {/* 5. Participants table */}
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
                          gravatarHash={participant.gravatarHash}
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
