import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function CategoryLoading() {
  return (
    <EditorialLoadingStage
      eyebrow="Category"
      title="Loading this category lane."
      body="We are pulling the latest published quizzes and arranging them inside this editorial slice."
    />
  );
}
