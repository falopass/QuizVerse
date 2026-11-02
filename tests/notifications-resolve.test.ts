import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveNotificationTargets } from '@/lib/notifications/resolve';
import type { Database, NotificationType } from '@/types/database';

const mocks = vi.hoisted(() => ({
  quizzes: [] as Array<{ id: string; slug: string; title: string; status: string }>,
  profiles: [] as Array<{ id: string; username: string; display_name: string | null }>,
}));

const supabase = {
  from: (table: string) => {
    if (table !== 'quizzes' && table !== 'profiles') {
      throw new Error(`unexpected table ${table}`);
    }
    return {
      select: () => ({
        in: async (_column: string, ids: string[]) => ({
          data:
            table === 'quizzes'
              ? mocks.quizzes.filter((row) => ids.includes(row.id))
              : mocks.profiles.filter((row) => ids.includes(row.id)),
        }),
      }),
    };
  },
} as unknown as SupabaseClient<Database>;

function row(overrides: Record<string, unknown>) {
  return {
    id: 'n-1',
    type: 'comment',
    title: 'Stored English title',
    body: 'Stored English body',
    data: {},
    is_read: false,
    created_at: '2026-11-01T10:00:00Z',
    ...overrides,
  } as Parameters<typeof resolveNotificationTargets>[1][number];
}

describe('resolveNotificationTargets', () => {
  it('comentario → ficha del quiz con ancla de comentarios, actor y título', async () => {
    mocks.quizzes = [{ id: 'q-1', slug: 'hp-trivia', title: 'HP Trivia', status: 'published' }];
    mocks.profiles = [{ id: 'u-1', username: 'ada', display_name: 'Ada' }];

    const [resolved] = await resolveNotificationTargets(
      supabase,
      [
        row({
          data: { quiz_id: 'q-1', comment_id: 'c-1', user_id: 'u-1' },
        }),
      ],
      'es'
    );

    expect(resolved.href).toBe('/es/quiz/hp-trivia#quiz-comments');
    expect(resolved.actorName).toBe('Ada');
    expect(resolved.quizTitle).toBe('HP Trivia');
  });

  it('follow → perfil del seguidor por username', async () => {
    mocks.quizzes = [];
    mocks.profiles = [{ id: 'u-2', username: 'grace', display_name: 'Grace H.' }];

    const [resolved] = await resolveNotificationTargets(
      supabase,
      [row({ type: 'follow', data: { follower_id: 'u-2' } })],
      'es'
    );

    expect(resolved.href).toBe('/es/profile/grace');
    expect(resolved.actorName).toBe('Grace H.');
  });

  it('quiz aprobado y publicado enlaza a la ficha; rechazado va a Mis quizzes', async () => {
    mocks.quizzes = [{ id: 'q-2', slug: 'nuevo-quiz', title: 'Nuevo', status: 'published' }];
    mocks.profiles = [];

    const [approved, rejected] = await resolveNotificationTargets(
      supabase,
      [
        row({ id: 'n-2', type: 'quiz_approved', data: { quiz_id: 'q-2' } }),
        row({ id: 'n-3', type: 'quiz_rejected', data: { quiz_id: 'q-2' } }),
      ],
      'en'
    );

    expect(approved.href).toBe('/en/quiz/nuevo-quiz');
    expect(rejected.href).toBe('/en/my-quizzes');
  });

  it('comentario sobre quiz no publicado cae a Mis quizzes', async () => {
    mocks.quizzes = [{ id: 'q-3', slug: 'pendiente', title: 'Pendiente', status: 'pending' }];
    mocks.profiles = [];

    const [resolved] = await resolveNotificationTargets(
      supabase,
      [row({ type: 'comment', data: { quiz_id: 'q-3' } })],
      'es'
    );

    expect(resolved.href).toBe('/es/my-quizzes');
  });

  it('tipo desconocido no rompe: sin quiz no enlaza, con quiz enlaza a la ficha', async () => {
    mocks.quizzes = [{ id: 'q-4', slug: 'x', title: 'X', status: 'published' }];
    mocks.profiles = [];

    const unknownType = 'comment_report' as NotificationType;
    const [noLink, withQuiz] = await resolveNotificationTargets(
      supabase,
      [
        row({ id: 'n-4', type: unknownType, data: {} }),
        row({ id: 'n-5', type: unknownType, data: { quiz_id: 'q-4' } }),
      ],
      'es'
    );

    expect(noLink.href).toBeNull();
    expect(withQuiz.href).toBe('/es/quiz/x');
  });

  it('datos ausentes o malformados devuelven la fila sin destino ni actor', async () => {
    mocks.quizzes = [];
    mocks.profiles = [];

    const [resolved] = await resolveNotificationTargets(
      supabase,
      [row({ type: 'comment', data: null })],
      'es'
    );

    expect(resolved.href).toBeNull();
    expect(resolved.actorName).toBeNull();
    expect(resolved.quizTitle).toBeNull();
  });
});
