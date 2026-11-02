# AGENTS.md — QuizVerse

> AI agents and developers: Read this BEFORE making changes to this codebase.

## Resource limits (RAM) — MANDATORY

This project is developed on a single personal machine, and also worked on by Cloud sessions. Respect these limits in local sessions:

- MAX_BUILD=1 · MAX_FULL_TEST_SUITE=1 · MAX_DEV_SERVER=1 · MAX_BROWSER=1 · MAX_HEAVY_TASKS=1 · TEST_RUNNER_MAX_WORKERS=2
- One build, one dev server, one browser and one full suite **at a time**. Never parallelize heavy tasks locally.
- Subagents **only edit files and explore**. They do NOT run dev servers, builds, typecheck or full suites. At most 2 subagents write at once, on disjoint files; shared files (`package.json`, lockfile, configs) are edited by the main agent. The main agent runs heavy tasks, one at a time.

## Workflow rules

- **Never push directly to `main`.** One branch per feature/fix (`type/short-name`) + Pull Request; you merge it yourself once checks are green — no per-merge owner approval needed.
- Before starting: `git switch main && git pull --rebase` (multiple sessions may be working on the repo).
- Commits in Spanish (Conventional Commits: `feat:`, `fix:`, `docs:`…).
- Do not touch `deploy/` or the VPS infrastructure (it is no longer production; it belongs to the owner).
- Verify before opening a PR: `npm run format:check`, `npm run typecheck`, `npm run lint` (`eslint . --max-warnings=0`: warnings are errors), `npm run seo:guard`, `npm test` (vitest; while iterating, `npx vitest related <files>`) and `npm run test:node` (`node --test tests/*.node.test.mjs`, for `node:test` suites that vitest does not discover). `npm run build` runs in CI and in Cloud sessions; locally only if the owner asks (it is denied in the owner's machine config). Use the Workers Builds branch preview for visual checks.
- `npm test` does NOT enforce coverage; `npm run test:coverage` does (v8 thresholds in `vitest.config.ts`: global ~60/75/70 plus higher bars for `src/lib/quiz`, `src/lib/seo`, `src/lib/data`). CI runs coverage.
- If you rebase a branch that is already pushed, push with `git push --force-with-lease`, never `--force`. Merge the PR yourself once the checks are green — that merge IS the production deploy; the owner reviews merged work afterwards. Never deploy by hand.
- Step-by-step procedures live in `.devin/skills/`: `verificar` and `entregar-pr`.
- There is no `CHANGELOG.md`. Changes are documented in each PR description; do not create the file or ask for one.

## Stack

- **Framework**: Next.js 16.4.2 (App Router + Server Components + Server Actions)
- **UI**: React 19.2.4 + TypeScript 5.x + Tailwind CSS 4.x
- **State**: Zustand (client state management)
- **Animations**: Framer Motion
- **Validation**: Zod 4.x
- **DB/Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Caching/Rate Limit**: Upstash Redis
- **AI Generation**: DeepSeek (runtime + offline seed pipeline)
- **OG Images**: Satori + @resvg/resvg-js
- **Covers**: Procedural fallback + Stock (Pexels/Pixabay) + Generated/Curated types
- **Deploy**: Cloudflare Workers (OpenNext, production via Workers Builds from `main`)
- **Domain**: quizverse.org

## Commands

```bash
# App lifecycle — BLOCKED on the work machine
# npm run dev and npm run build are denied in the owner's machine config.
# The build runs in CI per PR (.github/workflows/ci.yml) and in Cloud sessions;
# use the Workers Builds branch preview for visual checks instead of a local dev server.
npm start          # Production server
npm run lint       # ESLint

# Editorial pipeline
npm run seed:polish           # Normalize and curate generated seed
npm run seed:covers           # Generate procedural cover assets
npm run seed:stock-covers     # Hydrate strong quizzes with stock covers
npm run seed:supabase:import  # Import seed into Supabase
```

## Project Structure

```
src/
├── app/
│   ├── [locale]/              # Bilingual routes (/en, /es)
│   │   ├── (inicio)/          # Home
│   │   ├── quiz/              # Explore lives here: /[locale]/quiz (route group (explorar)).
│   │   │   │                  #   /[locale]/explore 308-redirects here (next.config.ts)
│   │   │   └── [slug]/        # Quiz detail
│   │   │       ├── play/      # Play flow
│   │   │       └── result/    # Shareable results
│   │   ├── category/[slug]/   # Category hubs
│   │   ├── leaderboard/       # Rankings
│   │   ├── login|register|forgot-password|reset-password/
│   │   ├── me/                # "Mi actividad": own profile hub
│   │   ├── profile/[username]# Public profiles
│   │   ├── my-quizzes/        # Creator's quizzes; [id]/edit, [id]/preview (draft preview)
│   │   ├── create/            # Manual composer (+ create/ai, create/done)
│   │   ├── admin/             # moderacion, quizzes, reportes (owner-only)
│   │   ├── notifications/     # Notification inbox
│   │   ├── settings/          # Account settings (incl. delete account)
│   │   ├── achievements/      # Achievements
│   │   └── about|contact|faq|privacy|terms|novedades|indice|random|feed.xml
│   ├── api/                   # API routes (AI generation, analytics, monitoring, csp-report)
│   ├── covers/                # Procedural cover image generation
│   └── stock-covers/          # Stock cover routing
├── actions/
│   └── quiz.actions.ts        # Server actions for quiz operations (auth|social|... actions too)
├── components/
│   ├── home/                  # Home page components
│   ├── layout/                # Layout shared components
│   ├── quiz/                  # Quiz play, result, detail components
│   └── shared/                # Shared UI primitives
├── lib/
│   ├── ads/                   # AdSense slot config (inert until env is set)
│   ├── auth/                  # OAuth provider flag, identity
│   ├── data/                  # Public data layer (src/lib/data/public.ts)
│   ├── design/                # Design tokens
│   ├── i18n/                  # Internationalization
│   ├── quiz/                  # Quiz logic and types (see "Juego y puntuación")
│   ├── seo/                   # Metadata and OG image generation
│   ├── supabase/              # Supabase client + SSR helpers
│   ├── telemetry/             # Analytics and monitoring
│   └── utils/                 # rate-limit.ts (Upstash → CF ratelimit bindings fallback)
├── providers/                 # React providers
├── stores/                    # Zustand stores
└── types/                     # TypeScript type definitions

scripts/
├── polish-trending-seed.mjs          # Seed polisher
├── hydrate-stock-covers.mjs          # Stock cover hydration
├── import-trending-seed-to-supabase.mjs  # Supabase importer
└── generate-cover-assets.mjs         # Procedural covers

generated/                      # Seed data and reports
├── trending-seed-openrouter.json
├── trending-seed-openrouter.normalized.json
├── trending-seed-polish-report.json
├── stock-cover-hydration-report.json
└── supabase-import-report.json

supabase/
├── migrations/                 # DB migrations
└── seed/                       # Seed data
```

## Code Conventions

- **TypeScript strict** — no `any` unless unavoidable
- **App Router** — server components by default, "use client" only when needed
- **Server Actions** — use `src/actions/quiz.actions.ts` for mutations from server components
- **i18n** — all public routes under `[locale]` (`/en`, `/es`). Never hardcode text in English-only
- **Supabase SSR** — use `@supabase/ssr` for server components, `@supabase/supabase-js` for client
- **Validation** — Zod for all external inputs (API routes, server actions, AI payloads)
- **State** — Zustand for client-side shared state, not Context
- **Covers** — layered system: procedural (fallback) → stock (curated) → generated/curated (future)
- **OG Images** — Satori + resvg for dynamic social share images
- **Telemetry** — analytics endpoint for page views, quiz lifecycle, locale switch events
- **Serializable props across the server/client boundary** — every prop passed to a `'use client'` component must be JSON-serializable (no functions, classes, `Date`, `Map`). This includes the i18n dictionary: the layout passes it whole to `SiteShell` (`'use client'`). A PR that added functions to the dictionary took production down with 500s on every route and CI did not catch it — think twice before touching the dictionary, the root layout or the shell.

## ⚠️ WHAT NOT TO TOUCH

- **NO modificar** Supabase migration files sin crear una nueva (no edit existing migrations)
- **NO hardcodear** strings en un solo idioma — todo pasa por i18n locale system
- **NO commitear** `.env.local` ni keys de Supabase service role, Groq, Pexels, Pixabay
- **NO eliminar** el sistema de covers por capas (procedural/stock/generated) — es core del diseño editorial
- **NO romper** las rutas `/[locale]` — son la base del SEO y la experiencia bilingüe
- **El directorio `generated/`** es artefacto de pipeline — no editar manualmente los JSON del seed
- **Supabase service role key** solo en scripts de import, NUNCA en código client
- **AI generation** route valida con Zod — no saltar validación en Groq endpoint
- **NO enviar la clave de respuestas al navegador** — `questions[].options[].is_correct`
  sólo existe en el servidor. Ver "Juego y puntuación" abajo.

## Juego y puntuación (server-authoritative)

El navegador nunca decide una puntuación. Manda **qué eligió**; el servidor
decide cuánto vale.

| Módulo                             | Responsabilidad                                                                                                    |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `src/lib/quiz/answer-key.ts`       | Clave de respuestas: `evaluateAnswer`, `eliminateWrongOptions`, `toClientQuiz` (quita `is_correct`), `buildReview` |
| `src/lib/quiz/attempt.ts`          | Partida efímera firmada (HMAC): emisión, verificación, caducidad e ids deterministas del envío                     |
| `src/lib/quiz/attempt-store.ts`    | Estado por attempt: una pregunta revelada una sola vez y en orden (Redis; memoria si no hay)                       |
| `src/lib/quiz/submission.ts`       | Zod del envío + `scoreSubmission` (trivia por aciertos, personality por tag dominante) + `pointsFor`               |
| `src/lib/quiz/quiz-repository.ts`  | Única puerta a la clave: carga el quiz publicado por id                                                            |
| `src/app/api/quiz/reveal/route.ts` | `POST` por pregunta: veredicto o pista 50/50. Exige attempt, rate limit por IP                                     |
| `src/actions/quiz.actions.ts`      | Orquestación fina: auth → Zod → dominio → persistir → revalidate                                                   |
| `src/lib/actions/types.ts`         | Contrato `ActionResult` (`{ success: true } \| { success: false, code, error }`)                                   |
| `src/lib/quiz/quiz-slug.ts`        | Slugs ASCII con prefijo de idioma y colisión resuelta por sufijo                                                   |

Reglas:

- `toClientQuiz()` es obligatorio en cualquier pantalla que envíe un quiz a un
  componente cliente (`/play`, `/result`). Si añades otra, pásala por ahí.
- El feedback inmediato se pide a `/api/quiz/reveal`. Si falla, el jugador sigue
  sin feedback; la partida no se bloquea y el servidor vuelve a puntuar al
  enviar.
- El reveal exige el `attempt` firmado que emite `startQuizAttempt` al arrancar
  cada partida (secreto `QUIZ_ATTEMPT_SECRET`, o derivado de
  `SUPABASE_SERVICE_ROLE_KEY`). Sin attempt válido responde 401/403; cada
  pregunta se revela una sola vez por partida y solo hacia adelante. El 50/50
  se gasta una vez por partida (repetir la misma pregunta es idempotente).
  Sin ninguno de los dos secretos el servidor entra en modo degradado: el
  reveal responde sin attempt (como antes del anti-trampa) y registra un
  aviso una vez por instancia — así previews y entornos locales sin secretos
  no pierden el feedback inmediato.
- `submitQuizResult` es idempotente por attempt: un reintento devuelve la
  sesión existente sin sumar puntos ni plays, pero reporta los puntos que el
  primer envío ya otorgó. Con secreto configurado, un envío autenticado sin
  attempt válido se guarda como anónimo (sin puntos) para que omitir el token
  no sea una vía de farmeo; sin secreto se mantiene el comportamiento anterior.
  La migración 020 añade `game_sessions.attempt_id`; sin ella el envío sigue
  funcionando (se detecta la columna ausente y se registra).
- `answers[].is_correct` que llega del cliente se ignora: se recalcula en
  `scoreSubmission` y se guarda ya corregido.
- Los puntos los otorga el trigger `award_quiz_points` (10 + 25 por partida
  perfecta). `pointsFor()` sólo replica ese número para la UI: si cambias uno,
  cambia el otro.

## Auth/Email — correos de GoTrue por Cloudflare Email Service

GoTrue (Supabase auto-hospedado en el VPS, `api.quizverse.org`) no usa SMTP:
envía los correos de auth con su **Send Email Hook** (HTTP, firmado con
Standard Webhooks) contra `POST /api/auth/send-email`, y el Worker los manda
con el binding nativo `send_email` de Cloudflare Email Service (ya habilitado
para `quizverse.org`; DKIM/SPF/rebotes configurados a nivel de dominio).

Piezas:

- `src/app/api/auth/send-email/route.ts` — verifica la firma
  (`webhook-id`/`webhook-timestamp`/`webhook-signature`, HMAC-SHA256 sobre
  `id.timestamp.body`, tolerancia ±5 min), valida el payload con Zod y responde
  en el formato del hook: `200 {}` al enviar, `{ error: { http_code, message } }`
  en error (503 + `Retry-After` cuando conviene reintento). Sin sesión ni rate
  limit de usuario: lo llama GoTrue; el proxy ya excluye `/api`.
- `src/lib/email/hook-signature.ts` — la firma (WebCrypto, tiempo constante).
- `src/lib/email/plan.ts` — payload → correos: idioma (`es` si `redirect_to`
  contiene `/es` — incluido el `next` de `/callback` — o `user_metadata` lo
  indica; si no, `en`), enlace `/auth/v1/verify` con `redirect_to` solo si es
  de quizverse.org, y el mapeo de `email_change` (Secure Email Change manda dos
  correos en un solo hook: al correo nuevo `token_hash`+`token_new`, al actual
  `token_hash_new`+`token` — los nombres están invertidos por compatibilidad en
  GoTrue, ver `src/lib/email/plan.ts`).
- `src/lib/email/templates.ts` — HTML + texto plano, es/en, todos los
  `email_action_type` de GoTrue (incluidas las notificaciones de seguridad).
- `src/lib/email/send.ts` — el binding `EMAIL` (remitente restringido a
  `noreply@quizverse.org` en `wrangler.jsonc`); sin contexto CF devuelve 503.

Configuración (lado del dueño, no del repo):

- GoTrue en el VPS: `GOTRUE_HOOK_SEND_EMAIL_ENABLED=true`,
  `GOTRUE_HOOK_SEND_EMAIL_URI=https://quizverse.org/api/auth/send-email`,
  `GOTRUE_HOOK_SEND_EMAIL_SECRETS=v1,whsec_<base64>`. Con el hook activo GoTrue
  no toca el SMTP para ningún correo de auth.
- Worker (ya existe como secreto): `SEND_EMAIL_HOOK_SECRET` con el mismo valor
  `v1,whsec_<base64>` — el endpoint toma la clave HMAC de los bytes base64 tras
  `whsec_`. Sin él responde 503.

## Contenido y seeds

Pipeline reproducible en `scripts/seed/` (ver `scripts/seed/README.md`):

- `seed:categorize` clasifica el catálogo por tema con una tabla de reglas
  ordenada y emite SQL idempotente.
- `seed:editorial` valida `editorial-seed.json` (una sola respuesta correcta por
  pregunta, categorías existentes) y emite el `INSERT ... ON CONFLICT DO NOTHING`.
- `seed:audit` es la puerta de calidad: falla si hay preguntas sin respuesta,
  opciones vacías o slugs duplicados.

Flujo por lotes: el contenido nuevo entra como `scripts/seed/editorial-seed-<lote>.json`
(un lote por archivo, pares en/es) y se emite con

```bash
node scripts/seed/emit-editorial-seed.mjs --input scripts/seed/editorial-seed-<lote>.json \
  --write --out supabase/seed/editorial-seed-<lote>.sql
```

El emisor imprime `Validated: {…}` con el conteo por categoría; el SQL es
idempotente (`ON CONFLICT (slug) DO NOTHING`) y cada lote lleva su test
`tests/editorial-seed-<lote>.test.ts`. Aplicar el SQL a la DB es decisión del
dueño. Detalles en `scripts/seed/README.md`.

Categorías vacías no son un estado válido: si una categoría se queda sin quizzes,
la página 404 y el sitemap la omite.

## Database Schema (Supabase)

Tables (main ones; see `supabase/migrations/` for the full list):

- `quizzes` — id, slug, title, description, locale, category, quiz_type, questions[], status (draft/published), featured, cover_type, cover_url, payoff, created_at
- `quiz_answer_keys` — the answer key, split out of `quizzes` by migration 015. **No grants for `anon`/`authenticated`, no policies**: only the server (service role) reads it, via `src/lib/quiz/quiz-repository.ts`. A trigger keeps it in sync on insert/update.
- `categories` — id, slug, label (en/es), icon
- `profiles` — user profiles (Supabase Auth linked)
- `game_sessions` — play session persistence with share tokens and `attempt_id` (migration 020)
- `likes` — quiz likes/favorites
- `achievements`, `comments`, `follows`, `notifications` — social layer

### Migrations

- Files live in `supabase/migrations/` as `NNN_name.sql`. Numbers are not always unique (several `011`, `015`, `018`, `019` files exist); order within a prefix is by name and the files are idempotent.
- **Production has everything applied up to `020`; the next free number is `021`.**
- **There is no migrations control table** — they were applied by hand, so `supabase migration list` will not tell you what is applied. Verify by objects instead, **per file**: `game_sessions.attempt_id` + index `game_sessions_attempt_id_unique` mean 020 ran; table `public.quiz_answer_keys` means `015_ocultar_clave_respuestas` ran; function `public.guard_quiz_editable_columns` means `015_creator_draft_review_transitions` ran; columns `quizzes.moderated_by`/`moderated_at` mean 016 ran. Files sharing a prefix each need their own check — one object does not prove the other file ran.
- Safe procedure for a new migration:
  1. Take a backup (Supabase dashboard or `pg_dump`) before touching prod.
  2. Rehearse on a copy/branch DB first; migrations are written idempotent (`IF NOT EXISTS`, `ON CONFLICT`) but test anyway.
  3. Apply **one file at a time inside a transaction** (`psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/0NN_x.sql`), so a failure rolls back cleanly.
  4. Smoke afterwards: `scripts/smoke-prod.sh` plus the specific path the migration touches.
- `scripts/apply-migrations.mjs` wraps `supabase db push --db-url` for future use (needs `SUPABASE_DB_URL` in `.env.local`); because prod was applied by hand, the first run would need a one-time `supabase migration repair --status applied <versiones>`. Owner's call, not automated.
- **Never edit an existing migration** — new changes go in a new file.

## Locale Routing

```
/en                     → English home
/es                     → Spanish home
/[locale]/quiz          → Explore (was /explore; /[locale]/explore 308-redirects here)
/[locale]/quiz/[slug]         → Quiz detail
/[locale]/quiz/[slug]/play    → Play flow
/[locale]/quiz/[slug]/result  → Shareable results
/[locale]/category/[slug]     → Category hub
/[locale]/leaderboard         → Rankings
/[locale]/me                  → "Mi actividad" (own activity, auth)
/[locale]/profile/[username]  → Public profile
/[locale]/my-quizzes          → Creator's quizzes (+ [id]/edit, [id]/preview)
/[locale]/create, /create/ai  → Manual and AI composers (auth)
/[locale]/notifications       → Notification inbox (auth)
/[locale]/settings            → Account settings (auth)
/[locale]/admin/*             → moderacion, quizzes, reportes (owner-only)
```

Non-localized root paths redirect to `/en` by default via `src/proxy.ts`.

## SEO

Todo el SEO vive en `src/lib/seo/`. Hay **una sola fuente de verdad** por dato; si
tocas metadata, tocas esto y nada más.

| Archivo              | Responsabilidad                                                                                                   |
| :------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `site.ts`            | `SITE_URL`, marca, OG estáticas, handles y tokens de verificación (env)                                           |
| `metadata.ts`        | `buildMetadata()` — title, description (recortada a ~158), canonical, hreflang + `x-default`, OG, Twitter, robots |
| `structured-data.ts` | Nodos JSON-LD: `Organization`, `WebSite`, `BreadcrumbList`, `Quiz`, `ItemList`, `WebPage`                         |
| `sitemap.ts`         | Serializador XML (escapa y valida `lastmod`)                                                                      |
| `og-font.ts`         | Fuente para las OG dinámicas de Satori                                                                            |

Reglas:

- **Nunca** pongas `canonical` en `src/app/layout.tsx`: lo heredarían las páginas
  sin metadata propia y todas canonicalizarían a la home. Cada página llama a
  `buildMetadata()` con su `path`.
- `alternatePath` **solo** cuando la traducción existe de verdad. Un `hreflang`
  que apunta a la home de otro idioma es peor que no emitir `hreflang`.
- `noindex` en `/play`, `/result`, login, registro, `/create`, `/create/ai` y
  perfiles. Se dejan **rastreables** (no `Disallow`) para que Google lea el
  `noindex`.
- **JSON-LD**: un bloque por página vía `<JsonLd />`; el layout raíz emite
  `Organization` + `WebSite`, y cada página añade lo suyo.
- `htmlLimitedBots` en `next.config.ts` fuerza que los crawlers reciban
  `<title>`, canonical y OG en el `<head>` (Next los streamea al body si no).
- Rutas raíz (`/robots.txt`, `/sitemap.xml`, `/favicon.ico`, `/<key>.txt`,
  `/google<token>.html`) están excluidas del redirect de idioma por el `matcher`
  de `proxy.ts` (nunca llegan a la función). Si añades un archivo suelto en la
  raíz sin extensión, exclúyelo en `NON_LOCALE_*`.

### Comandos

```bash
npm run seo:assets     # regenera favicons, iconos PWA y OG 1200×630 desde SVG
npm run seo:indexnow   # envía el sitemap a IndexNow (Bing, Yandex, Seznam, Naver)
```

`public/<key>.txt` es la clave de IndexNow: no la borres ni la cambies sin
regenerarla, o las peticiones devuelven 403.

### Verificación de propiedad

| Motor         | Cómo                                                                                                                                                                            |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google        | Meta tag (`GOOGLE_SITE_VERIFICATION`, variable del Worker; plantilla en `deploy/env.example`) **o** URL `https://quizverse.org/google<token>.html` (se sirve sola, sin rebuild) |
| Bing / Yandex | `BING_SITE_VERIFICATION` / `YANDEX_SITE_VERIFICATION`                                                                                                                           |

Las variables de SEO se leen en runtime del Worker: se configuran como variables o secretos del Worker en Cloudflare.

## Catalog Stats (≥ 524; audit DB 2026-10-18; lotes pendientes de importar aparte)

- 524 quizzes published confirmados: el último audit contra la DB
  (`generated/audit/content-audit.json`, 2026-10-18) contó 524 quizzes y 4192
  preguntas (262 en, 262 es; 246 trivia, 278 personality). Desde entonces se
  mergearon lotes nuevos, pero **mergeado ≠ publicado**: importar el SQL es
  decisión del dueño, así que el total real es 524 + lo que ya se haya aplicado.
- Los seeds editoriales versionados suman 314 quizzes
  (`grep -c 'insert into public.quizzes' supabase/seed/*.sql`: 157 en + 157 es;
  284 trivia + 30 personality, según `scripts/seed/editorial-seed*.json`).
- Por categoría (audit 2026-10-18, ya parcialmente desactualizado):
  movies-tv 174, anime-manga 119, gaming 94, music 51, lifestyle 21, culture 20,
  literature 12, pop-culture 9, technology 5, relationships 5, food-drink 3,
  science 3, animals 2, sports 2, geography 2, history 2.
- `personality` es un hub de _tipo_ de quiz (`/category/personality`), no una
  categoría de tema: se queda sin filas a propósito
- Regenerar la taxonomía: `npm run seed:categorize`; auditar: `npm run seed:audit`

## Deployment

- Production runs on Cloudflare Workers via OpenNext: Workers Builds builds and deploys `main`, and creates preview deployments for other branches and PRs.
- Cache: R2 for the incremental cache (`NEXT_INC_CACHE_R2_BUCKET`) and D1 for the tag cache (`NEXT_TAG_CACHE_D1`); bindings live in `wrangler.jsonc`.
- Domain: `quizverse.org` serves the app; `www.quizverse.org` redirects to apex and `/` redirects to `/en`.
- `deploy/` (owner's VPS: Docker + Caddy) is no longer production; leave it untouched.
- Environment variables: the tracked template is `deploy/env.example` (`.env.example` is gitignored, so Cloud sessions do not have it). Never commit real values.

### Worker variables and secrets (what the code reads today)

Server-only (configure as Worker secrets/vars):

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase client.
- `SUPABASE_SERVICE_ROLE_KEY` — server and import scripts only (reads `quiz_answer_keys`, admin ops). Already configured. NEVER in client code.
- `QUIZ_ATTEMPT_SECRET` — signs the anti-cheat `attempt` token for `/api/quiz/reveal` and idempotent submit. Already configured. Without it (and without service key to derive from) the server runs in degraded mode.
- `SEND_EMAIL_HOOK_SECRET` — firma Standard Webhooks (`v1,whsec_<base64>`) del Send Email Hook de GoTrue → `/api/auth/send-email` (ver "Auth/Email"). Ya existe en el Worker; el mismo valor va en `GOTRUE_HOOK_SEND_EMAIL_SECRETS` en el VPS.
- `AUTH_OAUTH_PROVIDERS` — comma list (`"google,github,facebook"`) gating social login buttons and the OAuth action; empty/unset = email only. Read in runtime on purpose (not `NEXT_PUBLIC_`, which is baked at build).
- `DEEPSEEK_API_KEY` — `/api/quiz/generate` (AI creation).
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — optional: rate limiting and the per-attempt reveal store. Without Upstash, rate limiting falls back to the Cloudflare Rate Limiting bindings in `wrangler.jsonc` (`RATE_LIMIT_*`, mapped per-policy in `src/lib/utils/rate-limit.ts`) and the attempt store falls back to in-process memory.
- `PEXELS_API_KEY` / `PIXABAY_API_KEY` — stock cover hydration scripts.
- `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` / `YANDEX_SITE_VERIFICATION` — SEO ownership meta tags.

Public `NEXT_PUBLIC_*` (baked into the build; a change needs a rebuild):

- `NEXT_PUBLIC_SITE_URL` — canonical base URL (`SITE_URL` in `src/lib/seo/site.ts`, default `https://quizverse.org`). Changing it in the Worker without rebuilding keeps the old canonical URLs.
- `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` + `NEXT_PUBLIC_ADSENSE_{HOME,EXPLORE,DETAIL}_SLOT` — AdSense. Until publisher+slot are set the slots are inert: they render nothing and reserve no space (`src/lib/ads/config.ts`).

Pipeline-only (scripts, not the Worker): `SUPABASE_DB_URL`, `SEED_*`, `STOCK_COVER_*`, `WORKERS_CI*`.

### Production smoke

`scripts/smoke-prod.sh` curl-checks the deployed site (local homes, explore, a quiz detail, play/result, OG, sitemap, robots, `/feed.xml` and `/explore` redirects, real 404s incl. Googlebot UA, and asserts the `/play` HTML never leaks `is_correct`). `.github/workflows/smoke.yml` runs it every 30 min, on `workflow_dispatch` and after each push to `main` (with a wait + retries while Workers Builds publishes). Run by hand: `scripts/smoke-prod.sh [base-url]`.

Product direction: editorial, bilingual, discovery-oriented, ad-supported. NOT a generic quiz template grid.
