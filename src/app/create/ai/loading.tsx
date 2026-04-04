import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function CreateAiLoading() {
  return (
    <EditorialLoadingStage
      eyebrow="AI Studio"
      title="Preparing the AI drafting flow."
      body="Loading generation controls, account context, and your editing workspace."
    />
  );
}
