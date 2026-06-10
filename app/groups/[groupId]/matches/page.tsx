import Link from "next/link";
import { LocalKickoff } from "@/components/LocalKickoff";
import { TeamName } from "@/components/TeamName";
import { notFound } from "next/navigation";
import { saveAllPredictionsAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getMatchesWithPredictions } from "@/lib/data";
import { displayName } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";

type MatchesPageProps = {
  params: Promise<{ groupId: string }>;
};

function formatProbability(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
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

export default async function MatchesPage({ params }: MatchesPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, matches, locale, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getMatchesWithPredictions(groupId, user.id),
    getLocale(),
    getDictionary(),
  ]);

  if (!group) {
    notFound();
  }

  const now = Date.now();
  const unlockedMatchIds = matches
    .filter((match) => new Date(match.kickoff_utc).getTime() > now)
    .map((match) => match.id);

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
        <Link href={`/groups/${group.id}/ranking`}>{t.group.ranking}</Link>
      </div>

      {matches.length === 0 ? (
        <div className="empty">{t.matches.empty}</div>
      ) : (
        <form className="match-form" action={saveAllPredictionsAction}>
          <input name="groupId" type="hidden" value={group.id} />
          <input name="matchIds" type="hidden" value={unlockedMatchIds.join(",")} />

          <section className="match-list">
            {matches.map((match) => {
              const locked = new Date(match.kickoff_utc).getTime() <= now;
              const homeName = displayName(
                match.home_team_name,
                match.home_team_placeholder ?? t.matches.fallbackTeam,
              );
              const awayName = displayName(
                match.away_team_name,
                match.away_team_placeholder ?? t.matches.fallbackTeam,
              );

              return (
                <article className="match-card" key={match.id}>
                  <div className="row">
                    <span className="muted">
                      {t.matches.match} {match.match_number} · {match.group_name ?? match.round}
                    </span>
                    <span className="muted">
                      <LocalKickoff iso={match.kickoff_utc} locale={locale} />
                    </span>
                  </div>

                  <div className="match-title">
                    <TeamName
                      canonicalName={match.home_team_name}
                      className="team"
                      name={homeName}
                    />
                    <span className="muted">{t.matches.versus}</span>
                    <TeamName
                      canonicalName={match.away_team_name}
                      className="team"
                      name={awayName}
                    />
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
                      {t.matches.odds}: {t.matches.home}{" "}
                      {formatProbability(match.odds_home_win_probability)} · {t.matches.draw}{" "}
                      {formatProbability(match.odds_draw_probability)} · {t.matches.away}{" "}
                      {formatProbability(match.odds_away_win_probability)}
                    </div>
                  ) : null}

                  <div className="score-inputs">
                    <label>
                      <TeamName canonicalName={match.home_team_name} name={homeName} />
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
                  </div>
                </article>
              );
            })}
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
