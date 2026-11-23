/**
 * Contratos de permisos y seguridad de Lote 2:
 *  - Migración 023 (`023_proteger_reportes_quiz.sql`): cierre de INSERT directo,
 *    snapshot autoritativo, objetivo publicado, estado inicial, deduplicación sin
 *    PII y resolución exclusiva de moderadores.
 *  - Migración 024 (`024_limitar_mutaciones_sociales.sql`): UPDATE de
 *    `notifications` restringido a `is_read`, deduplicación de `notify_follow`,
 *    encapsulación de `user_follows` y compatibilidad de `increment_shares` con L3.
 *  - Distinción de señales estimadas vs confirmadas en `buildTraffic`, lectura
 *    acotada `readBoundedJson` y política CSP en observación (`next.config.ts`).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readBoundedJson, readBoundedText } from '@/lib/utils/read-bounded-body';
import { buildTraffic } from '@/lib/admin/stats';
import nextConfig from '../next.config';

const commentMocks = vi.hoisted(() => ({
  limitCheck: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '1.2.3.4']]),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: () => ({ check: commentMocks.limitCheck }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from: () => {
      throw new Error('DB should not be queried when rate limiter denies');
    },
  }),
}));

import { createComment, reportComment } from '@/actions/comments.actions';

const ROOT = process.cwd();
const readMigration = (name: string) =>
  readFileSync(path.join(ROOT, 'supabase', 'migrations', name), 'utf8');

describe('migración 023 — proteger reportes de quizzes (A-08)', () => {
  const sql = readMigration('023_proteger_reportes_quiz.sql');

  it('cierra INSERT directo a anon/authenticated y reserva escritura a service_role', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "quiz_reports_insert_authenticated"/i);
    expect(sql).toMatch(/CREATE POLICY "quiz_reports_insert_none"[\s\S]*WITH CHECK \(false\)/i);
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.quiz_reports FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(
      /GRANT UPDATE \(resolved, resolved_by, resolved_at\) ON public\.quiz_reports TO authenticated/i
    );
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.quiz_reports TO service_role/i
    );
  });

  it('controla objetivo publicado, snapshot, estado inicial, resolución admin y cascada FK en guard_quiz_report', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.guard_quiz_report\(\)/i);
    expect(sql).toMatch(/q\.status = 'published'/i);
    expect(sql).toMatch(/NEW\.quiz_title := v_title/i);
    expect(sql).toMatch(/NEW\.quiz_slug := v_slug/i);
    expect(sql).toMatch(/NEW\.resolved := false/i);
    expect(sql).toMatch(/NEW\.resolved_by := NULL/i);
    expect(sql).toMatch(/NEW\.resolved_at := NULL/i);
    expect(sql).toMatch(/pg_trigger_depth\(\) > 1/i);
    expect(sql).toMatch(/is_admin = true/i);
    expect(sql).toMatch(/NEW\.resolved_by IS DISTINCT FROM auth\.uid\(\)/i);
  });

  it('crea índices únicos parciales para deduplicar reportes abiertos (autenticado y anónimo sin PII)', () => {
    expect(sql).toMatch(/WITH ranked_open_reports AS/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS quiz_reports_open_by_user_once/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS quiz_reports_open_by_fingerprint_once/i);
    expect(sql).toMatch(/reporter_fingerprint/i);
    expect(sql).toMatch(/WHERE NOT resolved/i);
  });
});

describe('migración 024 — limitar mutaciones sociales (A-16)', () => {
  const sql = readMigration('024_limitar_mutaciones_sociales.sql');

  it('restringe UPDATE de notifications a is_read por privilegio de columna y trigger', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.guard_notifications_update\(\)/i);
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.notifications FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(/GRANT UPDATE \(is_read\) ON public\.notifications TO authenticated/i);
    expect(sql).toMatch(/NEW\.title IS DISTINCT FROM OLD\.title/i);
    expect(sql).toMatch(/NEW\.data IS DISTINCT FROM OLD\.data/i);
  });

  it('deduplica notificaciones de follow por par con bloqueo consultivo e índice parcial', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_notifications_follow_pair/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.notify_follow\(\)/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/type = 'follow'[\s\S]*data->>'follower_id' = NEW\.follower_id::text/i);
  });

  it('encapsula escrituras de user_follows en service_role manteniendo lectura pública', () => {
    expect(sql).toMatch(/CREATE POLICY "user_follows_insert_none"[\s\S]*WITH CHECK \(false\)/i);
    expect(sql).toMatch(/CREATE POLICY "user_follows_delete_none"[\s\S]*USING \(false\)/i);
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.user_follows FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(/GRANT SELECT ON public\.user_follows TO anon, authenticated/i);
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.user_follows TO service_role/i
    );
  });

  it('preserva increment_shares navegable para L3 y lo acota a quizzes publicados', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.increment_shares\(quiz_uuid UUID\)/i);
    expect(sql).toMatch(/AND status = 'published'/i);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.increment_shares\(UUID\) TO anon, authenticated, service_role/i
    );
  });
});

describe('readBoundedText / readBoundedJson', () => {
  it('acepta JSON dentro del tope y cuenta bytes UTF-8 reales', async () => {
    const req = new Request('http://test/api', {
      method: 'POST',
      body: JSON.stringify({ ok: 'ñ' }),
    });
    const res = await readBoundedJson(req, 64);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ ok: 'ñ' });
      expect(res.bytes).toBeGreaterThan(8);
    }
  });

  it('rechaza payloads que superan el tope por Content-Length o por stream multi-chunk', async () => {
    const byHeader = await readBoundedText(
      new Request('http://test/api', {
        method: 'POST',
        body: 'hi',
        headers: { 'content-length': '200' },
      }),
      64
    );
    expect(byHeader).toEqual({ ok: false, reason: 'payload_too_large' });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('a'.repeat(40)));
        controller.enqueue(encoder.encode('b'.repeat(40)));
        controller.close();
      },
    });
    const req = new Request('http://test/api', {
      method: 'POST',
      body: stream,
      // @ts-expect-error -- Node fetch requiere duplex para ReadableStream
      duplex: 'half',
    });
    const byStream = await readBoundedJson(req, 64);
    expect(byStream).toEqual({ ok: false, reason: 'payload_too_large' });
  });

  it('distingue JSON malformado de exceso de tamaño y captura errores del stream', async () => {
    const req = new Request('http://test/api', { method: 'POST', body: '{bad' });
    expect(await readBoundedJson(req, 64)).toEqual({ ok: false, reason: 'invalid_json' });

    const brokenStream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('stream aborted');
      },
    });
    const brokenReq = new Request('http://test/api', {
      method: 'POST',
      body: brokenStream,
      // @ts-expect-error -- Node fetch requiere duplex para ReadableStream
      duplex: 'half',
    });
    expect(await readBoundedJson(brokenReq, 64)).toEqual({ ok: false, reason: 'invalid_json' });
  });
});

describe('observabilidad y CSP en observación', () => {
  it('buildTraffic identifica los beacons como señales estimadas con retención de 180 días', () => {
    const traffic = buildTraffic(null, new Date('2026-11-22T00:00:00Z'));
    expect(traffic.measurement).toBe('estimated_beacon');
    expect(traffic.retentionDays).toBe(180);
  });

  it('next.config.ts amplía CSP en modo report-only sin endurecer script-src en enforce global', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const standard = rules.find((rule) => rule.source === '/((?!embed/en/|embed/es/).*)');
    const embed = rules.find((rule) => rule.source === '/embed/es/:path*');
    expect(standard).toBeDefined();
    expect(embed).toBeDefined();

    const reportOnly = standard!.headers.find(
      (h) => h.key === 'Content-Security-Policy-Report-Only'
    )?.value;
    const enforced = standard!.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    const embedEnforced = embed!.headers.find((h) => h.key === 'Content-Security-Policy')?.value;

    expect(reportOnly).toContain("script-src-attr 'none'");
    expect(reportOnly).toContain("media-src 'self'");
    expect(reportOnly).toContain("worker-src 'self'");
    expect(reportOnly).not.toContain('frame-src');
    expect(reportOnly).toContain('report-to csp');
    // Enforcement global intacto: sin script-src ni style-src en enforce.
    expect(enforced).toBe(
      "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'self'"
    );
    // Embed sigue embebible desde cualquier origen (sin frame-ancestors).
    expect(embedEnforced).toBe("base-uri 'self'; object-src 'none'; form-action 'self'");
  });
});

describe('comments.actions — distinción unavailable vs rate_limited', () => {
  const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
  const COMMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  beforeEach(() => {
    commentMocks.limitCheck.mockReset();
  });

  it('createComment devuelve unavailable (no rate_limited) cuando el backend del limiter cae', async () => {
    commentMocks.limitCheck.mockResolvedValue({
      allowed: false,
      remaining: 0,
      reset: 600,
      errored: true,
    });

    const result = await createComment(QUIZ_ID, 'Hola');
    expect(result).toMatchObject({ success: false, code: 'unavailable' });
  });

  it('reportComment devuelve unavailable (no rate_limited) cuando el backend del limiter cae', async () => {
    commentMocks.limitCheck.mockResolvedValue({
      allowed: false,
      remaining: 0,
      reset: 600,
      errored: true,
    });

    const result = await reportComment(COMMENT_ID, 'spam');
    expect(result).toMatchObject({ success: false, code: 'unavailable' });
  });
});
