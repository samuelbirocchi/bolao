import { syncMatchesAction, updateMatchResultAction } from "@/lib/actions";
import { requireGlobalAdmin } from "@/lib/auth";
import { getAdminMatches } from "@/lib/data";
import { formatKickoffForLocale } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export default async function AdminMatchesPage() {
  await requireGlobalAdmin();
  const [matches, locale, t] = await Promise.all([getAdminMatches(), getLocale(), getDictionary()]);

  return (
    <main className="page">
      <div className="row page-title">
        <div>
          <h1>{t.adminMatches.title}</h1>
          <p>{t.adminMatches.description}</p>
        </div>
        <form action={syncMatchesAction}>
          <button type="submit">{t.adminMatches.sync}</button>
        </form>
      </div>

      {matches.length === 0 ? (
        <div className="empty">{t.adminMatches.empty}</div>
      ) : (
        <section className="match-list">
          {matches.map((match) => (
            <article className="match-card" key={match.id}>
              <div className="row">
                <span className="muted">
                  {t.matches.match} {match.match_number} · {match.group_name ?? match.round}
                </span>
                <span className="muted">{formatKickoffForLocale(match.kickoff_utc, locale)}</span>
              </div>
              <div className="match-title">
                <span className="team">{match.home_team_name}</span>
                <span className="muted">{t.matches.versus}</span>
                <span className="team">{match.away_team_name}</span>
              </div>
              <form className="score-inputs" action={updateMatchResultAction}>
                <input name="matchId" type="hidden" value={match.id} />
                <label>
                  {t.adminMatches.homeGoals}
                  <input
                    defaultValue={match.result_home_goals ?? ""}
                    min={0}
                    name="homeGoals"
                    required
                    type="number"
                  />
                </label>
                <label>
                  {t.adminMatches.awayGoals}
                  <input
                    defaultValue={match.result_away_goals ?? ""}
                    min={0}
                    name="awayGoals"
                    required
                    type="number"
                  />
                </label>
                <button type="submit">{t.adminMatches.saveResult}</button>
              </form>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
