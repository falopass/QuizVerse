import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function LeaderboardLoading() {
  return (
    <EditorialLoadingStage
      eyebrow="Leaderboard"
      title="Assembling the live board."
      body="Fetching ranked profiles, points, and public activity so the board lands with current data."
    />
  );
}
