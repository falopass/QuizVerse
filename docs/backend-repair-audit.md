# Backend Repair Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Nota de mantenimiento.** Revisado el 2026-10-19 contra `origin/main` (`5327ef0`); este documento se poda contra `main`: lo que no tenga estado explícito es no verificado.

**Goal:** Reparar el backend de QuizVerse con cambios mínimos, verificables y seguros, dejando claras las causas de cada problema antes de tocar código.

**Architecture:** QuizVerse usa Next.js App Router con Server Components, Server Actions, API Routes y Supabase como base de datos/autenticación. La reparación debe mantener Supabase como fuente de verdad para datos persistentes, RLS como primera barrera de seguridad y Server Actions/API Routes como capa de validación y orquestación.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zod, Supabase PostgreSQL/Auth/RLS, Upstash Redis, DeepSeek API, Vitest.

---

## 1. Resumen ejecutivo

El backend no necesita un rewrite completo. Necesita una reparación ordenada en zonas específicas donde hoy hay riesgo de errores de producción, datos inconsistentes o seguridad incompleta.

Los problemas más importantes detectados son:

1. Clientes Supabase con fallbacks falsos que ocultan configuración rota.
2. Server Actions con casts forzados (`as unknown as`, `as never`, `@ts-expect-error`) en escrituras de base de datos.
3. Tipos `Database` desactualizados respecto a migraciones recientes.
4. RLS incompleto para acciones de administración.
5. Triggers SQL con riesgo de error en `INSERT`.
6. Cálculo de score confiando en datos enviados por el cliente.
7. Puntos y achievements con lógica duplicada entre aplicación y base de datos.
8. Reportes de quizzes con dos caminos distintos y validación inconsistente.
9. Rate limit con comportamiento no diferenciado entre endpoints baratos y endpoints costosos.
10. Generación AI con validación estructural insuficiente.
11. Revalidación de cache usando rutas no localizadas.
12. Soporte de `poll` ambiguo: el sistema lo acepta, pero lo convierte silenciosamente a `personality`.

La prioridad debe ser: primero confirmar errores con comandos, luego arreglar contratos y seguridad, después endurecer flujos funcionales.

---

## 2. Comandos base antes de modificar

Antes de implementar cualquier reparación, ejecutar:

```bash
npm run typecheck
npm run test
npm run build
```

### Por qué

Sin una línea base no se sabe qué falla hoy y qué rompe cada cambio. La reparación debe ser incremental: un problema, una hipótesis, una verificación.

### Criterio de éxito

- Queda registrado el primer error real si existe.
- Después de cada fase se puede comparar si mejoró o empeoró el estado.

---

## 3. Mapa de archivos críticos

**Estado (2026-10-19):** Obsoleto en parte — `src/actions/report.actions.ts`, `src/actions/admin.actions.ts` y `src/lib/data/db-fetchers.ts` ya no existen; `src/actions/` contiene `auth.actions.ts`, `profile.actions.ts`, `quiz.actions.ts` y `social.actions.ts` (`ls src/actions`).

### Supabase/env

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/env.ts`
- `src/proxy.ts`

### Server Actions

- `src/actions/quiz.actions.ts`
- `src/actions/report.actions.ts`
- `src/actions/profile.actions.ts`
- `src/actions/admin.actions.ts`

### API Routes

- `src/app/api/quiz/generate/route.ts`
- `src/app/api/quiz/report/route.ts`
- `src/app/api/analytics/route.ts`
- `src/app/api/monitor/route.ts`
- `src/app/api/sitemap/route.ts`
- `src/app/api/locale/route.ts`

### Data layer y lógica backend

- `src/lib/data/public.ts`
- `src/lib/data/db-fetchers.ts`
- `src/lib/data/normalizers.ts`
- `src/lib/quiz/achievements.ts`
- `src/lib/quiz/generator.ts`
- `src/lib/quiz/validator.ts`
- `src/lib/utils/rate-limit.ts`
- `src/lib/auth/require-admin.ts`

### Tipos y DB

- `src/types/database.ts`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`
- `supabase/migrations/003_functions.sql`
- `supabase/migrations/005_comments.sql`
- `supabase/migrations/006_follows.sql`
- `supabase/migrations/007_notifications.sql`
- Crear: `supabase/migrations/008_backend_repairs.sql`

---

# Reparaciones específicas

---

## 4. Supabase usa placeholders peligrosos

**Estado (2026-10-19):** Resuelto — `src/lib/supabase/env.ts` centraliza la lectura y lanza error explícito en producción (`env.ts:30-38`); los placeholders solo se permiten en dev/test y en `next build` de CI (`env.ts:26-29`).

### Archivos afectados

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/env.ts`
- `src/proxy.ts`

### Qué se observó

Hay fallbacks como:

```ts
'https://placeholder.supabase.co';
'placeholder-key';
'https://dummy.supabase.co';
'dummy-anon-key';
```

### Por qué hay que arreglarlo

En producción, si faltan variables de entorno, la app debe fallar con un mensaje claro. Usar un Supabase falso puede ocultar un deploy mal configurado y provocar errores difíciles de diagnosticar.

También puede generar una falsa sensación de que la app funciona cuando en realidad está usando catálogo local o fallando silenciosamente.

### Qué hay que hacer

- Centralizar la lectura de env Supabase en un helper server-safe/client-safe.
- En producción, lanzar error si faltan:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Permitir fallback solo en desarrollo/test si se decide explícitamente.
- Usar el mismo helper desde `server.ts`, `client.ts` y `proxy.ts`.

### Criterio de éxito

- Ningún cliente Supabase usa placeholder en producción.
- El error por env faltante es explícito.
- `npm run build` no oculta configuración rota.

---

## 5. `createAdminClient()` usa non-null assertions inseguras

**Estado (2026-10-19):** Obsoleto — `src/lib/supabase/admin.ts` no existe y no hay cliente service-role en la app: `grep -rn "SERVICE_ROLE" src` devuelve 0 resultados.

### Archivo afectado

- `src/lib/supabase/admin.ts`

### Qué se observó

Actualmente usa:

```ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
```

### Por qué hay que arreglarlo

El `!` le dice a TypeScript que confíe aunque el valor pueda faltar. Si la variable no existe, el error aparece tarde y sin contexto suficiente.

La service role key es crítica: solo debe usarse server-side y con validación clara.

### Qué hay que hacer

- Validar explícitamente `NEXT_PUBLIC_SUPABASE_URL`.
- Validar explícitamente `SUPABASE_SERVICE_ROLE_KEY`.
- Lanzar errores claros si falta alguna variable.
- Confirmar que `createAdminClient()` no se importa desde client components.

### Criterio de éxito

- Si falta `SUPABASE_SERVICE_ROLE_KEY`, el error dice exactamente eso.
- No hay imports del admin client en archivos con `'use client'`.

---

## 6. Tipos `Database` desactualizados

**Estado (2026-10-19):** Obsoleto — `src/types/database.ts` ya tipa `quiz_comments` (`:450`), `user_follows` (`:503`), `notifications`, `quiz_reports` (`:391`) y los RPC `increment_plays`, `increment_shares` y `toggle_like` (`:593`).

### Archivo afectado

- `src/types/database.ts`

### Migraciones involucradas

- `supabase/migrations/005_comments.sql`
- `supabase/migrations/006_follows.sql`
- `supabase/migrations/007_notifications.sql`

### Qué se observó

El tipo `Database` no refleja completamente tablas y columnas creadas después del schema inicial:

- `quiz_comments`
- `user_follows`
- `notifications`
- enum `notification_type`
- columnas `profiles.followers_count`
- columnas `profiles.following_count`

### Por qué hay que arreglarlo

Si los tipos no coinciden con la DB real, el código termina usando casts forzados para compilar. Eso elimina la protección de TypeScript justo en la capa más sensible: writes de Supabase.

### Qué hay que hacer

- Regenerar tipos desde Supabase si hay acceso al proyecto.
- Si no se puede regenerar, actualizar `src/types/database.ts` manualmente según migraciones `005`, `006` y `007`.
- Después de actualizar tipos, eliminar casts innecesarios en acciones y rutas.

### Criterio de éxito

- `npm run typecheck` pasa.
- Las tablas nuevas existen en `Database['public']['Tables']`.
- No se necesitan casts como `as never` para inserts normales.

---

## 7. Casts inseguros en Server Actions

**Estado (2026-10-19):** Resuelto — `grep -rn "as never\|@ts-expect-error" src` devuelve 0 resultados. `as unknown as` solo queda fuera de writes Supabase: `normalizers.ts` (narrowing de JSON), `api/sitemap/route.ts:54`, `api/locale/route.ts:37` y `rate-limit.ts:56` (este último cubierto en §20).

### Archivos afectados

- `src/actions/quiz.actions.ts`
- `src/actions/report.actions.ts`
- `src/actions/profile.actions.ts`
- `src/actions/admin.actions.ts`
- `src/lib/quiz/achievements.ts`

### Qué se observó

Hay patrones como:

```ts
as unknown as
as never
@ts-expect-error
```

### Por qué hay que arreglarlo

Estos casts esconden errores reales de contrato entre la app y Supabase. Si una columna cambia, si un enum no coincide o si un RPC está mal llamado, TypeScript no podrá avisar.

### Qué hay que hacer

- Arreglar primero `src/types/database.ts`.
- Reemplazar casts por tipos derivados de `Database`.
- Eliminar `@ts-expect-error` en inserts/updates normales.
- Mantener casts solo si existe una limitación real de Supabase types y queda aislada.

### Criterio de éxito

- No hay `@ts-expect-error` para operaciones CRUD simples.
- No hay `as never` en writes Supabase.
- El código sigue strict TypeScript sin `any`.

---

## 8. `likeQuiz()` usa un método RPC inexistente

**Estado (2026-10-19):** Obsoleto — `rpcLike` ya no existe y `likeQuiz` llama `supabase.rpc('toggle_like', …)` (`src/actions/quiz.actions.ts:273`); la función existe en `supabase/migrations/003_functions.sql:32`. Lo que falta es la UI de like (encargo LIKE-01, bloqueado).

### Archivo afectado

- `src/actions/quiz.actions.ts`

### Qué se observó

Se define una interfaz con `rpcLike`, pero Supabase no tiene ese método. El cliente real usa `.rpc()`.

### Por qué hay que arreglarlo

El cast hace parecer válido un método que no existe. Esto puede fallar en runtime o dejar TypeScript sin capacidad de detectar el error.

### Qué hay que hacer

Usar directamente:

```ts
const { data, error } = await supabase.rpc('toggle_like', {
  p_quiz_id: quizId,
  p_user_id: user.id,
});
```

### Criterio de éxito

- No existe `rpcLike`.
- Like/unlike funciona.
- `likes_count` se actualiza una sola vez.

---

## 9. `submitQuizResult()` confía en `is_correct` enviado por cliente

**Estado (2026-10-19):** Resuelto — el envío pasa por `QuizSubmissionSchema` + `scoreSubmission` server-side (`src/actions/quiz.actions.ts:19,216`; `src/lib/quiz/submission.ts`), que recalcula cada `is_correct` ignorando el dato del cliente.

### Archivo afectado

- `src/actions/quiz.actions.ts`

### Qué se observó

El cliente envía respuestas con:

```ts
is_correct: boolean;
```

El backend usa ese dato para calcular score.

### Por qué hay que arreglarlo

El cliente no es confiable. Un usuario podría enviar todas las respuestas como correctas y obtener score/puntos falsos.

### Qué hay que hacer

- Validar el input con Zod.
- Aceptar desde cliente solo:
  - `question_id`
  - `selected_option_id`
  - `time_ms`
- Buscar el quiz en Supabase.
- Calcular server-side si la opción seleccionada es correcta.
- Guardar en `game_sessions.answers` la versión ya verificada por servidor.

### Criterio de éxito

- El score no depende de `is_correct` enviado por cliente.
- Payload manipulado no puede inflar resultados.
- Los tests cubren respuestas correctas, incorrectas y preguntas inexistentes.

---

## 10. Puntos y achievements tienen doble fuente de verdad

**Estado (2026-10-19):** En revisión — `checkAchievements` ya lee el premio desde `achievements.points_reward` (`src/lib/quiz/achievements.ts:104`) e inserta con `ignoreDuplicates` (`:98-99`), pero la app sigue actualizando `profiles.points` además del trigger `award_quiz_points` (`supabase/migrations/003_functions.sql`): falta decidir si esa doble escritura es intencional.

### Archivos afectados

- `src/actions/quiz.actions.ts`
- `src/lib/quiz/achievements.ts`
- `supabase/migrations/003_functions.sql`

### Qué se observó

La base de datos tiene trigger `award_quiz_points()`, pero la app también calcula puntos y desbloquea achievements.

### Por qué hay que arreglarlo

Dos fuentes de verdad pueden causar:

- puntos duplicados,
- achievements duplicados,
- UI mostrando datos distintos a la DB,
- bugs intermitentes por orden de triggers y llamadas app.

### Qué hay que hacer

Decidir fuente de verdad.

Recomendación:

- La DB debe encargarse de counters persistentes, puntos y achievements básicos.
- La app puede devolver una estimación visual o leer el estado actualizado después del insert.
- `checkAchievements()` no debe sumar puntos hardcodeados si la DB ya lo hace.

### Criterio de éxito

- No hay doble award de puntos.
- `first_quiz` no se intenta insertar dos veces de forma conflictiva.
- Los puntos extra salen de `achievements.points_reward`, no de un número hardcodeado.

---

## 11. `checkAchievements()` consulta columna inexistente

**Estado (2026-10-19):** Resuelto — la consulta selecciona `achievement_id` (`src/lib/quiz/achievements.ts:80`).

### Archivo afectado

- `src/lib/quiz/achievements.ts`

### Qué se observó

Consulta:

```ts
.from('user_achievements')
.select('id')
```

Pero la tabla `user_achievements` tiene:

- `user_id`
- `achievement_id`
- `unlocked_at`

No tiene columna `id`.

### Por qué hay que arreglarlo

La consulta puede fallar en runtime o devolver un contrato incorrecto.

### Qué hay que hacer

Cambiar la consulta para seleccionar `achievement_id`.

### Criterio de éxito

- La revisión de achievements no falla.
- TypeScript detecta la columna correcta cuando los tipos DB estén actualizados.

---

## 12. Trigger `increment_creator_quizzes()` puede fallar en INSERT

**Estado (2026-10-19):** Sin verificar — el código señalado sigue igual en `supabase/migrations/003_functions.sql:194-208` y ninguna migración posterior lo redefine. Nota: en un INSERT `OLD` es NULL y `NULL IS DISTINCT FROM 'published'` es verdadero, así que el contador probablemente sí suma; queda pendiente confirmar si el bug descrito existe de verdad antes de tocar la función.

### Archivo original

- `supabase/migrations/003_functions.sql`

### Archivo a crear

- `supabase/migrations/008_backend_repairs.sql`

### Qué se observó

La función usa `OLD.status`:

```sql
IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
```

Pero el trigger corre en:

```sql
AFTER INSERT OR UPDATE ON quizzes
```

### Por qué hay que arreglarlo

En un `INSERT`, `OLD` no existe. Esto puede romper creación de quizzes publicados.

### Qué hay que hacer

Crear migración nueva que redefina la función diferenciando:

- `TG_OP = 'INSERT'`
- `TG_OP = 'UPDATE'`

### Criterio de éxito

- Crear quiz publicado no rompe.
- Aprobar quiz incrementa `quizzes_created` una sola vez.
- Actualizar un quiz ya publicado no vuelve a sumar.

---

## 13. `handle_new_user()` puede generar usernames duplicados

**Estado (2026-10-19):** Resuelto — `supabase/migrations/009_fix_signup_username.sql` redefine `handle_new_user()` normalizando el username (misma regla que `src/lib/auth/identity.ts`) y resolviendo colisiones con sufijo del UUID.

### Archivo original

- `supabase/migrations/003_functions.sql`

### Archivo a crear

- `supabase/migrations/008_backend_repairs.sql`

### Qué se observó

El username se genera desde metadata:

```sql
LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'name', 'user_' || LEFT(NEW.id::TEXT, 8)), ' ', '_'))
```

### Por qué hay que arreglarlo

Dos usuarios con el mismo nombre pueden producir el mismo username y romper el signup por constraint unique.

### Qué hay que hacer

- Generar un username base seguro.
- Sanitizar caracteres no permitidos.
- Agregar sufijo del UUID cuando sea necesario.
- Asegurar formato compatible con `^[a-z0-9_]{3,24}$`.

### Criterio de éxito

- Dos usuarios con mismo nombre pueden registrarse.
- El trigger no rompe signup.
- El username generado cumple la constraint.

---

## 14. RLS admin incompleto para aprobar/rechazar quizzes

**Estado (2026-10-19):** Pendiente — no existe aún la policy admin de update de quizzes en `supabase/migrations/` (`grep -rn "is_admin" supabase/migrations/002_rls_policies.sql` no muestra policy de quizzes). `010_moderation_guards.sql` añade guardias de publicación e `is_admin`, pero el flujo de aprobar/rechazar depende de la decisión ADM-01 (`decision/adm-01.md`).

### Archivos afectados

- `supabase/migrations/002_rls_policies.sql`
- Crear: `supabase/migrations/008_backend_repairs.sql`
- `src/actions/admin.actions.ts`

### Qué se observó

La policy de update en quizzes permite actualizar solo al creador:

```sql
USING (auth.uid() = creator_id)
```

Pero los admins necesitan aprobar/rechazar quizzes de otros usuarios.

### Por qué hay que arreglarlo

Aunque `requireAdmin()` pase en la aplicación, Supabase puede bloquear el update por RLS.

### Qué hay que hacer

Crear policy nueva que permita a admins actualizar quizzes:

```sql
EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid() AND is_admin = true
)
```

### Criterio de éxito

- Admin puede aprobar/rechazar quizzes.
- Usuario normal no puede aprobar/rechazar.
- RLS y Server Action coinciden en autorización.

---

## 15. Lectura de reports demasiado amplia

**Estado (2026-10-19):** Pendiente — la policy sigue siendo `quiz_reports_read_authenticated` con `USING (auth.role() = 'authenticated')` en `supabase/migrations/002_rls_policies.sql:105`; ninguna migración posterior la restringe. Canalizado a la decisión ADM-01.

### Archivo afectado

- `supabase/migrations/002_rls_policies.sql`

### Qué se observó

La policy actual permite leer reportes a cualquier usuario autenticado:

```sql
USING (auth.role() = 'authenticated')
```

### Por qué hay que arreglarlo

Los reportes pueden contener denuncias, contexto sensible o información de moderación. No deberían ser visibles para cualquier usuario logueado.

### Qué hay que hacer

Crear migración nueva que reemplace esa policy por una de admin-only.

### Criterio de éxito

- Admin puede listar reportes.
- Usuario normal no puede listar reportes.
- La UI/admin actions no dependen solo de ocultar links.

---

## 16. `getPendingQuizzes()` y `getReports()` no verifican admin

**Estado (2026-10-19):** Pendiente — `src/actions/admin.actions.ts` no existe (`ls src/actions` → auth, profile, quiz, social), por lo que las funciones citadas tampoco. El modelo de moderación/admin completo queda en la decisión ADM-01.

### Archivo afectado

- `src/actions/admin.actions.ts`

### Qué se observó

Algunas funciones admin llaman `requireAdmin()`, pero estas no:

- `getPendingQuizzes()`
- `getReports()`

### Por qué hay que arreglarlo

Aunque RLS proteja la DB, la capa app debe validar autorización explícitamente. Es defensa en profundidad.

### Qué hay que hacer

Agregar al inicio de ambas funciones:

```ts
const adminCheck = await requireAdmin();
if ('error' in adminCheck) return { error: adminCheck.error };
```

### Criterio de éxito

- Usuario normal recibe error.
- Admin recibe datos.
- La forma de respuesta queda consistente con otras acciones admin.

---

## 17. Endpoint de reportes duplica lógica con Server Action

**Estado (2026-10-19):** Obsoleto — ya hay un solo camino: `src/actions/report.actions.ts` no existe y `/api/quiz/report` valida con Zod (`quiz_id` uuid, enum de reasons, `details` ≤ 1000) y tiene rate limit propio de 8/600s (`src/app/api/quiz/report/route.ts:20-30`), con errores 400/429/500.

### Archivos afectados

- `src/actions/report.actions.ts`
- `src/app/api/quiz/report/route.ts`
- `src/components/shared/report-button.tsx`

### Qué se observó

Hay dos caminos para reportar quizzes:

1. Server Action `reportQuiz()`.
2. API route `/api/quiz/report`.

### Por qué hay que arreglarlo

Dos caminos pueden divergir en:

- validación,
- rate limit,
- autorización,
- formato de errores,
- límites de longitud.

### Qué hay que hacer

Elegir un contrato principal.

Recomendación mínima:

- Mantener `/api/quiz/report` porque `ReportButton` ya usa `fetch`.
- Endurecer la route con Zod.
- Validar UUID de `quiz_id`.
- Limitar `details` a 500 caracteres.
- Aplicar `apiLimiter`.
- Eliminar `payload as never`.

### Criterio de éxito

- Payload inválido retorna 400.
- Rate limit retorna 429.
- Insert válido retorna `{ success: true }`.
- No queda `as never`.

---

## 18. Reportes anónimos deben definirse explícitamente

**Estado (2026-10-19):** Pendiente — la route sigue insertando `reporter_id: user?.id ?? null` (`src/app/api/quiz/report/route.ts:57`) y la RLS admite anónimos; la decisión explícita forma parte de ADM-01.

### Archivos afectados

- `src/app/api/quiz/report/route.ts`
- `supabase/migrations/002_rls_policies.sql`

### Qué se observó

El código permite:

```ts
reporter_id: user?.id ?? null;
```

Y la RLS permite `reporter_id IS NULL`.

### Por qué hay que decidirlo

Permitir reportes anónimos puede ser útil para moderación, pero también abre más superficie de spam.

### Decisión recomendada

Permitir reportes anónimos solo si se mantiene:

- rate limit por IP,
- reasons estrictamente validados,
- `details` limitado,
- no exposición pública de reportes.

Si se prefiere menos abuso, exigir login.

### Criterio de éxito

- El comportamiento elegido queda reflejado en API route y RLS.
- No hay aceptación anónima accidental.

---

## 19. Rate limit debe distinguir endpoints críticos y no críticos

**Estado (2026-10-19):** En revisión — el helper ahora reporta `errored` y falla abierto cuando Redis no está configurado (`src/lib/utils/rate-limit.ts:40-42,71`); la política por endpoint está en vuelo con PR #56 (`fix/rate-limit-reset`) y el encargo FIX-04.

### Archivo afectado

- `src/lib/utils/rate-limit.ts`

### Qué se observó

Si Redis está configurado pero falla, el helper retorna:

```ts
allowed: false;
```

### Por qué hay que arreglarlo

No todos los endpoints tienen el mismo riesgo.

- AI generation consume dinero/API externa: debe fallar cerrado en producción.
- Analytics/monitor son no críticos: no deberían romper UX si Redis falla.

### Qué hay que hacer

- Permitir política por limiter o por llamada.
- Para AI generation: fail closed en producción.
- Para analytics/monitor: fail open o degradación controlada.
- En desarrollo sin Redis: permitir con warning.

### Criterio de éxito

- Redis caído no rompe analytics.
- Redis caído no deja AI generation ilimitada en producción.

---

## 20. Cálculo de `reset` en rate limit puede estar mal

**Estado (2026-10-19):** En revisión — el cast ciego del score sigue en `src/lib/utils/rate-limit.ts:56`; lo corrige PR #56 (`fix/rate-limit-reset`).

### Archivo afectado

- `src/lib/utils/rate-limit.ts`

### Qué se observó

El código asume una forma específica para `zrange` con scores:

```ts
const oldestEntry = await redis.zrange<number[]>(key, 0, 0, { withScores: true });
const oldestScore = oldestEntry?.[0] as unknown as number | undefined;
```

### Por qué hay que arreglarlo

Si Upstash devuelve `[member, score]` o una estructura distinta, `reset` se calcula mal. Eso afecta UX y headers/respuestas de rate limit.

### Qué hay que hacer

- Confirmar shape real de `@upstash/redis` para `zrange(..., { withScores: true })`.
- Extraer score de forma segura con narrowing de `unknown`.
- Agregar test de límite alcanzado.

### Criterio de éxito

- `reset` representa segundos reales hasta liberar ventana.
- No hay cast ciego del score.

---

## 21. AI generation valida poco la respuesta de DeepSeek

**Estado (2026-10-19):** En revisión — el request ya valida con Zod (`src/app/api/quiz/generate/route.ts:6-11,21`); la validación estructural completa de la respuesta del modelo está en el encargo FIX-05, en vuelo.

### Archivos afectados

- `src/app/api/quiz/generate/route.ts`
- `src/lib/quiz/generator.ts`
- `src/lib/quiz/validator.ts`

### Qué se observó

La respuesta del modelo se parsea como JSON y se valida de forma básica:

- existe `title`,
- existen `questions`,
- hay al menos una pregunta.

### Por qué hay que arreglarlo

Un modelo puede devolver JSON válido pero semánticamente inválido:

- menos preguntas de las solicitadas,
- opciones vacías,
- trivia sin exactamente una respuesta correcta,
- personality sin resultados,
- resultados con `background_theme` inválido,
- tags demasiado largos o vacíos.

### Qué hay que hacer

- Crear schema Zod específico para respuesta AI o reutilizar `QuizCreateSchema` adaptada.
- Rechazar estructura inválida antes de responder al cliente.
- Mantener `validationWarnings` solo para diferencias no fatales.

### Criterio de éxito

- El frontend no recibe quizzes estructuralmente inválidos.
- Errores del proveedor retornan 502 con mensaje seguro.
- No se expone información sensible de la API key ni payload interno.

---

## 22. Soporte de `poll` es ambiguo

**Estado (2026-10-19):** Resuelto — el proyecto rechaza `poll` en las entradas: el request de generate usa `z.enum(['trivia', 'personality'])` (`src/app/api/quiz/generate/route.ts:8`) y `src/lib/quiz/validator.ts:43` documenta que `poll` vuelve solo cuando tenga implementación completa (rama `chore/poll-enums`, PR #21).

### Archivos afectados

- `src/app/api/quiz/generate/route.ts`
- `src/lib/quiz/validator.ts`
- `src/actions/quiz.actions.ts`
- `src/types/database.ts`
- DB enum `quiz_type`

### Qué se observó

El sistema acepta `poll`, pero generation lo normaliza silenciosamente:

```ts
parsed.data.quiz_type === 'poll' ? 'personality' : parsed.data.quiz_type;
```

### Por qué hay que arreglarlo

Un `poll` no es un `personality quiz`. Convertirlo silenciosamente crea datos engañosos y comportamiento inesperado.

### Qué hay que hacer

Elegir una opción:

1. Deshabilitar `poll` temporalmente en API/UI.
2. Implementar scoring, persistencia y resultado real para `poll`.

Recomendación mínima: deshabilitar `poll` hasta que tenga flujo propio.

### Criterio de éxito

- El usuario no puede crear un tipo cuyo comportamiento real sea otro.
- No hay normalización silenciosa de `poll` a `personality`.

---

## 23. Revalidación usa rutas no localizadas

**Estado (2026-10-19):** En revisión — `revalidatePath('/quiz')` y `revalidatePath('/')` siguen en `src/actions/quiz.actions.ts:131-170`; forma parte del encargo FIX-05 en vuelo.

### Archivos afectados

- `src/actions/quiz.actions.ts`
- `src/actions/admin.actions.ts`
- `src/actions/report.actions.ts`

### Qué se observó

Hay llamadas como:

```ts
revalidatePath('/quiz');
revalidatePath('/');
```

Pero las rutas públicas reales son localizadas:

- `/en`
- `/es`
- `/en/quiz`
- `/es/quiz`
- `/{locale}/quiz/{slug}`

### Por qué hay que arreglarlo

La cache puede no invalidarse donde el usuario realmente ve el contenido.

### Qué hay que hacer

- Revalidar rutas según `quiz.language`.
- Para acciones sin locale claro, revalidar ambos locales.
- En approve/reject, obtener `slug` y `language` antes de revalidar.

### Criterio de éxito

- Crear/aprobar quiz actualiza home y explore localizados.
- No se depende de rutas antiguas sin locale.

---

## 24. `db-fetchers.ts` duplica lógica de `public.ts`

**Estado (2026-10-19):** Obsoleto — `src/lib/data/db-fetchers.ts` no existe (`ls src/lib/data` → catalog, challenge, launch-catalog, normalizers, public, quiz-locale-map, stock-cover-manifest); cada query vive en `public.ts`.

### Archivos afectados

- `src/lib/data/public.ts`
- `src/lib/data/db-fetchers.ts`

### Qué se observó

Funciones duplicadas:

- `fetchPublicCategoriesFromDb`
- `fetchPublishedQuizzesFromDb`
- `fetchPublishedQuizTotalsFromDb`
- `fetchQuizBySlugFromDb`

### Por qué hay que arreglarlo

Duplicar queries aumenta el riesgo de cambiar una y olvidar la otra.

### Qué hay que hacer

Elegir una fuente:

- O `public.ts` contiene las funciones internas y `db-fetchers.ts` se elimina si no se usa.
- O `public.ts` importa fetchers desde `db-fetchers.ts` y solo conserva cache/fallbacks.

Recomendación mínima: si `db-fetchers.ts` no se usa, eliminarlo en una tarea separada después de verificar imports.

### Criterio de éxito

- Cada query vive en un solo lugar.
- No hay divergencia entre data layer cacheada y fetchers crudos.

---

## 25. Migración `008_backend_repairs.sql` requerida

**Estado (2026-10-19):** Resuelto — existe `supabase/migrations/008_fix_trigger_search_path.sql` (fija `search_path` en todas las funciones de trigger; distinto contenido al planeado aquí, aplicada en producción el 2026-09-27). Las piezas pendientes de esta lista viven en migraciones separadas (`009_fix_signup_username.sql`, `010_moderation_guards.sql`) y en ADM-01.

### Archivo a crear

- `supabase/migrations/008_backend_repairs.sql`

### Por qué no editar migraciones existentes

Las migraciones existentes representan historial. Si ya fueron aplicadas en un entorno, editarlas rompe reproducibilidad. La forma correcta es crear una migración nueva que modifique funciones/policies existentes.

### Debe incluir

- `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- Redefinición segura de `increment_creator_quizzes()`.
- Redefinición segura de `handle_new_user()`.
- Policy admin para update de quizzes.
- Policy admin-only para lectura de `quiz_reports`.
- Revisión de `toggle_like()` si se mantiene como `SECURITY DEFINER`.
- Opcional: backfill idempotente de counters si se detectan inconsistencias.

### Criterio de éxito

- Un proyecto nuevo aplica migraciones `001` a `008` sin error.
- Un proyecto existente puede aplicar `008` sin perder datos.
- Admin moderation funciona con RLS activado.

---

# Plan de ejecución recomendado

---

## Fase 1 — Línea base

- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run test`.
- [ ] Ejecutar `npm run build`.
- [ ] Guardar errores iniciales en la descripción del PR o en un comentario de trabajo.

### Por qué

Permite separar problemas preexistentes de problemas introducidos por la reparación.

---

## Fase 2 — Tipos y Supabase clients

- [ ] Actualizar `src/types/database.ts` según migraciones reales.
- [ ] Centralizar validación de env Supabase.
- [ ] Reparar `server.ts`, `client.ts`, `env.ts` y `proxy.ts` para no usar placeholders en producción.
- [ ] Reparar `admin.ts` para validar service role key.
- [ ] Ejecutar `npm run typecheck`.

### Por qué

Los tipos y clientes Supabase son base para todo lo demás. Si siguen frágiles, cada fix posterior necesita casts inseguros.

---

## Fase 3 — Migración DB/RLS/triggers

- [ ] Crear `supabase/migrations/008_backend_repairs.sql`.
- [ ] Reparar `increment_creator_quizzes()`.
- [ ] Reparar `handle_new_user()`.
- [ ] Agregar policy admin para update de quizzes.
- [ ] Restringir lectura de reports a admins.
- [ ] Aplicar migración localmente con `npm run db:migrate` si el entorno está configurado.

### Por qué

La DB debe proteger invariantes aunque la app tenga bugs.

---

## Fase 4 — Server Actions críticas

- [ ] Reparar `likeQuiz()` para usar `supabase.rpc()` real.
- [ ] Reparar `submitQuizResult()` para calcular score server-side.
- [ ] Reparar `checkAchievements()` para usar columnas reales.
- [ ] Agregar `requireAdmin()` a `getPendingQuizzes()` y `getReports()`.
- [ ] Corregir revalidaciones con rutas localizadas.
- [ ] Ejecutar `npm run typecheck` y `npm run test`.

### Por qué

Estas acciones modifican datos persistentes o controlan permisos. Son las más sensibles.

---

## Fase 5 — API Routes

- [ ] Endurecer `/api/quiz/report` con Zod y rate limit.
- [ ] Decidir y aplicar regla explícita para reportes anónimos.
- [ ] Endurecer `/api/quiz/generate` validando respuesta DeepSeek.
- [ ] Separar política de rate limit para endpoints críticos/no críticos.
- [ ] Ejecutar `npm run typecheck` y smoke manual de endpoints.

### Por qué

Las API routes reciben input externo directo. Deben validar antes de tocar DB o proveedor externo.

---

## Fase 6 — Limpieza mínima

- [ ] Eliminar casts que ya no sean necesarios.
- [ ] Eliminar o consolidar `src/lib/data/db-fetchers.ts` si sigue sin usarse.
- [ ] Decidir si `poll` se deshabilita o se implementa bien.
- [ ] Ejecutar `npm run lint` si los cambios tocaron muchos archivos.

### Por qué

La limpieza se hace después de estabilizar comportamiento, no antes.

---

## Fase 7 — Verificación final

- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run test`.
- [ ] Ejecutar `npm run build`.
- [ ] Probar signup/login.
- [ ] Probar creación de quiz manual.
- [ ] Probar creación de quiz con AI.
- [ ] Probar approve/reject como admin.
- [ ] Probar que usuario normal no accede a admin data.
- [ ] Probar jugar quiz trivia.
- [ ] Probar jugar quiz personality.
- [ ] Probar like/unlike.
- [ ] Probar reportar quiz.
- [ ] Probar result share URL.

### Por qué

El backend solo se considera reparado si pasan compilación, tests y flujos reales.

---

# Riesgos principales

## Riesgo 1 — Cambiar RLS puede bloquear flujos existentes

### Mitigación

Probar con tres perfiles:

- anónimo,
- usuario normal,
- admin.

---

## Riesgo 2 — Reparar puntos puede cambiar stats existentes

### Mitigación

Definir primero fuente de verdad. No hacer backfills destructivos. Si se hace backfill, que sea idempotente.

---

## Riesgo 3 — Validación AI más estricta puede rechazar más generaciones

### Mitigación

Retornar errores claros y seguros. Mantener warnings para diferencias no críticas, pero rechazar estructura inválida.

---

## Riesgo 4 — Actualizar tipos manualmente puede quedar incompleto

### Mitigación

Preferir generar tipos desde Supabase. Si se actualizan manualmente, revisar contra todas las migraciones.

---

# Definición de backend reparado

El backend se considera reparado cuando:

- `npm run typecheck` pasa.
- `npm run test` pasa.
- `npm run build` pasa.
- No hay placeholders Supabase en producción.
- No hay `as never` en writes Supabase.
- No hay `@ts-expect-error` para inserts/updates normales.
- Admin puede aprobar/rechazar quizzes.
- Usuario normal no puede acceder a funciones admin.
- Score se calcula server-side.
- Puntos y achievements no se duplican.
- Reports tienen validación, rate limit y autorización clara.
- AI generation no devuelve quizzes estructuralmente inválidos.
- Rutas localizadas se revalidan correctamente.
- `poll` no se normaliza silenciosamente a otro tipo.
