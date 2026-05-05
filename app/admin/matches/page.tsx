import { syncMatchesAction, syncOddsAction, updateMatchResultAction } from "@/lib/actions";
import { requireGlobalAdmin } from "@/lib/auth";
import { getAdminMatches } from "@/lib/data";
import { formatKickoffForLocale } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";

function formatProbability(value: number | null, missing: string) {
  return value === null ? missing : `${Math.round(value * 100)}%`;
}

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
        <div className="row">
          <form action={syncMatchesAction}>
            <button type="submit">{t.adminMatches.sync}</button>
          </form>
          <form action={syncOddsAction}>
            <button className="secondary" type="submit">
              {t.adminMatches.syncOdds}
            </button>
          </form>
        </div>
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
              <div className="notice">
                {t.adminMatches.odds}: {t.adminMatches.home}{" "}
                {formatProbability(match.odds_home_win_probability, t.adminMatches.missing)} ·{" "}
                {t.adminMatches.draw}{" "}
                {formatProbability(match.odds_draw_probability, t.adminMatches.missing)} ·{" "}
                {t.adminMatches.away}{" "}
                {formatProbability(match.odds_away_win_probability, t.adminMatches.missing)}
                {match.odds_captured_at
                  ? ` · ${match.odds_bookmaker_count ?? 0} ${t.adminMatches.bookmakers}`
                  : ` · ${t.adminMatches.notSynced}`}
              </div>
              <div className="match-title">
                <span className="team">{match.home_team_name}</span>
                <span className="muted">{t.matches.versus}</span>
                <span className="team">{match.away_team_name}</span>
              </div>
              <form className="score-inputs admin-score-inputs" action={updateMatchResultAction}>
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
                <label>
                  {t.adminMatches.resolution}
                  <select defaultValue={match.result_resolution ?? "regular"} name="resolution">
                    <option value="regular">{t.adminMatches.regular}</option>
                    <option value="extra_time">{t.adminMatches.extraTime}</option>
                    <option value="penalties">{t.adminMatches.penalties}</option>
                  </select>
                </label>
                <label>
                  {t.adminMatches.homePenalties}
                  <input
                    defaultValue={match.result_home_penalties ?? ""}
                    min={0}
                    name="homePenalties"
                    type="number"
                  />
                </label>
                <label>
                  {t.adminMatches.awayPenalties}
                  <input
                    defaultValue={match.result_away_penalties ?? ""}
                    min={0}
                    name="awayPenalties"
                    type="number"
                  />
                </label>
                <button type="submit">{t.adminMatches.saveResult}</button>
              </form>
              {match.phase ? (
                <p className="muted">
                  {t.adminMatches.apiPhase}: {match.phase}
                </p>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
