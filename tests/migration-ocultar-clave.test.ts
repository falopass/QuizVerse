import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La migración 015 cierra AB-01: la clave de respuestas salía por la API
 * pública leyendo `quizzes.questions` con la publishable key. Diseño: la clave
 * se mueve a `quiz_answer_keys` (solo service_role) y `questions` queda
 * saneado en sitio, mantenido por trigger en cada escritura. No hay una base
 * local en CI, así que este test fija el contrato del SQL; la prueba
 * funcional se hace contra Supabase local o tras aplicarla en producción.
 */

const MIGRATION = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '015_ocultar_clave_respuestas.sql'
);

const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, 'utf8') : '';

describe('migración 015_ocultar_clave_respuestas', () => {
  it('existe y no está vacía', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('crea quiz_answer_keys colgada de quizzes con cascade', () => {
    expect(sql).toMatch(/create table if not exists public\.quiz_answer_keys/i);
    expect(sql).toMatch(
      /quiz_id uuid primary key references public\.quizzes\(id\)\s+on delete cascade/i
    );
    // El trigger BEFORE INSERT copia la clave antes de que exista la fila
    // padre: la FK debe diferirse al COMMIT o toda alta nueva revienta.
    expect(sql).toMatch(/deferrable initially deferred/i);
    expect(sql).toMatch(/questions jsonb not null/i);
  });

  it('nadie salvo service_role puede leerla: RLS + revoke + grant mínimo', () => {
    expect(sql).toMatch(/alter table public\.quiz_answer_keys enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.quiz_answer_keys from public, anon, authenticated/i);
    expect(sql).toMatch(/grant all on public\.quiz_answer_keys to service_role/i);
    // Sin policies: la tabla no devuelve filas ni a authenticated.
    expect(sql).not.toMatch(/create policy .* on public\.quiz_answer_keys/i);
  });

  it('el saneado quita explanation de la pregunta e is_correct de cada opción', () => {
    expect(sql).toMatch(/create or replace function public\.sanitize_quiz_questions/i);
    expect(sql).toMatch(/q\.value - 'explanation'/i);
    expect(sql).toMatch(/o\.value - 'is_correct'/i);
  });

  it('la detección de clave mira explanation e is_correct dentro del jsonb', () => {
    expect(sql).toMatch(/create or replace function public\.quiz_questions_have_key/i);
    expect(sql).toMatch(/q\.value \? 'explanation'/i);
    expect(sql).toMatch(/o\.value \? 'is_correct'/i);
  });

  it('el backfill copia la clave ANTES de sanear y solo filas que la traen', () => {
    const insertAt = sql.search(/insert into public\.quiz_answer_keys/i);
    const updateAt = sql.search(/update public\.quizzes\s+set questions/i);
    expect(insertAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(insertAt);
    // Las dos consultas van acotadas por quiz_questions_have_key: una
    // re-ejecución no encuentra filas y jamás pisa la clave ya guardada.
    expect(sql).toMatch(
      /insert into public\.quiz_answer_keys[^;]*where public\.quiz_questions_have_key\(questions\)/i
    );
    expect(sql).toMatch(
      /update public\.quizzes\s+set questions = public\.sanitize_quiz_questions\(questions\)\s+where public\.quiz_questions_have_key\(questions\)/i
    );
  });

  it('todo INSERT/UPDATE de questions reparte clave y versión pública vía trigger', () => {
    expect(sql).toMatch(/create or replace function public\.split_quiz_answer_key/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/on conflict \(quiz_id\) do update/i);
    expect(sql).toMatch(/before insert or update of questions on public\.quizzes/i);
    expect(sql).toMatch(/NEW\.questions := public\.sanitize_quiz_questions\(NEW\.questions\)/i);
  });

  it('idempotente: or replace / if not exists / drop if exists por todas partes', () => {
    expect(sql).toMatch(/create table if not exists public\.quiz_answer_keys/i);
    expect(sql).toMatch(/create or replace function public\.quiz_questions_have_key/i);
    expect(sql).toMatch(/create or replace function public\.sanitize_quiz_questions/i);
    expect(sql).toMatch(/create or replace function public\.split_quiz_answer_key/i);
    expect(sql).toMatch(/drop trigger if exists trg_split_quiz_answer_key/i);
  });

  it('no edita ni deshace migraciones anteriores', () => {
    expect(sql).not.toMatch(/drop table public\.quizzes/i);
    expect(sql).not.toMatch(/alter table public\.quizzes\s+drop column/i);
  });
});
