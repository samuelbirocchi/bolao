import Link from "next/link";
import { notFound } from "next/navigation";
import { savePredictionAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getMatchesWithPredictions } from "@/lib/data";
import { displayName } from "@/lib/format";
import { formatKickoffForLocale } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";

type MatchesPageProps = {
  params: Promise<{ groupId: string }>;
};

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

      {matches.length === 0 ? (
        <div className="empty">{t.matches.empty}</div>
      ) : (
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
                    {formatKickoffForLocale(match.kickoff_utc, locale)}
                  </span>
                </div>

                <div className="match-title">
                  <span className="team">{homeName}</span>
                  <span className="muted">{t.matches.versus}</span>
                  <span className="team">{awayName}</span>
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

                <form className="score-inputs" action={savePredictionAction}>
                  <input name="groupId" type="hidden" value={group.id} />
                  <input name="matchId" type="hidden" value={match.id} />
                  <label>
                    {homeName}
                    <input
                      aria-label={`${homeName} ${t.matches.goals}`}
                      defaultValue={match.prediction_home_goals ?? ""}
                      disabled={locked}
                      min={0}
                      name="homeGoals"
                      required
                      type="number"
                    />
                  </label>
                  <label>
                    {awayName}
                    <input
                      aria-label={`${awayName} ${t.matches.goals}`}
                      defaultValue={match.prediction_away_goals ?? ""}
                      disabled={locked}
                      min={0}
                      name="awayGoals"
                      required
                      type="number"
                    />
                  </label>
                  <button disabled={locked} type="submit">
                    {locked ? t.matches.locked : t.matches.save}
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
