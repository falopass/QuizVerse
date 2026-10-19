import Link from 'next/link';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
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
  const description =
    lang === 'es'
      ? 'QuizVerse es una plataforma editorial bilingüe de quizzes con tests de personalidad, trivia afilada y resultados que vale la pena compartir.'
      : 'QuizVerse is a bilingual editorial quiz platform with personality tests, sharp trivia and results worth sharing.';

  return buildMetadata({
    title: lang === 'es' ? 'Acerca de QuizVerse' : 'About QuizVerse',
    description,
    path: `/${lang}/about`,
    alternatePath: `/${lang === 'es' ? 'en' : 'es'}/about`,
    locale: lang,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const title = lang === 'es' ? 'Acerca de QuizVerse' : 'About QuizVerse';

  return (
    <>
      <JsonLd
        data={buildGraph([
          webPageNode(`/${lang}/about`, lang, title),
          breadcrumbNode([
            { name: lang === 'es' ? 'Inicio' : 'Home', path: `/${lang}` },
            { name: title, path: `/${lang}/about` },
          ]),
        ])}
      />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {lang === 'es' ? 'Acerca de QuizVerse' : 'About QuizVerse'}
        </h1>

        <div className="text-text-secondary mt-8 space-y-6 text-lg leading-relaxed">
          {lang === 'es' ? (
            <>
              <p>
                QuizVerse nace de una idea simple: los quizzes merecen el mismo criterio editorial
                que cualquier otro producto de entretenimiento. No somos una plantilla genérica ni
                un generador de contenido sin alma.
              </p>
              <p>
                Construimos una plataforma bilingüe que prioriza la calidad del catálogo, la
                experiencia de juego pulida y un sistema de diseño con identidad propia. Cada quiz
                pasa por un pipeline editorial que incluye generación con IA, curaduría humana,
                polish de copys, asignación de portadas y validación de estructura.
              </p>
              <p>
                Nuestro motor soporta formatos de trivia, personalidad y encuestas, con scoring
                inteligente, streaks, power-ups y resultados compartibles. Todo corre sobre Next.js,
                Supabase y DeepSeek, con un stack moderno pensado para escalar.
              </p>
              <p>
                QuizVerse es un producto editorial bilingüe, orientado al descubrimiento y diseñado
                para gente curiosa — no una fábrica de quizzes genéricos.
              </p>
            </>
          ) : (
            <>
              <p>
                QuizVerse was born from a simple idea: quizzes deserve the same editorial standards
                as any other entertainment product. We are not a generic template or a soulless
                content generator.
              </p>
              <p>
                We built a bilingual platform that prioritizes catalog quality, polished gameplay,
                and a design system with its own identity. Every quiz goes through an editorial
                pipeline that includes AI generation, human curation, copy polish, cover assignment,
                and structure validation.
              </p>
              <p>
                Our engine supports trivia, personality, and poll formats with intelligent scoring,
                streaks, power-ups, and shareable results. Everything runs on Next.js, Supabase, and
                DeepSeek — a modern stack built to scale.
              </p>
              <p>
                QuizVerse is a bilingual editorial product, discovery-oriented and designed for
                curious people — not a generic quiz factory.
              </p>
            </>
          )}
        </div>

        <div className="border-border-subtle mt-12 border-t pt-8">
          <h2 className="font-display text-2xl font-semibold">
            {lang === 'es' ? 'El equipo' : 'The team'}
          </h2>
          <p className="text-text-secondary mt-3 text-base leading-relaxed">
            {lang === 'es'
              ? 'QuizVerse es desarrollado por un equipo pequeño con experiencia en producto, diseño editorial y desarrollo full-stack. Creemos que el contenido interactivo merece mejor ejecución.'
              : 'QuizVerse is built by a small team with experience in product, editorial design, and full-stack development. We believe interactive content deserves better execution.'}
          </p>
        </div>

        <div className="border-border-subtle mt-12 border-t pt-8">
          <h2 className="font-display text-2xl font-semibold">
            {lang === 'es' ? 'Cómo se hacen los quizzes' : 'How our quizzes are made'}
          </h2>
          <div className="text-text-secondary mt-4 space-y-4 text-lg leading-relaxed">
            {lang === 'es' ? (
              <>
                <p>
                  Cada quiz empieza con generación asistida por IA y termina con curaduría humana.
                  La máquina propone preguntas, opciones y descripciones; una persona revisa el
                  resultado, pule los copys y decide qué se publica y qué se descarta. Nada llega al
                  catálogo sin pasar por ese filtro.
                </p>
                <p>
                  La clasificación también es determinista: una tabla de reglas ordenada asigna cada
                  quiz a su categoría por tema — primero franquicias, luego temas y al final las
                  categorías generales — en lugar de depender de etiquetado manual. El mismo
                  contenido produce siempre la misma clasificación, así que el catálogo se puede
                  auditar de punta a punta.
                </p>
                <p>
                  Antes de publicarse, una auditoría automática bloquea el lote si encuentra
                  preguntas sin una única respuesta correcta, opciones vacías, slugs duplicados o
                  descripciones demasiado cortas. Si un quiz no pasa la validación, no se publica.
                </p>
              </>
            ) : (
              <>
                <p>
                  Every quiz starts with AI-assisted generation and ends with human curation. The
                  machine proposes questions, options, and descriptions; a person reviews the
                  result, polishes the copy, and decides what gets published and what gets cut.
                  Nothing reaches the catalog without passing that filter.
                </p>
                <p>
                  Classification is deterministic too: an ordered rule table assigns each quiz to
                  its subject category — franchises first, then topics, then broader themes —
                  instead of relying on manual tagging. The same content always produces the same
                  classification, so the whole catalog can be audited end to end.
                </p>
                <p>
                  Before anything ships, an automated audit blocks the batch if it finds questions
                  without a single correct answer, empty options, duplicate slugs, or thin
                  descriptions. If a quiz fails validation, it does not get published.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="border-border-subtle mt-12 border-t pt-8">
          <h2 className="font-display text-2xl font-semibold">
            {lang === 'es' ? 'Empieza a explorar' : 'Start exploring'}
          </h2>
          <p className="text-text-secondary mt-3 text-base leading-relaxed">
            {lang === 'es' ? (
              <>
                ¿Por dónde empezar? Recorre el{' '}
                <Link href={localizeHref(lang, '/quiz')} className="text-accent-primary underline">
                  catálogo de quizzes
                </Link>
                , mira quién encabeza el{' '}
                <Link
                  href={localizeHref(lang, '/leaderboard')}
                  className="text-accent-primary underline"
                >
                  ranking
                </Link>
                ,{' '}
                <Link
                  href={localizeHref(lang, '/create')}
                  className="text-accent-primary underline"
                >
                  crea tu propio quiz
                </Link>{' '}
                o{' '}
                <Link
                  href={localizeHref(lang, '/contact')}
                  className="text-accent-primary underline"
                >
                  escríbenos
                </Link>{' '}
                si tienes una idea que debería existir.
              </>
            ) : (
              <>
                Not sure where to begin? Browse the{' '}
                <Link href={localizeHref(lang, '/quiz')} className="text-accent-primary underline">
                  quiz catalog
                </Link>
                , see who is on top of the{' '}
                <Link
                  href={localizeHref(lang, '/leaderboard')}
                  className="text-accent-primary underline"
                >
                  leaderboard
                </Link>
                ,{' '}
                <Link
                  href={localizeHref(lang, '/create')}
                  className="text-accent-primary underline"
                >
                  create your own quiz
                </Link>{' '}
                or{' '}
                <Link
                  href={localizeHref(lang, '/contact')}
                  className="text-accent-primary underline"
                >
                  get in touch
                </Link>{' '}
                if there is an idea you think should exist.
              </>
            )}
          </p>
        </div>
      </main>
    </>
  );
}
