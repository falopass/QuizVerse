/**
 * Persistencia y normalización de la analítica de crecimiento (migración 022).
 *
 * /api/analytics vuelca cada evento normalizado a los logs del Worker (Workers
 * Logs); los que sirven al producto además se insertan en `analytics_events`
 * con el cliente service role (la tabla no tiene policies para
 * anon/authenticated). Los beacons anónimos del navegador se etiquetan como
 * señales estimadas (`beacon_estimated`), distintas de las partidas
 * confirmadas por el servidor (`game_sessions`).
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

/** Retención documentada por delete_old_analytics_events() en migración 022. */
export const ANALYTICS_RETENTION_DAYS = 180;

export interface AnalyticsEventInput {
  name: string;
  locale?: string;
  path?: string;
  quizId?: string;
  quizSlug?: string;
  quizType?: string;
  source?: string;
  value?: number;
  message?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface NormalizedAnalyticsEvent {
  name: string;
  locale: 'en' | 'es' | null;
  path: string | null;
  quizId: string | null;
  quizSlug: string | null;
  quizType: string | null;
  source: string | null;
  value: number | null;
  message: string | null;
  metadata: Record<string, string | number | boolean> | null;
}

type AnalyticsClient = Pick<SupabaseClient<Database>, 'from'>;

const SHARE_CHANNEL_SET: ReadonlySet<string> = new Set(SHARE_CHANNELS);
const INVITE_CHANNELS: ReadonlySet<string> = new Set(['challenge', 'g']);
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,119}$/i;
const SAFE_TOKEN_RE = /^[a-z0-9][a-z0-9._:-]{0,59}$/i;
const SAFE_METADATA_KEY_RE = /^[a-zA-Z0-9_.-]{1,40}$/;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]+/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_QUERY_OR_HASH_RE = /(https?:\/\/[^\s?#]+)[?#][^\s]*/gi;
const SENSITIVE_PARAM_RE = /([?&](?:s|token|code|access_token|refresh_token|email)=)[^&\s]+/gi;

/** Quita saltos de línea, caracteres de control, correos y queries sensibles de texto público. */
export function sanitizePublicText(value: string | undefined, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(URL_QUERY_OR_HASH_RE, '$1')
    .replace(SENSITIVE_PARAM_RE, '$1[redacted]')
    .replace(EMAIL_RE, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

/** Token técnico seguro (sin espacios, saltos ni texto libre) para campos tipo source/type. */
export function sanitizePublicToken(value: string | undefined, maxLength = 60): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || !SAFE_TOKEN_RE.test(trimmed)) return null;
  return trimmed;
}

/** Slug o identificador ASCII seguro (UUID o slug de quiz). */
export function sanitizePublicSlug(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_SLUG_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Solo la ruta interna, sin query ni hash: ahí viajan los tokens de share.
 * Los share_click llegan como URL absoluta (SITE_URL o location.href): se
 * queda el pathname. Cualquier otra cosa se descarta.
 */
export function sanitizeEventPath(path: string | undefined): string | null {
  if (!path) return null;
  const withoutControls = path.replace(CONTROL_CHARS_RE, '').trim();
  if (!withoutControls) return null;
  const clean = withoutControls.split(/[?#]/, 1)[0];
  if (clean.startsWith('/') && !clean.startsWith('//')) {
    return clean.slice(0, 300);
  }
  try {
    const url = new URL(clean);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.pathname.slice(0, 300);
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
  return sanitizePublicToken(payload.source, 60);
}

/** Normaliza metadata pública antes de volcarla a logs estructurados. */
export function sanitizePublicMetadata(
  metadata: Record<string, string | number | boolean> | undefined,
  eventName?: string
): Record<string, string | number | boolean> | null {
  if (!metadata) return null;
  const out: Record<string, string | number | boolean> = {};
  let count = 0;

  for (const [key, value] of Object.entries(metadata)) {
    if (count >= 10) break;
    if (!SAFE_METADATA_KEY_RE.test(key)) continue;

    // En eventos con atribución controlada, descartamos canales fuera de la lista
    // blanca también en los logs (evita filtrar `?via=correo@evil.com`).
    if (eventName === 'invite_landing' && key === 'channel') {
      const normalized = attributedSource(metadata.kind, value);
      if (!normalized) continue;
      out[key] = normalized.slice(normalized.indexOf(':') + 1);
      count += 1;
      continue;
    }
    if (eventName === 'quiz_complete' && key === 'shareVia') {
      if (typeof value !== 'string') continue;
      const separator = value.indexOf(':');
      const normalized =
        separator > 0
          ? attributedSource(value.slice(0, separator), value.slice(separator + 1))
          : null;
      if (!normalized) continue;
      out[key] = normalized;
      count += 1;
      continue;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
      count += 1;
    } else if (typeof value === 'boolean') {
      out[key] = value;
      count += 1;
    } else if (typeof value === 'string') {
      const safe = sanitizePublicText(value, 120);
      if (safe !== null) {
        out[key] = safe;
        count += 1;
      }
    }
  }

  return count > 0 ? out : null;
}

/** Normaliza todos los campos públicos antes de emitir log estructurado y persistir en DB. */
export function normalizeAnalyticsEvent(payload: AnalyticsEventInput): NormalizedAnalyticsEvent {
  return {
    name: payload.name,
    locale: payload.locale === 'en' || payload.locale === 'es' ? payload.locale : null,
    path: sanitizeEventPath(payload.path),
    quizId: sanitizePublicSlug(payload.quizId),
    quizSlug: sanitizePublicSlug(payload.quizSlug),
    quizType: sanitizePublicToken(payload.quizType, 40),
    source: eventSource(payload),
    value:
      typeof payload.value === 'number' && Number.isFinite(payload.value) ? payload.value : null,
    message: sanitizePublicText(payload.message, 500),
    metadata: sanitizePublicMetadata(payload.metadata, payload.name),
  };
}

/** null cuando el evento no se persiste (no está en la lista blanca). */
export function toAnalyticsEventRow(payload: AnalyticsEventInput): AnalyticsEventInsert | null {
  if (!PERSISTED_EVENTS.has(payload.name)) return null;
  const normalized = normalizeAnalyticsEvent(payload);
  return {
    name: normalized.name,
    locale: normalized.locale,
    path: normalized.path,
    quiz_slug: normalized.quizSlug,
    source: normalized.source,
    value: normalized.value,
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
