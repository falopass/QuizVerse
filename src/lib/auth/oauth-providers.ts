import { OAuthProviderSchema, type OAuthProvider } from '@/lib/auth/identity';

/**
 * Proveedores OAuth habilitados, leídos en runtime de `AUTH_OAUTH_PROVIDERS`
 * (lista separada por comas: `"google,github"`). Nunca `NEXT_PUBLIC_*`: en
 * Cloudflare Workers las variables públicas quedan horneadas en el build y
 * no se podrían activar sin redesplegar.
 *
 * Sin variable o vacía devuelve `[]`: la UI no muestra botones sociales y
 * `signInWithOAuthAction` rechaza cualquier proveedor con `provider_disabled`.
 * Un nombre que no esté en `OAuthProviderSchema` se ignora.
 */
export function enabledOAuthProviders(): OAuthProvider[] {
  const enabled = new Set(
    (process.env.AUTH_OAUTH_PROVIDERS ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
  );
  // El orden lo fija el esquema, no la variable, para que la UI sea estable.
  return OAuthProviderSchema.options.filter((provider) => enabled.has(provider));
}
