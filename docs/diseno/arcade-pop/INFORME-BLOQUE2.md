# Bloque 2 — Arcade pop

## Archivos tocados

- `src/app/[locale]/page.tsx`, `src/app/[locale]/quiz/[slug]/result/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`.
- `src/components/home/quiz-detail-page.tsx`.
- `src/components/quiz/game-mode-selector.tsx`, `power-up-bar.tsx`, `question-card.tsx`, `quiz-player.tsx`, `quiz-progress.tsx`, `result-screen.tsx`, `streak-indicator.tsx`.
- `src/components/shared/cookie-consent.tsx`, `quiz-cover-art.tsx`.
- `src/lib/quiz/scoring.ts`, `src/stores/quiz-store.ts`.
- `tests/arcade-game.test.ts`, `tests/scoring.test.ts`.
- Este informe.

## Resultado real de los comandos

Todos se ejecutaron sobre el estado final del código. No se inició servidor de desarrollo.

**`npm run typecheck` — exit 0**

```text
> quizverse@0.1.0 typecheck
> tsc --noEmit
```

**`npm run lint` — exit 0, 26 advertencias fuera de los archivos cambiados**

```text
D:\Códigos\Paginas\QuizVerse\src\lib\seo\sitemap.ts
  43:65  warning  'limit' is assigned a value but never used. Allowed unused args must match /^_/u   @typescript-eslint/no-unused-vars
  43:80  warning  'offset' is assigned a value but never used. Allowed unused args must match /^_/u  @typescript-eslint/no-unused-vars

✖ 26 problems (0 errors, 26 warnings)
```

Las otras advertencias pertenecen a `scripts/*.mjs` y `src/app/api/analytics/route.ts`; esos archivos no se modificaron.

**`npm test` — exit 0**

```text
 Test Files  6 passed (6)
      Tests  68 passed (68)
   Start at  00:21:14
   Duration  29.65s (transform 2.95s, setup 13.21s, collect 5.16s, tests 169ms, environment 129.05s, prepare 8.72s)
```

**`npm run build` — exit 0**

```text
├ ƒ /api/sitemap
├ ƒ /callback
├ ƒ /covers/[slug]
├ ƒ /covers/[slug].svg
├ ○ /opengraph-image
└ ƒ /stock-covers/[slug]

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

El build compiló en 27.0 s, terminó TypeScript en 11.5 s y generó 134/134 páginas. Incluyó las rutas dinámicas `/[locale]/quiz/[slug]/play` y `/[locale]/quiz/[slug]/result`.

El detector de interfaz devolvió `[]` y `git diff --check` terminó sin errores.

## Listo

- Selección de modos, pregunta, pausa y resultado con las superficies, tipografía y acentos arcade en EN y ES. El resultado muestra revisión de respuestas y enlaces claros para compartir, jugar otro quiz y ver el ranking.
- Reloj y ayuda `+10s` solo en Time Attack; Classic, Practice y Survival no tienen cuenta regresiva. Survival termina tras un error y Practice muestra la explicación después de responder. La ayuda 50/50 descarta dos opciones incorrectas y también bloquea su selección por teclado.
- Portadas con título propio y edición derivada del slug, con rótulo sin rotación en todas las variantes. Se quitaron el rótulo de categoría suelto del detalle y la repetición del tipo en sus datos.
- Home con hero equilibrado, franja centrada, encabezado de juegos legible y título SEO sin `QuizVerse | QuizVerse`.
- Aviso de cookies más compacto; en selección, juego y resultado queda en el flujo de la página para no cubrir preguntas ni acciones.

## Decisiones sin maqueta y límites

- Time Attack usa una bolsa de tiempo equivalente a la suma de los límites de sus preguntas y se pausa durante el feedback. El bonus de velocidad requiere tiempo real registrado; los otros modos guardan `time_ms: 0`.
- Survival se ofrece solo para trivia: los quizzes de personalidad no tienen respuestas correctas con las que aplicar la eliminación. Las portadas muestran el título completo y el slug para distinguir quizzes del mismo fandom; el texto central siempre queda horizontal.
- La revisión de respuestas se muestra directamente en el resultado. “Jugar otro” abre el catálogo; repetir el mismo quiz es una acción separada.
- No se comprobó el render local con navegador ni un despliegue en producción. El encargo prohibía levantar un servidor de desarrollo; el acceso de la herramienta web a `quizverse.org/en` falló. La adaptación a 390 px se revisó en CSS y queda pendiente una comprobación visual en navegador.
