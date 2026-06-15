import { permanentRedirect } from "next/navigation";

type RankingPageProps = {
  params: Promise<{ groupId: string }>;
};

// Ranking has merged into the leaderboard (Classificação). Keep this route as a
// permanent redirect so existing links and bookmarks still resolve.
export default async function RankingPage({ params }: RankingPageProps) {
  const { groupId } = await params;
  permanentRedirect(`/groups/${groupId}/leaderboard`);
}
