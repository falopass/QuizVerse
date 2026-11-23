'use server';

/**
 * Borrado de la cuenta desde /settings.
 *
 * Orquesta, en este orden: sesión → validación → rate limit → revalidación de
 * identidad → borrado en `auth.users`. El cliente service role se usa aquí
 * porque `auth.admin` no existe en el cliente SSR y porque el borrado debe
 * saltar RLS.
 *
 * Compatibilidad dual con la migración 028 (`028_borrado_cuenta_atomico.sql`):
 * - Con 028 aplicada (`has_atomic_account_deletion()` = true): un trigger
 *   `BEFORE DELETE ON public.profiles` elimina borradores privados, limpia
 *   notificaciones de terceros y anonimiza referencias de moderación DENTRO de
 *   la misma transacción PostgreSQL que elimina `auth.users`. Los borradores y
 *   referencias conservan su propiedad hasta esa transacción y un fallo hace
 *   rollback completo.
 * - Sin 028 aplicada (instalaciones pendientes de migración, con o sin 019):
 *   conserva el flujo compatible con lectura paginada, anonimización con
 *   restauración en caso de fallo y borrado troceado de borradores.
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authLimiter } from '@/lib/utils/rate-limit';
import {
  DeleteAccountSchema,
  chunkIds,
  isMissingSchemaError,
  matchesOAuthConfirmation,
  requiresPasswordReauth,
  type DeleteAccountResult,
} from '@/lib/auth/account-deletion';

function logCleanupError(step: string, error: unknown): void {
  console.error(`[action:delete-account:${step}]`, error);
}

/** PostgREST devuelve como máximo 1000 filas por consulta por defecto. */
const PAGE_SIZE = 1000;
/** El filtro `in` viaja en la URL: se trocea para no pasarse de largo. */
const UPDATE_CHUNK = 200;

interface PageResult {
  data: { id: string }[] | null;
  error: { code?: string } | null;
}

interface AnonymizePlan {
  scope: string;
  ids: string[];
  apply: (
    chunk: string[],
    value: string | null
  ) => PromiseLike<{ error: { code?: string } | null }>;
}

/**
 * Detecta si la migración 028 (trigger `BEFORE DELETE` atómico en PostgreSQL)
 * está aplicada. Si el RPC no existe todavía (`PGRST202`/`42883`), degrada al
 * camino compatible; si ocurre otro error de DB, falla cerrado.
 */
async function checkAtomicDeletionSupport(
  service: NonNullable<ReturnType<typeof createServiceClient>>
): Promise<{ ok: true; atomic: boolean } | { ok: false }> {
  const rpcFn = (
    service as unknown as {
      rpc?: (fn: string) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
    }
  ).rpc;
  if (typeof rpcFn !== 'function') return { ok: true, atomic: false };

  const { data, error } = await rpcFn.call(service, 'has_atomic_account_deletion');
  if (error) {
    if (isMissingSchemaError(error)) return { ok: true, atomic: false };
    logCleanupError('atomic-check', error);
    return { ok: false };
  }

  return { ok: true, atomic: data === true };
}

/**
 * IDs de filas cuyo `column` apunta a la cuenta. Pagina con orden estable
 * porque PostgREST limita las filas por consulta y sin `order` puede repetir
 * u omitir filas entre páginas.
 */
async function collectIds(
  scope: string,
  fetchPage: (from: number, to: number) => PromiseLike<PageResult>
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      if (isMissingSchemaError(error)) return { ok: true, ids: [] };
      logCleanupError(`${scope}-read`, error);
      return { ok: false };
    }
    const page = data ?? [];
    ids.push(...page.map((row) => row.id));
    if (page.length < PAGE_SIZE) return { ok: true, ids };
  }
}

/**
 * Aplica `value` a los IDs en lotes: `null` anonimiza y `userId` restaura la
 * autoría si el borrado no llega a ocurrir.
 */
async function applyValue(plan: AnonymizePlan, value: string | null): Promise<boolean> {
  for (const chunk of chunkIds(plan.ids, UPDATE_CHUNK)) {
    const { error } = await plan.apply(chunk, value);
    if (error && !isMissingSchemaError(error)) {
      logCleanupError(`${plan.scope}-${value === null ? 'anonymize' : 'restore'}`, error);
      return false;
    }
  }
  return true;
}

async function anonymizeAll(plans: AnonymizePlan[]): Promise<boolean> {
  let ok = true;
  for (const plan of plans) ok = (await applyValue(plan, null)) && ok;
  return ok;
}

async function restoreAll(plans: AnonymizePlan[], userId: string): Promise<void> {
  for (const plan of plans) await applyValue(plan, userId);
}

async function safeSignOut(supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  try {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) logCleanupError('sign-out', signOutError);
  } catch (error) {
    logCleanupError('sign-out', error);
  }
}

export async function deleteAccountAction(input: unknown): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unauthorized' };

  const parsed = DeleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid_input' };

  const { allowed } = await authLimiter.check(`delete-account:${user.id}`);
  if (!allowed) return { ok: false, code: 'rate_limited' };

  // Sin la key no hay forma de borrar `auth.users`: la UI ya lo avisa antes de
  // mostrar el formulario, y aquí se corta con un código estable.
  const service = createServiceClient();
  if (!service) return { ok: false, code: 'unavailable' };

  if (requiresPasswordReauth(user)) {
    if (!user.email || !parsed.data.password) return { ok: false, code: 'invalid_input' };
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.password,
    });
    if (error) return { ok: false, code: 'invalid_credentials' };
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();
    const expected = profile?.username ?? user.email;
    if (!matchesOAuthConfirmation(parsed.data.confirmation, expected)) {
      return { ok: false, code: 'confirmation_mismatch' };
    }
  }

  const atomicCheck = await checkAtomicDeletionSupport(service);
  if (!atomicCheck.ok) return { ok: false, code: 'unexpected' };

  if (atomicCheck.atomic) {
    // Migración 028 activa: borradores, notificaciones y referencias de
    // moderación conservan su propiedad hasta esta misma transacción y
    // PostgreSQL hace rollback completo si cualquier paso falla.
    const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
    if (deleteError) {
      logCleanupError('auth-users', deleteError);
      return { ok: false, code: 'unexpected' };
    }
    await safeSignOut(supabase);
    return { ok: true };
  }

  // Camino compatible cuando la migración 028 aún no está aplicada (funciona
  // tanto con 019 aplicada como sin sus cambios de FK).
  const drafts = await collectIds('drafts', (from, to) =>
    service
      .from('quizzes')
      .select('id')
      .eq('creator_id', user.id)
      .neq('status', 'published')
      .order('id', { ascending: true })
      .range(from, to)
  );
  if (!drafts.ok) return { ok: false, code: 'unexpected' };

  const quizReports = await collectIds('quiz_reports', (from, to) =>
    service
      .from('quiz_reports')
      .select('id')
      .eq('resolved_by', user.id)
      .order('id', { ascending: true })
      .range(from, to)
  );
  if (!quizReports.ok) return { ok: false, code: 'unexpected' };

  const commentReports = await collectIds('comment_reports', (from, to) =>
    service
      .from('comment_reports')
      .select('id')
      .eq('resolved_by', user.id)
      .order('id', { ascending: true })
      .range(from, to)
  );
  if (!commentReports.ok) return { ok: false, code: 'unexpected' };

  const moderatedQuizzes = await collectIds('quizzes-moderated', (from, to) =>
    service
      .from('quizzes')
      .select('id')
      .eq('moderated_by', user.id)
      .order('id', { ascending: true })
      .range(from, to)
  );
  if (!moderatedQuizzes.ok) return { ok: false, code: 'unexpected' };

  const plans: AnonymizePlan[] = [
    {
      scope: 'quiz_reports',
      ids: quizReports.ids,
      apply: (chunk, value) =>
        service.from('quiz_reports').update({ resolved_by: value }).in('id', chunk),
    },
    {
      scope: 'comment_reports',
      ids: commentReports.ids,
      apply: (chunk, value) =>
        service.from('comment_reports').update({ resolved_by: value }).in('id', chunk),
    },
    {
      scope: 'quizzes-moderated',
      ids: moderatedQuizzes.ids,
      apply: (chunk, value) =>
        service.from('quizzes').update({ moderated_by: value }).in('id', chunk),
    },
  ];

  if (!(await anonymizeAll(plans))) {
    await restoreAll(plans, user.id);
    return { ok: false, code: 'unexpected' };
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    logCleanupError('auth-users', deleteError);
    await restoreAll(plans, user.id);
    return { ok: false, code: 'unexpected' };
  }

  // Sin 028 la cuenta ya no existe en auth.users: se trocea el borrado de
  // borradores y se registran fallos sin revertir la respuesta de éxito.
  for (const chunk of chunkIds(drafts.ids, UPDATE_CHUNK)) {
    const { error } = await service.from('quizzes').delete().in('id', chunk);
    if (error && !isMissingSchemaError(error)) logCleanupError('drafts-delete', error);
  }

  const { error: notificationsError } = await service
    .from('notifications')
    .delete()
    .or(`data->>user_id.eq.${user.id},data->>follower_id.eq.${user.id}`);
  if (notificationsError && !isMissingSchemaError(notificationsError)) {
    logCleanupError('notifications', notificationsError);
  }

  await safeSignOut(supabase);
  return { ok: true };
}
