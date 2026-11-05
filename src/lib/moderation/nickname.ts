/**
 * Apodos para espacios públicos sin cuenta (ranking de grupo y futuros usos).
 *
 * Puro y testeable: la validación corre en el cliente para UX y en el servidor
 * para autoridad. Las listas viven en `blocked-words.ts`; ahí queda también
 * documentado qué entra, qué no y por qué.
 *
 * Modelo:
 * - `normalizeNickname` pone el apodo en su forma válida (recorte, espacios
 *   colapsados, 2-20 caracteres de letras/números/espacio/`_-.`).
 * - `isNicknameAllowed` compara variantes "plegadas" del apodo — minúsculas,
 *   sin tildes, leetspeak decodificado y sin separadores — contra la lista:
 *   'contains' (subcadena, tras recortar las excepciones), 'exact' (token o
 *   apodo entero) y 'boundary' (subcadena no precedida de vocal legítima).
 *   Las letras repetidas se aplastan ("puuuta" → "puta") en una variante más.
 */

import { BLOCKED_WORDS, EXCEPTION_WORDS, RESERVED_WORDS, type BlockedTerm } from './blocked-words';

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

const NICKNAME_CHARS = /^[\p{L}\p{N} ._-]+$/u;

/**
 * Recorta y colapsa espacios. Devuelve la forma normalizada cuando cumple la
 * forma (largo y caracteres), `null` en otro caso. Para saber qué falló,
 * `isNicknameAllowed` reporta la razón.
 */
export function normalizeNickname(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, ' ');
  // Largo en puntos de código: un emoji cuenta como un carácter, no dos.
  const length = [...value].length;
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) return null;
  if (!NICKNAME_CHARS.test(value)) return null;
  return value;
}

export type NicknameDenyReason = 'length' | 'chars' | 'blocked' | 'reserved';

export type NicknameVerdict =
  | { ok: true; value: string }
  | { ok: false; reason: NicknameDenyReason };

/**
 * Sustituciones leetspeak que decodifica el filtro. No es exhaustiva a
 * propósito: cada entrada nueva puede crear falsos positivos. El "1" es
 * ambiguo entre i y l ("sh1t" vs "cu1o"), así que se evalúan dos pasadas.
 * Las claves no listadas se pierden al plegar, que ya tapa "cu6lo"-style.
 */
const LEET_MAP: Record<string, string> = {
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '0': 'o',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '+': 't',
};

const LEET_MAP_L: Record<string, string> = { ...LEET_MAP, '1': 'l' };

export type FoldForm = 'leet' | 'leetL' | 'plain';
const FOLD_FORMS: readonly FoldForm[] = ['leet', 'leetL', 'plain'];

function leetFor(form: FoldForm): Record<string, string> | null {
  if (form === 'plain') return null;
  return form === 'leetL' ? LEET_MAP_L : LEET_MAP;
}

/**
 * Minúsculas, sin marcas diacríticas (tildes, ñ→n, ü→u, ß→ss), con el leet
 * decodificado y solo letras al final. Todo lo que no sea letra se cae:
 * eso atrapa separadores ("p.u.t.a"), espacios y dígitos inyectados.
 */
function fold(input: string, form: FoldForm): string {
  const leet = leetFor(form);
  const replaced = input.toLowerCase().replace(/ß/g, 'ss').normalize('NFKD');
  let out = '';
  for (const ch of replaced) {
    if (/\p{M}/u.test(ch)) continue;
    const mapped = leet ? (leet[ch] ?? ch) : ch;
    if (/\p{L}/u.test(mapped)) out += mapped;
  }
  return out;
}

/** "puuuta" → "puta". Aplana rachas de la misma letra. */
function squash(input: string): string {
  return input.replace(/(.)\1+/g, '$1');
}

/**
 * Variantes plegadas de un texto: con y sin leet, cada una también aplastada.
 * La variante sin leet cubre la evasión por dígitos no decodificados
 * ("cu9lo" → "culo"); la aplastada cubre letras repetidas.
 */
function foldedVariants(folded: string): string[] {
  return [...new Set([folded, squash(folded)])].filter(Boolean);
}

/** Excepciones ya plegadas; se prueban también aplastadas por el motivo de arriba. */
const EXCEPTIONS: readonly string[] = [
  ...new Set(
    EXCEPTION_WORDS.flatMap((word) => {
      const folded = fold(word, 'plain');
      return [folded, squash(folded)];
    })
  ),
].sort((a, b) => b.length - a.length);

/** Quita cada palabra de excepción del texto plegado. Lo que queda se inspecciona. */
function stripExceptions(folded: string): string {
  let rest = folded;
  for (const word of EXCEPTIONS) {
    if (word && rest.includes(word)) rest = rest.split(word).join('');
  }
  return rest;
}

function isException(folded: string): boolean {
  return EXCEPTIONS.includes(folded);
}

function hasBoundaryHit(folded: string, term: string, allowBefore: string): boolean {
  let index = folded.indexOf(term);
  while (index !== -1) {
    if (index === 0 || !allowBefore.includes(folded[index - 1])) return true;
    index = folded.indexOf(term, index + 1);
  }
  return false;
}

function tokensOf(value: string): string[] {
  return value.split(/[\s._-]+/).filter(Boolean);
}

function listHit(normalized: string, terms: readonly BlockedTerm[], foldForm: FoldForm): boolean {
  const wholeVariants = foldedVariants(fold(normalized, foldForm));
  const tokenVariants = tokensOf(normalized).flatMap((token) =>
    foldedVariants(fold(token, foldForm))
  );

  for (const { term, match = 'contains', allowBefore = 'aei' } of terms) {
    if (match === 'exact') {
      for (const variant of [...wholeVariants, ...tokenVariants]) {
        if (variant === term) return true;
      }
      continue;
    }
    if (match === 'boundary') {
      for (const variant of [...wholeVariants, ...tokenVariants]) {
        if (isException(variant)) continue;
        if (hasBoundaryHit(variant, term, allowBefore)) return true;
      }
      continue;
    }
    // 'contains': sobre el plegado entero (cubre separadores y varios tokens),
    // recortando antes las palabras legítimas que lo contienen.
    for (const variant of wholeVariants) {
      if (stripExceptions(variant).includes(term)) return true;
    }
  }
  return false;
}

/** ¿El apodo choca con la lista de bloqueo? */
export function isNicknameBlocked(normalized: string): boolean {
  return FOLD_FORMS.some((form) => listHit(normalized, BLOCKED_WORDS, form));
}

/** ¿El apodo suplanta marca/staff/sistema? */
export function isNicknameReserved(normalized: string): boolean {
  return FOLD_FORMS.some((form) => listHit(normalized, RESERVED_WORDS, form));
}

/**
 * Veredicto del apodo. `value` es la forma normalizada lista para guardar;
 * `reason` es estable para que la UI lo traduzca.
 */
export function isNicknameAllowed(raw: string): NicknameVerdict {
  const value = raw.trim().replace(/\s+/g, ' ');
  const length = [...value].length;
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) {
    return { ok: false, reason: 'length' };
  }
  if (!NICKNAME_CHARS.test(value)) return { ok: false, reason: 'chars' };
  if (isNicknameBlocked(value)) return { ok: false, reason: 'blocked' };
  if (isNicknameReserved(value)) return { ok: false, reason: 'reserved' };
  return { ok: true, value };
}
