import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getLeaderboard, getScoringSettings } from "@/lib/data";

type LeaderboardPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, entries, scoring] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getLeaderboard(groupId),
    getScoringSettings(),
  ]);

  if (!group) {
    notFound();
  }

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>Leaderboard</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>Overview</Link>
        <Link href={`/groups/${group.id}/matches`}>Matches</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>Leaderboard</Link>
      </div>

      <div className="notice" style={{ marginBottom: "1rem" }}>
        Scoring: exact {scoring.exactScorePoints}, team goal {scoring.teamGoalPoints}, outcome{" "}
        {scoring.outcomePoints}. Changes recalculate every completed match.
      </div>

      {entries.length === 0 ? (
        <div className="empty">No players are ranked yet.</div>
      ) : (
        <section className="leaderboard">
          {entries.map((entry, index) => (
            <article className="leader-row" key={entry.user_id}>
              <span className="rank">{index + 1}</span>
              <div>
                <strong>{entry.display_name ?? "Player"}</strong>
                <p className="muted">
                  Exact {entry.exact_score_count} · Outcome {entry.outcome_count} · Team goals{" "}
                  {entry.team_goal_count}
                </p>
              </div>
              <span className="points">{entry.total_points}</span>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
