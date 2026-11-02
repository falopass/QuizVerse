/**
 * Verificación de firmas Standard Webhooks para el Send Email Hook de GoTrue.
 *
 * GoTrue firma cada POST con los headers `webhook-id`, `webhook-timestamp` y
 * `webhook-signature`: HMAC-SHA256 sobre `${id}.${timestamp}.${body}` codificada
 * en base64 y prefijada `v1,`. La cabecera puede traer varias firmas (rotación
 * de secretos), separadas por comas o espacios.
 *
 * El secreto compartido (`SEND_EMAIL_HOOK_SECRET`, mismo valor que
 * `GOTRUE_HOOK_SEND_EMAIL_SECRETS`) tiene formato `v1,whsec_<base64>`: la clave
 * HMAC son los bytes base64 que siguen a `whsec_`.
 *
 * `crypto.subtle.verify` hace la comparación en tiempo constante.
 */
import 'server-only';

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;
const SECRET_PREFIX = 'whsec_';
const SIGNATURE_PREFIX = 'v1,';

function fromBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function secretBytes(secret: string): Uint8Array | null {
  const index = secret.indexOf(SECRET_PREFIX);
  if (index === -1) return null;
  return fromBase64(secret.slice(index + SECRET_PREFIX.length).trim());
}

export async function verifySendEmailSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  now = Date.now()
): Promise<boolean> {
  const keyBytes = secretBytes(secret);
  if (!keyBytes || keyBytes.length === 0) return false;

  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatureHeader = headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  // Anti-replay: la firma solo vale dentro de una ventana de ±5 minutos.
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  // Standard Webhooks separa las firmas con espacios; GoTrue las une con ", ".
  // La coma también separa la versión de la firma, así que solo se puede
  // partir por espacios y recortar comas sobrantes del token.
  const candidates = signatureHeader
    .split(/\s+/)
    .filter((entry) => entry.startsWith(SIGNATURE_PREFIX))
    .map((entry) => fromBase64(entry.slice(SIGNATURE_PREFIX.length).replace(/,+$/, '')))
    .filter((bytes): bytes is Uint8Array => bytes !== null && bytes.length === 32);
  if (candidates.length === 0) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);

  for (const candidate of candidates) {
    if (await crypto.subtle.verify('HMAC', key, candidate as unknown as BufferSource, signed)) {
      return true;
    }
  }
  return false;
}
