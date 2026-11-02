import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La migración 014 endurece RLS (hallazgos AB-02/03/08/09 del informe
 * scout-auth-backend), aplicada sobre la 013 ya mergeada: la 014 no repite
 * lo que la 013 resuelve (grants por columna en profiles, lectura por token,
 * RPC unlock_achievement que paga los premios) y añade lo que le quedó
 * abierto. No hay una base local en CI, así que este test fija el contrato
 * del SQL. La prueba funcional se hace contra Supabase local
 * (`supabase start` + `db push`) siguiendo los pasos del PR.
 */

const MIGRATION = join(__dirname, '..', 'supabase', 'migrations', '014_endurecer_rls.sql');

const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, 'utf8') : '';

describe('migración 014_endurecer_rls', () => {
  it('existe y no está vacía', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('AB-02: el insert de game_sessions exige dueño o anónimo', () => {
    expect(sql).toMatch(/drop policy if exists game_sessions_insert_any/i);
    expect(sql).toMatch(/create policy "game_sessions_insert_player"/i);
    expect(sql).toMatch(/with check \(player_id is null or player_id = auth\.uid\(\)\)/i);
  });

  it('AB-02: rangos de score, max_score y tiempo validados en el insert', () => {
    // Guard BEFORE INSERT (no CHECK): las cascadas FK sobre filas basura
    // antiguas no deben fallar al borrar una cuenta.
    expect(sql).toMatch(/create or replace function public\.guard_game_session_ranges\(\)/i);
    expect(sql).toMatch(/before insert on public\.game_sessions/i);
    expect(sql).toMatch(/NEW\.score > NEW\.max_score/i);
    expect(sql).toMatch(/NEW\.time_taken_seconds < 0/i);
    expect(sql).toMatch(/'23514'/);
  });

  it('AB-03: guard de columnas no editables en profiles', () => {
    expect(sql).toMatch(/create or replace function public\.guard_profile_editable_columns\(\)/i);
    expect(sql).toMatch(/create trigger trigger_guard_profile_editable_columns/i);
    for (const column of [
      'points',
      'quizzes_played',
      'quizzes_created',
      'is_admin',
      'is_verified',
      'followers_count',
      'following_count',
    ]) {
      expect(sql).toMatch(new RegExp(`NEW\\.${column} := OLD\\.${column}`, 'i'));
    }
  });

  it('AB-08: guard de columnas no editables en quizzes', () => {
    expect(sql).toMatch(/create or replace function public\.guard_quiz_editable_columns\(\)/i);
    expect(sql).toMatch(/create trigger trigger_guard_quiz_editable_columns/i);
    for (const column of [
      'creator_id',
      'plays_count',
      'shares_count',
      'likes_count',
      'avg_score',
      'is_featured',
      'published_at',
    ]) {
      expect(sql).toMatch(new RegExp(`NEW\\.${column} := OLD\\.${column}`, 'i'));
    }
  });

  it('AB-08: el creador sí puede archivar su propio quiz', () => {
    expect(sql).toMatch(/NEW\.status <> 'archived'/i);
  });

  it('los guards pasan libres sin JWT de usuario (service role y triggers internos)', () => {
    expect(sql).toMatch(
      /auth\.uid\(\) is null or current_user not in \('anon', 'authenticated'\)/i
    );
  });

  it('AB-09: el insert de user_achievements exige dueño y condición cumplida', () => {
    expect(sql).toMatch(/drop policy if exists user_achievements_insert_system/i);
    expect(sql).toMatch(/create policy "user_achievements_insert_own"/i);
    expect(sql).toMatch(/auth\.uid\(\) = user_id/i);
    expect(sql).toMatch(/achievement_condition_met\(user_id, achievement_id\)/i);
  });

  it('achievement_condition_met evalúa plays, creates y partida perfecta', () => {
    expect(sql).toMatch(/create or replace function public\.achievement_condition_met/i);
    expect(sql).toMatch(/when 'plays' then/i);
    expect(sql).toMatch(/when 'creates' then/i);
    expect(sql).toMatch(/when 'score' then/i);
    expect(sql).toMatch(/from public\.game_sessions s/i);
  });

  it('achievement_condition_met solo responde sobre el propio uid (no es oráculo RPC)', () => {
    expect(sql).toMatch(/auth\.uid\(\) is null or auth\.uid\(\) <> p_user_id/i);
  });

  it('AB-03: avatar_url queda en la whitelist (grant aditivo sobre el de la 013)', () => {
    expect(sql).toMatch(/grant update \(avatar_url\) on public\.profiles to authenticated/i);
  });

  it('sin trigger de premio propio: paga solo unlock_achievement (013), nunca dos veces', () => {
    expect(sql).not.toMatch(/create (or replace )?function public\.award_achievement_points/i);
    expect(sql).not.toMatch(/create trigger trigger_award_achievement_points/i);
    // Limpieza del borrador anterior de la 014 si alguien lo aplico en local.
    expect(sql).toMatch(/drop trigger if exists trigger_award_achievement_points/i);
    expect(sql).toMatch(/drop function if exists public\.award_achievement_points\(\)/i);
  });

  it('increment_creator_quizzes queda SECURITY DEFINER (autosuficiente si va sola)', () => {
    expect(sql).toMatch(/alter function public\.increment_creator_quizzes\(\) security definer/i);
  });

  it('es idempotente: políticas y triggers con drop if exists', () => {
    expect(sql).toMatch(/drop policy if exists/i);
    expect(sql).toMatch(/drop trigger if exists/i);
    expect(sql).toMatch(/create or replace function/i);
  });
});
