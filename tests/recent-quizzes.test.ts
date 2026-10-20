import { describe, expect, it } from 'vitest';
import {
  RECENT_LIMIT,
  STORAGE_KEY,
  readRecent,
  recordRecent,
  type RecentQuiz,
  type StorageLike,
} from '@/lib/history/recent-quizzes';

const entry = (slug: string, playedAt: string, extra: Partial<RecentQuiz> = {}): RecentQuiz => ({
  slug,
  title: `Quiz ${slug}`,
  quizType: 'trivia',
  locale: 'en',
  categoryName: null,
  coverImageUrl: null,
  minutes: 5,
  playedAt,
  ...extra,
});

function memoryStorage(initial?: Record<string, string>) {
  const data: Record<string, string> = { ...(initial ?? {}) };
  const storage: StorageLike & { data: Record<string, string> } = {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
  return storage;
}

describe('readRecent', () => {
  it('devuelve lista vacía sin nada guardado y sin storage', () => {
    expect(readRecent(memoryStorage())).toEqual([]);
    expect(readRecent(null)).toEqual([]);
  });

  it('ordena por playedAt descendente aunque el JSON venga desordenado', () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify([
        entry('viejo', '2026-10-10T10:00:00Z'),
        entry('nuevo', '2026-10-19T10:00:00Z'),
        entry('medio', '2026-10-15T10:00:00Z'),
      ]),
    });
    expect(readRecent(storage).map((item) => item.slug)).toEqual(['nuevo', 'medio', 'viejo']);
  });

  it('ignora JSON corrupto', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{no es json' });
    expect(readRecent(storage)).toEqual([]);
  });

  it('ignora valores que no son un array', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ slug: 'x' }) });
    expect(readRecent(storage)).toEqual([]);
  });

  it('descarta entradas sin slug o title y conserva las válidas', () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify([
        entry('valido', '2026-10-19T10:00:00Z'),
        { title: 'sin slug', playedAt: '2026-10-19T11:00:00Z' },
        { slug: 'sin-titulo', playedAt: '2026-10-19T12:00:00Z' },
        { ...entry('sin-locale', '2026-10-19T13:00:00Z'), locale: 'fr' },
        'basura',
        null,
      ]),
    });
    expect(readRecent(storage).map((item) => item.slug)).toEqual(['valido']);
  });

  it('recorta a RECENT_LIMIT entradas', () => {
    const many = Array.from({ length: RECENT_LIMIT + 3 }, (_, index) =>
      entry(`q${index}`, `2026-10-${String(10 + index).padStart(2, '0')}T10:00:00Z`)
    );
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(many) });
    const list = readRecent(storage);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0].slug).toBe(`q${RECENT_LIMIT + 2}`);
  });

  it('devuelve [] si getItem lanza', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
    };
    expect(readRecent(throwing)).toEqual([]);
  });
});

describe('recordRecent', () => {
  it('deduplica por slug: el repetido va al frente con playedAt y score nuevos', () => {
    const storage = memoryStorage();
    recordRecent(entry('a', '2026-10-10T10:00:00Z', { score: '3/10' }), storage);
    recordRecent(entry('b', '2026-10-11T10:00:00Z'), storage);
    const list = recordRecent(entry('a', '2026-10-12T10:00:00Z', { score: '9/10' }), storage);
    expect(list.map((item) => item.slug)).toEqual(['a', 'b']);
    expect(list[0].playedAt).toBe('2026-10-12T10:00:00Z');
    expect(list[0].score).toBe('9/10');
    expect(readRecent(storage)).toHaveLength(2);
  });

  it('respeta el tope de 6 y descarta el más antiguo', () => {
    const storage = memoryStorage();
    for (let index = 0; index < RECENT_LIMIT + 1; index += 1) {
      recordRecent(
        entry(`q${index}`, `2026-10-${String(10 + index).padStart(2, '0')}T10:00:00Z`),
        storage
      );
    }
    const list = readRecent(storage);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list.map((item) => item.slug)).not.toContain('q0');
    expect(list[0].slug).toBe(`q${RECENT_LIMIT}`);
  });

  it('devuelve la lista nueva aunque setItem lance', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const list = recordRecent(entry('a', '2026-10-19T10:00:00Z'), storage);
    expect(list.map((item) => item.slug)).toEqual(['a']);
  });

  it('no rompe si getItem lanza al leer el historial previo', () => {
    let writes = 0;
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        writes += 1;
      },
    };
    const list = recordRecent(entry('a', '2026-10-19T10:00:00Z'), storage);
    expect(list.map((item) => item.slug)).toEqual(['a']);
    expect(writes).toBe(1);
  });

  it('descarta una entrada inválida sin perder el historial', () => {
    const storage = memoryStorage();
    recordRecent(entry('a', '2026-10-19T10:00:00Z'), storage);
    const invalid = { ...entry('b', '2026-10-20T10:00:00Z'), slug: '' } as RecentQuiz;
    const list = recordRecent(invalid, storage);
    expect(list.map((item) => item.slug)).toEqual(['a']);
    expect(readRecent(storage)).toHaveLength(1);
  });
});
