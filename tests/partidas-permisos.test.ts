/**
 * Contratos de permisos, proyecciones e integridad de Lote 3:
 *  - Migración 025 (`025_proteger_preguntas_publicas.sql`): proyección pública
 *    explícita por lista blanca sin `explanation` ni `is_correct`, y fusión
 *    idempotente de `quiz_answer_keys` en actualizaciones e importaciones.
 *  - Migración 026 (`026_proteger_partidas_y_premios.sql`): cierre de INSERT
 *    directo en `game_sessions` para `anon`/`authenticated`, guard de quiz
 *    publicado y rangos, verificación de participación, separación de
 *    completitud de personalidad y perfección de trivia, y revocación de
 *    ejecución pública en `increment_shares` / `mark_session_shared`.
 *  - Migración 027 (`027_ordenar_ranking_grupos.sql`): un único mejor intento
 *    elegible por participante en grupos y desempate determinista por
 *    `score DESC, time_taken_seconds ASC NULLS LAST, created_at ASC, game_session_id ASC`.
 *  - Flujos de runtime: proyección sin explicaciones en cliente y API diaria,
 *    50/50, concurrencia/transición única de finalización, cambio de isolate y
 *    respaldo de catálogo.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildReview, eliminateWrongOptions, toClientQuiz } from '@/lib/quiz/answer-key';
import { computeAuthoritativeTimeSeconds, createQuizAttempt } from '@/lib/quiz/attempt';
import {
  claimHint,
  claimQuestionReveal,
  finalizeAttemptState,
  getAttemptReveals,
  initAttemptState,
  resetAttemptStoreForTests,
} from '@/lib/quiz/attempt-store';
import { isFallbackCatalogQuizId } from '@/lib/quiz/quiz-repository';
import { pointsFor, scoreSubmission } from '@/lib/quiz/submission';
import { isBetterGroupAttempt, sortGroupEntriesDeterministically } from '@/lib/data/group';
import type { Quiz } from '@/types/quiz';

const ROOT = process.cwd();
const readMigration = (name: string) =>
  readFileSync(path.join(ROOT, 'supabase', 'migrations', name), 'utf8');

describe('migración 025 — proteger preguntas públicas y explicaciones (A-04)', () => {
  const sql = readMigration('025_proteger_preguntas_publicas.sql');

  it('protege quiz_answer_keys con RLS y reserva acceso a service_role', () => {
    expect(sql).toMatch(/ALTER TABLE public\.quiz_answer_keys ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/REVOKE ALL ON public\.quiz_answer_keys FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT ALL ON public\.quiz_answer_keys TO service_role/i);
  });

  it('define project_public_quiz_questions por lista blanca sin explanation ni is_correct', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.project_public_quiz_questions\(p_questions JSONB\)/i
    );
    expect(sql).toMatch(/'id', q\.value -> 'id'/i);
    expect(sql).toMatch(/'question', q\.value -> 'question'/i);
    expect(sql).toMatch(/'options'/i);
    expect(sql).toMatch(/'personality_tags'/i);
  });

  it('preserva claves y explicaciones en actualizaciones parciales con merge_quiz_answer_key_questions', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.merge_quiz_answer_key_questions/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.split_quiz_answer_key\(\)/i);
    expect(sql).toMatch(
      /NEW\.questions := public\.project_public_quiz_questions\(NEW\.questions\)/i
    );
  });
});

describe('migración 026 — proteger partidas, premios y shares (A-01, A-09, A-16)', () => {
  const sql = readMigration('026_proteger_partidas_y_premios.sql');

  it('cierra INSERT directo de game_sessions a anon/authenticated y reserva escritura a service_role', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "game_sessions_insert_player"/i);
    expect(sql).toMatch(/CREATE POLICY "game_sessions_insert_none"[\s\S]*WITH CHECK \(false\)/i);
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.game_sessions FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(/GRANT SELECT ON public\.game_sessions TO authenticated/i);
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.game_sessions TO service_role/i
    );
  });

  it('valida rangos, quiz publicado, participación efectiva y separa personalidad de perfección en trivia', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.guard_game_session_ranges\(\)/i);
    expect(sql).toMatch(/q\.status = 'published'/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.game_session_has_participation/i);
    expect(sql).toMatch(
      /IF NOT public\.game_session_has_participation\(NEW\.answers, NEW\.score\) THEN/i
    );
    expect(sql).toMatch(
      /IF v_quiz_type = 'trivia' AND NEW\.max_score > 0 AND NEW\.score = NEW\.max_score THEN/i
    );
    expect(sql).toMatch(/AND q\.quiz_type = 'trivia'/i);
  });

  it('revoca EXECUTE público de increment_shares y mark_session_shared reservándolos a service_role', () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.increment_shares\(UUID\) FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.increment_shares\(UUID\) TO service_role/i
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.mark_session_shared\(TEXT\) FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.mark_session_shared\(TEXT\) TO service_role/i
    );
  });
});

describe('migración 027 — ordenar ranking de grupos y mejor intento por participante (A-10)', () => {
  const sql = readMigration('027_ordenar_ranking_grupos.sql');

  it('añade player_id, consolida duplicados al mejor intento y crea índice único parcial por participante', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS player_id UUID/i);
    expect(sql).toMatch(/WITH ranked_participant_entries AS/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS quiz_group_entries_player_unique/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.sync_quiz_group_entry\(\)/i);
  });

  it('desempata de forma estable incluyendo game_session_id ASC en get_quiz_group_entries', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_quiz_group_entries/i);
    expect(sql).toMatch(/WITH best_per_participant AS/i);
    expect(sql).toMatch(
      /b\.score DESC[\s\S]*b\.time_taken_seconds ASC NULLS LAST[\s\S]*b\.created_at ASC[\s\S]*b\.game_session_id ASC/i
    );
  });
});

describe('contratos de runtime — proyección, intento, concurrencia, 50/50 y grupo', () => {
  const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';

  beforeEach(() => {
    process.env.QUIZ_ATTEMPT_SECRET = 'permisos-test-secret';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetAttemptStoreForTests();
  });

  const triviaQuiz: Quiz = {
    id: QUIZ_ID,
    slug: 'trivia-secreta',
    title: 'Trivia Secreta',
    description: 'Descripción',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'es',
    questions: [
      {
        id: 'q1',
        question: '¿Planeta con más lunas?',
        explanation: 'EXPLICACION_SECRETA_SATURNO_270',
        options: [
          { id: 'q1a', text: 'Saturno', is_correct: true },
          { id: 'q1b', text: 'Marte', is_correct: false },
          { id: 'q1c', text: 'Venus', is_correct: false },
          { id: 'q1d', text: 'Mercurio', is_correct: false },
        ],
      },
      {
        id: 'q2',
        question: '¿Planeta más cercano al Sol?',
        explanation: 'EXPLICACION_SECRETA_MERCURIO',
        options: [
          { id: 'q2a', text: 'Mercurio', is_correct: true },
          { id: 'q2b', text: 'Tierra', is_correct: false },
          { id: 'q2c', text: 'Júpiter', is_correct: false },
        ],
      },
    ],
    results: null,
    tags: [],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: null,
    updated_at: null,
    created_at: '2026-01-01',
  };

  it('toClientQuiz oculta is_correct y explanation en la carga previa, y buildReview las entrega solo al finalizar', () => {
    const clientPayload = toClientQuiz(triviaQuiz);
    const serialized = JSON.stringify(clientPayload);

    expect(serialized).not.toContain('is_correct');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('EXPLICACION_SECRETA_SATURNO_270');

    const review = buildReview(triviaQuiz, [
      { question_id: 'q1', selected_option_id: 'q1a', is_correct: true },
      { question_id: 'q1', selected_option_id: 'q1b', is_correct: false }, // duplicada ignorada
    ]);
    expect(review).toHaveLength(1);
    expect(review[0].explanation).toBe('EXPLICACION_SECRETA_SATURNO_270');
  });

  it('50/50 es determinista, nunca regala la única respuesta en 3 opciones y solo se permite en una pregunta por intento', async () => {
    const hint4 = eliminateWrongOptions(triviaQuiz, 'q1');
    expect(hint4).toHaveLength(2);
    expect(hint4).not.toContain('q1a');

    const hint3 = eliminateWrongOptions(triviaQuiz, 'q2');
    expect(hint3).toHaveLength(1);
    expect(hint3).not.toContain('q2a');

    const created = await createQuizAttempt(QUIZ_ID, 1_700_000_000_000, {
      userId: 'u-1',
      variant: 'normal',
      questionIds: ['q1', 'q2'],
    });
    expect(created).not.toBeNull();
    const attemptId = created!.attempt.attemptId;
    await initAttemptState(attemptId);

    expect(await claimHint(attemptId, 'q1')).toEqual({ ok: true });
    expect(await claimHint(attemptId, 'q1')).toEqual({ ok: true }); // idempotente
    expect(await claimHint(attemptId, 'q2')).toEqual({
      ok: false,
      reason: 'hint_already_used',
    });
  });

  it('garantiza orden estricto, una sola transición de finalización y detección de cambio de isolate', async () => {
    const now = 1_700_000_000_000;
    const created = await createQuizAttempt(QUIZ_ID, now, {
      userId: 'u-1',
      variant: 'normal',
      questionIds: ['q1', 'q2'],
    });
    const attemptId = created!.attempt.attemptId;
    await initAttemptState(attemptId);

    expect(await claimQuestionReveal(attemptId, 'q1', 0, 'q1b')).toEqual({ ok: true });
    expect(await claimQuestionReveal(attemptId, 'q1', 0, 'q1a')).toEqual({
      ok: false,
      reason: 'already_revealed',
    });
    expect(await claimQuestionReveal(attemptId, 'q2', 0, 'q2a')).toEqual({
      ok: false,
      reason: 'out_of_order',
    });

    //Dos finalizaciones concurrentes: la primera fija y lo revelado ('q1b') prevalece sobre lo enviado ('q1a').
    const [first, second] = await Promise.all([
      finalizeAttemptState(attemptId, { q1: 'q1a', q2: 'q2a' }),
      finalizeAttemptState(attemptId, { q1: 'q1a', q2: 'q2b' }),
    ]);
    expect(first.choices).toEqual({ q1: 'q1b', q2: 'q2a' });
    expect(second.choices).toEqual({ q1: 'q1b', q2: 'q2a' });
    expect([first.firstTime, second.firstTime]).toEqual([true, false]);

    // Cambio de isolate sin Redis: el nuevo isolate detecta estado ausente.
    resetAttemptStoreForTests();
    expect(await getAttemptReveals(attemptId)).toBeNull();
  });

  it('separa cero participación, completitud de personalidad y perfección de trivia, e identifica fichas de respaldo', () => {
    expect(isFallbackCatalogQuizId('launch-es-cine')).toBe(true);
    expect(isFallbackCatalogQuizId(QUIZ_ID)).toBe(false);

    const zero = scoreSubmission(triviaQuiz, [
      { question_id: 'q1', selected_option_id: '', time_ms: 0 },
    ]);
    expect(zero.participated).toBe(false);
    expect(
      pointsFor(zero.perfectTrivia, { participated: zero.participated, quizType: 'trivia' })
    ).toBe(0);

    const authTime = computeAuthoritativeTimeSeconds(
      2,
      { issuedAt: 1_700_000_000, expiresAt: 1_700_000_000 + 10_800 },
      (1_700_000_000 + 38) * 1000
    );
    expect(authTime).toBe(38);

    expect(
      isBetterGroupAttempt(
        { score: 8, time_taken_seconds: 38 },
        { score: 8, time_taken_seconds: 40 }
      )
    ).toBe(true);
    const ranked = sortGroupEntriesDeterministically([
      {
        nickname: 'Zoe',
        score: 8,
        maxScore: 8,
        timeTakenSeconds: 38,
        gameSessionId: 's-2',
        createdAt: '2026-11-23T00:00:00Z',
      },
      {
        nickname: 'Ana',
        score: 8,
        maxScore: 8,
        timeTakenSeconds: 38,
        gameSessionId: 's-1',
        createdAt: '2026-11-23T00:00:00Z',
      },
    ]);
    expect(ranked[0].gameSessionId).toBe('s-1');
  });
});
