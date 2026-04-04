import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function QuizCatalogLoading() {
  return (
    <EditorialLoadingStage
      eyebrow="Catalog"
      title="Refreshing the public quiz catalog."
      body="We are assembling the latest published quizzes, categories, and discovery lanes."
    />
  );
}
