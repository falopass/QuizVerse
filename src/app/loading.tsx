import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function LoadingPage() {
  return (
    <EditorialLoadingStage
      eyebrow="Loading"
      title="QuizVerse is shaping the next screen."
      body="Fetching live quizzes, profiles, and results so the experience stays polished instead of abrupt."
    />
  );
}
