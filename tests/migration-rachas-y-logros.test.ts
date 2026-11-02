import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La migración 018 añade la racha diaria y hace alcanzables tres logros
 * sembrados (J08 del informe scout-juego). No hay base local en CI, así que
 * este test fija el contrato del SQL; la prueba funcional se hace contra
 * Supabase local (`supabase start` + `db push`) siguiendo los pasos del PR.
 */

const MIGRATION = join(__dirname, '..', 'supabase', 'migrations', '018_rachas_y_logros.sql');

const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, 'utf8') : '';

describe('migración 018_rachas_y_logros', () => {
  it('existe y no está vacía', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('agrega las tres columnas de racha de forma idempotente', () => {
    expect(sql).toMatch(/add column if not exists current_streak integer not null default 0/i);
    expect(sql).toMatch(/add column if not exists longest_streak integer not null default 0/i);
    expect(sql).toMatch(/add column if not exists last_played_on date/i);
  });

  it('el día se cuenta en America/Santiago, no en UTC', () => {
    expect(sql).toMatch(/now\(\) at time zone 'America\/Santiago'/i);
    expect(sql).not.toMatch(/current_date/i);
  });

  it('el trigger de puntos calcula la racha en el mismo UPDATE atómico', () => {
    expect(sql).toMatch(/create or replace function public\.award_quiz_points/i);
    // Mismo día no suma, día siguiente suma, hueco reinicia.
    expect(sql).toMatch(/when last_played_on >= v_today then current_streak/i);
    expect(sql).toMatch(/when last_played_on = v_today - 1 then current_streak \+ 1/i);
    expect(sql).toMatch(/else 1/i);
    expect(sql).toMatch(/longest_streak = greatest\(/i);
    // Un solo UPDATE: no hay lectura previa de la racha fuera de la sentencia.
    expect(sql).toMatch(/set points = points \+ points_earned/i);
  });

  it('el trigger sigue siendo el de siempre, con el mismo WHEN', () => {
    expect(sql).toMatch(/drop trigger if exists trigger_award_quiz_points/i);
    expect(sql).toMatch(/when \(new\.player_id is not null\)/i);
    expect(sql).toMatch(/execute function public\.award_quiz_points\(\)/i);
  });

  it('unlock_achievement valida quiz_master_50, week_streak y explorer', () => {
    expect(sql).toMatch(/create or replace function public\.unlock_achievement/i);
    expect(sql).toMatch(/when 'quiz_master_50'\s+then v_quizzes_played >= 50/i);
    expect(sql).toMatch(
      /when 'week_streak'\s+then greatest\(v_longest_streak, v_current_streak\) >= 7/i
    );
    expect(sql).toMatch(/when 'explorer'\s+then public\.get_my_played_categories\(\) >= 5/i);
  });

  it('los logros sin métrica fiable no se inventan', () => {
    for (const id of ['going_viral', 'internet_famous', 'social_butterfly']) {
      expect(sql).not.toMatch(new RegExp(`when '${id}'`, 'i'));
    }
  });

  it('el conteo de categorías es de cada jugador y no se abre a anon', () => {
    expect(sql).toMatch(/create or replace function public\.get_my_played_categories\(\)/i);
    expect(sql).toMatch(/count\(distinct q\.category_id\)/i);
    expect(sql).toMatch(
      /revoke execute on function public\.get_my_played_categories\(\) from public, anon/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.get_my_played_categories\(\) to authenticated, service_role/i
    );
  });

  it('el jugador no puede escribir su racha (guard de la 014 extendido)', () => {
    expect(sql).toMatch(/create or replace function public\.guard_profile_editable_columns/i);
    for (const column of ['current_streak', 'longest_streak', 'last_played_on']) {
      expect(sql).toMatch(new RegExp(`NEW\\.${column} := OLD\\.${column}`, 'i'));
    }
  });

  it('la 018 no reescribe ninguna migración anterior', () => {
    expect(sql).not.toMatch(/alter table public\.profiles alter column/i);
  });
});
