# AGENTS.md — QuizVerse

> AI agents and developers: Read this BEFORE making changes to this codebase.

## Resource limits (RAM) — MANDATORY

This project is developed on a single personal machine, and also worked on by Cloud sessions. Respect these limits in local sessions:

- MAX_BUILD=1 · MAX_FULL_TEST_SUITE=1 · MAX_DEV_SERVER=1 · MAX_BROWSER=1 · MAX_HEAVY_TASKS=1 · TEST_RUNNER_MAX_WORKERS=2
- One build, one dev server, one browser and one full suite **at a time**. Never parallelize heavy tasks locally.
- Subagents **only edit files and explore**. They do NOT run dev servers, builds, typecheck or full suites. At most 2 subagents write at once, on disjoint files; shared files (`package.json`, lockfile, configs) are edited by the main agent. The main agent runs heavy tasks, one at a time.

## Workflow rules

- **Never push directly to `main`.** One branch per feature/fix (`type/short-name`) + Pull Request; the owner authorizes the merge.
- Before starting: `git switch main && git pull --rebase` (multiple sessions may be working on the repo).
- Commits in Spanish (Conventional Commits: `feat:`, `fix:`, `docs:`…).
- Do not touch `deploy/` or the VPS infrastructure (production lives there; its deploy belongs to the owner).
- Verify before opening a PR: `npm run lint`, `npm run typecheck`, `npm test` (vitest; while iterating, `npx vitest related <files>`) and `npm run test:node` (`node --test tests/*.node.test.mjs`, for `node:test` suites that vitest does not discover). `npm run build` runs in CI and in Cloud sessions; locally only if the owner asks (it is denied in the owner's machine config). Use the Vercel PR preview for visual checks.
- If you rebase a branch that is already pushed, push with `git push --force-with-lease`, never `--force`. Merge only when the owner asks for it or approves it, with CI green; never on your own initiative. Never deploy.
- Step-by-step procedures live in `.devin/skills/`: `verificar` and `entregar-pr`.

## Stack

- **Framework**: Next.js 16.2.1 (App Router + Server Components + Server Actions)
- **UI**: React 19.2.4 + TypeScript 5.x + Tailwind CSS 4.x
- **State**: Zustand (client state management)
- **Animations**: Framer Motion
- **Validation**: Zod 4.x
- **DB/Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Caching/Rate Limit**: Upstash Redis
- **AI Generation**: DeepSeek (runtime + offline seed pipeline)
- **OG Images**: Satori + @resvg/resvg-js
- **Covers**: Procedural fallback + Stock (Pexels/Pixabay) + Generated/Curated types
- **Deploy**: owner's VPS (production) + Vercel (PR previews)
- **Domain**: quizverse.org

## Commands

```bash
# App lifecycle
npm run dev        # Dev server → http://localhost:3000
npm run build      # Production build
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
│   │   ├── home
│   │   ├── explore
│   │   ├── quiz/
│   │   │   ├── [slug]/        # Quiz detail
│   │   │   │   ├── play/      # Play flow
│   │   │   │   └── result/    # Shareable results
│   ├── api/                   # API routes (AI generation, analytics, monitoring)
│   ├── covers/                # Procedural cover image generation
│   └── stock-covers/          # Stock cover routing
├── actions/
│   └── quiz.actions.ts        # Server actions for quiz operations
├── components/
│   ├── home/                  # Home page components
│   ├── layout/                # Layout shared components
│   ├── quiz/                  # Quiz play, result, detail components
│   └── shared/                # Shared UI primitives
├── lib/
│   ├── data/                  # Public data layer (src/lib/data/public.ts)
│   ├── design/                # Design tokens
│   ├── i18n/                  # Internationalization
│   ├── quiz/                  # Quiz logic and types
│   ├── seo/                   # Metadata and OG image generation
│   ├── supabase/              # Supabase client + SSR helpers
│   └── telemetry/             # Analytics and monitoring
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
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `src/lib/quiz/answer-key.ts`       | Clave de respuestas: `evaluateAnswer`, `eliminateWrongOptions`, `toClientQuiz` (quita `is_correct`), `buildReview` |
| `src/lib/quiz/submission.ts`       | Zod del envío + `scoreSubmission` (trivia por aciertos, personality por tag dominante) + `pointsFor`               |
| `src/lib/quiz/quiz-repository.ts`  | Única puerta a la clave: carga el quiz publicado por id                                                            |
| `src/app/api/quiz/reveal/route.ts` | `POST` por pregunta: veredicto o pista 50/50. Rate limit por IP                                                    |
| `src/actions/quiz.actions.ts`      | Orquestación fina: auth → Zod → dominio → persistir → revalidate                                                   |
| `src/lib/actions/types.ts`         | Contrato `ActionResult` (`{ success: true }                                                                        | { success: false, code, error }`) |
| `src/lib/quiz/quiz-slug.ts`        | Slugs ASCII con prefijo de idioma y colisión resuelta por sufijo                                                   |

Reglas:

- `toClientQuiz()` es obligatorio en cualquier pantalla que envíe un quiz a un
  componente cliente (`/play`, `/result`). Si añades otra, pásala por ahí.
- El feedback inmediato se pide a `/api/quiz/reveal`. Si falla, el jugador sigue
  sin feedback; la partida no se bloquea y el servidor vuelve a puntuar al
  enviar.
- `answers[].is_correct` que llega del cliente se ignora: se recalcula en
  `scoreSubmission` y se guarda ya corregido.
- Los puntos los otorga el trigger `award_quiz_points` (10 + 25 por partida
  perfecta). `pointsFor()` sólo replica ese número para la UI: si cambias uno,
  cambia el otro.

## Contenido y seeds

Pipeline reproducible en `scripts/seed/` (ver `scripts/seed/README.md`):

- `seed:categorize` clasifica el catálogo por tema con una tabla de reglas
  ordenada y emite SQL idempotente.
- `seed:editorial` valida `editorial-seed.json` (una sola respuesta correcta por
  pregunta, categorías existentes) y emite el `INSERT ... ON CONFLICT DO NOTHING`.
- `seed:audit` es la puerta de calidad: falla si hay preguntas sin respuesta,
  opciones vacías o slugs duplicados.

Categorías vacías no son un estado válido: si una categoría se queda sin quizzes,
la página 404 y el sitemap la omite.

## Database Schema (Supabase)

Tables:

- `quizzes` — id, slug, title, description, locale, category, quiz_type, questions[], correct_answers[], featured, cover_type, cover_url, payoff, created_at
- `categories` — id, slug, label (en/es), icon
- `profiles` — user profiles (Supabase Auth linked)
- `game_sessions` — play session persistence with share tokens
- `likes` — quiz likes/favorites
- `achievements` — user achievements

## Locale Routing

```
/en          → English home
/es          → Spanish home
/en/quiz     → English explore
/[locale]/quiz/[slug]     → Quiz detail
/[locale]/quiz/[slug]/play     → Play flow
/[locale]/quiz/[slug]/result   → Shareable results
```

Non-localized root paths redirect to `/en` by default via `proxy.ts`.

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
  `/google<token>.html`) están excluidas del redirect de idioma en `proxy.ts`.
  Si añades un archivo suelto en la raíz, exclúyelo también.

### Comandos

```bash
npm run seo:assets     # regenera favicons, iconos PWA y OG 1200×630 desde SVG
npm run seo:indexnow   # envía el sitemap a IndexNow (Bing, Yandex, Seznam, Naver)
```

`public/<key>.txt` es la clave de IndexNow: no la borres ni la cambies sin
regenerarla, o las peticiones devuelven 403.

### Verificación de propiedad

| Motor         | Cómo                                                                                                                                     |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------- |
| Google        | Meta tag (`GOOGLE_SITE_VERIFICATION` en `deploy/.env`) **o** URL `https://quizverse.org/google<token>.html` (se sirve sola, sin rebuild) |
| Bing / Yandex | `BING_SITE_VERIFICATION` / `YANDEX_SITE_VERIFICATION`                                                                                    |

Los `.env` de SEO se leen en runtime: basta `docker compose up -d app`.

## Catalog Stats (current, 2026-10-18)

- 524 quizzes published (4192 questions)
- 262 en English, 262 en Spanish
- 246 trivia, 278 personality
- 16 categorías pobladas: movies-tv 174, anime-manga 119, gaming 94, music 51,
  lifestyle 21, culture 20, literature 12, pop-culture 9, technology 5,
  relationships 5, food-drink 3, science 3, animals 2, sports 2, geography 2,
  history 2
- `personality` es un hub de _tipo_ de quiz (`/category/personality`), no una
  categoría de tema: se queda sin filas a propósito
- Regenerar la taxonomía: `npm run seed:categorize`; auditar: `npm run seed:audit`

## Deployment

- Production runs on the owner's VPS (`deploy/`: Docker + Caddy). Do not touch it or deploy it; that belongs to the owner.
- Vercel builds a preview per PR for visual review.
- Environment variables: the tracked template is `deploy/env.example` (`.env.example` is gitignored, so Cloud sessions do not have it). The app also reads `SUPABASE_SERVICE_ROLE_KEY` (server and import scripts only), `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (rate limiting), `PEXELS_API_KEY`/`PIXABAY_API_KEY` (stock covers) and the optional `NEXT_PUBLIC_ADSENSE_*_SLOT`. Never commit real values.

Product direction: editorial, bilingual, discovery-oriented, ad-supported. NOT a generic quiz template grid.
