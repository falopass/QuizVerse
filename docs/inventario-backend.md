# Inventario del backend — qué falta desde `main`

**Base:** `main` @ `f8b7b6e` · **Fecha:** 2026-10-18 · **Carril:** `quiz/backend/*`
**Método:** lectura de código en un worktree limpio + `grep` de referencias + conteo de tests + introspección de la base de producción por SSH. Sin estimaciones: cada línea tiene archivo o comando.

> **Nota de mantenimiento.** Revisado el 2026-10-19 contra `origin/main` (`5327ef0`); este documento se poda contra `main`: lo que no tenga estado explícito es no verificado.

> **Aviso de concurrencia.** Hay otra sesión trabajando **sin commitear** en el árbol compartido sobre dos zonas: el motor de juego server-authoritative (§2) y la taxonomía de contenido (§7). Su trabajo no está en `main`: los archivos nuevos (`answer-key.ts`, `submission.ts`, `quiz-repository.ts`, `scripts/seed/`) existen en disco pero no en git. Este inventario describe `main` y marca esas dos zonas como **en curso**, no como «falta». Los números de §7 son de la base de producción, que esa sesión ya modificó.

---

## 0. Mapa actual

**Estado (2026-10-19):** Obsoleto en parte — el árbol de abajo es la foto original. Hoy `src/app/api` tiene 13 endpoints (suman `categories`, `leaderboard`, `og/result`, `quizzes`, `stats` y `quiz/reveal` a los 7 originales), `src/actions/` tiene 4 acciones (auth, profile, quiz, social) y `src/lib/auth/` ya no contiene `require-admin.ts` (`ls src/lib/auth` → identity, messages).

```
src/app/[locale]/**          Server Components (leen por lib/data/public.ts)
src/app/api/**               7 rutas: analytics, locale, monitor, quiz/generate,
                             quiz/locale, quiz/report, sitemap
src/actions/                 quiz.actions.ts  ← única server action del repo
src/lib/quiz/                engine.ts, scoring.ts, validator.ts, generator.ts, achievements.ts
src/lib/data/                public.ts (cache + fallback), normalizers.ts, launch-catalog.ts,
                             quiz-locale-map.ts, stock-cover-manifest.ts
src/lib/auth/                require-admin.ts  ← existe y ninguna ruta lo usa
```

Superficie de mutación: **una** server action (`quiz.actions.ts`, 5 funciones). Todo lo demás es lectura.

---

## 1. Auth y sesiones — **falta**

**Estado (2026-10-19):** Resuelto en gran parte — existe `src/actions/auth.actions.ts` con `signUpAction` y `signInWithPassword` (`auth.actions.ts:31,77`) y `register-form.tsx:35` ya la usa; el trigger roto lo corrige `supabase/migrations/009_fix_signup_username.sql`. Sin verificar: rate limit en auth y flujo de login completo en UI.

| Qué          | Estado                       | Evidencia                                                                                                                                                     |
| :----------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login        | **No existe**                | `src/components/home/login-page.tsx` solo pinta botones; `grep signInWithPassword` → 0 resultados en todo `src/`                                              |
| Logout       | Solo cliente                 | `src/providers/supabase-provider.tsx:45` (`supabase.auth.signOut()`)                                                                                          |
| Registro     | Cliente, sin validación      | `src/components/auth/register-form.tsx:31` llama `supabase.auth.signUp` directo: sin Zod, sin rate limit, sin normalizar el username                          |
| Alta en base | **Rota para nombres reales** | `handle_new_user` hace `lower(replace(name,' ','_'))`; `profiles.username` tiene `CHECK '^[a-z0-9_]{3,24}$'`. «José Pérez» → viola el CHECK → el signup falla |
| Roles        | Sin superficie               | `src/lib/auth/require-admin.ts` no lo importa nadie; no hay ruta admin                                                                                        |
| Acciones     | **No existen**               | `src/actions/` solo contiene `quiz.actions.ts`                                                                                                                |

**Falta:** `src/actions/auth.actions.ts` (signUp/signIn/signOut con Zod + `authLimiter` + `ActionResult`), migración `009` que arregle el trigger, y tests de validación/mapeo de errores.

---

## 2. Motor de juego — **en curso en la sesión concurrente (no está en `main`)**

**Estado (2026-10-19):** Resuelto — el motor server-authoritative ya aterrizó en `main`: `src/lib/quiz/answer-key.ts`, `submission.ts` (`scoreSubmission`, `pointsFor`), `quiz-repository.ts`, `/api/quiz/reveal` y `src/lib/actions/types.ts` existen, y `submitQuizResult` puntúa en servidor (`src/actions/quiz.actions.ts:216`).

En `main` el motor está triplicado: `engine.calculateQuestionScore`, `scoring.calculateTriviaScore` (253 líneas cuyo único importador es su propio test) y el `submitQuizResult` de `quiz.actions.ts`, que **confía en el `is_correct` que manda el cliente** (`quiz.actions.ts:286`), con 4 `as unknown as` y un `rpcLike` que no existe en Supabase.

La otra sesión ya tiene escrito, sin commitear, el reemplazo: `answer-key.ts` (clave de respuestas en servidor, `toClientQuiz`, `buildReview`), `submission.ts` (Zod + `scoreSubmission` + `pointsFor`), `quiz-repository.ts`, `/api/quiz/reveal` y `src/lib/actions/types.ts`. También actualizó `AGENTS.md` para documentarlo.

**Qué falta aquí, de verdad:** nada de diseño; falta que ese trabajo aterrice en `main` y se revise. Si se descarta, el hueco vuelve a estar abierto y este carril lo retoma con el mismo contrato.

---

## 3. Perfiles — **solo lectura**

**Estado (2026-10-19):** En revisión — existe `src/actions/profile.actions.ts` (edición de perfil); stats agregadas del jugador y `preferred_language` sin verificar.

| Qué                                      | Estado                                                                                           |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------- |
| Leer perfil, quizzes del creador, logros | Existe (`public.ts`: `getProfileByUsername`, `getQuizzesByCreatorId`, `getUnlockedAchievements`) |
| Editar perfil                            | **No existe** (ni action, ni validación de unicidad, ni avatar)                                  |
| Stats agregadas del jugador              | **No existe** (puntos, racha, categorías jugadas)                                                |
| Preferencia de idioma                    | Solo cookie; `profiles.preferred_language` nunca se escribe                                      |

**Falta:** `src/actions/profile.actions.ts` (update con Zod, username único y normalizado, bio ≤ 280) y un `getProfileStats(userId)` con una sola query agregada.

---

## 4. Endpoints — **faltan los públicos**

**Estado (2026-10-19):** Resuelto en su mayoría — ya existen `GET /api/categories`, `GET /api/quizzes`, `GET /api/stats` y `GET /api/leaderboard` (`ls src/app/api`). Sin verificar: validación Zod de query params en cada ruta y contratos huérfanos de `src/types/quiz.ts`.

Existen (7): `analytics`, `locale`, `monitor`, `quiz/generate`, `quiz/locale`, `quiz/report`, `sitemap`.

Faltan:

| Endpoint                                                      | Para qué                                          | Reutiliza             |
| :------------------------------------------------------------ | :------------------------------------------------ | :-------------------- |
| `GET /api/categories`                                         | categorías + conteo por locale                    | `getPublicCategories` |
| `GET /api/quizzes?category&locale&q&page&limit`               | catálogo paginado                                 | `getPublishedQuizzes` |
| `GET /api/stats`                                              | quizzes publicados, partidas, categorías, idiomas | SQL agregado          |
| `GET /api/leaderboard?scope=global\|friends&period=all\|week` | ranking                                           | `getLeaderboard`      |

Pruebas de que faltan: `src/types/quiz.ts:239` declara `SearchQuizzesResponse` y `SubmitSessionRequest/Response`, y **nadie los referencia**. Contratos huérfanos de endpoints que no se escribieron.

Además: ninguna ruta GET valida query params con Zod, y `apiLimiter` solo se usa en escrituras.

---

## 5. Tipos — **incompletos respecto a la base**

**Estado (2026-10-19):** Resuelto — `src/types/database.ts` tipa `quiz_comments` (`:450`), `user_follows` (`:503`), `notifications` y `quiz_reports` (`:391`); el ranking de amigos ya usa `user_follows` (`src/app/api/leaderboard/route.ts:42-49`).

`src/types/database.ts` no declara `notifications`, `user_follows` ni `quiz_comments` (migraciones `005`, `006`, `007`). Cualquier query a esas tablas obliga a castear, exactamente el patrón que el repo quiere evitar. Bloquea el ranking entre amigos, que necesita `user_follows`.

---

## 6. Tests y CI — **deuda estructural**

**Estado (2026-10-19):** En revisión — la suite creció a 29 archivos en `tests/` (incluye `answer-key`, `friends-ranking`, `share-tracking`, `follow-action`, `profile-schema`), así que el «cero tests para actions/data/api» ya no aplica. Sin verificar: cobertura mínima, typecheck pre-commit y estado del `migration repair`.

- 83 casos en 8 archivos (`engine` 18, `scoring` 13, `validator` 18, `utils` 17, `seo` 14, y 1 en tres de integración).
- **Cero** tests para `src/actions`, `src/lib/data`, `src/lib/supabase` y `src/app/api`.
- CI en rojo 5/5 por `format:check` (PR #2 lo arregla).
- `npm run db:migrate` usa la CLI oficial (`supabase db push --db-url "$SUPABASE_DB_URL"`). Requiere `SUPABASE_DB_URL` en `.env.local` y, una sola vez, `supabase migration repair --db-url "$SUPABASE_DB_URL" --status applied <versiones>` porque las migraciones se aplicaron a mano.
- Sin cobertura mínima ni typecheck pre-commit.

---

## 7. Contenido — **taxonomía ya aplicada, curaduría pendiente**

**Estado (2026-10-19):** Snapshot histórico — las cifras de abajo se midieron el 2026-10-18 por SSH y no se re-midieron; la re-medición depende de la importación (pendiente de re-medición — requiere importación, IMP-01). El pipeline `scripts/seed/` sí aterrizó en `main`.

Estado real de la base de producción (medido hoy por SSH, no estimado):

- **524** quizzes publicados (262/262), 4 192 preguntas.
- **16 de 17 categorías pobladas** (`movies-tv` 174, `anime-manga` 119, `gaming` 94, `music` 51, `lifestyle` 21, `culture` 20…). `personality` queda fuera a propósito: es un hub de _tipo_, no de tema.
- **0 destacados**: `is_featured = false` en los 524.
- 76 quizzes por idioma sin pareja en↔es (183 pares de 262).
- `src/lib/data/launch-catalog.ts` (48 KB) sigue siendo el fallback silencioso si Supabase falla.

La taxonomía y el pipeline (`scripts/seed/` con `seed:categorize`, `seed:editorial`, `seed:audit`) los escribió la sesión concurrente; **no están en `main`**. Lo que queda de contenido en este carril: destacados, cerrar los 76 pares y decidir el fallback.

---

## 8. Viralidad — **botones sí, bucle no**

**Estado (2026-10-19):** Snapshot histórico parcialmente obsoleto — la tabla de abajo es la foto original; al 2026-10-19: compartir **sí** escribe `shares_count` (`incrementShares`, `src/actions/quiz.actions.ts:303-315`, con `tests/share-tracking.test.tsx`), la OG por resultado **sí** existe (`src/app/api/og/result/[locale]/[slug]`) y el ranking entre amigos **sí** existe (`GET /api/leaderboard?scope=friends`, `tests/friends-ranking.test.ts`, PR #32). Lo que sigue sin existir: invitaciones/código de referido.

| Pieza                   | Estado                                                                                                                             |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| Botones de compartir    | Existen: `src/components/shared/share-buttons.tsx` (WhatsApp, X, Facebook, copiar, Web Share) y se usan en `result-screen.tsx:262` |
| URL de resultado        | `?s=<share_token>`; `getQuizSessionByShareToken` la resuelve                                                                       |
| OG por resultado        | **No existe**: `result/page.tsx` usa la OG del quiz (`quizOgImage(locale, slug)`)                                                  |
| Tracking de compartidos | **No existe**: `shares_count` y `was_shared` valen 0 en las 12 sesiones y nada los escribe                                         |
| Ranking entre amigos    | **No existe**: el leaderboard es global sobre `profiles.points`; `user_follows` no está tipado                                     |
| Invitaciones            | **No existe**: sin código de referido ni atribución                                                                                |

---

## 9. Orden de ejecución

**Estado (2026-10-19):** Snapshot histórico — la tabla describe el plan original; los ítems 2, 3, 5 y la mayoría de 7 ya aterrizaron por otros carriles (ver estados de §1-§8). Pendiente real: moderación/admin (decisión ADM-01, `decision/adm-01.md`) e invitaciones.

| #   | Rama                                       | Qué cierra                    | Verde cuando                                                                 |
| :-- | :----------------------------------------- | :---------------------------- | :--------------------------------------------------------------------------- |
| 1   | `quiz/backend/ci-format` (PR #2, mergeado) | CI en rojo                    | `format:check` pasa sin tocar SEO                                            |
| 2   | —                                          | §2 motor server-authoritative | **lo tiene la sesión concurrente**: revisar y mergear su rama cuando la abra |
| 3   | `quiz/backend/auth`                        | §1                            | signup/login/logout con Zod y migración 009                                  |
| 4   | `quiz/backend/profiles`                    | §3                            | update + stats con tests                                                     |
| 5   | `quiz/backend/api`                         | §4 y §5                       | 4 endpoints con query Zod, tipos y tests                                     |
| 6   | `quiz/backend/content`                     | §7 (resto)                    | destacados != 0, 262 pares, fallback decidido                                |
| 7   | `quiz/backend/virality`                    | §8                            | OG por resultado, tracking, amigos, invitaciones                             |

**Definición de verde:** `typecheck`, `lint`, `format:check`, `test:coverage` y `build` en GitHub Actions, más `curl` sobre `quizverse.org` pegado en el PR.

**Fuera de alcance:** `src/lib/seo/**`, `metadata.ts`, `robots`, sitemap, favicons e imágenes OG del carril SEO.
