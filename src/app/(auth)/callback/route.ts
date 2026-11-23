import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import {
  RECOVERY_COOKIE_NAME,
  createRecoveryChallenge,
  isRecoveryPath,
  isRecoverySession,
  recoveryCookieOptions,
  sessionIdFromAccessToken,
} from '@/lib/auth/password-recovery';

/** Idioma de la ruta de retorno; solo cuenta un prefijo `/en` o `/es` exacto. */
function localeOfNext(next: string | null): 'en' | 'es' {
  return next?.match(/^\/(en|es)(\/|$)/)?.[1] === 'es' ? 'es' : 'en';
}

function redirectRecoveryExpired(origin: string, locale: 'en' | 'es') {
  const response = NextResponse.redirect(`${origin}/${locale}/reset-password?error=expired`);
  response.cookies.set(RECOVERY_COOKIE_NAME, '', recoveryCookieOptions(0));
  return response;
}

/**
 * Retorno del flujo OAuth, confirmación de alta y recuperación de contraseña.
 *
 * - OAuth / confirmación: GoTrue redirige aquí con `?code=` (PKCE) o con
 *   `?error=`. En fallo volvemos a `/{locale}/login?error=oauth` conservando
 *   el destino saneado (`safeRedirectPath`).
 * - Recuperación (`next=/[locale]/reset-password` o `token_hash` + `type=recovery`):
 *   exige que GoTrue confirme un desafío de recuperación real (`verifyOtp` con
 *   `type: 'recovery'` o `exchangeCodeForSession` cuyo JWT traiga `amr: recovery`).
 *   Solo entonces emite la cookie HttpOnly firmada de un solo uso para
 *   `resetPasswordAction`. Un enlace vencido o un código OAuth redirige a
 *   `/{locale}/reset-password?error=expired` sin habilitar el formulario.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const providerError = requestUrl.searchParams.get('error');
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get('next');
  const locale = localeOfNext(next);
  const safeNext = safeRedirectPath(next, `/${locale}`);
  const isRecovery = isRecoveryPath(safeNext) || (type === 'recovery' && Boolean(tokenHash));

  if (isRecovery) {
    if (providerError) {
      return redirectRecoveryExpired(origin, locale);
    }

    const recoveryNext = isRecoveryPath(safeNext) ? safeNext : `/${locale}/reset-password`;
    const supabase = await createClient();

    let userId: string | null = null;
    let sessionId: string | null = null;

    if (tokenHash && type === 'recovery') {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      if (error || !data?.user) {
        return redirectRecoveryExpired(origin, locale);
      }
      userId = data.user.id;
      sessionId = sessionIdFromAccessToken(data.session?.access_token);
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data?.user || !isRecoverySession(data.session)) {
        return redirectRecoveryExpired(origin, locale);
      }
      userId = data.user.id;
      sessionId = sessionIdFromAccessToken(data.session?.access_token);
    } else {
      return redirectRecoveryExpired(origin, locale);
    }

    const issued = await createRecoveryChallenge({ userId, sessionId });
    if (!issued) {
      return redirectRecoveryExpired(origin, locale);
    }

    const response = NextResponse.redirect(`${origin}${recoveryNext}`);
    response.cookies.set(RECOVERY_COOKIE_NAME, issued.token, recoveryCookieOptions());
    return response;
  }

  // El destino se devuelve como `redirect` para que un reintento no lo pierda.
  const loginPath = `/${locale}/login?error=oauth&redirect=${encodeURIComponent(safeNext)}`;

  if (providerError) {
    return NextResponse.redirect(`${origin}${loginPath}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}${loginPath}`);
    }
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
