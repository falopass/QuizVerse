import type { Metadata } from 'next';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbNode, buildGraph, faqNode, webPageNode } from '@/lib/seo/structured-data';
import { EmbedBuilder } from '@/components/widget/embed-builder';
import type { EmbedBuilderLabels } from '@/components/widget/embed-builder';

export const revalidate = 300;

const TITLES = {
  es: 'Pon un quiz de QuizVerse en tu web',
  en: 'Embed a QuizVerse quiz on your site',
} as const;

const FAQS = {
  es: [
    {
      question: '¿Cuánto cuesta incrustar un quiz?',
      answer:
        'Nada. El widget es gratuito para cualquier web, sin límite de partidas ni caducidad.',
    },
    {
      question: '¿Mis visitantes necesitan cuenta en QuizVerse?',
      answer:
        'No. Juegan dentro del iframe, sin registro ni instalación. Si quieren guardar su puntuación o competir en el ranking, pueden abrir el quiz en QuizVerse desde el enlace del propio widget.',
    },
    {
      question: '¿El widget se actualiza si el quiz cambia?',
      answer:
        'Sí. El iframe carga siempre la versión publicada actual: si se corrige una pregunta o cambia la portada, tu página lo refleja sin que tengas que tocar el código.',
    },
    {
      question: '¿Puedo quitar el enlace a QuizVerse?',
      answer:
        'El enlace de atribución es parte del acuerdo de uso: es un enlace normal a la ficha del quiz que ayuda a tus lectores a jugar a pantalla completa y mantiene el servicio gratis.',
    },
  ],
  en: [
    {
      question: 'How much does embedding a quiz cost?',
      answer: 'Nothing. The widget is free for any site, with no play limit and no expiry.',
    },
    {
      question: 'Do my visitors need a QuizVerse account?',
      answer:
        'No. They play inside the iframe — no sign-up, nothing to install. If they want to save their score or join the leaderboard, they can open the quiz on QuizVerse from the link inside the widget.',
    },
    {
      question: 'Does the widget update when the quiz changes?',
      answer:
        'Yes. The iframe always loads the currently published version: if a question is fixed or the cover changes, your page reflects it without touching the code.',
    },
    {
      question: 'Can I remove the link back to QuizVerse?',
      answer:
        'The attribution link is part of the terms of use: it is a regular link to the quiz page that lets your readers play full-screen and keeps the service free.',
    },
  ],
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const description =
    lang === 'es'
      ? 'Incrusta cualquier quiz de QuizVerse en tu web con un iframe: gratis, sin registro para tus visitantes y siempre actualizado. Genera el código en segundos.'
      : 'Embed any QuizVerse quiz on your site with an iframe: free, no sign-up for your visitors and always up to date. Generate the code in seconds.';

  return buildMetadata({
    title: TITLES[lang],
    description,
    path: `/${lang}/widget`,
    alternatePath: `/${lang === 'es' ? 'en' : 'es'}/widget`,
    locale: lang,
  });
}

export default async function WidgetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  const title = TITLES[lang];
  const faqs = FAQS[lang];

  const builderLabels: EmbedBuilderLabels = es
    ? {
        searchLabel: 'Elige un quiz',
        searchPlaceholder: 'Busca por título…',
        searching: 'Buscando…',
        noResults: 'No encontramos quizzes con ese título.',
        searchError: 'No pudimos cargar el catálogo. Inténtalo de nuevo.',
        pickQuiz: 'Elige un quiz en el buscador para generar el código.',
        changeQuiz: 'Elegir otro quiz',
        previewLabel: 'Vista previa',
        previewIframeTitle: 'Vista previa de {title}',
        heightLabel: 'Altura del widget',
        codeLabel: 'Código para incrustar',
        copyCode: 'Copiar código',
        copied: '¡Copiado!',
        copyFailed: 'No pudimos copiar: selecciona el código y cópialo a mano.',
      }
    : {
        searchLabel: 'Choose a quiz',
        searchPlaceholder: 'Search by title…',
        searching: 'Searching…',
        noResults: 'No quizzes matched that title.',
        searchError: 'We could not load the catalog. Try again.',
        pickQuiz: 'Pick a quiz from the search box to generate the code.',
        changeQuiz: 'Choose another quiz',
        previewLabel: 'Preview',
        previewIframeTitle: 'Preview of {title}',
        heightLabel: 'Widget height',
        codeLabel: 'Embed code',
        copyCode: 'Copy code',
        copied: 'Copied!',
        copyFailed: "Couldn't copy: select the code and copy it manually.",
      };

  const steps = es
    ? [
        'Busca el quiz que quieres incrustar con el buscador de abajo: vale cualquiera publicado en el catálogo.',
        'Ajusta la altura y comprueba el resultado en la vista previa.',
        'Pulsa «Copiar código» y pega el HTML en tu página, donde quieras que aparezca el juego.',
      ]
    : [
        'Find the quiz you want to embed with the search box below — anything published in the catalog works.',
        'Adjust the height and check the result in the preview.',
        'Hit "Copy code" and paste the HTML into your page where you want the game to appear.',
      ];

  return (
    <>
      <JsonLd
        data={buildGraph([
          webPageNode(`/${lang}/widget`, lang, title),
          breadcrumbNode([
            { name: es ? 'Inicio' : 'Home', path: `/${lang}` },
            { name: title, path: `/${lang}/widget` },
          ]),
          faqNode([...faqs]),
        ])}
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-text-secondary mt-6 text-lg leading-relaxed">
          {es
            ? 'Cualquier quiz publicado en QuizVerse cabe en tu web con un iframe. Es gratis, tus visitantes juegan sin registrarse y el widget siempre muestra la versión publicada más reciente.'
            : 'Any quiz published on QuizVerse fits on your site with an iframe. It is free, your visitors play with no sign-up and the widget always shows the latest published version.'}
        </p>

        <div className="border-border-subtle mt-12 border-t pt-8">
          <h2 className="font-display text-2xl font-semibold">
            {es ? 'Cómo funciona' : 'How it works'}
          </h2>
          <ol className="text-text-secondary mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="border-border-subtle mt-12 border-t pt-8">
          <EmbedBuilder locale={lang} labels={builderLabels} />
        </div>

        <div className="border-border-subtle mt-12 border-t pt-8">
          <h2 className="font-display text-2xl font-semibold">
            {es ? 'Preguntas frecuentes' : 'Frequently asked questions'}
          </h2>
          <div className="mt-6 space-y-8">
            {faqs.map((item) => (
              <div key={item.question}>
                <h3 className="text-lg font-semibold">{item.question}</h3>
                <p className="text-text-secondary mt-2 text-base leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
