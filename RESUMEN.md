# Lote 2 final — rendimiento, SEO y portadas

Reimplementación desde `main` actual del trabajo perdido del Lote 2.
Rama: `devin/quizverse-lote2-final`.

## 1. canvas-confetti diferido

- `src/lib/ui/celebrate.ts` (nuevo): `celebrate(opts)` hace
  `await import('canvas-confetti')` solo cuando hay que lanzar, respeta
  `prefers-reduced-motion: reduce` y la ausencia de `window`, y devuelve una
  cancelación que también cubre el caso "cancelar antes de que el import
  resuelva". Mantiene la misma lluvia de antes (defaults, decaimiento de
  partículas, origen aleatorio).
- `src/components/quiz/result-screen.tsx`: el `import confetti` estático (~20 KB
  en el chunk de /result) desaparece; el efecto llama a `celebrate`.
- Test: `tests/celebrate.test.ts` (mock del módulo, reduced-motion, sin window,
  ráfagas decrecientes, cancelación en vuelo y previa al import).

## 2. Confetti también en personalidad

- Mismo efecto: `personality` celebra siempre al terminar con una ráfaga más
  corta (`durationMs: 1200`); trivia conserva el umbral ≥ 60 % con 3000 ms.

## 3. prefers-reduced-motion en /result

- `useReducedMotion()` + `entrance()` aplicados a los `motion.*` de
  `result-screen.tsx` (titular del veredicto, lista de respuestas, overlay y
  panel del diálogo de compartir). El elemento de puntuación
  (`arcade-result-score` / `arcade-result-number`) no es `motion.*` — es CSS —
  y no se tocó (zona del Lote 1).
- Stubs de `matchMedia` completados con `addEventListener`/`removeEventListener`
  en `tests/result-page.test.tsx`, `tests/result-share-dialog.test.tsx`,
  `tests/result-compatibility.test.tsx` y `tests/result-group-invite.test.tsx`:
  `useReducedMotion` los exige (sin ellos lanzaba `TypeError` recuperable).

## 4. searchIndex precalculado (INP en /quiz)

- `src/lib/catalog/search-index.ts` (nuevo): `foldSearchText` (la misma
  normalización de siempre), `searchIndexText` (título + descripción + nombre
  de categoría ya localizado + tags, unidos con `\n` para que una consulta no
  cruce campos) y `matchesSearchIndex`.
- `explore-editorial-page.tsx`: un `useMemo` precalcula el índice sobre
  `localizedQuizzes` y el filtro hace un `includes` por quiz en vez de
  re-normalizar en cada pulsación; `useDeferredValue` para la consulta.
- Cambio deliberado respecto al filtro viejo: la categoría entra en el índice
  (la pedía el encargo); buscar «cine» ahora también trae la categoría. El
  resto de campos es idéntico (`tests/search-index.test.ts` reproduce el
  filtro anterior y compara).

## 5. OG dinámico 1200×630 para /daily y /novedades

- `src/app/[locale]/daily/opengraph-image.tsx` y
  `src/app/[locale]/novedades/opengraph-image.tsx` (nuevos), patrón de
  `indice`/`faq` (Satori + `arcadeOgOptions`, textos es/en, caché larga:
  las tarjetas no leen datos del día ni el listado, así que son estables).
- `src/lib/seo/site.ts`: helpers `dailyOgImage` / `novedadesOgImage`.
- Metadata: `image:` a la ruta OG vía `buildMetadata()` en ambas páginas.
- `src/proxy.ts` y `next.config.ts` no necesitan cambios: `/{locale}/<página>/opengraph-image`
  lleva prefijo de idioma (pasa el proxy sin redirect), `METADATA_FILE_RE` la
  excluye de las reglas de caché de páginas y `isPageRequest` no la marca
  `private`, así que conserva el `Cache-Control` que fija `ImageResponse`,
  igual que las OG ya existentes.
- Tests: `tests/og-static-pages.test.ts` ampliado con `/daily` y `/novedades`
  (exports 1200×630 + `og:image`/`twitter:image` apuntando a la ruta).

## 6. Paleta por franquicia en la home

- `src/lib/design/franchise-palette.ts` (nuevo): mapa puro por slug de
  categoría (la franquicia editorial del sitio) → `accent` / `soft` /
  `onAccent`, con `contrastRatio`/`relativeLuminance` WCAG. Las 18 categorías
  tienen acento propio; slug desconocido o ausente → `undefined` y la tarjeta
  queda con el acento lima actual.
- `editorial-quiz-card.tsx`: la tarjeta publica `--qv-accent`,
  `--qv-accent-soft` y `--qv-on-accent` por `style` en el `Link`. Ya las
  consumen el meta (`color`), el panel de info (fondo velado) y el botón
  «Jugar» (acento + tinta AA). El `category` del tipo pasa a pedir `slug`
  opcional además de `name`.
- Test: `tests/franchise-palette.test.ts` (mapa completo, fallback, AA ≥ 4.5
  de `onAccent` sobre `accent`).
- Límites conocidos: el borde en `:hover` sigue siendo el acento base —
  `.arcade-card:hover` vive en `globals.css` (zona del Lote 1), que ya puede
  consumir `var(--qv-accent, var(--accent-primary))`; la sección «Jugados
  recientemente» no pinta paleta (su historial no guarda slug de categoría).

## Verificación

- `npm run format:check` — verde.
- `npm run typecheck` — verde.
- `npm run lint` (`--max-warnings=0`) — verde.
- `npm run seo:guard` — 41 páginas, 0 problemas (baseline confirmado).
- `npm test` — 4340 tests en verde (baseline 4323 + 17 nuevos).
- `npm run test:node` — verde.
- `npm run build` no se corrió (lo hace el CI del PR).
- Revisión visual pendiente en la preview de Workers Builds del PR.

## Pendiente

- Nada funcional. El consumo del borde `:hover` por franquicia queda a cargo
  de `globals.css` (Lote 1 o un follow-up).
