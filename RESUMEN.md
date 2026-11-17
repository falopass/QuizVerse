# RESUMEN — Lote 1 final: animaciones del flujo principal + marcador, cronómetro y racha

Rama: `devin/quizverse-lote1-final`. Re-implementación desde `main` (8271d9b) del
trabajo perdido. Cero contenido nuevo, cero rutas nuevas.

## Qué se hizo, por punto

1. **Entrada escalonada de opciones** (`question-card.tsx`): cada opción lleva
   `qv-l1-option-in` (opacidad + `translateY(10px)`, 0.28 s) con
   `animation-delay` inline de `index * 50ms`. La tarjeta re-monta por pregunta
   (`AnimatePresence` + `key={currentQuestionIndex}` en el player), así que el
   stagger se repite en cada una. Al revelar el veredicto el retardo se anula
   (`0ms`) para que pulso/shake salten al instante.
2. **Pulso en acierto**: `qv-l1-correct-pulse` (scale 1→1.04→1 + halo
   `box-shadow` con `--success` vía `color-mix`, 0.45 s) sobre la opción
   correcta revelada (`arcade-option-correct`).
3. **Shake en error**: `qv-l1-shake` (translateX −7/+6/−4/+3 px, 0.35 s) sobre
   la opción elegida incorrecta (`arcade-option-incorrect`).
4. **Veredicto teñido**: el banner `arcade-answer-feedback` recibe
   `qv-l1-verdict-correct`/`qv-l1-verdict-incorrect` (border + color con los
   tokens `--success`/`--error`). El color lo decide el nuevo prop
   `verdictCorrect`, alimentado desde `lastAnswerCorrect` del player — la
   fuente de verdad del veredicto del servidor, no la comparación visual de
   ids.
5. **Score pop en resultado**: solo el elemento `arcade-result-number` recibe
   `qv-l1-score-pop` (opacidad + scale 0.6→1.06→1, `transform-origin: left
bottom`). No se tocó confetti, imports ni otras animaciones de
   `result-screen.tsx`.
6. **Grid vivo en explore**: cada tarjeta del grid de
   `explore-editorial-page.tsx` (el grid principal y el "Ver más") va envuelta
   en `div.qv-l1-explore-card` con `animation-delay` de
   `min(index, 12) * 45ms`. El hover ya lo traía `.arcade-card`; se añadió la
   misma reacción para teclado con
   `.qv-l1-explore-card:focus-within .arcade-card`. No se tocaron los
   `useMemo` ni `editorial-quiz-card.tsx`.
7. **Marcador en vivo**: `QuizProgress` acepta `correctAnswers` +
   `answeredCount` (solo trivia) y pinta `N/M correctas|correct`. Va con
   `aria-hidden="true"`: el anuncio lo sigue haciendo la región sr-only
   `scoreAnnouncement` del player, sin duplicados. El `role="status"` del
   componente sigue siendo uno solo (lo cubre un test).
8. **Cronómetro m:ss**: función pura `formatClock` en el nuevo
   `src/lib/quiz/format-clock.ts` (0→`0:00`, 65→`1:05`, 600→`10:00`; minutos
   sin acotar). El player tickea `elapsedSeconds` cada segundo desde
   `store.startedAt` (mismo reloj que `persistSession`, con el mismo tope de
   2 h) y lo pasa a `QuizProgress`, que lo muestra en `font-mono` en todos los
   modos — en Contrarreloj convive con la cuenta atrás. `quiz-progress` ahora
   formatea también `timeRemaining` con `formatClock` (una sola función).
9. **Racha animada**: `streak-indicator.tsx` envuelve el número en un span con
   `key={streak}` + `qv-l1-streak-pop` (scale 0.7→1.18→1): al subir la racha el
   span re-monta y el pop se repite. Textos es/en sin cambios.

## Reduced motion

Todo va por keyframes `qv-l1-` en un bloque delimitado de `globals.css`
(`/* === lote1: animaciones de juego === */` … `/* === fin lote1 === */`) con
`@media (prefers-reduced-motion: reduce) { animation: none }` para las seis
animaciones. Sin animación no hay estado inicial retenido: el contenido nunca
queda oculto. El tinte del veredicto es color, no movimiento, y se mantiene.

## Textos nuevos

Dos, ambos por el patrón local `locale === 'es' ? … : …` ya usado por cada
componente: `correctas`/`correct` en el marcador (`quiz-progress`) — el
cronómetro es solo dígitos. Nada en el diccionario i18n.

## Archivos

- `src/lib/quiz/format-clock.ts` (nuevo)
- `src/components/quiz/question-card.tsx`
- `src/components/quiz/quiz-player.tsx`
- `src/components/quiz/quiz-progress.tsx`
- `src/components/quiz/streak-indicator.tsx`
- `src/components/quiz/result-screen.tsx` (solo el `<p>` de la puntuación)
- `src/components/home/explore-editorial-page.tsx` (solo los dos `.map` del grid)
- `src/app/globals.css` (bloque delimitado al final)
- Tests: `tests/format-clock.test.ts` (3), `tests/streak-indicator.test.tsx` (3),
  `tests/question-card-animations.test.tsx` (4), `tests/quiz-progress.test.tsx`
  (+5)

## Verificación

- `npx prettier --write` sobre lo tocado + `npm run format:check`: OK.
- `npm run typecheck` (flock): OK.
- `npm run lint` (`--max-warnings=0`): OK.
- `npm run seo:guard`: 41 páginas, 0 problemas.
- `npm test` (flock): **4331 tests en verde** (346 archivos). Baseline de main
  esperada ~4321 + 15 tests nuevos; el conteo exacto de main pudo variar por
  merges recientes.
- `npm run test:node` (flock): 7 tests en verde.

## Pendiente / supuestos

- En `result-screen.tsx` el pop se hizo con clase CSS (`qv-l1-score-pop`) en vez
  de `motion.p` + `entrance()` para no tocar la línea de imports de
  framer-motion ni el efecto de confetti (zona del Lote 2). El efecto es
  equivalente (pop con rebote suave) y respeta reduced-motion por el media query.
- El cronómetro en pausa sigue contando (la pantalla de pausa oculta el marcador
  y `persistSession` cuenta la pausa igual): consistente con lo que se envía.
- El stagger del grid se limita a 12 pasos (0.54 s máx) para no eternizar la
  entrada en catálogos largos.
- No se verificó visualmente en navegador (encargo sin dev server); la
  comprobación visual queda para la preview de Workers Builds del PR.
