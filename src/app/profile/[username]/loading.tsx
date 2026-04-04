import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function ProfileLoading() {
  return (
    <EditorialLoadingStage
      eyebrow="Profile"
      title="Loading this public profile."
      body="Pulling profile stats, unlocked milestones, and published quizzes for this creator."
    />
  );
}
