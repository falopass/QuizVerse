import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbNode, buildGraph, webPageNode } from '@/lib/seo/structured-data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  return buildMetadata({
    title: lang === 'es' ? 'Contacto' : 'Contact',
    description:
      lang === 'es'
        ? 'Contacta al equipo de QuizVerse para colaboraciones, prensa, sugerencias de quizzes o feedback.'
        : 'Reach the QuizVerse team for partnerships, press, quiz suggestions or feedback.',
    path: `/${lang}/contact`,
    alternatePath: `/${lang === 'es' ? 'en' : 'es'}/contact`,
    locale: lang,
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const title = lang === 'es' ? 'Contacto' : 'Contact';

  return (
    <>
      <JsonLd
        data={buildGraph([
          webPageNode(`/${lang}/contact`, lang, title),
          breadcrumbNode([
            { name: lang === 'es' ? 'Inicio' : 'Home', path: `/${lang}` },
            { name: title, path: `/${lang}/contact` },
          ]),
        ])}
      />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {lang === 'es' ? 'Contacto' : 'Contact'}
        </h1>

        <div className="text-text-secondary mt-8 space-y-6 text-lg leading-relaxed">
          {lang === 'es' ? (
            <>
              <p>
                ¿Tienes una idea de colaboración, quieres reportar un problema o simplemente darnos
                feedback? Escríbenos.
              </p>
              <p>
                Puedes contactarnos en{' '}
                <a
                  href="mailto:hello@quizverse.org"
                  className="text-accent-primary hover:text-accent-hover underline transition-colors"
                >
                  hello@quizverse.org
                </a>
                . Respondemos en un plazo de 1-2 días hábiles.
              </p>
              <p>
                Para reportar contenido inapropiado, usa el botón de reporte dentro de cada quiz.
                Para solicitudes de eliminación de contenido o temas legales, incluye todos los
                detalles relevantes en tu correo.
              </p>
            </>
          ) : (
            <>
              <p>
                Have a collaboration idea, need to report an issue, or just want to give us
                feedback? Reach out.
              </p>
              <p>
                You can contact us at{' '}
                <a
                  href="mailto:hello@quizverse.org"
                  className="text-accent-primary hover:text-accent-hover underline transition-colors"
                >
                  hello@quizverse.org
                </a>
                . We respond within 1-2 business days.
              </p>
              <p>
                To report inappropriate content, use the report button inside each quiz. For content
                removal requests or legal matters, include all relevant details in your email.
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
