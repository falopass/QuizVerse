import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getLocale, getLocaleFromParam } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/navigation';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';

export async function LoginPageView({
  redirectTo = '/',
  locale: localeParam,
}: {
  redirectTo?: string;
  locale?: string;
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
          google: 'Continuar con Google',
          github: 'Continuar con GitHub',
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
          google: 'Continue with Google',
          github: 'Continue with GitHub',
          browseFirst: 'or browse first',
          legal: 'By continuing, you agree to our',
          and: 'and',
          privacy: 'Privacy Policy',
          terms: 'Terms',
        };
  const safeRedirect = safeRedirectPath(redirectTo, localizeHref(locale, '/'));
  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/callback?next=${encodeURIComponent(safeRedirect)}`;
  const googleAuthUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(callbackUrl)}`;
  const githubAuthUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(callbackUrl)}`;

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

            <a
              href={googleAuthUrl}
              className="flex items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-4 py-4 text-sm font-semibold text-neutral-900 transition-transform hover:-translate-y-0.5"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {copy.google}
            </a>
            <a
              href={githubAuthUrl}
              className="flex items-center justify-center gap-3 rounded-full bg-neutral-950 px-4 py-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {copy.github}
            </a>
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
