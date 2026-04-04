import { Metadata } from 'next';
import { EditorialEmptyState } from '@/components/home/app-placeholders';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'Oops! The page you are looking for does not exist.',
};

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] px-4 pb-16 pt-28">
      <div className="mx-auto max-w-4xl">
        <EditorialEmptyState
          eyebrow="404"
          title="That page drifted out of orbit."
          body="The quiz, category, or profile you tried to open does not exist anymore, or never made it into the public catalog."
          primaryHref="/quiz"
          primaryLabel="Browse quizzes"
          secondaryHref="/"
          secondaryLabel="Go home"
        />
      </div>
    </div>
  );
}
