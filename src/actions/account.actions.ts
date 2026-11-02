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

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;
type ReportTable = 'quiz_reports' | 'comment_reports';

/** PostgREST devuelve como máximo 1000 filas por consulta por defecto. */
const REPORT_PAGE_SIZE = 1000;
/** El filtro `in` viaja en la URL: se trocea para no pasarse de largo. */
const REPORT_UPDATE_CHUNK = 200;

function isMissingTable(error: { code?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01';
}

/**
 * IDs de reportes resueltos por la cuenta. `comment_reports` nace en la 017:
 * si la tabla aún no está desplegada, no hay nada que anonimizar. Pagina
 * porque una cuenta de moderación puede superar el límite de PostgREST.
 */
async function resolvedReportIds(
  service: ServiceClient,
  table: ReportTable,
  userId: string
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  const ids: string[] = [];
  for (let from = 0; ; from += REPORT_PAGE_SIZE) {
    const { data, error } = await service
      .from(table)
      .select('id')
      .eq('resolved_by', userId)
      .range(from, from + REPORT_PAGE_SIZE - 1);
    if (error) {
      if (isMissingTable(error)) return { ok: true, ids: [] };
      logCleanupError(`${table}-read`, error);
      return { ok: false };
    }
    const page = data ?? [];
    ids.push(...page.map((row) => row.id));
    if (page.length < REPORT_PAGE_SIZE) return { ok: true, ids };
  }
}

/**
 * `resolved_by` no tiene ON DELETE en `quiz_reports` (001) ni en
 * `comment_reports` (017): sin este UPDATE la cascada del perfil falla por la
 * FK. Los reportes se anonimizan, no se borran. `value` vuelve a `userId` para
 * compensar si el borrado no llega a ocurrir.
 */
async function setResolvedBy(
  service: ServiceClient,
  table: ReportTable,
  ids: string[],
  value: string | null
): Promise<boolean> {
  for (let index = 0; index < ids.length; index += REPORT_UPDATE_CHUNK) {
    const chunk = ids.slice(index, index + REPORT_UPDATE_CHUNK);
    const { error } = await service.from(table).update({ resolved_by: value }).in('id', chunk);
    if (error && !isMissingTable(error)) {
      logCleanupError(`${table}-${value === null ? 'anonymize' : 'restore'}`, error);
      return false;
    }
  }
  return true;
}

async function restoreResolvedBy(
  service: ServiceClient,
  quizReportIds: string[],
  commentReportIds: string[],
  userId: string
): Promise<void> {
  await setResolvedBy(service, 'quiz_reports', quizReportIds, userId);
  await setResolvedBy(service, 'comment_reports', commentReportIds, userId);
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

  // `resolved_by` no tiene ON DELETE: sin estos UPDATE la cascada del perfil
  // falla por la FK. Los reportes quedan anonimizados, no se borran.
  const quizReports = await resolvedReportIds(service, 'quiz_reports', user.id);
  if (!quizReports.ok) return { ok: false, code: 'unexpected' };
  const commentReports = await resolvedReportIds(service, 'comment_reports', user.id);
  if (!commentReports.ok) return { ok: false, code: 'unexpected' };

  const quizAnonymized = await setResolvedBy(service, 'quiz_reports', quizReports.ids, null);
  const commentAnonymized =
    quizAnonymized && (await setResolvedBy(service, 'comment_reports', commentReports.ids, null));
  if (!quizAnonymized || !commentAnonymized) {
    // Compensación: devolver la autoría a los reportes que ya se tocaron.
    if (quizAnonymized) await setResolvedBy(service, 'quiz_reports', quizReports.ids, user.id);
    if (commentAnonymized) {
      await setResolvedBy(service, 'comment_reports', commentReports.ids, user.id);
    }
    return { ok: false, code: 'unexpected' };
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    logCleanupError('auth-users', deleteError);
    // La cuenta sigue viva: se devuelve la autoría a los reportes tocados.
    await restoreResolvedBy(service, quizReports.ids, commentReports.ids, user.id);
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
