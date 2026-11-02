import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';

/**
 * Retorno del flujo OAuth (y de los enlaces de recuperación de contraseña).
 *
 * GoTrue redirige aquí con `?code=` cuando el proveedor aceptó, o con
 * `?error=&error_description=` cuando falló — incluido el caso de un proveedor
 * aún no habilitado en el backend. En ambos fallos volvemos al login del
 * idioma de donde salió la persona, con `?error=oauth` para que la página
 * muestre el aviso en vez de tragar el silencio.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const providerError = requestUrl.searchParams.get('error');
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get('next');
  const safeNext = safeRedirectPath(next, '/');
  const loginPath = `/${safeNext.startsWith('/es') ? 'es' : 'en'}/login?error=oauth`;

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
