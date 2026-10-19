import { headers } from 'next/headers';
import Link from 'next/link';
import { EditorialEmptyState } from '@/components/home/app-placeholders';

const POPULAR_CATEGORIES = [
  { slug: 'movies-tv', en: 'Movies & TV', es: 'Cine y televisión' },
  { slug: 'anime-manga', en: 'Anime & Manga', es: 'Anime y manga' },
  { slug: 'gaming', en: 'Gaming', es: 'Videojuegos' },
  { slug: 'music', en: 'Music', es: 'Música' },
  { slug: 'culture', en: 'Culture', es: 'Cultura' },
  { slug: 'lifestyle', en: 'Lifestyle', es: 'Estilo de vida' },
  { slug: 'literature', en: 'Literature', es: 'Literatura' },
  { slug: 'pop-culture', en: 'Pop Culture', es: 'Cultura pop' },
] as const;

export default async function NotFoundPage() {
  const locale = (await headers()).get('x-quizverse-locale') === 'es' ? 'es' : 'en';
  const es = locale === 'es';
  return (
    <main id="main-content" className="min-h-[70vh] px-4 pt-28 pb-16">
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
        <nav aria-label={es ? 'Categorías' : 'Categories'} className="mx-auto mt-6 max-w-4xl">
          <h2 className="eyebrow text-center">{es ? 'Categorías' : 'Categories'}</h2>
          <ul className="mt-4 flex flex-wrap justify-center gap-3">
            {POPULAR_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/${locale}/category/${category.slug}`}
                  className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors"
                >
                  {es ? category.es : category.en}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
