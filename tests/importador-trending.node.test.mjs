// Runs under `node --test`. Verifica el contrato del importador legado:
// - dry-run de solo lectura (cero escrituras en DB y disco)
// - rechazo explícito del tipo `poll`
// - altas insert-only: dos ejecuciones sobre el mismo destino preservan
//   métricas, fechas, referencias (id) y contenido de los quizzes existentes
// - recuento paginado completo en `syncCategoryCounts` más allá de una página

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  importTrendingSeed,
  syncCategoryCounts,
  validateQuiz,
} from '../scripts/import-trending-seed-to-supabase.mjs';

function makeTriviaQuiz(overrides = {}) {
  return {
    slug: 'es-trivia-historia-antigua',
    title: 'Historia antigua: 8 preguntas clave',
    description: 'Pon a prueba cuánto recuerdas del mundo antiguo.',
    language: 'es',
    quiz_type: 'trivia',
    category_slug: 'history',
    difficulty: 'medium',
    estimated_minutes: 3,
    tags: ['historia', 'antigüedad'],
    questions: [
      {
        id: 'q1',
        question: '¿Dónde nació la democracia clásica?',
        options: [
          { id: 'a', text: 'Atenas', is_correct: true },
          { id: 'b', text: 'Esparta', is_correct: false },
        ],
      },
      {
        id: 'q2',
        question: '¿Qué río marcó al Antiguo Egipto?',
        options: [
          { id: 'a', text: 'Nilo', is_correct: true },
          { id: 'b', text: 'Tigris', is_correct: false },
        ],
      },
      {
        id: 'q3',
        question: '¿En qué península surgió Roma?',
        options: [
          { id: 'a', text: 'Itálica', is_correct: true },
          { id: 'b', text: 'Ibérica', is_correct: false },
        ],
      },
    ],
    ...overrides,
  };
}

function makePersonalityQuiz(overrides = {}) {
  return {
    slug: 'en-personality-creative-archetype',
    title: 'Creative Archetype: Find Your Studio Role',
    description: 'Three quick questions to map your creative rhythm.',
    language: 'en',
    quiz_type: 'personality',
    category_slug: 'culture',
    questions: [
      {
        id: 'q1',
        question: 'How do you start a project?',
        options: [
          { id: 'a', text: 'Sketch first', personality_tags: ['maker'] },
          { id: 'b', text: 'Outline first', personality_tags: ['planner'] },
        ],
      },
      {
        id: 'q2',
        question: 'What unlocks a block?',
        options: [
          { id: 'a', text: 'A prototype', personality_tags: ['maker'] },
          { id: 'b', text: 'A checklist', personality_tags: ['planner'] },
        ],
      },
      {
        id: 'q3',
        question: 'How do you finish?',
        options: [
          { id: 'a', text: 'Ship and iterate', personality_tags: ['maker'] },
          { id: 'b', text: 'Polish every detail', personality_tags: ['planner'] },
        ],
      },
    ],
    results: [
      { id: 'r1', title: 'The Maker', description: 'Hands-on momentum.' },
      { id: 'r2', title: 'The Planner', description: 'Structured clarity.' },
    ],
    ...overrides,
  };
}

/**
 * Destino Supabase en memoria que registra todas las escrituras y simula
 * PostgREST (`select`, `in`, `eq`, `order`, `range`, `upsert`, `update`).
 */
function createMemorySupabase({ initialCategories = [], initialQuizzes = [] } = {}) {
  const categories = new Map(initialCategories.map((c) => [c.slug, { ...c }]));
  const quizzes = new Map(initialQuizzes.map((q) => [q.slug, { ...q }]));
  const writes = [];
  let nextCatId = initialCategories.length + 1;
  let nextQuizId = initialQuizzes.length + 1;

  const supabase = {
    categories,
    quizzes,
    writes,
    from(table) {
      const state = {
        table,
        filters: [],
        inFilter: null,
        orderCol: null,
        orderAsc: true,
        upsertData: null,
        updateData: null,
      };

      const runSelect = () => {
        const source = table === 'categories' ? [...categories.values()] : [...quizzes.values()];
        let rows = source.filter((row) => state.filters.every(([col, val]) => row[col] === val));
        if (state.inFilter) {
          const [col, values] = state.inFilter;
          const set = new Set(values);
          rows = rows.filter((row) => set.has(row[col]));
        }
        if (state.orderCol) {
          const col = state.orderCol;
          const dir = state.orderAsc ? 1 : -1;
          rows.sort((a, b) => (a[col] < b[col] ? -1 * dir : a[col] > b[col] ? 1 * dir : 0));
        }
        return rows;
      };

      const builder = {
        select() {
          if (state.upsertData) {
            return Promise.resolve({ data: state.upsertData, error: null });
          }
          return builder;
        },
        in(col, values) {
          state.inFilter = [col, values];
          return Promise.resolve({ data: runSelect(), error: null });
        },
        eq(col, val) {
          state.filters.push([col, val]);
          if (state.updateData) {
            writes.push({
              op: 'update',
              table,
              filters: [...state.filters],
              data: state.updateData,
            });
            const targetRows =
              table === 'categories' ? [...categories.values()] : [...quizzes.values()];
            for (const row of targetRows) {
              if (state.filters.every(([c, v]) => row[c] === v)) {
                Object.assign(row, state.updateData);
              }
            }
            return Promise.resolve({ data: null, error: null });
          }
          return builder;
        },
        order(col, { ascending = true } = {}) {
          state.orderCol = col;
          state.orderAsc = ascending;
          return builder;
        },
        range(from, to) {
          const rows = runSelect().slice(from, to + 1);
          return Promise.resolve({ data: rows, error: null });
        },
        upsert(payload, options = {}) {
          const items = Array.isArray(payload) ? payload : [payload];
          writes.push({ op: 'upsert', table, count: items.length, options });
          const inserted = [];
          if (table === 'categories') {
            for (const item of items) {
              const existing = categories.get(item.slug);
              if (existing) {
                if (!options.ignoreDuplicates) {
                  Object.assign(existing, item);
                }
                inserted.push(existing);
              } else {
                const created = {
                  id: `cat-${nextCatId++}`,
                  quiz_count: 0,
                  ...item,
                };
                categories.set(created.slug, created);
                inserted.push(created);
              }
            }
          } else if (table === 'quizzes') {
            for (const item of items) {
              const existing = quizzes.get(item.slug);
              if (existing) {
                if (!options.ignoreDuplicates) {
                  Object.assign(existing, item);
                }
                inserted.push(existing);
              } else {
                const created = {
                  id: `quiz-${String(nextQuizId++).padStart(4, '0')}`,
                  ...item,
                };
                quizzes.set(created.slug, created);
                inserted.push(created);
              }
            }
          }
          state.upsertData = inserted;
          return {
            select() {
              return Promise.resolve({ data: inserted, error: null });
            },
            then(resolve) {
              return Promise.resolve({ data: inserted, error: null }).then(resolve);
            },
          };
        },
        update(data) {
          state.updateData = data;
          return builder;
        },
        then(resolve) {
          return Promise.resolve({ data: runSelect(), error: null }).then(resolve);
        },
      };

      return builder;
    },
  };

  return supabase;
}

describe('import-trending-seed-to-supabase (A-15)', () => {
  it('rechaza el tipo poll y conserva trivia y personality', () => {
    const pollQuiz = makeTriviaQuiz({
      slug: 'es-poll-encuesta',
      quiz_type: 'poll',
    });
    const issues = validateQuiz(pollQuiz);
    assert.ok(
      issues.some((issue) => issue.includes('invalid type poll')),
      `Se esperaba rechazo de poll, recibido: ${issues.join(', ')}`
    );
    assert.deepEqual(validateQuiz(makeTriviaQuiz()), []);
    assert.deepEqual(validateQuiz(makePersonalityQuiz()), []);
  });

  it('dry-run solo lee y produce cero escrituras en DB incluso con categorías nuevas', async () => {
    const db = createMemorySupabase({
      initialCategories: [{ id: 'cat-history', slug: 'history', name: 'History', quiz_count: 0 }],
    });

    const summary = await importTrendingSeed({
      supabase: db,
      dryRun: true,
      quizzes: [
        makeTriviaQuiz(),
        makePersonalityQuiz({ category_slug: 'new-category-on-dry-run' }),
        makeTriviaQuiz({ slug: 'es-poll-descartado', quiz_type: 'poll' }),
      ],
    });

    assert.equal(summary.dryRun, true);
    assert.equal(summary.imported, 2);
    assert.equal(summary.skipped, 1);
    assert.equal(db.writes.length, 0, 'dry-run no debe ejecutar ningún upsert ni update');
    assert.equal(db.categories.has('new-category-on-dry-run'), false);
    assert.equal(db.quizzes.size, 0);
  });

  it('dos ejecuciones en destino de prueba son insert-only y preservan métricas, fechas y referencias', async () => {
    const db = createMemorySupabase({
      initialCategories: [{ id: 'cat-history', slug: 'history', name: 'History', quiz_count: 0 }],
    });

    const firstQuiz = makeTriviaQuiz({
      slug: 'es-trivia-historia-antigua',
      title: 'Historia antigua: versión original',
      plays_count: 0,
      likes_count: 0,
      shares_count: 0,
      published_at: '2026-03-01T10:00:00.000Z',
      created_at: '2026-03-01T10:00:00.000Z',
    });

    // 1.ª ejecución: inserta el primer quiz y crea la categoría faltante `culture`.
    const run1 = await importTrendingSeed({
      supabase: db,
      dryRun: false,
      quizzes: [firstQuiz],
    });

    assert.equal(run1.imported, 1);
    assert.equal(run1.preservedExisting, 0);
    assert.equal(db.quizzes.size, 1);

    // Simulamos actividad real en producción sobre el registro ya publicado:
    // acumula partidas, likes, shares y mantiene su id referenciado por game_sessions.
    const storedBeforeRerun = db.quizzes.get('es-trivia-historia-antigua');
    assert.ok(storedBeforeRerun);
    const originalId = storedBeforeRerun.id;
    storedBeforeRerun.plays_count = 480;
    storedBeforeRerun.likes_count = 39;
    storedBeforeRerun.shares_count = 17;
    storedBeforeRerun.avg_score = 81.5;

    // 2.ª ejecución: re-ejecuta con el mismo slug (con título y contadores a 0 en el seed)
    // más un segundo quiz nuevo y un quiz `poll` que debe rechazarse.
    const modifiedSeedForFirst = makeTriviaQuiz({
      slug: 'es-trivia-historia-antigua',
      title: 'Título que NO debe pisar al publicado',
      plays_count: 0,
      likes_count: 0,
      shares_count: 0,
      published_at: '2026-11-23T00:00:00.000Z',
    });
    const secondQuiz = makePersonalityQuiz();
    const invalidPoll = makeTriviaQuiz({ slug: 'en-poll-invalid', quiz_type: 'poll' });

    const run2 = await importTrendingSeed({
      supabase: db,
      dryRun: false,
      quizzes: [modifiedSeedForFirst, secondQuiz, invalidPoll],
    });

    assert.equal(run2.imported, 1, 'solo debe insertar el quiz nuevo');
    assert.equal(run2.preservedExisting, 1, 'debe detectar y preservar el quiz ya existente');
    assert.equal(run2.skipped, 1, 'debe rechazar el quiz poll');
    assert.equal(db.quizzes.size, 2);

    const storedAfterRerun = db.quizzes.get('es-trivia-historia-antigua');
    assert.equal(storedAfterRerun.id, originalId);
    assert.equal(storedAfterRerun.title, 'Historia antigua: versión original');
    assert.equal(storedAfterRerun.plays_count, 480);
    assert.equal(storedAfterRerun.likes_count, 39);
    assert.equal(storedAfterRerun.shares_count, 17);
    assert.equal(storedAfterRerun.avg_score, 81.5);
    assert.equal(storedAfterRerun.published_at, '2026-03-01T10:00:00.000Z');
    assert.equal(storedAfterRerun.created_at, '2026-03-01T10:00:00.000Z');

    assert.equal(db.categories.get('history').quiz_count, 1);
    assert.equal(db.categories.get('culture').quiz_count, 1);
  });

  it('syncCategoryCounts pagina con orden estable y cuenta el catálogo completo en múltiples páginas', async () => {
    const initialQuizzes = Array.from({ length: 125 }, (_, i) => ({
      id: `quiz-${String(i + 1).padStart(4, '0')}`,
      slug: `es-quiz-${i + 1}`,
      category_id: i % 2 === 0 ? 'cat-1' : 'cat-2',
      status: i < 120 ? 'published' : 'draft',
    }));

    const db = createMemorySupabase({
      initialCategories: [
        { id: 'cat-1', slug: 'history', name: 'History', quiz_count: 0 },
        { id: 'cat-2', slug: 'science', name: 'Science', quiz_count: 0 },
      ],
      initialQuizzes,
    });

    // Forzamos páginas pequeñas (pageSize: 30) para comprobar 5 páginas consecutivas.
    await syncCategoryCounts({ supabase: db, pageSize: 30 });

    assert.equal(db.categories.get('history').quiz_count, 60);
    assert.equal(db.categories.get('science').quiz_count, 60);
  });
});
