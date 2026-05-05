import Link from "next/link";
import { notFound } from "next/navigation";
import { savePredictionAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getMatchesWithPredictions } from "@/lib/data";
import { displayName, formatKickoff } from "@/lib/format";

type MatchesPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function MatchesPage({ params }: MatchesPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, matches] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getMatchesWithPredictions(groupId, user.id),
  ]);

  if (!group) {
    notFound();
  }

  const now = Date.now();

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>Matches</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>Overview</Link>
        <Link href={`/groups/${group.id}/matches`}>Matches</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>Leaderboard</Link>
      </div>

      {matches.length === 0 ? (
        <div className="empty">No matches are loaded yet. Ask a global admin to sync or add them.</div>
      ) : (
        <section className="match-list">
          {matches.map((match) => {
            const locked = new Date(match.kickoff_utc).getTime() <= now;
            const homeName = displayName(match.home_team_name, match.home_team_placeholder ?? "TBD");
            const awayName = displayName(match.away_team_name, match.away_team_placeholder ?? "TBD");

            return (
              <article className="match-card" key={match.id}>
                <div className="row">
                  <span className="muted">
                    Match {match.match_number} · {match.group_name ?? match.round}
                  </span>
                  <span className="muted">{formatKickoff(match.kickoff_utc)}</span>
                </div>

                <div className="match-title">
                  <span className="team">{homeName}</span>
                  <span className="muted">vs</span>
                  <span className="team">{awayName}</span>
                </div>

                {match.result_home_goals !== null && match.result_away_goals !== null ? (
                  <div className="notice">
                    Result: {match.result_home_goals} x {match.result_away_goals}
                  </div>
                ) : null}

                <form className="score-inputs" action={savePredictionAction}>
                  <input name="groupId" type="hidden" value={group.id} />
                  <input name="matchId" type="hidden" value={match.id} />
                  <label>
                    {homeName}
                    <input
                      aria-label={`${homeName} goals`}
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
                      aria-label={`${awayName} goals`}
                      defaultValue={match.prediction_away_goals ?? ""}
                      disabled={locked}
                      min={0}
                      name="awayGoals"
                      required
                      type="number"
                    />
                  </label>
                  <button disabled={locked} type="submit">
                    {locked ? "Locked" : "Save"}
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
