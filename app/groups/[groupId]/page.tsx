import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getLeaderboard, getMatchesWithPredictions } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

type GroupPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupPage({ params }: GroupPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, matches, leaderboard, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getMatchesWithPredictions(groupId, user.id),
    getLeaderboard(groupId),
    getDictionary(),
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
        <Link href={`/groups/${group.id}`}>{t.group.overview}</Link>
        <Link href={`/groups/${group.id}/matches`}>{t.group.matches}</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>{t.group.leaderboard}</Link>
      </div>

      <section className="grid three">
        <div className="stat">
          <span className="muted">{t.group.predictions}</span>
          <strong>
            {predictedCount}/{matches.length}
          </strong>
        </div>
        <div className="stat">
          <span className="muted">{t.group.completedMatches}</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="stat">
          <span className="muted">{t.group.players}</span>
          <strong>{leaderboard.length}</strong>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: "1rem" }}>
        <div className="card stack">
          <h2>{t.group.inviteFriends}</h2>
          {shareUrl ? (
            <>
              <p className="muted">{t.group.shareLink}</p>
              <input readOnly value={shareUrl} aria-label={t.group.inviteLink} />
              <p className="muted">
                {t.group.code}: {group.invite_code}
              </p>
            </>
          ) : (
            <p className="muted">{t.group.noInviteCode}</p>
          )}
        </div>
        <div className="card stack">
          <h2>{t.group.nextStep}</h2>
          <p className="muted">{t.group.nextStepDescription}</p>
          <Link className="button" href={`/groups/${group.id}/matches`}>
            {t.group.makePredictions}
          </Link>
        </div>
      </section>
    </main>
  );
}
