# QuizVerse — Refactor Status

**Última actualización:** 2026-05-20
**Stack:** Next.js 16.2.1, React 19.2, TypeScript 5.x, Supabase, Zustand, Tailwind CSS 4.x

---

## Completado ✅

### Fase 0 — Infraestructura

- `.gitignore` — excluye node_modules, .next, .env.local, coverage
- `.eslintrc.json` — next/core-web-vitals + prettier, no-unused-vars: warn
- `prettier.config.js` — singleQuote, trailingComma, tailwindcss plugin
- `next.config.mjs` — reactStrictMode, security headers (HSTS, XFO, XCTO, RP, PP), remotePatterns
- `.github/workflows/ci.yml` — typecheck → lint → format:check → test:coverage → build
- `vitest.config.ts` — alias @ → ./src, node environment
- `public/robots.txt` — allow all, sitemap reference
- `public/manifest.json` — PWA manifest

### Fase 1 — Tests (0 → 65)

- `tests/scoring.test.ts` — 12 tests (trivia/personality scoring, points, achievements)
- `tests/engine.test.ts` — 18 tests (quizReducer, question score, time, validate)
- `tests/validator.test.ts` — 18 tests (quiz/question/personality validation)
- `tests/utils.test.ts` — 17 tests (slugify, formatNumber, formatCompact, formatRelative)
- `tests/setup.ts` — jest-dom matchers

### Fase 2 — Eliminar duplicación

- `src/lib/utils/slugify.ts` — 1 fuente canónica (antes 6 implementaciones inline)
- `calculatePersonalityResult` unificado en scoring.ts (antes 2 versiones)
- `quizReducer` unificado en engine.ts (antes duplicado en use-quiz-state.ts)
- `calculatePercentage` importado de engine.ts (antes inline en public.ts)

### Fase 5 — Dividir archivos grandes

- `src/lib/data/db-fetchers.ts` — extraído de public.ts (fetchCategories, fetchQuizzes, fetchTotals)
- `src/lib/data/normalizers.ts` — extraído de public.ts (normalizers + Row types)
- `src/actions/schemas/quiz.schema.ts` — Zod schemas extraídos de quiz.actions.ts
- `src/lib/quiz/achievements.ts` — sistema de logros extraído de quiz.actions.ts

### Fase 6 — Seguridad

- `src/lib/security/csrf.ts` — validateCSRF, get/set cookie, request identifier
- Rate limiter con fallback a Map cuando Redis no disponible
- CSRF aplicado a 5 API routes: generate, report, analytics, monitor, locale

### Fase 7 — Manejo de errores

- `src/lib/utils/logger.ts` — structured logger (info/warn/error) con ISO timestamps

### Fase 8 — Accesibilidad parcial

- `<Image>` de Next.js en quiz-card, profile-header, explore-page

### Fase 10 — Desacoplamiento

- `src/lib/hooks/use-quiz-game.ts` — hook wrapper del quiz player (reducer + scoring + telemetry)
- `src/lib/hooks/use-telemetry.ts` — telemetría client-side con buffer y flush

### Fase 11 — Configuración centralizada

- `src/lib/config.ts` — APP_CONFIG con supabase, limits, features, analytics, quiz scoring

### Fase 12 — Features nuevas

- `src/components/auth/register-form.tsx` + `register-page.tsx`
- `src/app/[locale]/register/page.tsx` — registro email/password
- `src/app/[locale]/loading.tsx` — loading page bilingüe con EditorialLoadingStage
- `supabase/migrations/005_comments.sql` — tabla quiz_comments + RLS
- `supabase/migrations/006_follows.sql` — tabla user_follows + RLS
- `supabase/migrations/007_notifications.sql` — tabla notifications + enum + RLS

---

## Pendiente ⏳

### Tipo 4 — TypeScript safety

- Reemplazar `any` types en engine.ts, quiz-store.ts, quiz.actions.ts
- Agregar Relationships tipadas a database.ts
- Eliminar double assertions (`as unknown as`) en supabase client/server

### Fase 3 — Eliminar código huérfano

- Eliminar V1 components (floating-nav, mobile-nav, footer, result-screen, game-mode-selector, question-card)
- Renombrar V2 → sin sufijo en todos los imports
- `SeoHead.tsx` — componente eliminado, verificar exports restantes

### Fase 6 (resto) — Auth guard + admin

- `require-admin.ts` ya creado pero admin.actions.ts aún usa checks inline

### Fase 8 — Accesibilidad (restante)

- ThemeProvider: eliminar `return null`, usar suppressHydrationWarning
- ARIA labels en botones de quiz-player, nav links, editorial cards, SVGs
- Indicadores correcto/incorrecto con íconos ✓/✗, no solo color

### Fase 9 — Performance

- `useMemo` en diccionarios copy de quiz-player, ai-generator, quiz-creator
- Fuentes locales para OG images (no Google Fonts CDN)
- `<Image>` en quiz-cover-art

### Migraciones no aplicadas

- 005_comments.sql, 006_follows.sql, 007_notifications.sql — creadas pero no ejecutadas en Supabase

### CI/CD

- Workflow creado pero no verificado en GitHub Actions
- `npm run typecheck`, `npm run format:check`, `npm run test:coverage` requieren scripts en package.json

---

## Estructura de archivos nuevos

```
src/lib/config.ts                  ← constantes centralizadas
src/lib/supabase/env.ts            ← env vars tipadas
src/lib/security/csrf.ts           ← protección CSRF
src/lib/auth/require-admin.ts      ← helper reutilizable
src/lib/utils/logger.ts            ← structured logger
src/lib/utils/slugify.ts           ← slugify canónico
src/lib/data/db-fetchers.ts        ← fetch functions (de public.ts)
src/lib/data/normalizers.ts        ← normalizers + Row types
src/lib/quiz/achievements.ts       ← sistema de logros
src/lib/hooks/use-quiz-game.ts     ← hook player desacoplado
src/lib/hooks/use-telemetry.ts     ← telemetría client-side
src/lib/i18n/category-navigation.ts ← navegación bilingüe categorías
src/lib/i18n/category-slugs.ts     ← mapeo slugs en/es
src/actions/schemas/quiz.schema.ts ← Zod schemas para quizzes
src/components/auth/register-form.tsx
src/components/auth/register-page.tsx
src/app/[locale]/register/page.tsx
src/app/[locale]/loading.tsx
```

---

## Verificación

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

**Meta final:** build limpio, 65+ tests pasando, cobertura >80% en lógica core, rutas localizadas en/es operativas.
