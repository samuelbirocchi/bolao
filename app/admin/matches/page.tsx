import { syncMatchesAction, updateMatchResultAction } from "@/lib/actions";
import { requireGlobalAdmin } from "@/lib/auth";
import { getAdminMatches } from "@/lib/data";
import { formatKickoff } from "@/lib/format";

export default async function AdminMatchesPage() {
  await requireGlobalAdmin();
  const matches = await getAdminMatches();

  return (
    <main className="page">
      <div className="row page-title">
        <div>
          <h1>Matches</h1>
          <p>Sync fixtures from the API or manually enter final scores.</p>
        </div>
        <form action={syncMatchesAction}>
          <button type="submit">Sync WC2026 API</button>
        </form>
      </div>

      {matches.length === 0 ? (
        <div className="empty">No matches are loaded yet. Sync from the API to start.</div>
      ) : (
        <section className="match-list">
          {matches.map((match) => (
            <article className="match-card" key={match.id}>
              <div className="row">
                <span className="muted">
                  Match {match.match_number} · {match.group_name ?? match.round}
                </span>
                <span className="muted">{formatKickoff(match.kickoff_utc)}</span>
              </div>
              <div className="match-title">
                <span className="team">{match.home_team_name}</span>
                <span className="muted">vs</span>
                <span className="team">{match.away_team_name}</span>
              </div>
              <form className="score-inputs" action={updateMatchResultAction}>
                <input name="matchId" type="hidden" value={match.id} />
                <label>
                  Home goals
                  <input
                    defaultValue={match.result_home_goals ?? ""}
                    min={0}
                    name="homeGoals"
                    required
                    type="number"
                  />
                </label>
                <label>
                  Away goals
                  <input
                    defaultValue={match.result_away_goals ?? ""}
                    min={0}
                    name="awayGoals"
                    required
                    type="number"
                  />
                </label>
                <button type="submit">Save result</button>
              </form>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
