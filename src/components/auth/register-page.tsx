import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { getLocaleFromParam } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/navigation';

export async function RegisterPageView({
  redirectTo = '/',
  locale: localeParam,
}: {
  redirectTo?: string;
  locale?: string;
}) {
  const locale = localeParam ? getLocaleFromParam(localeParam as 'en' | 'es') : 'en';
  const isEs = locale === 'es';
  const copy = isEs
    ? {
        eyebrow: 'Cuenta',
        title: 'Crea tu cuenta',
        subtitle: 'Únete a QuizVerse y empieza a crear, jugar y compartir.',
        email: 'Correo electrónico',
        password: 'Contraseña',
        name: 'Nombre',
        signUp: 'Crear cuenta',
        haveAccount: '¿Ya tienes cuenta?',
        signIn: 'Inicia sesión',
        legal: 'Al registrarte, aceptas nuestros',
        and: 'y',
        privacy: 'Política de Privacidad',
        terms: 'Términos',
      }
    : {
        eyebrow: 'Account',
        title: 'Create your account',
        subtitle: 'Join QuizVerse and start creating, playing, and sharing.',
        email: 'Email',
        password: 'Password',
        name: 'Name',
        signUp: 'Sign Up',
        haveAccount: 'Already have an account?',
        signIn: 'Sign In',
        legal: 'By signing up, you agree to our',
        and: 'and',
        privacy: 'Privacy Policy',
        terms: 'Terms',
      };

  const safeRedirect =
    redirectTo && redirectTo.startsWith('/') ? redirectTo : localizeHref(locale, '/');

  return (
    <div className="min-h-screen px-4 pt-28 pb-20">
      <div className="mx-auto max-w-md">
        <div className="surface-card p-8 md:p-10">
          <div className="mb-8">
            <div className="border-border-subtle bg-bg-primary text-accent-primary flex h-14 w-14 items-center justify-center rounded-full border text-sm font-black tracking-[0.22em] uppercase">
              QV
            </div>
            <p className="eyebrow mt-5">{copy.eyebrow}</p>
            <h1 className="font-display text-text-primary mt-1 text-4xl">{copy.title}</h1>
            <p className="text-text-secondary mt-3 text-sm leading-6">{copy.subtitle}</p>
          </div>

          <RegisterForm
            labels={{
              email: copy.email,
              password: copy.password,
              name: copy.name,
              submit: copy.signUp,
            }}
            redirectTo={safeRedirect}
            locale={locale}
          />

          <p className="text-text-secondary mt-6 text-center text-sm">
            {copy.haveAccount}{' '}
            <Link
              href={localizeHref(locale, '/login')}
              className="text-accent-primary font-semibold hover:underline"
            >
              {copy.signIn}
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
        </div>
      </div>
    </div>
  );
}
