import { describe, expect, it, vi } from 'vitest';

const { updateSpy } = vi.hoisted(() => ({ updateSpy: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'creator-1' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { creator_id: 'creator-1' }, error: null }),
        }),
      }),
      update: (payload: unknown) => {
        updateSpy(payload);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { updateQuiz } from '@/actions/quiz.actions';

describe('updateQuiz', () => {
  it('strips a client-sent status so it never reaches the update', async () => {
    const result = await updateQuiz('quiz-1', {
      title: 'A perfectly valid title',
      status: 'published',
    });

    expect(result.success).toBe(true);
    const payload = updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ title: 'A perfectly valid title' });
    expect(payload).not.toHaveProperty('status');
  });
});
