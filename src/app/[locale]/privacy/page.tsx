import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  return buildMetadata({
    title: lang === 'es' ? 'Política de Privacidad' : 'Privacy Policy',
    description:
      lang === 'es'
        ? 'Cómo QuizVerse recopila, usa y protege tus datos personales, y qué cookies y servicios usa el sitio.'
        : 'How QuizVerse collects, uses and protects your personal data, and which cookies and services the site relies on.',
    path: `/${lang}/privacy`,
    alternatePath: `/${lang === 'es' ? 'en' : 'es'}/privacy`,
    locale: lang,
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';

  const content = {
    title: { en: 'Privacy Policy', es: 'Política de Privacidad' },
    lastUpdated: { en: 'Last updated: May 2026', es: 'Última actualización: mayo 2026' },
    sections: {
      intro: {
        en: 'QuizVerse ("we", "our", or "us") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights regarding your personal information.',
        es: 'QuizVerse ("nosotros" o "nuestro") se compromete a proteger tu privacidad. Esta política explica qué datos recopilamos, cómo los usamos y tus derechos sobre tu información personal.',
      },
      whatWeCollect: {
        heading: { en: 'What We Collect', es: 'Qué recopilamos' },
        body: {
          en: 'When you create an account, we collect your email address and a username. When you play quizzes, we store your game sessions including scores, answers, and results for leaderboard and sharing features. We also collect basic analytics: pages visited, quiz interactions, and locale preferences to improve the product.',
          es: 'Cuando creas una cuenta, recopilamos tu correo electrónico y un nombre de usuario. Cuando juegas quizzes, almacenamos tus sesiones de juego incluyendo puntuaciones, respuestas y resultados para funciones de ranking y compartir. También recopilamos analíticas básicas: páginas visitadas, interacciones con quizzes y preferencias de idioma para mejorar el producto.',
        },
      },
      cookies: {
        heading: { en: 'Cookies', es: 'Cookies' },
        body: {
          en: 'We use essential cookies for authentication (Supabase sessions) and optional cookies for analytics. We do not use tracking cookies for advertising without your explicit consent. You can manage cookie preferences through our consent banner.',
          es: 'Usamos cookies esenciales para autenticación (sesiones de Supabase) y cookies opcionales para analíticas. No usamos cookies de seguimiento para publicidad sin tu consentimiento explícito. Puedes gestionar tus preferencias de cookies a través de nuestro banner de consentimiento.',
        },
      },
      thirdParty: {
        heading: { en: 'Third-Party Services', es: 'Servicios de terceros' },
        body: {
          en: 'QuizVerse uses the following third-party services that may process your data: Supabase (authentication, database, storage), DeepSeek (AI quiz generation), Pexels and Pixabay (stock imagery), and optionally Google AdSense (advertising). Each of these services has its own privacy policy.',
          es: 'QuizVerse utiliza los siguientes servicios de terceros que pueden procesar tus datos: Supabase (autenticación, base de datos, almacenamiento), DeepSeek (generación de quizzes con IA), Pexels y Pixabay (imágenes de stock), y opcionalmente Google AdSense (publicidad). Cada uno de estos servicios tiene su propia política de privacidad.',
        },
      },
      dataRetention: {
        heading: { en: 'Data Retention', es: 'Retención de datos' },
        body: {
          en: 'We retain your account data for as long as your account is active. Game session data is retained indefinitely for leaderboard purposes. You can request deletion of your account and associated data at any time by contacting us.',
          es: 'Conservamos los datos de tu cuenta mientras esté activa. Los datos de sesiones de juego se conservan indefinidamente para fines de ranking. Puedes solicitar la eliminación de tu cuenta y datos asociados en cualquier momento contactándonos.',
        },
      },
      yourRights: {
        heading: { en: 'Your Rights', es: 'Tus derechos' },
        body: {
          en: 'Depending on your jurisdiction, you may have the right to access, correct, delete, or export your personal data. You may also have the right to restrict or object to processing. To exercise these rights, contact us at hello@quizverse.org.',
          es: 'Dependiendo de tu jurisdicción, puedes tener derecho a acceder, corregir, eliminar o exportar tus datos personales. También puedes tener derecho a restringir u oponerte al procesamiento. Para ejercer estos derechos, contáctanos en hello@quizverse.org.',
        },
      },
      changes: {
        heading: { en: 'Changes to This Policy', es: 'Cambios a esta política' },
        body: {
          en: 'We may update this privacy policy from time to time. We will notify you of significant changes by posting a notice on our website.',
          es: 'Podemos actualizar esta política de privacidad ocasionalmente. Te notificaremos cambios significativos publicando un aviso en nuestro sitio web.',
        },
      },
    },
  };

  const t = (key: Record<string, string>) => key[lang] ?? key.en;

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        {t(content.title)}
      </h1>
      <p className="text-text-muted mt-2 text-sm">{t(content.lastUpdated)}</p>

      <div className="mt-8 space-y-8 text-base leading-relaxed">
        <p className="text-text-secondary">{t(content.sections.intro)}</p>

        {(
          Object.entries(content.sections).filter(([key]) => key !== 'intro') as [
            string,
            { heading: { en: string; es: string }; body: { en: string; es: string } },
          ][]
        ).map(([, section], index) => (
          <section key={`privacy-section-${index}`}>
            <h2 className="text-text-primary font-display text-xl font-semibold">
              {t(section.heading)}
            </h2>
            <p className="text-text-secondary mt-3">{t(section.body)}</p>
          </section>
        ))}
      </div>

      <div className="border-border-subtle mt-12 border-t pt-8">
        <p className="text-text-muted text-sm">
          {lang === 'es'
            ? 'Si tienes preguntas sobre esta política, contáctanos en '
            : 'If you have questions about this policy, contact us at '}
          <a
            href="mailto:hello@quizverse.org"
            className="text-accent-primary hover:text-accent-hover underline transition-colors"
          >
            hello@quizverse.org
          </a>
        </p>
      </div>
    </main>
  );
}
