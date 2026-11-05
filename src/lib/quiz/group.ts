/**
 * Ranking de grupo por enlace (`?g=<token>`): un quiz, un creador y todos los
 * que entran por el mismo link. Puro: la capa de datos vive en
 * `src/lib/data/group.ts` y la mutación en `src/actions/group.actions.ts`.
 *
 * El token público del grupo usa 20 hex (10 bytes aleatorios): no adivinable y
 * de largo distinto al `share_token` de sesión (16 hex) para que los espacios
 * de tokens no se mezclen ni aunque alguien pegue uno en el lugar del otro.
 */

const GROUP_TOKEN_PATTERN = /^[0-9a-f]{20}$/;

export function isGroupToken(value: unknown): value is string {
  return typeof value === 'string' && GROUP_TOKEN_PATTERN.test(value);
}

/** Datos públicos del grupo, resueltos solo por token (sin PII). */
export interface QuizGroupInfo {
  id: string;
  quizId: string;
  token: string;
  creatorNickname: string;
  /** Jugadores con entrada; sale del conteo del RPC, no del tope de filas. */
  playerCount: number;
  createdAt: string;
}

/** Una fila del ranking: el apodo es el único identificador visible. */
export interface GroupEntry {
  nickname: string;
  score: number;
  maxScore: number;
  timeTakenSeconds: number | null;
  gameSessionId: string;
  createdAt: string;
  /**
   * Puesto real 1-based dentro del grupo: el RPC lo devuelve para cada fila
   * (la propia puede quedar fuera del top 100). Búsquedas directas lo omiten.
   */
  position?: number;
}

/**
 * Orden del ranking: más puntaje primero; empate gana quien fue más rápido;
 * persiste el empate, quien entró antes. Determinista y sin estado.
 */
export function rankGroupEntries(entries: readonly GroupEntry[]): GroupEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const timeA = a.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER;
    const timeB = b.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Posición 1-based de una sesión dentro del ranking; 0 si no está. Prefiere
 * `entry.position` (el puesto real del RPC) sobre el índice del array: la
 * fila propia puede venir fuera del top 100 y el índice mentiría el puesto.
 */
export function groupPositionOf(
  ranked: readonly GroupEntry[],
  gameSessionId: string | undefined
): number {
  if (!gameSessionId) return 0;
  const index = ranked.findIndex((entry) => entry.gameSessionId === gameSessionId);
  return index === -1 ? 0 : (ranked[index].position ?? index + 1);
}
