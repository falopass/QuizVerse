import { NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';

/**
 * Receptor de reportes de la `Content-Security-Policy-Report-Only`
 * (`report-uri` + `report-to` en next.config.ts). Sin él el modo medición
 * no medía nada: las violaciones solo aparecían en la consola de cada visita.
 *
 * Acepta los dos formatos que emiten los navegadores:
 *   - `application/csp-report`   → `{"csp-report": {…kebab-case…}}`
 *   - `application/reports+json` → `[{type, url, body: {…camelCase…}}]`
 *
 * El log va resumido y sin datos personales ni libre albedrío: la directiva y
 * la disposición solo pasan si tienen forma de token CSP (`img-src`,
 * `enforce`, …) y los URI se reducen a su host. El `document-uri`/`documentURL`
 * no se guarda: su query puede llevar tokens de partida (`?s=…`). Nada de lo
 * que manda el cliente se registra verbatim: este endpoint es público y un
 * POST podría plantar URLs o datos sensibles en los campos de texto.
 */

const ACCEPTED_TYPES = new Set(['application/csp-report', 'application/reports+json']);
const MAX_BODY_BYTES = 8 * 1024;
/** Con 8 KB caben ~200 reportes diminutos; 10 bastan para medir el ruido. */
const MAX_REPORTS_LOGGED = 10;
const SAFE_TOKEN = /^[a-zA-Z0-9-]{1,40}$/;

// Telemetría, no seguridad: como /api/monitor degrada abierto si Redis cae.
const cspReportLimiter = createRateLimiter('csp-report', 60, 60, 'open');

function safeToken(value: unknown): string | null {
  return typeof value === 'string' && SAFE_TOKEN.test(value) ? value : null;
}

function hostOf(uri: unknown): string | null {
  if (typeof uri !== 'string' || uri === '') return null;
  try {
    return new URL(uri).host || null;
  } catch {
    // Los reportes usan pseudo-URIs ('inline', 'eval', 'data:'): se devuelven
    // tal cual solo si tienen forma de token, nada de texto libre.
    return safeToken(uri);
  }
}

/** Lee ambos estilos de clave: kebab-case (csp-report) y camelCase (reports+json). */
function summarize(report: Record<string, unknown>) {
  return {
    directive:
      safeToken(report['effective-directive'] ?? report['effectiveDirective']) ??
      safeToken(report['violated-directive'] ?? report['violatedDirective']),
    blockedHost: hostOf(report['blocked-uri'] ?? report['blockedURL']),
    sourceHost: hostOf(report['source-file'] ?? report['sourceFile']),
    disposition: safeToken(report.disposition),
  };
}

/** Normaliza ambos formatos a la lista de cuerpos del reporte. */
function reportBodies(raw: unknown): Record<string, unknown>[] {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const legacy = (raw as Record<string, unknown>)['csp-report'];
    if (legacy && typeof legacy === 'object') return [legacy as Record<string, unknown>];
    const single = (raw as Record<string, unknown>).body;
    if (single && typeof single === 'object') return [single as Record<string, unknown>];
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { body: Record<string, unknown> } =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as { body?: unknown }).body === 'object'
    )
    .map((item) => item.body);
}

/** Lee el body con tope real: `null` si supera `maxBytes` (cancela el stream). */
async function readTextWithCap(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) {
    const text = await request.text();
    return text.length <= maxBytes ? text : null;
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buffer);
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!contentType || !ACCEPTED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415 });
  }

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const { allowed } = await cspReportLimiter.check(clientIpFromHeaders(request.headers));
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const text = await readTextWithCap(request, MAX_BODY_BYTES);
  if (text === null) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const summaries = reportBodies(raw).slice(0, MAX_REPORTS_LOGGED).map(summarize);
  if (summaries.length === 0) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  console.warn(
    JSON.stringify({
      channel: 'csp-report',
      at: new Date().toISOString(),
      reports: summaries,
    })
  );

  // Los navegadores no leen la respuesta: 204 ahorra los bytes del body.
  return new Response(null, { status: 204 });
}
