/**
 * Estado efímero de una partida: qué preguntas ya se revelaron y en qué orden.
 *
 * Con Redis configurado el estado se comparte entre isolates del Worker y el
 * "una vez por pregunta" es real. Sin Redis cae a un Map del proceso: el juego
 * funciona igual, pero dos isolates distintos podrían aceptar la misma pregunta
 * una vez cada uno. Es un fallback consciente, no el camino recomendado.
 *
 * El 50/50 también se marca aquí, pero aparte: solo hay una pista por partida
 * (repetir la misma pregunta es idempotente). Sin ese tope se podía dejar cada
 * pregunta en dos alternativas sin gastar la ayuda.
 */

import 'server-only';

import { getRedis } from '@/lib/utils/redis';

const KEY_PREFIX = 'quiz-attempt:';
const TTL_SECONDS = 3 * 60 * 60;
const MAX_MEMORY_ENTRIES = 5_000;

export type RevealClaim =
  | { ok: true }
  | { ok: false; reason: 'already_revealed' | 'out_of_order' | 'store_unavailable' };

export type HintClaim =
  | { ok: true }
  | { ok: false; reason: 'hint_already_used' | 'store_unavailable' };

export interface FinalizeAttemptResult {
  ok: boolean;
  /** True en la primera transición a finalizado; false en reintentos idempotentes. */
  firstTime: boolean;
  /** Elecciones definitivas por pregunta (lo revelado prevalece sobre lo enviado). */
  choices: Record<string, string>;
  /** True cuando el estado proviene de Redis duradero. */
  durable: boolean;
}

interface MemoryAttempt {
  expiresAt: number;
  revealed: Map<string, string>;
  lastIndex: number;
  /** Pregunta en la que se gastó el 50/50; solo hay una por partida. */
  hintQuestionId: string | null;
  /** Una vez finalizado el intento no admite más reveals, pistas ni cambios. */
  finalized: boolean;
}

const memory = new Map<string, MemoryAttempt>();

function memoryAttempt(attemptId: string): MemoryAttempt {
  const now = Date.now();
  const current = memory.get(attemptId);
  if (current && current.expiresAt > now) return current;

  if (memory.size >= MAX_MEMORY_ENTRIES) {
    for (const [key, value] of memory) {
      if (value.expiresAt <= now) memory.delete(key);
    }
  }

  const entry: MemoryAttempt = {
    expiresAt: now + TTL_SECONDS * 1000,
    revealed: new Map(),
    lastIndex: -1,
    hintQuestionId: null,
    finalized: false,
  };
  memory.set(attemptId, entry);
  return entry;
}

/** True cuando Upstash Redis está configurado como almacén duradero entre isolates. */
export function durableAttemptStoreConfigured(): boolean {
  return getRedis() !== null;
}

/**
 * Limpia el almacén en memoria del proceso. Solo para pruebas controladas que
 * simulan un cambio de isolate en Cloudflare Workers.
 */
export function resetAttemptStoreForTests(): void {
  memory.clear();
}

/**
 * Registra el intento al emitirse para distinguir una partida sin reveals
 * (`{}`) de un intento cuyo estado se perdió por cambio de isolate o caída (`null`).
 */
export async function initAttemptState(attemptId: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.eval(
        `
local key = KEYS[1]
if redis.call('EXISTS', key) == 0 then
  redis.call('HSET', key, 'init', '1')
end
redis.call('EXPIRE', key, ARGV[1])
return 1
`,
        [`${KEY_PREFIX}${attemptId}`],
        [String(TTL_SECONDS)]
      );
      return true;
    } catch (error) {
      console.error('[quiz-attempt] Redis error al inicializar attempt:', error);
      return false;
    }
  }

  memoryAttempt(attemptId);
  return true;
}

/**
 * Lua atómico: rechaza si el intento ya fue finalizado, la pregunta es repetida
 * o el índice no avanza estrictamente. Devuelve 1 (aceptada), 0 (ya revelada o
 * intento finalizado) o -1 (fuera de orden).
 */
const CLAIM_SCRIPT = `
local finalized = redis.call('HGET', KEYS[1], 'finalized')
if finalized == '1' then return 0 end
local existing = redis.call('HGET', KEYS[1], 'q:' .. ARGV[1])
if existing then return 0 end
local last = tonumber(redis.call('HGET', KEYS[1], 'last') or '-1')
local current = tonumber(ARGV[2])
if current < 0 or current <= last then return -1 end
redis.call('HSET', KEYS[1], 'q:' .. ARGV[1], ARGV[3])
redis.call('HSET', KEYS[1], 'last', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`;

function fromScriptResult(result: number): RevealClaim {
  if (result === 1) return { ok: true };
  return { ok: false, reason: result === 0 ? 'already_revealed' : 'out_of_order' };
}

/**
 * Marca una pregunta como revelada en esta partida.
 *
 * `index` es la posición de la pregunta en el quiz: debe avanzar estrictamente
 * y el intento no puede estar finalizado. Si Redis está configurado y falla,
 * devuelve `store_unavailable` en lugar de degradar a memoria local.
 */
export async function claimQuestionReveal(
  attemptId: string,
  questionId: string,
  index: number,
  selectedOptionId: string
): Promise<RevealClaim> {
  const redis = getRedis();
  if (redis) {
    try {
      const result = await redis.eval(
        CLAIM_SCRIPT,
        [`${KEY_PREFIX}${attemptId}`],
        [questionId, String(index), selectedOptionId, String(TTL_SECONDS)]
      );
      return fromScriptResult(Number(result));
    } catch (error) {
      console.error('[quiz-attempt] Redis error en claimQuestionReveal:', error);
      return { ok: false, reason: 'store_unavailable' };
    }
  }

  const entry = memoryAttempt(attemptId);
  if (entry.finalized || entry.revealed.has(questionId)) {
    return { ok: false, reason: 'already_revealed' };
  }
  if (index < 0 || index <= entry.lastIndex) return { ok: false, reason: 'out_of_order' };

  entry.revealed.set(questionId, selectedOptionId);
  entry.lastIndex = index;
  return { ok: true };
}

/**
 * Lua atómico del 50/50: una sola pista por partida mientras no esté finalizada.
 * Repetir la misma pregunta devuelve 2 (idempotente); pedir otra o con partida
 * finalizada devuelve 0.
 */
const HINT_SCRIPT = `
local finalized = redis.call('HGET', KEYS[1], 'finalized')
if finalized == '1' then return 0 end
local existing = redis.call('HGET', KEYS[1], 'hint')
if existing then
  if existing == ARGV[1] then return 2 end
  return 0
end
redis.call('HSET', KEYS[1], 'hint', ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

/**
 * Marca el 50/50 de la partida. Sin esto un cliente podía pedir pistas de
 * todas las preguntas y dejar cada una en dos alternativas sin gastar ayudas.
 */
export async function claimHint(attemptId: string, questionId: string): Promise<HintClaim> {
  const redis = getRedis();
  if (redis) {
    try {
      const result = await redis.eval(
        HINT_SCRIPT,
        [`${KEY_PREFIX}${attemptId}`],
        [questionId, String(TTL_SECONDS)]
      );
      return Number(result) === 0 ? { ok: false, reason: 'hint_already_used' } : { ok: true };
    } catch (error) {
      console.error('[quiz-attempt] Redis error en claimHint:', error);
      return { ok: false, reason: 'store_unavailable' };
    }
  }

  const entry = memoryAttempt(attemptId);
  if (entry.finalized) return { ok: false, reason: 'hint_already_used' };
  if (entry.hintQuestionId === null) {
    entry.hintQuestionId = questionId;
    return { ok: true };
  }
  return entry.hintQuestionId === questionId
    ? { ok: true }
    : { ok: false, reason: 'hint_already_used' };
}

/**
 * Opciones que el jugador eligió al pedir el veredicto, por pregunta.
 *
 * El envío las usa como verdad: si el jugador reveló la pregunta con una
 * opción, no puede enviar otra distinta y cosechar la respuesta que acaba de
 * ver. Devuelve `null` cuando no hay estado (Redis caído o cambio de isolate
 * sin Redis).
 */
export async function getAttemptReveals(attemptId: string): Promise<Record<string, string> | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const stored = await redis.hgetall<Record<string, string>>(`${KEY_PREFIX}${attemptId}`);
      if (!stored || Object.keys(stored).length === 0) return null;

      const revealed: Record<string, string> = {};
      for (const [field, value] of Object.entries(stored)) {
        if (field.startsWith('q:') && typeof value === 'string') {
          revealed[field.slice(2)] = value;
        }
      }
      return revealed;
    } catch (error) {
      console.error('[quiz-attempt] Redis error en getAttemptReveals:', error);
      return null;
    }
  }

  const entry = memory.get(attemptId);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return Object.fromEntries(entry.revealed);
}

/**
 * Lua atómico: fija la opción elegida para una pregunta una sola vez, sin
 * exigir orden — a diferencia del claim de reveal, que no puede retroceder.
 * Sirve para el envío final del reto diario, que llega fuera de secuencia:
 * lo que no llegó a revelarse queda fijado al primer envío y un reenvío con
 * otra opción no puede sondear la clave.
 */
const LOCK_CHOICE_SCRIPT = `
local existing = redis.call('HGET', KEYS[1], 'q:' .. ARGV[1])
if existing then return existing end
local finalized = redis.call('HGET', KEYS[1], 'finalized')
if finalized == '1' then return '' end
redis.call('HSET', KEYS[1], 'q:' .. ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return ARGV[2]
`;

/**
 * Fija la opción enviada para una pregunta no revelada (una vez por partida)
 * y devuelve la que quedó: leer-o-escribir atómico, así dos envíos
 * simultáneos con opciones distintas califican la misma — la primera —
 * y ninguno sondea la clave. Escribe en el mismo campo `q:` que el reveal.
 */
export async function lockAttemptChoice(
  attemptId: string,
  questionId: string,
  selectedOptionId: string
): Promise<string> {
  const redis = getRedis();
  if (redis) {
    try {
      const stored = await redis.eval(
        LOCK_CHOICE_SCRIPT,
        [`${KEY_PREFIX}${attemptId}`],
        [questionId, selectedOptionId, String(TTL_SECONDS)]
      );
      if (typeof stored === 'string' && stored.length > 0) return stored;
      throw new Error('Could not lock choice in Redis');
    } catch (error) {
      console.error('[quiz-attempt] Redis error en lockAttemptChoice:', error);
      throw error;
    }
  }

  const entry = memoryAttempt(attemptId);
  const existing = entry.revealed.get(questionId);
  if (existing !== undefined) return existing;
  if (entry.finalized) return '';
  entry.revealed.set(questionId, selectedOptionId);
  return selectedOptionId;
}

const FINALIZE_SCRIPT = `
local key = KEYS[1]
local ttl = ARGV[1]
local wasFinalized = redis.call('HGET', key, 'finalized') == '1'
if not wasFinalized then
  local i = 2
  while i <= #ARGV do
    local qid = ARGV[i]
    local opt = ARGV[i + 1]
    if qid and opt and opt ~= '' then
      local existing = redis.call('HGET', key, 'q:' .. qid)
      if not existing then
        redis.call('HSET', key, 'q:' .. qid, opt)
      end
    end
    i = i + 2
  end
  redis.call('HSET', key, 'finalized', '1')
  redis.call('EXPIRE', key, ttl)
end
local all = redis.call('HGETALL', key)
return { wasFinalized and 0 or 1, all }
`;

/**
 * Cierra el intento en una sola transición atómica de finalización.
 *
 * - Fija las respuestas enviadas que aún no tenían reveal previo.
 * - Lo revelado durante la partida prevalece siempre y nunca se sobrescribe.
 * - Marca `finalized = 1`: a partir de aquí cualquier `/api/quiz/reveal` o
 *   50/50 con el mismo token es rechazado, y un segundo envío concurrente o
 *   repetido recibe exactamente las mismas elecciones consolidadas.
 */
export async function finalizeAttemptState(
  attemptId: string,
  submittedChoices: Record<string, string> = {}
): Promise<FinalizeAttemptResult> {
  const redis = getRedis();
  if (redis) {
    try {
      const argv: string[] = [String(TTL_SECONDS)];
      for (const [questionId, optionId] of Object.entries(submittedChoices)) {
        if (questionId && typeof optionId === 'string' && optionId.length > 0) {
          argv.push(questionId, optionId);
        }
      }
      const raw = await redis.eval<string[], [number, string[]]>(
        FINALIZE_SCRIPT,
        [`${KEY_PREFIX}${attemptId}`],
        argv
      );
      const firstTime = Array.isArray(raw) ? Number(raw[0]) === 1 : true;
      const pairs = Array.isArray(raw) && Array.isArray(raw[1]) ? raw[1] : [];
      const choices: Record<string, string> = {};
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const field = String(pairs[i]);
        const value = String(pairs[i + 1]);
        if (field.startsWith('q:')) {
          choices[field.slice(2)] = value;
        }
      }
      return { ok: true, firstTime, choices, durable: true };
    } catch (error) {
      console.error('[quiz-attempt] Redis error en finalizeAttemptState:', error);
      return { ok: false, firstTime: false, choices: {}, durable: false };
    }
  }

  const existingEntry = memory.get(attemptId);
  if (!existingEntry || existingEntry.expiresAt <= Date.now()) {
    // Intento desconocido en este isolate (cambio de isolate o expirado).
    const entry = memoryAttempt(attemptId);
    for (const [questionId, optionId] of Object.entries(submittedChoices)) {
      if (questionId && typeof optionId === 'string' && optionId.length > 0) {
        entry.revealed.set(questionId, optionId);
      }
    }
    entry.finalized = true;
    return {
      ok: false,
      firstTime: true,
      choices: Object.fromEntries(entry.revealed),
      durable: false,
    };
  }

  const firstTime = !existingEntry.finalized;
  if (firstTime) {
    for (const [questionId, optionId] of Object.entries(submittedChoices)) {
      if (
        questionId &&
        typeof optionId === 'string' &&
        optionId.length > 0 &&
        !existingEntry.revealed.has(questionId)
      ) {
        existingEntry.revealed.set(questionId, optionId);
      }
    }
    existingEntry.finalized = true;
  }

  return {
    ok: true,
    firstTime,
    choices: Object.fromEntries(existingEntry.revealed),
    durable: false,
  };
}
