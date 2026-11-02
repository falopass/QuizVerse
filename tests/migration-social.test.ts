import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La migración 019 cierra los hallazgos sociales que tocan la DB sin cambiar
 * el contrato de la app: logros legibles en el perfil público (SOC-02),
 * índice de la ventana semanal (SOC-08), tope de p_limit + puesto propio
 * (SOC-14) y contadores de follows con piso y reconciliación (SOC-15).
 *
 * No hay base local en CI: este test fija el contrato del SQL. La prueba
 * funcional va contra Supabase local (`supabase start` + `db push`).
 */

const MIGRATION = join(__dirname, '..', 'supabase', 'migrations', '019_social_y_ranking.sql');

const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, 'utf8') : '';

describe('migración 019_social_y_ranking', () => {
  it('existe y no está vacía', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('SOC-02: los logros desbloqueados son legibles en el perfil público', () => {
    expect(sql).toMatch(/drop policy if exists "user_achievements_read_own"/i);
    expect(sql).toMatch(
      /create policy "user_achievements_read_public" on public\.user_achievements/i
    );
    expect(sql).toMatch(/for select\s+using \(true\)/i);
    // La escritura sigue cerrada: esta migración no abre ningún INSERT.
    expect(sql).not.toMatch(/for insert/i);
  });

  it('SOC-08: índice parcial sobre completed_at para la ventana semanal', () => {
    expect(sql).toMatch(
      /create index if not exists idx_game_sessions_completed_at\s+on public\.game_sessions \(completed_at\)\s+where player_id is not null/i
    );
  });

  it('SOC-14: p_limit se clampea en SQL (1..100, default 50)', () => {
    expect(sql).toMatch(
      /create or replace function public\.get_weekly_session_totals\(p_limit integer\)/i
    );
    expect(sql).toMatch(/least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/i);
  });

  it('SOC-14: get_weekly_rank solo devuelve el puesto propio', () => {
    expect(sql).toMatch(/create or replace function public\.get_weekly_rank\(p_user_id uuid\)/i);
    // Guard estricto: sin JWT de usuario tampoco pasa (no hay puesto propio).
    expect(sql).toMatch(/if p_user_id is distinct from auth\.uid\(\) then/i);
    expect(sql).toMatch(/raise exception 'get_weekly_rank/i);
    // Solo sesiones con JWT: el puesto es dato de la sesión.
    expect(sql).toMatch(
      /revoke execute on function public\.get_weekly_rank\(uuid\) from public, anon, service_role/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.get_weekly_rank\(uuid\)\s+to authenticated/i
    );
    // Mismo orden que el tablero: partidas, perfectas y desempate por id.
    expect(sql).toMatch(/t\.played > v_played/i);
    expect(sql).toMatch(/t\.perfect > v_perfect/i);
    expect(sql).toMatch(/t\.player_id < p_user_id/i);
  });

  it('SOC-06: el RPC de totales desempata por player_id (paginación estable)', () => {
    expect(sql).toMatch(/order by 2 desc, 3 desc, s\.player_id/i);
  });

  it('SOC-15: los decrementos de follows no bajan de cero', () => {
    expect(sql).toMatch(/create or replace function public\.update_follow_counts\(\)/i);
    expect(sql).toMatch(/greatest\(0, followers_count - 1\)/i);
    expect(sql).toMatch(/greatest\(0, following_count - 1\)/i);
    // Sigue siendo DEFINER: es lo que le permite escribir profiles.
    expect(sql).toMatch(/security definer set search_path = public, pg_temp/i);
  });

  it('SOC-15: reconcilia los contadores desde user_follows', () => {
    expect(sql).toMatch(/update public\.profiles p set/i);
    expect(sql).toMatch(
      /followers_count = \(select count\(\*\) from public\.user_follows f where f\.following_id = p\.id\)/i
    );
    expect(sql).toMatch(
      /following_count = \(select count\(\*\) from public\.user_follows f where f\.follower_id = p\.id\)/i
    );
  });

  it('es idempotente: create or replace / if exists / if not exists', () => {
    expect(sql).toMatch(/create or replace function/i);
    expect(sql).toMatch(/drop policy if exists/i);
    expect(sql).toMatch(/create index if not exists/i);
    // No redefine tablas ni toca migraciones previas.
    expect(sql).not.toMatch(/alter table/i);
  });

  it('no toca notificaciones (rama feat/notificaciones-v2)', () => {
    expect(sql).not.toMatch(/notification/i);
  });
});
