import Link from 'next/link';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { getCategoryLabelBySlug } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/json-ld';
import { aboutPageNode, breadcrumbNode, buildGraph } from '@/lib/seo/structured-data';
import type { ReactNode } from 'react';

interface EditorialSection {
  id: string;
  heading: string;
  body: ReactNode;
}

function sections(lang: Locale): EditorialSection[] {
  const link = (href: string, children: ReactNode) => (
    <Link href={localizeHref(lang, href)} className="text-accent-primary underline">
      {children}
    </Link>
  );

  return lang === 'es'
    ? [
        {
          id: 'topics',
          heading: 'Cómo elegimos un tema',
          body: (
            <>
              <p>
                Un tema entra al catálogo cuando junta tres cosas: suficiente material verificable
                para sostener preguntas variadas, una audiencia que lo busca en alguno de nuestros
                dos idiomas y un ángulo que no repita un quiz que ya existe.
              </p>
              <p>
                Se descarta lo que no cumple: temas que dependen de un solo dato oscuro, franquicias
                ya cubiertas desde el mismo ángulo, rumores o fechas que ninguna fuente estable
                confirma, y cualquier pregunta cuya respuesta correcta sea discutible. Si el borrador
                no sobrevive a ese filtro, no se publica.
              </p>
            </>
          ),
        },
        {
          id: 'verification',
          heading: 'Cómo verificamos cada dato',
          body: (
            <>
              <p>
                En los quizzes de trivia, cada pregunta necesita una única respuesta correcta
                respaldada por una fuente comprobable antes de entrar al lote. Cuando un hecho es
                ambiguo o cambió con el tiempo — un récord, un reparto, una fecha de estreno — la
                pregunta se reformula para que la respuesta no dependa de interpretación, o sale
                del quiz.
              </p>
              <p>
                En los quizzes de personalidad no hay respuestas correctas: cada opción suma peso a
                las etiquetas de los resultados posibles y la etiqueta dominante define el resultado
                final. La verificación ahí es de consistencia — que cada opción apunte al resultado
                que promete y que cada resultado tenga un texto a la altura — no de exactitud
                factual.
              </p>
            </>
          ),
        },
        {
          id: 'corrections',
          heading: 'Cómo corregimos un quiz publicado',
          body: (
            <>
              <p>
                Cada ficha de quiz tiene una opción para reportar un problema: esa señal llega a
                nuestra cola de revisión a través de un endpoint dedicado, validado y con límite de
                frecuencia por IP. También puedes escribirnos desde la{' '}
                {link('/contact', 'página de contacto')} si el error necesita contexto.
              </p>
              <p>
                Cuando un reporte se confirma, la pregunta se corrige o se retira y el lote completo
                vuelve a pasar la auditoría automática — la misma que bloquea publicaciones con
                respuestas ambiguas, opciones vacías o slugs duplicados — antes de que el cambio
                llegue al catálogo.
              </p>
            </>
          ),
        },
        {
          id: 'types',
          heading: 'Qué significa trivia y qué significa personalidad',
          body: (
            <>
              <p>
                Un quiz de <strong>trivia</strong> se juega contra una clave de respuestas: aciertas
                o fallas, y el puntaje lo calcula el servidor comparando lo que elegiste con esa
                clave. La categoría {link('/category/trivia', 'trivia')} los reúne todos.
              </p>
              <p>
                Un quiz de <strong>personalidad</strong> no tiene clave: tus elecciones alimentan
                etiquetas y el resultado dominante se determina también en el servidor. Viven en el
                hub {link('/category/personality', 'personalidad')}. En ambos casos el navegador
                nunca decide tu puntaje — solo informa qué elegiste.
              </p>
            </>
          ),
        },
        {
          id: 'explore',
          heading: 'Sigue explorando',
          body: (
            <p>
              Recorre el {link('/quiz', 'catálogo de quizzes')} o entra directo a{' '}
              {link('/category/movies-tv', getCategoryLabelBySlug('movies-tv', lang))},{' '}
              {link('/category/anime-manga', getCategoryLabelBySlug('anime-manga', lang))},{' '}
              {link('/category/gaming', getCategoryLabelBySlug('gaming', lang))} o{' '}
              {link('/category/music', getCategoryLabelBySlug('music', lang))}. Si quieres saber más
              sobre el proyecto, visita {link('/about', 'Acerca de QuizVerse')}.
            </p>
          ),
        },
      ]
    : [
        {
          id: 'topics',
          heading: 'How we pick a topic',
          body: (
            <>
              <p>
                A topic enters the catalog when it combines three things: enough verifiable material
                to sustain varied questions, an audience that looks for it in one of our two
                languages, and an angle that does not repeat a quiz that already exists.
              </p>
              <p>
                We discard whatever fails that bar: topics that hinge on a single obscure fact,
                franchises already covered from the same angle, rumors or dates no stable source
                confirms, and any question whose correct answer is debatable. If a draft does not
                survive that filter, it does not get published.
              </p>
            </>
          ),
        },
        {
          id: 'verification',
          heading: 'How we verify each fact',
          body: (
            <>
              <p>
                In trivia quizzes, every question needs a single correct answer backed by a
                checkable source before it joins a batch. When a fact is ambiguous or has changed
                over time — a record, a cast list, a release date — the question is rewritten so the
                answer does not depend on interpretation, or it leaves the quiz.
              </p>
              <p>
                In personality quizzes there are no correct answers: each option adds weight to the
                tags of the possible results and the dominant tag decides the final outcome.
                Verification there is about consistency — that every option points to the result it
                promises and that every result has copy worth reading — not factual accuracy.
              </p>
            </>
          ),
        },
        {
          id: 'corrections',
          heading: 'How we fix a published quiz',
          body: (
            <>
              <p>
                Every quiz page has a report option: that signal reaches our review queue through a
                dedicated endpoint, validated and rate-limited per IP. You can also write to us from
                the {link('/contact', 'contact page')} if the error needs context.
              </p>
              <p>
                Once a report is confirmed, the question is corrected or removed and the whole batch
                goes through the automated audit again — the same one that blocks publications with
                ambiguous answers, empty options or duplicate slugs — before the change reaches the
                catalog.
              </p>
            </>
          ),
        },
        {
          id: 'types',
          heading: 'What trivia and personality mean',
          body: (
            <>
              <p>
                A <strong>trivia</strong> quiz is played against an answer key: you either get it
                right or you do not, and the score is computed on the server by comparing your
                choices against that key. The {link('/category/trivia', 'trivia')} hub collects them
                all.
              </p>
              <p>
                A <strong>personality</strong> quiz has no key: your choices feed tags and the
                dominant result is determined on the server too. They live in the{' '}
                {link('/category/personality', 'personality')} hub. In both cases the browser never
                decides your score — it only reports what you picked.
              </p>
            </>
          ),
        },
        {
          id: 'explore',
          heading: 'Keep exploring',
          body: (
            <p>
              Browse the {link('/quiz', 'quiz catalog')} or jump straight into{' '}
              {link('/category/movies-tv', getCategoryLabelBySlug('movies-tv', lang))},{' '}
              {link('/category/anime-manga', getCategoryLabelBySlug('anime-manga', lang))},{' '}
              {link('/category/gaming', getCategoryLabelBySlug('gaming', lang))} or{' '}
              {link('/category/music', getCategoryLabelBySlug('music', lang))}. To learn more about
              the project itself, visit {link('/about', 'About QuizVerse')}.
            </p>
          ),
        },
      ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';

  return buildMetadata({
    title: lang === 'es' ? 'Cómo trabajamos' : 'How we work',
    description:
      lang === 'es'
        ? 'Cómo elegimos, verificamos y corregimos cada quiz de QuizVerse: fuentes por pregunta, auditoría antes de publicar y correcciones abiertas a reportes.'
        : 'How we pick, verify and fix every QuizVerse quiz: per-question sources, pre-publish auditing and corrections open to reader reports.',
    path: `/${lang}/editorial`,
    alternatePath: `/${lang === 'es' ? 'en' : 'es'}/editorial`,
    locale: lang,
  });
}

export default async function EditorialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const title = lang === 'es' ? 'Cómo trabajamos' : 'How we work';
  const pageSections = sections(lang);

  return (
    <>
      <JsonLd
        data={buildGraph([
          aboutPageNode({ path: `/${lang}/editorial`, locale: lang, name: title }),
          breadcrumbNode([
            { name: lang === 'es' ? 'Inicio' : 'Home', path: `/${lang}` },
            { name: title, path: `/${lang}/editorial` },
          ]),
        ])}
      />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-text-secondary mt-8 text-lg leading-relaxed">
          {lang === 'es'
            ? 'Esta es la metodología editorial detrás del catálogo: qué entra, qué se descarta, cómo se verifica y cómo se corrige.'
            : 'This is the editorial methodology behind the catalog: what gets in, what gets cut, how facts are verified and how mistakes get fixed.'}
        </p>

        {pageSections.map((section, index) => (
          <section
            key={section.id}
            data-section={section.id}
            className={index === 0 ? 'mt-12' : 'border-border-subtle mt-12 border-t pt-8'}
          >
            <h2 className="font-display text-2xl font-semibold">{section.heading}</h2>
            <div className="text-text-secondary mt-4 space-y-4 text-lg leading-relaxed">
              {section.body}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
