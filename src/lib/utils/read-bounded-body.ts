/**
 * Lectura acotada de cuerpos HTTP en el borde del Worker.
 *
 * Rechaza payloads grandes antes de llamar a `JSON.parse` (evita picos de RAM
 * o CPU en endpoints públicos de telemetría, reportes y webhooks). Comprueba
 * primero el `Content-Length` declarado y después cuenta los bytes reales del
 * stream, cancelándolo en cuanto supera `maxBytes`.
 */

export type BoundedTextResult =
  | { ok: true; text: string; bytes: number }
  | { ok: false; reason: 'payload_too_large' | 'read_error' };

export type BoundedJsonResult =
  | { ok: true; data: unknown; bytes: number }
  | { ok: false; reason: 'payload_too_large' | 'invalid_json' };

/** Comprobación rápida de `Content-Length` antes de gastar rate limit o leer el stream. */
export function hasOversizedContentLength(request: Request, maxBytes: number): boolean {
  const header = request.headers.get('content-length');
  if (header === null || header.trim() === '') return false;
  const declared = Number(header);
  return Number.isFinite(declared) && declared > maxBytes;
}

/** Lee el body como UTF-8 con tope estricto en bytes reales (cancela el stream al pasarse). */
export async function readBoundedText(
  request: Request,
  maxBytes: number
): Promise<BoundedTextResult> {
  if (hasOversizedContentLength(request, maxBytes)) {
    return { ok: false, reason: 'payload_too_large' };
  }

  if (!request.body) {
    try {
      const text = await request.text();
      const bytes = new TextEncoder().encode(text).byteLength;
      if (bytes > maxBytes) {
        return { ok: false, reason: 'payload_too_large' };
      }
      return { ok: true, text, bytes };
    } catch {
      return { ok: false, reason: 'read_error' };
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: 'payload_too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'read_error' };
  } finally {
    reader.releaseLock();
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    text: new TextDecoder().decode(buffer),
    bytes: total,
  };
}

/** Lee y parsea JSON con límite de bytes previo a `JSON.parse`. */
export async function readBoundedJson(
  request: Request,
  maxBytes: number
): Promise<BoundedJsonResult> {
  const read = await readBoundedText(request, maxBytes);
  if (!read.ok) {
    return read.reason === 'payload_too_large'
      ? { ok: false, reason: 'payload_too_large' }
      : { ok: false, reason: 'invalid_json' };
  }

  try {
    return { ok: true, data: JSON.parse(read.text) as unknown, bytes: read.bytes };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}
