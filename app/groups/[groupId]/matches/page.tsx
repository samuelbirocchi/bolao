import Link from "next/link";
import { DateBar } from "@/components/DateBar";
import { LocalKickoff } from "@/components/LocalKickoff";
import { TeamName } from "@/components/TeamName";
import { notFound } from "next/navigation";
import { saveAllPredictionsAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getMatchesWithPredictions, getScoringSettings } from "@/lib/data";
import { displayName } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { hasSaveFeedback } from "@/lib/saveFeedback";
import {
  getLocalDateKey,
  groupUpcomingByDate,
  isMatchLocked,
  splitMatchesByKickoff,
} from "@/lib/matches";
import { calculateBasePoints, type ScoreWeights } from "@/lib/scoring";

type MatchesPageProps = {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

function formatProbability(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
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

function statsBarWidth(count: number, total: number) {
  return total === 0 ? "0%" : `${Math.max(2, Math.round((count / total) * 100))}%`;
}

function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, value),
    template,
  );
}

function buildVictoryPointCopy(
  teamName: string,
  probability: number | null,
  weights: ScoreWeights,
  labels: {
    fallbackTooltip: string;
    points: string;
    tooltip: string;
  },
) {
  const points = calculateBasePoints(probability, weights);
  const values = {
    ceiling: formatProbability(weights.baseCeilingProbability),
    floor: formatProbability(weights.baseFloorProbability),
    maxPoints: String(weights.baseMaxPoints),
    minPoints: String(weights.baseMinPoints),
    points: String(points),
    probability: formatProbability(probability),
    team: teamName,
  };

  return {
    label: fillTemplate(labels.points, values),
    tooltip: fillTemplate(
      probability === null ? labels.fallbackTooltip : labels.tooltip,
      values,
    ),
  };
}

function formatResolution(
  resolution: string | null,
  labels: { afterExtraTime: string; onPenalties: string },
) {
  if (resolution === "extra_time") {
    return labels.afterExtraTime;
  }

  if (resolution === "penalties") {
    return labels.onPenalties;
  }

  return null;
}

export default async function MatchesPage({ params, searchParams }: MatchesPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, matches, scoring, locale, t, queryParams] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getMatchesWithPredictions(groupId, user.id),
    getScoringSettings(),
    getLocale(),
    getDictionary(),
    searchParams,
  ]);

  if (!group) {
    notFound();
  }

  const now = Date.now();
  const unlockedMatchIds = matches
    .filter((match) => !isMatchLocked(match.kickoff_utc, now))
    .map((match) => match.id);
  const { pastMatches, upcomingMatches } = splitMatchesByKickoff(matches, now);
  // Server-UTC grouping for v1: pills are bucketed by UTC date, not the
  // viewer's local timezone (see PR notes for the limitation).
  const dateGroups = groupUpcomingByDate(upcomingMatches, "UTC", locale);
  const todayKey = getLocalDateKey(new Date().toISOString(), "UTC");

  const renderMatchCard = (match: (typeof matches)[number]) => {
    const locked = isMatchLocked(match.kickoff_utc, now);
    const homeName = displayName(
      match.home_team_name,
      match.home_team_placeholder ?? t.matches.fallbackTeam,
    );
    const awayName = displayName(
      match.away_team_name,
      match.away_team_placeholder ?? t.matches.fallbackTeam,
    );
    const predictionStats =
      locked && match.prediction_stats && match.prediction_stats.total > 0
        ? match.prediction_stats
        : null;
    const outcomeRows = predictionStats
      ? [
          {
            className: "home",
            count: predictionStats.outcomes.home,
            label: homeName,
          },
          {
            className: "draw",
            count: predictionStats.outcomes.draw,
            label: t.matches.draw,
          },
          {
            className: "away",
            count: predictionStats.outcomes.away,
            label: awayName,
          },
        ]
      : [];
    const commonScorelines = predictionStats?.scorelines.slice(0, 5) ?? [];
    const homeVictoryPoints = buildVictoryPointCopy(
      homeName,
      match.odds_home_win_probability,
      scoring,
      t.matches.victoryPoints,
    );
    const awayVictoryPoints = buildVictoryPointCopy(
      awayName,
      match.odds_away_win_probability,
      scoring,
      t.matches.victoryPoints,
    );
    const drawVictoryPoints = buildVictoryPointCopy(
      t.matches.draw,
      match.odds_draw_probability,
      scoring,
      t.matches.victoryPoints.drawPoints,
    );

    return (
      <article
        className={
          locked ? "match-card match-card-clickable match-card-past" : "match-card"
        }
        key={match.id}
      >
        {locked ? (
          <Link
            aria-label={`${t.matches.viewLivePicks}: ${homeName} ${t.matches.versus} ${awayName}`}
            className="match-card-overlay"
            href={`/groups/${group.id}/matches/${match.id}`}
          >
            <span className="sr-only">{t.matches.viewLivePicks}</span>
          </Link>
        ) : null}
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
          <div className="notice">
            {t.matches.result}: {match.result_home_goals} x {match.result_away_goals}
            {match.result_resolution === "penalties" &&
            match.result_home_penalties !== null &&
            match.result_away_penalties !== null
              ? ` (${match.result_home_penalties} x ${match.result_away_penalties} ${t.matches.penaltiesShort})`
              : ""}
            {formatResolution(match.result_resolution, t.matches)
              ? ` ${formatResolution(match.result_resolution, t.matches)}`
              : ""}
          </div>
        ) : null}

        {match.odds_captured_at !== null ? (
          <div className="notice">
            {t.matches.odds}: {t.matches.home} {formatProbability(match.odds_home_win_probability)}{" "}
            · {t.matches.draw} {formatProbability(match.odds_draw_probability)} ·{" "}
            {t.matches.away} {formatProbability(match.odds_away_win_probability)}
          </div>
        ) : null}

        <div className="score-inputs">
          <label>
            <TeamName canonicalName={match.home_team_name} name={homeName} />
            <span
              aria-describedby={`${match.id}-home-points-tooltip`}
              className="prediction-points-help"
              tabIndex={0}
              title={homeVictoryPoints.tooltip}
            >
              <span className="prediction-points">{homeVictoryPoints.label}</span>
              <span aria-hidden="true" className="prediction-points-icon">
                ?
              </span>
              <span
                className="prediction-points-tooltip"
                id={`${match.id}-home-points-tooltip`}
                role="tooltip"
              >
                {homeVictoryPoints.tooltip}
              </span>
            </span>
            <input
              aria-label={`${homeName} ${t.matches.goals}`}
              defaultValue={match.prediction_home_goals ?? ""}
              disabled={locked}
              min={0}
              name={`home-${match.id}`}
              type="number"
            />
          </label>
          <label>
            <TeamName canonicalName={match.away_team_name} name={awayName} />
            <span
              aria-describedby={`${match.id}-away-points-tooltip`}
              className="prediction-points-help"
              tabIndex={0}
              title={awayVictoryPoints.tooltip}
            >
              <span className="prediction-points">{awayVictoryPoints.label}</span>
              <span aria-hidden="true" className="prediction-points-icon">
                ?
              </span>
              <span
                className="prediction-points-tooltip"
                id={`${match.id}-away-points-tooltip`}
                role="tooltip"
              >
                {awayVictoryPoints.tooltip}
              </span>
            </span>
            <input
              aria-label={`${awayName} ${t.matches.goals}`}
              defaultValue={match.prediction_away_goals ?? ""}
              disabled={locked}
              min={0}
              name={`away-${match.id}`}
              type="number"
            />
          </label>
          {locked ? <span className="muted">{t.matches.locked}</span> : null}
          {!locked ? (
            <span
              aria-describedby={`${match.id}-draw-points-tooltip`}
              className="prediction-points-help prediction-draw-points"
              tabIndex={0}
              title={drawVictoryPoints.tooltip}
            >
              <span className="prediction-points">{drawVictoryPoints.label}</span>
              <span aria-hidden="true" className="prediction-points-icon">
                ?
              </span>
              <span
                className="prediction-points-tooltip"
                id={`${match.id}-draw-points-tooltip`}
                role="tooltip"
              >
                {drawVictoryPoints.tooltip}
              </span>
            </span>
          ) : null}
        </div>

        {predictionStats ? (
          <details className="prediction-stats-details">
            <summary className="prediction-stats-summary">
              <strong>{t.matches.statistics}</strong>
              <span className="muted">
                {t.matches.statsDescription.replace(
                  "{count}",
                  String(predictionStats.total),
                )}
              </span>
            </summary>

            <div className="prediction-stats">
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
                            style={{ width: statsBarWidth(row.count, predictionStats.total) }}
                          />
                        </div>
                        <strong>{formatStatsShare(row.count, predictionStats.total, locale)}</strong>
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
                            {scoreline.homeGoals} x {scoreline.awayGoals}
                          </span>
                          <div className="stat-bar-track" aria-hidden="true">
                            <span
                              className="stat-bar-fill scoreline"
                              style={{
                                width: statsBarWidth(scoreline.count, predictionStats.total),
                              }}
                            />
                          </div>
                          <strong>
                            {formatStatsShare(scoreline.count, predictionStats.total, locale)}
                          </strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">{t.matches.noStats}</p>
                  )}
                </div>
              </div>
            </div>
          </details>
        ) : locked ? (
          <div className="notice">{t.matches.noStats}</div>
        ) : null}
        {locked ? <span className="match-card-cta">{t.matches.viewLivePicks}</span> : null}
      </article>
    );
  };

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>{t.group.matches}</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>{t.group.overview}</Link>
        <Link href={`/groups/${group.id}/matches`}>{t.group.matches}</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>{t.group.leaderboard}</Link>
      </div>

      {hasSaveFeedback(queryParams.saved, "predictions") ? (
        <div className="notice" role="status">
          {t.matches.savedNotice}
        </div>
      ) : null}

      {matches.length === 0 ? (
        <div className="empty">{t.matches.empty}</div>
      ) : (
        <form className="match-form" action={saveAllPredictionsAction}>
          <input name="groupId" type="hidden" value={group.id} />
          <input name="matchIds" type="hidden" value={unlockedMatchIds.join(",")} />

          <section className="match-list">
            {pastMatches.length > 0 ? (
              <details className="past-matches">
                <summary>
                  {t.matches.pastMatches} ({pastMatches.length})
                </summary>
                <div className="past-matches-list">{pastMatches.map(renderMatchCard)}</div>
              </details>
            ) : null}
            {dateGroups.length > 1 ? (
              <DateBar
                ariaLabel={t.matches.dateBarAriaLabel}
                groups={dateGroups.map(({ dateKey, label }) => ({ dateKey, label }))}
                todayKey={todayKey}
                todayLabel={t.matches.today}
              >
                {dateGroups.map((group) => (
                  <div data-date-key={group.dateKey} key={group.dateKey}>
                    {group.matches.map(renderMatchCard)}
                  </div>
                ))}
              </DateBar>
            ) : (
              upcomingMatches.map(renderMatchCard)
            )}
          </section>

          <div className="match-form-actions">
            <button disabled={unlockedMatchIds.length === 0} type="submit">
              {t.matches.saveAll}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
