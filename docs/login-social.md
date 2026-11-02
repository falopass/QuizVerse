# Login social (Google, Facebook, GitHub)

Los botones de acceso social están en `/[locale]/login` y `/[locale]/register`
**detrás de una bandera de entorno** (ver abajo). El flujo es PKCE server-side:

1. `OAuthButtons` llama `signInWithOAuthAction` (`src/actions/auth.actions.ts`),
   que valida el proveedor contra la bandera, aplica rate limit por IP y pide a
   GoTrue la URL de autorización (`signInWithOAuth` deja el `code_verifier` en
   cookie).
2. El navegador va al proveedor y vuelve a `https://quizverse.org/callback?code=…&next=…`.
3. `/callback` (`src/app/(auth)/callback/route.ts`) canjea el código con
   `exchangeCodeForSession`; el error vuelve a `/{locale}/login?error=oauth`.

## Bandera de proveedores: `AUTH_OAUTH_PROVIDERS`

Los proveedores visibles se controlan con una variable de entorno de servidor,
leída en runtime por `enabledOAuthProviders()` (`src/lib/auth/oauth-providers.ts`):

```bash
AUTH_OAUTH_PROVIDERS="google,github"   # lista separada por comas
```

- Valores admitidos: `google`, `facebook`, `github` (cualquier otro se ignora).
- Sin variable o vacía: no se muestra ningún botón social y
  `signInWithOAuthAction` rechaza el proveedor con `provider_disabled`.
- Nunca `NEXT_PUBLIC_*`: en Cloudflare Workers las variables públicas quedan
  horneadas en el build y no se podrían activar sin redesplegar.

**Dónde se configura:** como variable del Worker `quizverse` en Cloudflare
(dashboard → Workers & Pages → `quizverse` → Settings → Variables and Secrets;
es una variable, no un secreto). El cambio toma efecto al instante, sin rebuild.
Hasta que GoTrue tenga el proveedor habilitado (paso siguiente), la variable se
deja vacía o sin definir y las páginas no muestran acceso social.

## Lo que falta: habilitar los proveedores en GoTrue (VPS)

El Supabase es auto-hospedado en el VPS. Ahora mismo `/auth/v1/authorize`
responde `provider is not enabled` para google, facebook y github: **ninguno
está configurado**. Por eso `AUTH_OAUTH_PROVIDERS` arranca vacía: cada
proveedor se suma a la lista cuando su app OAuth y su `GOTRUE_EXTERNAL_*`
estén listos.

### 1. Crear las apps OAuth

| Proveedor | Consola                                                   | Callback URI a registrar                     |
| :-------- | :-------------------------------------------------------- | :------------------------------------------- |
| Google    | console.cloud.google.com → Credentials → OAuth client     | `https://api.quizverse.org/auth/v1/callback` |
| Facebook  | developers.facebook.com → App → Facebook Login → Settings | `https://api.quizverse.org/auth/v1/callback` |
| GitHub    | github.com/settings/developers → OAuth Apps               | `https://api.quizverse.org/auth/v1/callback` |

El callback siempre es el de **GoTrue** (`api.quizverse.org`), no el del sitio.
En Google hace falta también la «OAuth consent screen» publicada; en Facebook,
la app debe pasar de desarrollo a producción («Live mode»).

### 2. Variables en el contenedor de auth del VPS

En el `docker-compose` de Supabase (servicio `auth` / GoTrue), no en `deploy/`:

```bash
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<client id de Google>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<client secret de Google>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.quizverse.org/auth/v1/callback

GOTRUE_EXTERNAL_FACEBOOK_ENABLED=true
GOTRUE_EXTERNAL_FACEBOOK_CLIENT_ID=<app id de Meta>
GOTRUE_EXTERNAL_FACEBOOK_SECRET=<app secret de Meta>
GOTRUE_EXTERNAL_FACEBOOK_REDIRECT_URI=https://api.quizverse.org/auth/v1/callback

# Opcional
GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=<client id de GitHub>
GOTRUE_EXTERNAL_GITHUB_SECRET=<client secret de GitHub>
GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=https://api.quizverse.org/auth/v1/callback
```

Y que la lista de redirecciones permitidas incluya el dominio del sitio
(`GOTRUE_URI_ALLOW_LIST` debe cubrir `https://quizverse.org/*`; la recuperación
de contraseña ya depende de lo mismo, así que probablemente ya está).

### 3. Verificación

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.quizverse.org/auth/v1/authorize?provider=google"
```

Debe responder `302` hacia `accounts.google.com` (hoy responde `400`).

## Alta de usuarios OAuth

La migración `009_fix_signup_username` ya cubre el caso: el trigger
`handle_new_user` deriva el username de `name`, `display_name` o `full_name`
(Google y Facebook mandan `full_name`), pliega tildes y resuelve colisiones
con sufijo del UUID. Un alta por Google no rompe el CHECK `^[a-z0-9_]{3,24}$`.
Ojo: el `display_name` visible solo lee `name`/`display_name` — si el
proveedor manda únicamente `full_name`, el nombre queda «New Player» hasta
que la persona lo edite (deuda conocida, no bloquea el alta).

## Deuda relacionada (Worker)

El rate limit de auth (`authLimiter`, 5 intentos/minuto) depende de
`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Esas variables **no
están configuradas en el Worker de producción** (solo existe
`DEEPSEEK_API_KEY`): hoy el límite falla abierto y login, registro,
recuperación y `/api/quiz/reveal` corren sin freno. Hay que subirlas como
secretos del Worker `quizverse`.
