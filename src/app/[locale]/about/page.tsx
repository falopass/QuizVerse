import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const title = lang === 'es' ? 'Acerca de QuizVerse' : 'About QuizVerse';
  const description =
    lang === 'es'
      ? 'QuizVerse es una plataforma editorial de quizzes bilingüe con personalidad, trivia afilada y resultados que vale la pena compartir.'
      : 'QuizVerse is a bilingual editorial quiz platform with personality, sharp trivia, and results worth sharing.';

  return {
    title,
    description,
    alternates: { canonical: `/${lang}/about` },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        {lang === 'es' ? 'Acerca de QuizVerse' : 'About QuizVerse'}
      </h1>

      <div className="text-text-secondary mt-8 space-y-6 text-lg leading-relaxed">
        {lang === 'es' ? (
          <>
            <p>
              QuizVerse nace de una idea simple: los quizzes merecen el mismo criterio editorial
              que cualquier otro producto de entretenimiento. No somos una plantilla genérica ni un
              generador de contenido sin alma.
            </p>
            <p>
              Construimos una plataforma bilingüe que prioriza la calidad del catálogo, la
              experiencia de juego pulida y un sistema de diseño con identidad propia. Cada quiz
              pasa por un pipeline editorial que incluye generación con IA, curaduría humana, polish
              de copys, asignación de portadas y validación de estructura.
            </p>
            <p>
              Nuestro motor soporta formatos de trivia, personalidad y encuestas, con scoring
              inteligente, streaks, power-ups y resultados compartibles. Todo corre sobre
              Next.js, Supabase y DeepSeek, con un stack moderno pensado para escalar.
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

      <div className="mt-12 border-t border-border-subtle pt-8">
        <h2 className="font-display text-2xl font-semibold">
          {lang === 'es' ? 'El equipo' : 'The team'}
        </h2>
        <p className="text-text-secondary mt-3 text-base leading-relaxed">
          {lang === 'es'
            ? 'QuizVerse es desarrollado por un equipo pequeño con experiencia en producto, diseño editorial y desarrollo full-stack. Creemos que el contenido interactivo merece mejor ejecución.'
            : 'QuizVerse is built by a small team with experience in product, editorial design, and full-stack development. We believe interactive content deserves better execution.'}
        </p>
      </div>
    </main>
  );
}
