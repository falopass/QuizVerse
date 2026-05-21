# QuizVerse — Project Memory

## Qué es QuizVerse

Producto editorial bilingüe de quizzes (EN/ES). Plataforma donde los usuarios juegan quizzes de trivia y personalidad, crean quizzes con IA, comparten resultados y compiten en leaderboard. Desplegado en `quizverse.org`.

## Stack

- **Framework:** Next.js 16.2.1 + App Router + Server Components
- **UI:** React 19.2.4 + TypeScript 5.x strict
- **Estilos:** Tailwind CSS 4.x + tokens de diseño propios + Framer Motion 12.x
- **Validación:** Zod 4.x
- **DB/Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Cache/Rate:** Upstash Redis
- **AI:** DeepSeek (deepseek-chat, OpenAI-compatible API) — único provider
- **OG Images:** Satori + @resvg/resvg-js
- **Covers:** Pexels + Pixabay (stock) + procedurales + IA (futuro)
- **Deploy:** Vercel
- **CI/CD:** GitHub Actions
- **Tests:** Vitest 3.x + Testing Library + jsdom (65 tests)
- **Lint:** ESLint 9 + eslint-config-next + Prettier 3 + prettier-plugin-tailwindcss

## Arquitectura

```
Browser / Bots
  ├─ proxy.ts — refresca sesión Supabase, redirige paths sin locale a /en
  ├─ App Router /[locale]
  │   ├─ Home editorial (lead quiz, support rail, strips curadas)
  │   ├─ Explore / Category / Detail
  │   ├─ Play / Result (compartible con share_token)
  │   ├─ Create / AI Create / Login
  │   ├─ Profile / Leaderboard
  │   └─ Metadata / OG images / Covers procedurales + stock
  ├─ Server data layer — src/lib/data/public.ts
  ├─ Server actions — src/actions/quiz.actions.ts
  ├─ Supabase — quizzes, categories, profiles, game_sessions, likes, achievements
  ├─ DeepSeek API — generación AI runtime + seed pipeline
  ├─ Upstash Redis — rate limiting + caching
  └─ Pipeline editorial — scripts/*.mjs (polish, covers, stock-covers, import)
```

## Archivos clave

| Archivo | Propósito |
|---|---|
| `src/lib/data/public.ts` | Capa de datos pública (getHomePayload, getPublishedQuizzes, getQuizBySlug) |
| `src/actions/quiz.actions.ts` | Server Actions (createQuiz, submitQuizResult, likeQuiz) |
| `src/lib/quiz/generator.ts` | AI generation con DeepSeek |
| `src/app/api/quiz/generate/route.ts` | API route para generación AI |
| `src/lib/supabase/server.ts` | Supabase SSR client |
| `src/lib/supabase/client.ts` | Supabase browser client |
| `src/lib/supabase/admin.ts` | Supabase service role (scripts/seed) |
| `proxy.ts` | Middleware: sesión + locale redirect |

## Schema Supabase

- `quizzes` — id, slug, title, description, locale, category, quiz_type, questions[], visual_profile, featured, cover_type, cover_url, is_ai_generated
- `categories` — id, slug, label (en/es), icon, color
- `profiles` — Supabase Auth linked
- `game_sessions` — score, max_score, share_token, answers[]
- `likes`, `achievements`

## Rutas principales

- `/[locale]` — Home editorial
- `/[locale]/quiz` — Explore
- `/[locale]/quiz/[slug]` — Detail
- `/[locale]/quiz/[slug]/play` — Play flow
- `/[locale]/quiz/[slug]/result` — Result compartible
- `/[locale]/create/ai` — Generación con DeepSeek
- `/[locale]/login` — Auth Supabase
- `/[locale]/leaderboard` — Ranking global
- `/[locale]/profile/[username]` — Perfil

## Principios de desarrollo

1. **Cambios mínimos y quirúrgicos** sobre rewrites.
2. **TypeScript estricto**: nunca `any`, usar `unknown` con narrowing.
3. **Server Components por defecto**. Solo `"use client"` cuando sea estrictamente necesario.
4. **Respetar arquitectura existente**, naming y patterns del repo.
5. **Inspeccionar archivos relacionados primero** antes de editar.
6. **No agregar dependencias** salvo necesidad real.
7. **No dejar console.log** de debug en producción.
8. **Zod para toda validación** de input externo.
9. **Bilingüe siempre**: todo texto visible debe soportar EN y ES.
10. **DeepSeek es el único AI provider**. No reintroducir Groq, OpenRouter, OpenAI ni Qwen.

## Idioma

Responder en español. Código, commits, nombres de archivo y APIs en inglés.

## Comandos del proyecto

```bash
npm run dev              # Dev server
npm run build            # Build producción
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run format:check     # Prettier check
npm run test             # Vitest (65 tests)
npm run test:coverage    # Vitest + coverage
npm run seed:polish      # Normalizar seed
npm run seed:covers      # Covers procedurales
npm run seed:stock-covers # Stock covers (Pexels/Pixabay)
npm run seed:supabase:import # Importar a Supabase
```

## Variables de entorno (NO commitear valores reales)

- `NEXT_PUBLIC_SITE_URL` — URL de producción
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase JWT anon
- `SUPABASE_SERVICE_ROLE_KEY` — Admin operations (solo scripts)
- `DEEPSEEK_API_KEY` — AI generation
- `UPSTASH_REDIS_REST_URL` — Rate limiting
- `UPSTASH_REDIS_REST_TOKEN` — Upstash auth
- `PEXELS_API_KEY` — Stock covers (principal)
- `PIXABAY_API_KEY` — Stock covers (fallback)

## Lo que NO se hace

- No reescribir código salvo refactor explícito.
- No tocar auth, payments ni schemas de Supabase sin aprobación.
- No inventar datos de quizzes en código (solo via seed pipeline).
- No hardcodear strings de UI (usar sistema bilingüe).
- No dar estimaciones de tiempo.
- No agregar dependencias "por si acaso".
