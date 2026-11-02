import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La migración 018 usa `game_sessions.was_shared` (J12), una columna que
 * existía desde la 001 y que nadie escribía. No hay base local en CI, así que
 * este test fija el contrato del SQL: la escritura va por una función
 * SECURITY DEFINER que solo toca la fila del token y no devuelve columnas.
 */

const MIGRATION = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '018_marcar_sesion_compartida.sql'
);

const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, 'utf8') : '';

describe('migración 018_marcar_sesion_compartida', () => {
  it('existe y no está vacía', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('marca was_shared por token y no devuelve datos de la sesión', () => {
    expect(sql).toMatch(/create or replace function public\.mark_session_shared\(p_token text\)/i);
    expect(sql).toMatch(/returns void/i);
    expect(sql).toMatch(/set was_shared = true/i);
    expect(sql).toMatch(/where share_token = p_token/i);
  });

  it('es SECURITY DEFINER, cierra PUBLIC y permite a anon marcar su propio share', () => {
    expect(sql).toMatch(/security definer set search_path = public, pg_temp/i);
    expect(sql).toMatch(
      /revoke execute on function public\.mark_session_shared\(text\) from public/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.mark_session_shared\(text\)\s+to anon, authenticated, service_role/i
    );
  });

  it('es idempotente', () => {
    expect(sql).toMatch(/create or replace function/i);
  });
});
