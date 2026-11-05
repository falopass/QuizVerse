/**
 * Origen de la visita por enlaces compartidos: `?via=` (clic en un share),
 * `g`/`challenge` (invitaciones). Se guarda en sessionStorage para adjuntarlo
 * al `quiz_complete` y se limpia `via` de la barra para no propagarlo si el
 * visitante vuelve a compartir la página.
 */

const ORIGIN_KEY = 'qv.share_origin';

export type ShareOrigin =
  | { kind: 'via'; channel: string; ref?: string }
  | { kind: 'invite'; channel: 'g' | 'challenge'; ref?: string };

/** Interpreta los parámetros de la URL actual; null si no hay origen. */
export function detectShareOrigin(search: string): ShareOrigin | null {
  const params = new URLSearchParams(search);
  const via = params.get('via');
  if (via)
    return {
      kind: 'via',
      channel: via.slice(0, 40),
      ref: (params.get('challenge') ?? params.get('s') ?? params.get('g'))?.slice(0, 80),
    };
  const challenge = params.get('challenge');
  if (challenge) return { kind: 'invite', channel: 'challenge', ref: challenge.slice(0, 80) };
  const g = params.get('g');
  if (g) return { kind: 'invite', channel: 'g', ref: g.slice(0, 80) };
  return null;
}

const SEEN_KEY = 'qv.share_landings';
const SEEN_CAP = 20;

function seenLandings(): string[] {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Firma de la llegada para no contarla dos veces: el token del enlace (s,
 * challenge, g) distingue enlaces; sin token manda la ruta. Las navegaciones
 * internas que conservan `challenge` comparten firma y no cuentan de nuevo.
 */
export function landingSignature(origin: ShareOrigin, path: string): string {
  // Con token, la firma es el token solo: el mismo enlace compartido (s o
  // challenge) genera la misma firma llegue por via o por invitación, y las
  // navegaciones internas /result → /play?challenge= no cuentan dos veces.
  return origin.ref ?? `${origin.kind}:${origin.channel}:${path}`;
}

/** true si esta llegada ya se registró/encoló antes; la marca si no. */
export function markLandingSeen(signature: string): boolean {
  const seen = seenLandings();
  if (seen.includes(signature)) return true;
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen.slice(-SEEN_CAP + 1), signature]));
  } catch {
    // best-effort
  }
  return false;
}

const PENDING_KEY = 'qv.share_origin_pending';

export type PendingShareOrigin = ShareOrigin & {
  /** Página de la llegada (sin query); sin ella se usa la ruta actual al reportar. */
  path?: string;
  locale?: 'en' | 'es';
};

/**
 * Guarda el origen de la sesión para atribuir la partida. Atribución de
 * primer contacto: no sobreescribe (el reto aceptado tras llegar por
 * WhatsApp sigue atribuyéndose a WhatsApp). El evento `invite_landing` se
 * reporta aparte con `stashPendingOrigin`, una vez por cada llegada.
 */
export function storeShareOrigin(origin: ShareOrigin): void {
  try {
    if (sessionStorage.getItem(ORIGIN_KEY)) return;
    sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
  } catch {
    // sessionStorage puede no estar disponible; medir es best-effort.
  }
}

export function getShareOrigin(): ShareOrigin | null {
  try {
    const raw = sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShareOrigin;
    if (parsed?.kind === 'via' || parsed?.kind === 'invite') return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Encola la llegada para reportarla cuando haya consentimiento de analíticas. */
export function stashPendingOrigin(origin: PendingShareOrigin): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(origin));
  } catch {
    // best-effort
  }
}

/** La llegada pendiente de reportar, si la hay. */
export function pendingShareOrigin(): PendingShareOrigin | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingShareOrigin;
    if (parsed?.kind === 'via' || parsed?.kind === 'invite') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearPendingOrigin(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // best-effort
  }
}

/** La URL sin `via` (los demás parámetros se conservan). */
export function stripViaParam(url: string): string {
  const parsed = new URL(url, 'https://quizverse.invalid');
  parsed.searchParams.delete('via');
  return parsed.origin === 'https://quizverse.invalid'
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : parsed.toString();
}
