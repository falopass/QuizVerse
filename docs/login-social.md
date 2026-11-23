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
Cada proveedor debe añadirse a la lista solo cuando su app OAuth y sus variables
`GOTRUE_EXTERNAL_*` estén configuradas en GoTrue.

## Estado operativo observado (2026-11-22)

> **Alcance y origen de la evidencia:** lectura de código en `main` (`8271d9b`) +
> sondas HTTP anónimas GET contra `https://quizverse.org` y
> `https://api.quizverse.org/auth/v1/authorize` (sin iniciar sesión ni acceder al
> VPS/dashboard). Solo el dueño verifica credenciales o aplica cambios en
> producción.

| Proveedor | Estado en UI / GoTrue                                                            | Ciclo completo hasta sesión                                                                                           |
| :-------- | :------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| Google    | **Confirmado visible** en prod (botón en `/login` y `302` desde GoTrue)          | **Pendiente** — falta prueba end-to-end con cuenta de prueba hasta sesión activa                                      |
| GitHub    | **Confirmado visible** en prod (botón en `/login` y `302` desde GoTrue)          | **Pendiente** — falta prueba end-to-end con cuenta de prueba hasta sesión activa                                      |
| Facebook  | **Pendiente** — GoTrue respondió `400` (`provider is not enabled`) el 2026-11-22 | **Pendiente** — requiere crear app de Meta, `GOTRUE_EXTERNAL_FACEBOOK_*` y añadir `facebook` a `AUTH_OAUTH_PROVIDERS` |

## Configurar o agregar proveedores en GoTrue (VPS)

El Supabase es auto-hospedado en el VPS (`api.quizverse.org`). Para habilitar un
proveedor nuevo (por ejemplo `facebook`) o revisar uno existente, sigue estos pasos:

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

Debe responder `302` hacia el proveedor (confirmado el 2026-11-22 para `google` y
`github`; `facebook` respondía `400` hasta configurar su app). Ten en cuenta que
ese `302` solo confirma que GoTrue reconoce el proveedor: **no valida** el canje
PKCE en `/callback` ni la creación de sesión, que deben comprobarse aparte con
cuentas de prueba autorizadas.

## Alta de usuarios OAuth

La migración `009_fix_signup_username` ya cubre el caso: el trigger
`handle_new_user` deriva el username de `name`, `display_name` o `full_name`
(Google y Facebook mandan `full_name`), pliega tildes y resuelve colisiones
con sufijo del UUID. Un alta por Google no rompe el CHECK `^[a-z0-9_]{3,24}$`.
Ojo: el `display_name` visible solo lee `name`/`display_name` — si el
proveedor manda únicamente `full_name`, el nombre queda «New Player» hasta
que la persona lo edite (deuda conocida, no bloquea el alta).

## Deuda relacionada (Worker — estado al 2026-11-22)

- **Rate limiting:** cuando `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`
  no están configurados en el Worker, `src/lib/utils/rate-limit.ts` ya **no falla
  abierto por defecto**: recurre a los bindings nativos de Cloudflare Rate
  Limiting declarados en `wrangler.jsonc` (`RATE_LIMIT_AUTH`, `RATE_LIMIT_AUTH_IP`,
  `RATE_LIMIT_GAME`, `RATE_LIMIT_REVEAL`, etc.). Estos bindings aplican límites
  aproximados por ubicación (ventana fija de 60 s).
- **Estado pendiente (Upstash Redis):** subir `UPSTASH_REDIS_REST_URL` y
  `UPSTASH_REDIS_REST_TOKEN` como secretos del Worker `quizverse` sigue
  **pendiente** para contar con cuotas globales consistentes entre ubicaciones y
  almacenamiento compartido de `attempt-store` (revelación por pregunta y 50/50)
  entre isolates.
