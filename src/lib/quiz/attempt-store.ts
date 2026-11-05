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

export type RevealClaim = { ok: true } | { ok: false; reason: 'already_revealed' | 'out_of_order' };

export type HintClaim = { ok: true } | { ok: false; reason: 'hint_already_used' };

interface MemoryAttempt {
  expiresAt: number;
  revealed: Map<string, string>;
  lastIndex: number;
  /** Pregunta en la que se gastó el 50/50; solo hay una por partida. */
  hintQuestionId: string | null;
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
  };
  memory.set(attemptId, entry);
  return entry;
}

/**
 * Lua atómico: rechaza la pregunta repetida y la que retrocede en el orden.
 * Devuelve 1 (aceptada), 0 (ya revelada) o -1 (fuera de orden).
 */
const CLAIM_SCRIPT = `
local existing = redis.call('HGET', KEYS[1], 'q:' .. ARGV[1])
if existing then return 0 end
local last = tonumber(redis.call('HGET', KEYS[1], 'last') or '-1')
if tonumber(ARGV[2]) < last then return -1 end
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
 * `index` es la posición de la pregunta en el quiz: no se puede volver a una
 * anterior, así que un cliente no puede barrer el quiz en orden arbitrario.
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
      console.error('[quiz-attempt] Redis error, usando memoria local:', error);
    }
  }

  const entry = memoryAttempt(attemptId);
  if (entry.revealed.has(questionId)) return { ok: false, reason: 'already_revealed' };
  if (index < entry.lastIndex) return { ok: false, reason: 'out_of_order' };

  entry.revealed.set(questionId, selectedOptionId);
  entry.lastIndex = index;
  return { ok: true };
}

/**
 * Lua atómico del 50/50: una sola pista por partida. Repetir la misma pregunta
 * devuelve 2 (idempotente: el reintento tras perder la respuesta no la gasta
 * dos veces); pedir otra devuelve 0.
 */
const HINT_SCRIPT = `
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
      console.error('[quiz-attempt] Redis error, usando memoria local:', error);
    }
  }

  const entry = memoryAttempt(attemptId);
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
 * ver. Devuelve `null` cuando no hay estado (Redis caído y proceso nuevo): en
 * ese caso se puntúa lo enviado, como antes.
 */
export async function getAttemptReveals(attemptId: string): Promise<Record<string, string> | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const stored = await redis.hgetall<Record<string, string>>(`${KEY_PREFIX}${attemptId}`);
      if (!stored) return null;

      const revealed: Record<string, string> = {};
      for (const [field, value] of Object.entries(stored)) {
        if (field.startsWith('q:') && typeof value === 'string') {
          revealed[field.slice(2)] = value;
        }
      }
      return revealed;
    } catch (error) {
      console.error('[quiz-attempt] Redis error, leyendo memoria local:', error);
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
 * otra opción no puede sondear la clave. Devuelve 1 si quedó fijada, 0 si ya
 * existía.
 */
const LOCK_CHOICE_SCRIPT = `
local existing = redis.call('HGET', KEYS[1], 'q:' .. ARGV[1])
if existing then return existing end
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
      if (typeof stored === 'string') return stored;
    } catch (error) {
      console.error('[quiz-attempt] Redis error, usando memoria local:', error);
    }
  }

  const entry = memoryAttempt(attemptId);
  const existing = entry.revealed.get(questionId);
  if (existing !== undefined) return existing;
  entry.revealed.set(questionId, selectedOptionId);
  return selectedOptionId;
}
