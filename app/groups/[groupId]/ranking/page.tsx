import { redirect } from "next/navigation";

type RankingPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function RankingPage({ params }: RankingPageProps) {
  const { groupId } = await params;
  redirect(`/groups/${groupId}/leaderboard`);
}
