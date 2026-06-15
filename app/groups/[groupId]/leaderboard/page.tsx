import Link from "next/link";
import { notFound } from "next/navigation";
import { UserAvatar } from "@/components/UserAvatar";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getLeaderboard, getScoringSettings } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

type LeaderboardPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const { user } = await requireUser();
  const { groupId } = await params;
  const [group, entries, scoring, t] = await Promise.all([
    getGroupDetail(groupId, user.id),
    getLeaderboard(groupId),
    getScoringSettings(),
    getDictionary(),
  ]);

  if (!group) {
    notFound();
  }

  // Competition ranking: entries with the same total_points share the same rank,
  // and the next rank skips accordingly (1, 1, 3 not 1, 1, 2).
  const rankedEntries: { entry: (typeof entries)[number]; rank: number }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const prev = i > 0 ? rankedEntries[i - 1] : null;
    const rank = prev && prev.entry.total_points === entry.total_points ? prev.rank : i + 1;
    rankedEntries.push({ entry, rank });
  }

  return (
    <main className="page">
      <div className="page-title">
        <p>{group.name}</p>
        <h1>{t.leaderboard.title}</h1>
      </div>

      <div className="tabs">
        <Link href={`/groups/${group.id}`}>{t.group.overview}</Link>
        <Link href={`/groups/${group.id}/matches`}>{t.group.matches}</Link>
        <Link href={`/groups/${group.id}/leaderboard`}>{t.group.leaderboard}</Link>
        <Link href={`/groups/${group.id}/ranking`}>{t.group.ranking}</Link>
      </div>

      <div className="notice" style={{ marginBottom: "1rem" }}>
        {t.leaderboard.scoring
          .replace("{baseMin}", String(scoring.baseMinPoints))
          .replace("{baseMax}", String(scoring.baseMaxPoints))
          .replace("{exact}", String(scoring.exactScoreBonusPoints))
          .replace("{winnerGoals}", String(scoring.winnerGoalsBonusPoints))
          .replace("{goalDifference}", String(scoring.goalDifferenceBonusPoints))}
      </div>

      {entries.length === 0 ? (
        <div className="empty">{t.leaderboard.empty}</div>
      ) : (
        <section className="leaderboard">
          {rankedEntries.map(({ entry, rank }) => (
            <article className="leader-row" key={entry.user_id}>
              <span className="rank">{rank}</span>
              <UserAvatar
                name={entry.display_name}
                seed={entry.user_id}
                url={entry.avatar_url}
              />
              <div>
                <strong>{entry.display_name ?? t.leaderboard.player}</strong>
                <div className="scoring-badges">
                  <span className="scoring-badge">
                    {t.leaderboard.base} <strong>{entry.base_points}</strong>
                  </span>
                  <span className="scoring-badge">
                    {t.leaderboard.bonus} <strong>{entry.bonus_points}</strong>
                  </span>
                  <span className="scoring-badge">
                    {t.leaderboard.exact} <strong>{entry.exact_score_count}</strong>
                  </span>
                  <span className="scoring-badge">
                    {t.leaderboard.winners} <strong>{entry.winner_count}</strong>
                  </span>
                </div>
              </div>
              <span className="points">{entry.total_points}</span>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
