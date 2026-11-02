import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La migración 014 endurece RLS (hallazgos AB-02/03/08/09 del informe
 * scout-auth-backend). No hay una base local en CI, así que este test fija el
 * contrato del SQL: políticas, constraints y guards tienen que existir con la
 * semántica esperada. La prueba funcional se hace contra Supabase local
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

  it('AB-02: rangos de score, max_score y tiempo como CHECK NOT VALID', () => {
    for (const constraint of [
      'game_sessions_score_nonnegative',
      'game_sessions_max_score_nonnegative',
      'game_sessions_score_within_max',
      'game_sessions_time_nonnegative',
    ]) {
      expect(sql).toMatch(new RegExp(`add constraint ${constraint}`, 'i'));
    }
    expect(sql).toMatch(/score <= max_score/i);
    expect(sql).toMatch(/time_taken_seconds >= 0/i);
    expect(sql).toMatch(/not valid/i);
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

  it('los guards pasan libres sin JWT de usuario (service role y triggers internos)', () => {
    expect(sql).toMatch(
      /auth\.uid\(\) is null or current_user not in \('anon', 'authenticated'\)/i
    );
  });

  it('AB-09: el insert de user_achievements exige auth.uid() = user_id', () => {
    expect(sql).toMatch(/drop policy if exists user_achievements_insert_system/i);
    expect(sql).toMatch(/create policy "user_achievements_insert_own"/i);
    expect(sql).toMatch(/with check \(auth\.uid\(\) = user_id\)/i);
  });

  it('el premio de logros lo otorga la base (compensa el guard de points)', () => {
    expect(sql).toMatch(/create or replace function public\.award_achievement_points\(\)/i);
    expect(sql).toMatch(/after insert on public\.user_achievements/i);
    expect(sql).toMatch(/alter function public\.increment_creator_quizzes\(\) security definer/i);
  });

  it('es idempotente: políticas y triggers con drop if exists', () => {
    expect(sql).toMatch(/drop policy if exists/i);
    expect(sql).toMatch(/drop trigger if exists/i);
    expect(sql).toMatch(/create or replace function/i);
  });
});
