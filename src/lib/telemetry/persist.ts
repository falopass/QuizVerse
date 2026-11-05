/**
 * Persistencia de la analítica de crecimiento (migración 022).
 *
 * /api/analytics sigue volcando cada evento a los logs del Worker; los que
 * sirven al producto además se insertan en `analytics_events` con el
 * cliente service role (la tabla no tiene policies para anon/authenticated).
 *
 * Sin PII: ni IP, ni user agent, ni ids de usuario ni tokens. El path se
 * recorta antes del `?`/`#` (los enlaces compartidos llevan `s`,
 * `challenge`, `g`, `via` en la query) y solo se aceptan rutas internas.
 * La atribución llega ya agregada del cliente: `invite_landing` trae
 * `kind:channel` en metadata y `quiz_complete` trae `shareVia` con el mismo
 * formato — ambos aterrizan en la columna `source`.
 *
 * Todo es best-effort: sin service key, sin tabla o con error de inserción,
 * la función solo registra y devuelve; la ruta responde igual.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { SHARE_CHANNELS } from '@/lib/share/messages';
import { createServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/types/database';

type AnalyticsEventInsert = Database['public']['Tables']['analytics_events']['Insert'];

/** Solo lo que el panel agrega; el resto queda en los logs (errores, vitals…). */
const PERSISTED_EVENTS = new Set([
  'page_view',
  'quiz_start',
  'quiz_complete',
  'share_click',
  'invite_landing',
]);

export interface AnalyticsEventInput {
  name: string;
  locale?: string;
  path?: string;
  quizSlug?: string;
  source?: string;
  value?: number;
  metadata?: Record<string, string | number | boolean>;
}

type AnalyticsClient = Pick<SupabaseClient<Database>, 'from'>;

const SHARE_CHANNEL_SET: ReadonlySet<string> = new Set(SHARE_CHANNELS);
const INVITE_CHANNELS: ReadonlySet<string> = new Set(['challenge', 'g']);

/**
 * Solo la ruta interna, sin query ni hash: ahí viajan los tokens de share.
 * Los share_click llegan como URL absoluta (SITE_URL o location.href): se
 * queda el pathname. Cualquier otra cosa se descarta.
 */
export function sanitizeEventPath(path: string | undefined): string | null {
  if (!path) return null;
  const clean = path.split(/[?#]/, 1)[0];
  if (clean.startsWith('/') && !clean.startsWith('//')) return clean;
  try {
    const url = new URL(clean);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.pathname;
  } catch {
    return null;
  }
}

/**
 * Origen `via:<canal>` solo si el canal es uno de los que emite urlWithVia;
 * `invite:` solo challenge/g. `?via=` lo puede escribir cualquiera en la URL:
 * sin esta lista un correo o un token acabaría guardado en `source`.
 */
function attributedSource(kind: unknown, channel: unknown): string | null {
  if (kind === 'via' && typeof channel === 'string' && SHARE_CHANNEL_SET.has(channel)) {
    return `via:${channel}`;
  }
  if (kind === 'invite' && typeof channel === 'string' && INVITE_CHANNELS.has(channel)) {
    return `invite:${channel}`;
  }
  return null;
}

/** Canal de origen: share_click lo trae en `source`; el resto, en metadata. */
function eventSource(payload: AnalyticsEventInput): string | null {
  const metadata = payload.metadata ?? {};
  if (payload.name === 'invite_landing') {
    return attributedSource(metadata.kind, metadata.channel);
  }
  if (payload.name === 'quiz_complete') {
    const shareVia = metadata.shareVia;
    if (typeof shareVia !== 'string') return null;
    const separator = shareVia.indexOf(':');
    return separator > 0
      ? attributedSource(shareVia.slice(0, separator), shareVia.slice(separator + 1))
      : null;
  }
  if (payload.name === 'share_click') {
    return typeof payload.source === 'string' && SHARE_CHANNEL_SET.has(payload.source)
      ? payload.source
      : null;
  }
  return null;
}

/** null cuando el evento no se persiste (no está en la lista blanca). */
export function toAnalyticsEventRow(payload: AnalyticsEventInput): AnalyticsEventInsert | null {
  if (!PERSISTED_EVENTS.has(payload.name)) return null;
  return {
    name: payload.name,
    locale: payload.locale === 'en' || payload.locale === 'es' ? payload.locale : null,
    path: sanitizeEventPath(payload.path),
    quiz_slug: typeof payload.quizSlug === 'string' ? payload.quizSlug : null,
    source: eventSource(payload),
    value:
      typeof payload.value === 'number' && Number.isFinite(payload.value) ? payload.value : null,
  };
}

/** PostgREST/SQL cuando la tabla todavía no existe (migración sin aplicar). */
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table|relation .* does not exist/i.test(error.message ?? '')
  );
}

let warnedMissingTable = false;

/**
 * Inserta el evento si es de la lista blanca. Nunca lanza: la analítica no
 * puede romper la página ni la respuesta del endpoint.
 */
export async function persistAnalyticsEvent(
  payload: AnalyticsEventInput,
  client?: AnalyticsClient | null
): Promise<void> {
  try {
    const row = toAnalyticsEventRow(payload);
    if (!row) return;

    const supabase = client === undefined ? createServiceClient() : client;
    if (!supabase) return;

    const { error } = await supabase.from('analytics_events').insert(row);
    if (!error) return;
    if (isMissingTableError(error)) {
      if (!warnedMissingTable) {
        warnedMissingTable = true;
        console.warn(
          '[analytics] falta la tabla analytics_events: aplica ' +
            'supabase/migrations/022_analytics_events.sql. Los eventos siguen solo en logs.'
        );
      }
      return;
    }
    console.error('[analytics] no se pudo guardar el evento:', error.message ?? error);
  } catch (error) {
    console.error('[analytics] persistAnalyticsEvent falló:', error);
  }
}
