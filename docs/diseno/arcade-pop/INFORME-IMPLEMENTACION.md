# Arcade pop — implementación, bloque 1

## Archivos tocados

- `src/app/globals.css`, `src/app/layout.tsx`: paleta oscura, tipografía, componentes arcade y contraste.
- `src/components/layout/floating-nav.tsx`, `footer.tsx`, `site-shell.tsx`: navegación superior y pie adaptables; se retira la barra inferior móvil.
- `src/app/[locale]/page.tsx`, `src/app/[locale]/category/[slug]/page.tsx`, `src/components/home/quiz-detail-page.tsx`: home, categoría y detalle.
- `src/components/home/editorial-quiz-card.tsx`, `src/components/shared/quiz-cover-art.tsx`, `quiz-image.tsx`: tarjetas y portadas.
- `src/lib/data/public.ts`: consulta paginada por categoría y caché por petición.
- `src/lib/i18n/dictionaries.ts`: textos arcade EN/ES.
- `tests/category-paging.test.ts`, `tests/server-only.ts`, `vitest.config.ts`: comprobación de la paginación.

## Validación real

| Comando             | Resultado | Últimas líneas relevantes                                                                                       |
| ------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` | Salida 0  | `> tsc --noEmit` (sin errores)                                                                                  |
| `npm run lint`      | Salida 0  | `✖ 27 problems (0 errors, 27 warnings)`; advertencias en scripts, analytics, result y sitemap fuera del bloque. |
| `npm test`          | Salida 0  | `Test Files 5 passed (5)` · `Tests 66 passed (66)`                                                              |
| `npm run build`     | Salida 0  | `✓ Generating static pages using 7 workers (134/134)` · `ƒ (Dynamic) server-rendered on demand`                 |

## Listo y pendiente

- Listo: sistema arcade oscuro, fuentes locales vía `next/font`, header/footer, home, categoría, detalle, portadas CSS y fotos stock, i18n, CTA real a `/play`.
- El número de categoría cuenta las tarjetas efectivamente cargadas en el idioma activo; la consulta ya no corta el catálogo en 80.
- Pendiente para bloque 2: rediseño de jugar y resultado. No se cambiaron sus componentes.
- No se hizo smoke visual en la app real: el encargo prohíbe levantar servidores de desarrollo.

## Decisiones donde la maqueta no alcanzaba

- El hero destacado usa el primer quiz editorial disponible de Supabase, con fallback del catálogo existente.
- Las portadas sin foto usan título corto de fandom cuando se reconoce; el resto usa un rótulo de juego traducido.
- El violeta del hero de categoría se oscureció para que el texto claro cumpla AA.
- El toggle de tema se retiró de la navegación; arcade pop usa una sola paleta oscura.
- Se conservaron enlaces a crear, ranking y acceso en el pie para mantener esas rutas accesibles en móvil.
