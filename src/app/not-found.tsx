import { headers } from 'next/headers';
import { EditorialEmptyState } from '@/components/home/app-placeholders';

export default async function NotFoundPage() {
  const locale = (await headers()).get('x-quizverse-locale') === 'es' ? 'es' : 'en';
  const es = locale === 'es';
  return (
    <div className="min-h-[70vh] px-4 pt-28 pb-16">
      <div className="mx-auto max-w-4xl">
        <EditorialEmptyState
          eyebrow="404"
          title={es ? 'Esta página se salió de órbita.' : 'That page drifted out of orbit.'}
          body={
            es
              ? 'El quiz, la categoría o el perfil que buscas no está en el catálogo público.'
              : 'The quiz, category, or profile you tried to open is not in the public catalog.'
          }
          primaryHref={`/${locale}/quiz`}
          primaryLabel={es ? 'Explorar quizzes' : 'Browse quizzes'}
          secondaryHref={`/${locale}`}
          secondaryLabel={es ? 'Ir al inicio' : 'Go home'}
        />
      </div>
    </div>
  );
}
