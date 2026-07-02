import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  return {
    title: lang === 'es' ? 'Términos de Servicio' : 'Terms of Service',
    description:
      lang === 'es'
        ? 'Términos y condiciones de uso de la plataforma QuizVerse.'
        : 'Terms and conditions for using the QuizVerse platform.',
    alternates: { canonical: `/${lang}/terms` },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';

  const content = {
    title: { en: 'Terms of Service', es: 'Términos de Servicio' },
    lastUpdated: { en: 'Last updated: May 2026', es: 'Última actualización: mayo 2026' },
    sections: [
      {
        heading: { en: '1. Acceptance of Terms', es: '1. Aceptación de los términos' },
        body: {
          en: 'By accessing or using QuizVerse, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.',
          es: 'Al acceder o usar QuizVerse, aceptas estos Términos de Servicio. Si no estás de acuerdo, no uses la plataforma.',
        },
      },
      {
        heading: { en: '2. Accounts', es: '2. Cuentas' },
        body: {
          en: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate information when creating an account.',
          es: 'Eres responsable de mantener la confidencialidad de tus credenciales y de todas las actividades bajo tu cuenta. Debes proporcionar información precisa al crear una cuenta.',
        },
      },
      {
        heading: { en: '3. User-Generated Content', es: '3. Contenido generado por usuarios' },
        body: {
          en: 'You retain ownership of quizzes you create. By publishing content on QuizVerse, you grant us a worldwide, non-exclusive license to display and distribute it on the platform. You are responsible for ensuring your content does not infringe on third-party rights.',
          es: 'Conservas la propiedad de los quizzes que creas. Al publicar contenido en QuizVerse, nos otorgas una licencia mundial no exclusiva para mostrarlo y distribuirlo en la plataforma. Eres responsable de asegurar que tu contenido no infrinja derechos de terceros.',
        },
      },
      {
        heading: { en: '4. Prohibited Conduct', es: '4. Conducta prohibida' },
        body: {
          en: 'You may not: upload illegal content, harass or impersonate others, attempt to breach platform security, use automated tools to scrape or overload the platform, or violate any applicable laws.',
          es: 'No puedes: subir contenido ilegal, acosar o suplantar a otros, intentar vulnerar la seguridad de la plataforma, usar herramientas automatizadas para raspar o sobrecargar la plataforma, o violar leyes aplicables.',
        },
      },
      {
        heading: { en: '5. Intellectual Property', es: '5. Propiedad intelectual' },
        body: {
          en: 'The QuizVerse brand, design system, and platform code are our intellectual property. Quiz covers may use stock imagery under license from Pexels and Pixabay. AI-generated quiz content is created using DeepSeek.',
          es: 'La marca QuizVerse, el sistema de diseño y el código de la plataforma son de nuestra propiedad intelectual. Las portadas de quizzes pueden usar imágenes de stock bajo licencia de Pexels y Pixabay. El contenido generado por IA se crea usando DeepSeek.',
        },
      },
      {
        heading: { en: '6. Termination', es: '6. Terminación' },
        body: {
          en: 'We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time through your profile settings or by contacting us.',
          es: 'Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos. Puedes eliminar tu cuenta en cualquier momento desde la configuración de perfil o contactándonos.',
        },
      },
      {
        heading: { en: '7. Disclaimer', es: '7. Descargo de responsabilidad' },
        body: {
          en: 'QuizVerse is provided "as is" without warranties of any kind. We do not guarantee uninterrupted access or error-free operation. Quiz results are for entertainment purposes only.',
          es: 'QuizVerse se proporciona "tal cual" sin garantías de ningún tipo. No garantizamos acceso ininterrumpido ni funcionamiento libre de errores. Los resultados de quizzes son solo para fines de entretenimiento.',
        },
      },
      {
        heading: { en: '8. Limitation of Liability', es: '8. Limitación de responsabilidad' },
        body: {
          en: 'To the fullest extent permitted by law, QuizVerse shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.',
          es: 'En la máxima medida permitida por la ley, QuizVerse no será responsable por daños indirectos, incidentales o consecuentes derivados del uso de la plataforma.',
        },
      },
      {
        heading: { en: '9. Changes to Terms', es: '9. Cambios en los términos' },
        body: {
          en: 'We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.',
          es: 'Podemos actualizar estos términos ocasionalmente. El uso continuado de la plataforma después de los cambios constituye la aceptación de los nuevos términos.',
        },
      },
      {
        heading: { en: '10. Governing Law', es: '10. Ley aplicable' },
        body: {
          en: 'These terms are governed by the laws of Spain. Any disputes shall be resolved in the courts of Madrid.',
          es: 'Estos términos se rigen por las leyes de España. Cualquier disputa se resolverá en los tribunales de Madrid.',
        },
      },
    ],
  };

  const t = (key: Record<string, string>) => key[lang] ?? key.en;

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        {t(content.title)}
      </h1>
      <p className="text-text-muted mt-2 text-sm">{t(content.lastUpdated)}</p>

      <div className="mt-8 space-y-8 text-base leading-relaxed">
        {content.sections.map((section, i) => (
          <section key={i}>
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
            ? 'Para preguntas sobre estos términos, contáctanos en '
            : 'For questions about these terms, contact us at '}
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
