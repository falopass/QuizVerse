import { beforeEach, describe, expect, it, vi } from 'vitest';

const category = { id: 'culture', slug: 'culture', name: 'Culture' };
const rows: Array<{ quiz_type: string }> | null = [
  { quiz_type: 'trivia' },
  { quiz_type: 'personality' },
  { quiz_type: 'trivia' },
];
let fail = false;
const calls: string[] = [];

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) =>
      table === 'categories'
        ? { select: () => ({ order: async () => ({ data: [category], error: null }) }) }
        : {
            select: (cols: string) => {
              calls.push(cols);
              const query = {
                eq: () => query,
                then: (resolve: (value: unknown) => void) =>
                  resolve(
                    fail ? { data: null, error: { message: 'boom' } } : { data: rows, error: null }
                  ),
              };
              return query;
            },
          },
  }),
}));

import { getCategoryQuizTypes } from '@/lib/data/public';

describe('getCategoryQuizTypes', () => {
  beforeEach(() => {
    fail = false;
    calls.length = 0;
  });

  it('returns the distinct types of the whole hub', async () => {
    await expect(getCategoryQuizTypes('culture', 'en')).resolves.toEqual(['trivia', 'personality']);
    expect(calls).toContain('quiz_type');
  });

  it('returns an empty list on query failure', async () => {
    fail = true;
    await expect(getCategoryQuizTypes('culture', 'es')).resolves.toEqual([]);
  });

  it('returns an empty list for unknown slugs without querying', async () => {
    await expect(getCategoryQuizTypes('nope', 'en')).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });
});
