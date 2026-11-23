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
  const oauthProviders = enabledOAuthProviders();
  const copy =
    locale === 'es'
      ? {
          eyebrow: 'Cuenta',
          note1Title: 'Guarda tu progreso',
          note1Body: 'Mantén tu historial y los enlaces de tus resultados en un mismo lugar.',
          note2Title: 'Crea más rápido',
          note2Body: 'Combina borradores con IA y edición manual sin romper tu flujo.',
          note3Title: 'Comparte mejor',
          note3Body: 'Publica quizzes y resultados que se sientan diseñados para circular.',
          continueTitle: 'Continúa tu sesión',
          continueBody: oauthProviders.length
            ? 'Elige un proveedor o entra con tu correo.'
            : 'Entra con tu correo y tu contraseña.',
          oauthFailed: 'No pudimos completar el acceso social. Vuelve a intentarlo.',
          browseFirst: 'o explora primero',
          noAccount: '¿No tienes cuenta?',
          signUp: 'Crea una',
          legal: 'Al continuar, aceptas nuestros',
          and: 'y',
          privacy: 'Política de privacidad',
          terms: 'Términos',
        }
      : {
          eyebrow: 'Account',
          note1Title: 'Save progress',
          note1Body: 'Keep your quiz history and result links in one place.',
          note2Title: 'Create faster',
          note2Body: 'Move between AI drafts and manual editing without losing your flow.',
          note3Title: 'Share better',
          note3Body: 'Publish quizzes and results that feel designed to circulate.',
          continueTitle: 'Continue your session',
          continueBody: oauthProviders.length
            ? 'Pick a provider or sign in with your email.'
            : 'Sign in with your email and password.',
          oauthFailed: "We couldn't finish the social sign-in. Try again.",
          browseFirst: 'or browse first',
          noAccount: "Don't have an account?",
          signUp: 'Create one',
          legal: 'By continuing, you agree to our',
          and: 'and',
          privacy: 'Privacy Policy',
          terms: 'Terms',
        };
  const safeRedirect = safeRedirectPath(redirectTo, localizeHref(locale, '/'));
  // '/' no lleva idioma: la home localizada evita que el callback OAuth y la
  // vuelta del login por email devuelvan /es a la portada inglesa.
  const localizedRedirect = safeRedirect === '/' ? localizeHref(locale, '/') : safeRedirect;

  return (
    <div className="min-h-screen px-4 pt-6 pb-16 md:pt-10 md:pb-20">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="surface-card order-1 p-6 sm:p-8 md:p-10 lg:order-2">
          <div className="mb-8">
            <div className="border-border-subtle bg-bg-primary text-accent-primary flex h-12 w-12 items-center justify-center rounded-[4px] border text-sm font-bold">
              QV
            </div>
            <h1 className="font-display text-text-primary mt-5 text-3xl font-normal sm:text-4xl">
              {copy.continueTitle}
            </h1>
            <p className="text-text-secondary mt-3 text-sm leading-6">{copy.continueBody}</p>
          </div>

          <div className="space-y-4">
            <LoginForm locale={locale} redirectTo={localizedRedirect} showRegisterLink={false} />

            {oauthFailed ? (
              <p
                role="alert"
                className="border-error/40 bg-error/10 text-error rounded-[4px] border px-4 py-3 text-sm font-semibold"
              >
                {copy.oauthFailed}
              </p>
            ) : null}

            <OAuthButtons
              locale={locale}
              redirectTo={localizedRedirect}
              providers={oauthProviders}
            />
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="bg-border-subtle h-px flex-1" />
            <span className="text-text-muted text-xs font-semibold">{copy.browseFirst}</span>
            <div className="bg-border-subtle h-px flex-1" />
          </div>
          <Link
            href={
              localizedRedirect.includes('/create') ? localizeHref(locale, '/') : localizedRedirect
            }
            className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary inline-flex min-h-12 w-full items-center justify-center rounded-full border px-4 py-3.5 text-sm font-semibold transition-colors"
          >
            {dictionary.auth.guest}
          </Link>
          <p className="text-text-secondary mt-6 text-center text-sm">
            {copy.noAccount}{' '}
            <Link
              href={`${localizeHref(locale, '/register')}?redirect=${encodeURIComponent(localizedRedirect)}`}
              className="text-accent-primary font-semibold hover:underline"
            >
              {copy.signUp}
            </Link>
          </p>
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

        <section className="surface-panel order-2 flex flex-col justify-between gap-8 p-6 sm:p-8 md:p-10 lg:order-1 lg:min-h-[34rem]">
          <div className="space-y-4">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="font-display text-text-primary max-w-xl text-3xl font-normal md:text-5xl">
              {dictionary.auth.title}
            </h2>
            <p className="balanced-copy text-text-secondary max-w-xl text-base md:text-lg">
              {dictionary.auth.subtitle}
            </p>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-3">
            <EditorialNote title={copy.note1Title} body={copy.note1Body} />
            <EditorialNote title={copy.note2Title} body={copy.note2Body} />
            <EditorialNote title={copy.note3Title} body={copy.note3Body} />
          </div>
        </section>
      </div>
    </div>
  );
}

function EditorialNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-border-subtle bg-bg-primary rounded-[4px] border px-4 py-4">
      <p className="text-text-primary text-sm font-semibold">{title}</p>
      <p className="text-text-secondary mt-2 text-sm leading-6">{body}</p>
    </div>
  );
}
