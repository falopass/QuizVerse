import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getLocale, getLocaleFromParam } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/navigation';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { enabledOAuthProviders } from '@/lib/auth/oauth-providers';

export async function LoginPageView({
  redirectTo = '/',
  locale: localeParam,
  oauthFailed = false,
}: {
  redirectTo?: string;
  locale?: string;
  oauthFailed?: boolean;
}) {
  const locale = localeParam ? getLocaleFromParam(localeParam) : await getLocale();
  const dictionary = await getDictionary(locale);
  const copy =
    locale === 'es'
      ? {
          eyebrow: 'Cuenta',
          note1Title: 'Guarda tu progreso',
          note1Body: 'Mantén historial, rachas y enlaces de resultados en un mismo lugar.',
          note2Title: 'Crea más rápido',
          note2Body: 'Mueve borradores AI y edición manual sin romper tu flujo.',
          note3Title: 'Comparte mejor',
          note3Body: 'Publica quizzes y resultados que se sientan diseñados para circular.',
          continueTitle: 'Continúa tu sesión',
          continueBody: 'Elige un proveedor y entra al estudio de QuizVerse.',
          oauthFailed: 'No pudimos completar el acceso social. Vuelve a intentarlo.',
          browseFirst: 'o explora primero',
          legal: 'Al continuar, aceptas nuestros',
          and: 'y',
          privacy: 'Política de Privacidad',
          terms: 'Términos',
        }
      : {
          eyebrow: 'Account',
          note1Title: 'Save progress',
          note1Body: 'Keep quiz history, streaks and result links in one place.',
          note2Title: 'Create faster',
          note2Body: 'Move between AI drafts and manual editing without losing your flow.',
          note3Title: 'Share better',
          note3Body: 'Publish quizzes and results that feel designed to circulate.',
          continueTitle: 'Continue your session',
          continueBody: 'Pick a provider and step into the QuizVerse studio.',
          oauthFailed: "We couldn't finish the social sign-in. Try again.",
          browseFirst: 'or browse first',
          legal: 'By continuing, you agree to our',
          and: 'and',
          privacy: 'Privacy Policy',
          terms: 'Terms',
        };
  const safeRedirect = safeRedirectPath(redirectTo, localizeHref(locale, '/'));
  const oauthProviders = enabledOAuthProviders();

  return (
    <div className="min-h-screen px-4 pt-28 pb-20">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="surface-panel flex min-h-[34rem] flex-col justify-between p-8 md:p-10">
          <div className="space-y-5">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 className="text-text-primary max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
              {dictionary.auth.title}
            </h1>
            <p className="balanced-copy text-text-secondary max-w-xl text-lg">
              {dictionary.auth.subtitle}
            </p>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-3">
            <EditorialNote title={copy.note1Title} body={copy.note1Body} />
            <EditorialNote title={copy.note2Title} body={copy.note2Body} />
            <EditorialNote title={copy.note3Title} body={copy.note3Body} />
          </div>
        </section>

        <section className="surface-card p-8 md:p-10">
          <div className="mb-8">
            <div className="border-border-subtle bg-bg-primary text-accent-primary flex h-14 w-14 items-center justify-center rounded-full border text-sm font-black tracking-[0.22em] uppercase">
              QV
            </div>
            <h2 className="font-display text-text-primary mt-5 text-4xl">{copy.continueTitle}</h2>
            <p className="text-text-secondary mt-3 text-sm leading-6">{copy.continueBody}</p>
          </div>

          <div className="space-y-4">
            <LoginForm locale={locale} redirectTo={safeRedirect} />

            {oauthFailed ? (
              <p role="alert" className="text-sm font-semibold text-red-400">
                {copy.oauthFailed}
              </p>
            ) : null}

            <OAuthButtons locale={locale} redirectTo={safeRedirect} providers={oauthProviders} />
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="bg-border-subtle h-px flex-1" />
            <span className="text-text-muted text-[11px] font-semibold tracking-[0.24em] uppercase">
              {copy.browseFirst}
            </span>
            <div className="bg-border-subtle h-px flex-1" />
          </div>
          <Link
            href={safeRedirect.includes('/create') ? localizeHref(locale, '/') : safeRedirect}
            className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 inline-flex w-full items-center justify-center rounded-full border px-4 py-4 text-sm font-semibold transition-colors"
          >
            {dictionary.auth.guest}
          </Link>
          <p className="text-text-muted mt-6 text-xs leading-6">
            {copy.legal}{' '}
            <Link href={localizeHref(locale, '/terms')} className="underline">
              {copy.terms}
            </Link>{' '}
            {copy.and}{' '}
            <Link href={localizeHref(locale, '/privacy')} className="underline">
              {copy.privacy}
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

function EditorialNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-border-subtle bg-bg-primary rounded-[1.5rem] border px-5 py-5">
      <p className="text-text-primary text-sm font-semibold">{title}</p>
      <p className="text-text-secondary mt-2 text-sm leading-6">{body}</p>
    </div>
  );
}
