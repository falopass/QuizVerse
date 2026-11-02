'use server';

/**
 * Borrado de la cuenta desde /settings.
 *
 * Orquesta, en este orden: sesión → validación → rate limit → revalidación de
 * identidad → limpieza previa → borrado en `auth.users`. La clave de respuestas
 * no interviene; el cliente service role se usa aquí porque `auth.admin` no
 * existe en el cliente SSR y porque el borrado debe saltar RLS.
 *
 * El borrado de `auth.users` va al final: si algo falla antes, la cuenta sigue
 * intacta y el usuario puede reintentar. Lo único que se toca antes es
 * `quiz_reports.resolved_by`, cuya FK no tiene ON DELETE y bloquearía el
 * borrado del perfil.
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authLimiter } from '@/lib/utils/rate-limit';
import { DeleteAccountSchema, type DeleteAccountResult } from '@/lib/auth/account-deletion';

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

/** Tabla o columna que aún no está desplegada: no hay nada que anonimizar. */
function isMissingSchema(error: { code?: string }): boolean {
  return (
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    error.code === '42P01' ||
    error.code === '42703'
  );
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
      if (isMissingSchema(error)) return { ok: true, ids: [] };
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
  for (let index = 0; index < plan.ids.length; index += UPDATE_CHUNK) {
    const chunk = plan.ids.slice(index, index + UPDATE_CHUNK);
    const { error } = await plan.apply(chunk, value);
    if (error && !isMissingSchema(error)) {
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

  const hasEmailIdentity =
    user.identities?.some((identity) => identity.provider === 'email') ?? false;

  if (hasEmailIdentity) {
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
    const expected = (profile?.username ?? user.email ?? '').trim().toLowerCase();
    const typed = (parsed.data.confirmation ?? '').trim().toLowerCase();
    if (!expected || typed !== expected) return { ok: false, code: 'confirmation_mismatch' };
  }

  // Los quizzes no publicados son borradores privados: se van con la cuenta.
  // Los publicados se conservan y la FK los deja con creator_id NULL.
  const { data: drafts, error: draftsError } = await service
    .from('quizzes')
    .select('id')
    .eq('creator_id', user.id)
    .neq('status', 'published');
  if (draftsError) {
    logCleanupError('drafts-read', draftsError);
    return { ok: false, code: 'unexpected' };
  }

  // Referencias de moderación sin ON DELETE: sin anonimizarlas, la cascada del
  // perfil falla por la FK. Las filas se conservan y pierden la autoría.
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
    // Compensación: devolver la autoría a todas las filas, incluidos los lotes
    // que sí se alcanzaron a anonimizar antes del fallo.
    await restoreAll(plans, user.id);
    return { ok: false, code: 'unexpected' };
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    logCleanupError('auth-users', deleteError);
    // La cuenta sigue viva: se devuelve la autoría a las filas tocadas.
    await restoreAll(plans, user.id);
    return { ok: false, code: 'unexpected' };
  }

  // A partir de aquí la cuenta ya no existe: un fallo de limpieza se registra,
  // pero no se le dice al usuario que el borrado falló.
  const draftIds = (drafts ?? []).map((row) => row.id);
  if (draftIds.length > 0) {
    const { error } = await service.from('quizzes').delete().in('id', draftIds);
    if (error) logCleanupError('drafts-delete', error);
  }

  // Notificaciones de terceros que llevaban el nombre de la cuenta en el body.
  const { error: notificationsError } = await service
    .from('notifications')
    .delete()
    .or(`data->>user_id.eq.${user.id},data->>follower_id.eq.${user.id}`);
  if (notificationsError) logCleanupError('notifications', notificationsError);

  try {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) logCleanupError('sign-out', signOutError);
  } catch (error) {
    logCleanupError('sign-out', error);
  }

  return { ok: true };
}
