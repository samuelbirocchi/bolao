import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getLeaderboard, getMatchesWithPredictions } from "@/lib/data";

type GroupPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupPage({ params }: GroupPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, matches, leaderboard] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getMatchesWithPredictions(groupId, user.id),
    getLeaderboard(groupId),
  ]);

  if (!group) {
    notFound();
  }

  const predictedCount = matches.filter((match) => match.prediction_home_goals !== null).length;
  const completedCount = matches.filter((match) => match.result_home_goals !== null).length;
  const shareUrl = group.invite_code ? `/groups/join/${group.invite_code}` : null;

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.role}</p>
        <h1>{group.name}</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>Overview</Link>
        <Link href={`/groups/${group.id}/matches`}>Matches</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>Leaderboard</Link>
      </div>

      <section className="grid three">
        <div className="stat">
          <span className="muted">Predictions</span>
          <strong>
            {predictedCount}/{matches.length}
          </strong>
        </div>
        <div className="stat">
          <span className="muted">Completed matches</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="stat">
          <span className="muted">Players</span>
          <strong>{leaderboard.length}</strong>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: "1rem" }}>
        <div className="card stack">
          <h2>Invite friends</h2>
          {shareUrl ? (
            <>
              <p className="muted">Share this link with friends who should join the pool.</p>
              <input readOnly value={shareUrl} aria-label="Invite link" />
              <p className="muted">Code: {group.invite_code}</p>
            </>
          ) : (
            <p className="muted">No active invite code is available.</p>
          )}
        </div>
        <div className="card stack">
          <h2>Next step</h2>
          <p className="muted">Fill your match predictions before kickoff locks them.</p>
          <Link className="button" href={`/groups/${group.id}/matches`}>
            Make predictions
          </Link>
        </div>
      </section>
    </main>
  );
}
