import { describe, expect, it } from 'vitest';

import {
  buildDailySeries,
  buildTraffic,
  groupCounts,
  loadAdminStats,
  shareOf,
  STATS_WINDOW_DAYS,
  TOP_QUIZ_LIMIT,
  topQuizzes,
  trafficWindow,
  utcWindowStart,
  type AnalyticsEventLite,
} from '@/lib/admin/stats';

const NOW = new Date('2026-11-04T15:30:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

type Call = { method: string; args: unknown[] };
type DbResult = { data?: unknown; count?: number | null; error?: unknown };

interface QuerySpec {
  table: string;
  when: (calls: Call[]) => boolean;
  queue: DbResult[];
}

const sel = (calls: Call[]) =>
  calls.find((call) => call.method === 'select')?.args[0] as string | undefined;

const selectOptions = (calls: Call[]) =>
  calls.find((call) => call.method === 'select')?.args[1] as
    | { count?: string; head?: boolean }
    | undefined;

const hasCall = (calls: Call[], method: string) => calls.some((call) => call.method === method);

const argOf = (calls: Call[], method: string) => calls.find((call) => call.method === method)?.args;

/** Builder thenable mínimo que registra la cadena y resuelve desde las specs. */
function makeClient(specs: QuerySpec[]) {
  const allCalls: { table: string; calls: Call[] }[] = [];
  const resolveQuery = (table: string, calls: Call[]): DbResult => {
    const spec = specs.find(
      (candidate) =>
        candidate.table === table && candidate.when(calls) && candidate.queue.length > 0
    );
    if (!spec) throw new Error(`consulta sin mock: ${table} ${sel(calls)}`);
    const result = spec.queue.shift()!;
    return { data: null, error: null, ...result };
  };
  const client = {
    from: (table: string) => {
      const calls: Call[] = [];
      allCalls.push({ table, calls });
      const builder: Record<string, unknown> = {
        then: (resolve: (v: DbResult) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve()
            .then(() => resolveQuery(table, calls))
            .then(resolve, reject),
      };
      for (const method of ['select', 'eq', 'gte', 'not', 'in', 'is', 'order', 'limit', 'range']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      return builder;
    },
  };
  return { client, allCalls };
}

const ok = (data: unknown): DbResult => ({ data });
const count = (n: number): DbResult => ({ count: n, data: null });

const QUIZ_ROW = {
  title: 'Trivia de cine',
  slug: 'es-trivia-de-cine',
  language: 'es',
  value: 42,
};

/** Specs estándar: catálogo de 2 quizzes, 3 partidas, conteos pequeños. */
function baseSpecs(): QuerySpec[] {
  return [
    {
      table: 'quizzes',
      when: (c) => sel(c) === 'language, quiz_type, category_id',
      queue: [
        ok([
          { language: 'es', quiz_type: 'trivia', category_id: 'cat-1' },
          { language: 'en', quiz_type: 'poll', category_id: null },
        ]),
      ],
    },
    {
      table: 'categories',
      when: (c) => sel(c) === 'id, name',
      queue: [ok([{ id: 'cat-1', name: 'Cine' }])],
    },
    {
      table: 'game_sessions',
      when: (c) => sel(c) === 'completed_at, player_id',
      queue: [
        ok([
          { completed_at: '2026-11-04T01:00:00Z', player_id: 'u-secret-1' },
          { completed_at: '2026-11-02T10:00:00Z', player_id: null },
          { completed_at: '2026-11-02T11:00:00Z', player_id: 'u-secret-2' },
        ]),
      ],
    },
    {
      table: 'game_sessions',
      when: (c) => selectOptions(c)?.head === true && hasCall(c, 'not'),
      queue: [count(40)],
    },
    {
      table: 'game_sessions',
      when: (c) => selectOptions(c)?.head === true && !hasCall(c, 'not'),
      queue: [count(100)],
    },
    {
      table: 'quizzes',
      when: (c) => sel(c) === 'title, slug, language, value:plays_count',
      queue: [ok([QUIZ_ROW])],
    },
    {
      table: 'quizzes',
      when: (c) => sel(c) === 'title, slug, language, value:shares_count',
      queue: [ok([QUIZ_ROW])],
    },
    {
      table: 'quizzes',
      when: (c) => sel(c) === 'title, slug, language, value:likes_count',
      queue: [ok([QUIZ_ROW])],
    },
    {
      table: 'profiles',
      when: (c) => !hasCall(c, 'gte'),
      queue: [count(500)],
    },
    {
      table: 'profiles',
      when: (c) =>
        hasCall(c, 'gte') &&
        String(argOf(c, 'gte')?.[1] ?? '') > new Date(NOW.getTime() - 8 * DAY_MS).toISOString(),
      queue: [count(12)],
    },
    {
      table: 'profiles',
      when: (c) => hasCall(c, 'gte'),
      queue: [count(50)],
    },
    { table: 'quiz_comments', when: () => true, queue: [count(33)] },
    { table: 'quiz_reports', when: () => true, queue: [count(7)] },
    { table: 'comment_reports', when: () => true, queue: [count(2)] },
    { table: 'analytics_events', when: () => true, queue: [ok(EVENT_ROWS)] },
  ];
}

// Ventana: NOW = 2026-11-04; el corte de 7 días es 2026-10-29 00:00 UTC.
const EVENT_ROWS: AnalyticsEventLite[] = [
  { name: 'share_click', source: 'whatsapp', created_at: '2026-11-03T10:00:00Z' },
  { name: 'share_click', source: 'whatsapp', created_at: '2026-11-03T11:00:00Z' },
  { name: 'share_click', source: 'copy', created_at: '2026-10-20T12:00:00Z' },
  { name: 'invite_landing', source: 'via:whatsapp', created_at: '2026-11-03T13:00:00Z' },
  { name: 'invite_landing', source: 'invite:challenge', created_at: '2026-10-20T13:00:00Z' },
  { name: 'invite_landing', source: 'invite:g', created_at: '2026-10-10T13:00:00Z' },
  { name: 'quiz_start', source: null, created_at: '2026-11-03T14:00:00Z' },
  { name: 'quiz_complete', source: 'via:whatsapp', created_at: '2026-11-03T15:00:00Z' },
  { name: 'quiz_complete', source: null, created_at: '2026-10-15T15:00:00Z' },
  { name: 'page_view', source: null, created_at: '2026-11-03T16:00:00Z' },
];

const load = (specs: QuerySpec[]) => loadAdminStats(makeClient(specs).client as never, NOW);

describe('buildDailySeries', () => {
  it('rellena los huecos a 0 y ordena ascendente', () => {
    const series = buildDailySeries([], STATS_WINDOW_DAYS, NOW);

    expect(series).toHaveLength(30);
    expect(series[0].date).toBe('2026-10-06');
    expect(series.at(-1)?.date).toBe('2026-11-04');
    expect(series.every((day) => day.total === 0)).toBe(true);
  });

  it('agrupa por día UTC y separa registradas de anónimas', () => {
    const series = buildDailySeries(
      [
        { completed_at: '2026-11-04T01:00:00Z', player_id: 'u1' },
        { completed_at: '2026-11-04T23:59:59Z', player_id: null },
        { completed_at: '2026-11-03T12:00:00Z', player_id: 'u2' },
        { completed_at: 'fecha-rota', player_id: 'u3' }, // inválida: se ignora
      ],
      30,
      NOW
    );

    expect(series.at(-1)).toMatchObject({
      date: '2026-11-04',
      total: 2,
      registered: 1,
      anonymous: 1,
    });
    expect(series.at(-2)).toMatchObject({ date: '2026-11-03', total: 1, registered: 1 });
    expect(series.at(-3)?.total).toBe(0);
  });

  it('ignora sesiones fuera de la ventana', () => {
    const series = buildDailySeries(
      [{ completed_at: '2026-01-01T00:00:00Z', player_id: 'u1' }],
      30,
      NOW
    );
    expect(series.every((day) => day.total === 0)).toBe(true);
  });
});

describe('groupCounts', () => {
  it('ordena de mayor a menor y null (sin categoría) al final', () => {
    const groups = groupCounts(['b', 'a', 'b', null, 'a', 'b']);

    expect(groups.map((g) => [g.key, g.count])).toEqual([
      ['b', 3],
      ['a', 2],
      [null, 1],
    ]);
    expect(groups[0].share).toBeCloseTo(0.5);
    expect(groups.reduce((sum, g) => sum + g.share, 0)).toBeCloseTo(1);
  });

  it('devuelve [] y share 0 sin filas', () => {
    expect(groupCounts([])).toEqual([]);
    expect(shareOf(3, 0)).toBe(0);
  });
});

describe('topQuizzes', () => {
  it('ordena por valor descendente, desempata por título y recorta al límite', () => {
    const rows = Array.from({ length: TOP_QUIZ_LIMIT + 5 }, (_, i) => ({
      title: `Quiz ${String(i).padStart(2, '0')}`,
      slug: `s-${i}`,
      language: 'es',
      value: i === 3 ? 100 : i,
    }));

    const top = topQuizzes(rows);
    expect(top).toHaveLength(TOP_QUIZ_LIMIT);
    expect(top[0].value).toBe(100);
    expect(top[1].value).toBe(TOP_QUIZ_LIMIT + 4);
    expect(top.every((quiz, i) => i === 0 || top[i - 1].value >= quiz.value)).toBe(true);
  });
});

describe('utcWindowStart', () => {
  it('devuelve el primer día de la ventana a las 00:00 UTC', () => {
    expect(utcWindowStart(NOW, 30).toISOString()).toBe('2026-10-06T00:00:00.000Z');
  });
});

describe('loadAdminStats', () => {
  it('agrega catálogo, partidas, tops y cuentas sin PII en el payload', async () => {
    const stats = await load(baseSpecs());

    expect(stats.catalog.published).toBe(2);
    expect(stats.catalog.byLanguage).toEqual([
      { key: 'en', count: 1, share: 0.5 },
      { key: 'es', count: 1, share: 0.5 },
    ]);
    expect(stats.catalog.byCategory.map((g) => [g.key, g.count])).toEqual([
      ['Cine', 1],
      [null, 1],
    ]);
    expect(stats.sessions.windowTotal).toBe(3);
    expect(stats.sessions.windowRegistered).toBe(2);
    expect(stats.sessions.windowAnonymous).toBe(1);
    expect(stats.sessions.allTimeTotal).toBe(100);
    expect(stats.sessions.allTimeAnonymous).toBe(60);
    expect(stats.accounts).toEqual({ profilesTotal: 500, profilesNew7d: 12, profilesNew30d: 50 });
    expect(stats.community).toEqual({
      commentsTotal: 33,
      pendingQuizReports: 7,
      pendingCommentReports: 2,
    });
    expect(stats.top.byPlays[0]).toMatchObject({ slug: 'es-trivia-de-cine', value: 42 });

    // Origen de visitas: ventanas de 7 y 30 días sobre analytics_events.
    expect(stats.traffic.available).toBe(true);
    expect(stats.traffic.days7.quizStarts).toBe(1);
    expect(stats.traffic.days7.arrivals.map((g) => [g.key, g.count])).toEqual([
      ['via:whatsapp', 1],
    ]);
    expect(stats.traffic.days30.shareClicks.map((g) => [g.key, g.count])).toEqual([
      ['whatsapp', 2],
      ['copy', 1],
    ]);
    expect(stats.traffic.days30.arrivals.map((g) => [g.key, g.count])).toEqual([
      ['invite:challenge', 1],
      ['invite:g', 1],
      ['via:whatsapp', 1],
    ]);
    expect(stats.traffic.days30.quizCompletes).toBe(2);
    // 1 partida completada con origen compartido ÷ 3 llegadas.
    expect(stats.traffic.days30.arrivalCompletionShare).toBeCloseTo(1 / 3);

    // Nada de ids de jugador ni correos en lo que sale hacia la página.
    const payload = JSON.stringify(stats);
    expect(payload).not.toContain('u-secret');
    expect(payload).not.toMatch(/@|player_id|username|display_name|email/);
  });

  it('usa límites explícitos y no pide columnas con PII', async () => {
    const specs = baseSpecs();
    const { client, allCalls } = makeClient(specs);
    await loadAdminStats(client as never, NOW);

    for (const { calls } of allCalls) {
      const select = String(sel(calls) ?? '');
      expect(select).not.toMatch(/username|display_name|email|body|reporter_id|\*/);
    }

    // Tops acotados a 20 y agregaciones con count exacto sin filas.
    const topCalls = allCalls.filter(({ calls }) =>
      String(sel(calls) ?? '').startsWith('title, slug')
    );
    expect(topCalls).toHaveLength(3);
    for (const { calls } of topCalls) {
      expect(calls).toContainEqual({ method: 'limit', args: [TOP_QUIZ_LIMIT] });
      expect(calls).toContainEqual({ method: 'eq', args: ['status', 'published'] });
      // Desempates deterministas: sin ellos el LIMIT corta empates al azar.
      expect(calls).toContainEqual({
        method: 'order',
        args: ['title', { ascending: true }],
      });
      expect(calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
    }
    const headCounts = allCalls.filter(({ calls }) => selectOptions(calls)?.head === true);
    expect(headCounts.length).toBe(8);
    // La ventana de sesiones filtra por completed_at en la query, no en memoria.
    const windowCalls = allCalls.find(({ calls }) => sel(calls) === 'completed_at, player_id');
    const gte = windowCalls?.calls.find((call) => call.method === 'gte');
    expect(gte?.args).toEqual(['completed_at', '2026-10-06T00:00:00.000Z']);
  });

  it('la consulta de eventos filtra nombres y ordena recientes primero', async () => {
    const specs = baseSpecs();
    const { client, allCalls } = makeClient(specs);
    await loadAdminStats(client as never, NOW);

    const events = allCalls.find(
      ({ table, calls }) =>
        table === 'analytics_events' && sel(calls) === 'name, source, created_at'
    );
    expect(events).toBeDefined();
    // Solo los nombres agregados y la ventana de 30 días: sin ello page_view
    // inflaría el recorrido hasta el cap.
    expect(events!.calls).toContainEqual({
      method: 'in',
      args: ['name', ['share_click', 'invite_landing', 'quiz_start', 'quiz_complete']],
    });
    expect(events!.calls).toContainEqual({
      method: 'gte',
      args: ['created_at', '2026-10-06T00:00:00.000Z'],
    });
    // Recientes primero con desempate estable: el cap se lleva los más viejos.
    expect(events!.calls).toContainEqual({
      method: 'order',
      args: ['created_at', { ascending: false }],
    });
    expect(events!.calls).toContainEqual({
      method: 'order',
      args: ['id', { ascending: false }],
    });
    expect(events!.calls).toContainEqual({ method: 'range', args: [0, 999] });
  });

  it('pagina el catálogo mientras vengan páginas llenas', async () => {
    const specs = baseSpecs();
    const catalog = specs.find((s) => s.table === 'quizzes')!;
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({
      language: 'es',
      quiz_type: 'trivia',
      category_id: i % 2 ? 'cat-1' : null,
    }));
    catalog.queue = [ok(fullPage), ok([{ language: 'en', quiz_type: 'poll', category_id: null }])];

    const { client, allCalls } = makeClient(specs);
    const stats = await loadAdminStats(client as never, NOW);

    expect(stats.catalog.published).toBe(1001);
    const ranges = allCalls
      .filter(({ calls }) => sel(calls) === 'language, quiz_type, category_id')
      .flatMap(({ calls }) => calls.filter((call) => call.method === 'range'));
    expect(ranges).toEqual([
      { method: 'range', args: [0, 999] },
      { method: 'range', args: [1000, 1999] },
    ]);
  });

  it('tolera comment_reports sin migración 017 (null, no rompe)', async () => {
    const specs = baseSpecs();
    specs.find((s) => s.table === 'comment_reports')!.queue = [
      { error: { code: 'PGRST205', message: 'Could not find the table' } },
    ];

    const stats = await load(specs);
    expect(stats.community.pendingCommentReports).toBeNull();
    expect(stats.community.pendingQuizReports).toBe(7);
  });

  it('propaga errores reales de las consultas', async () => {
    const specs = baseSpecs();
    specs.find((s) => s.table === 'quiz_reports')!.queue = [
      { error: { code: '42501', message: 'permission denied' } },
    ];

    await expect(load(specs)).rejects.toMatchObject({ code: '42501' });
  });

  it('un error en comment_reports que no sea "tabla ausente" también propaga', async () => {
    const specs = baseSpecs();
    specs.find((s) => s.table === 'comment_reports')!.queue = [
      { error: { code: '42501', message: 'permission denied' } },
    ];

    await expect(load(specs)).rejects.toMatchObject({ code: '42501' });
  });

  it('tolera analytics_events sin migración 022 (available: false, el resto carga)', async () => {
    const specs = baseSpecs();
    specs.find((s) => s.table === 'analytics_events')!.queue = [
      { error: { code: 'PGRST205', message: 'Could not find the table' } },
    ];

    const stats = await load(specs);
    expect(stats.traffic.available).toBe(false);
    expect(stats.traffic.days30.quizStarts).toBe(0);
    expect(stats.catalog.published).toBe(2);
  });

  it('un error real de analytics_events propaga como el resto', async () => {
    const specs = baseSpecs();
    specs.find((s) => s.table === 'analytics_events')!.queue = [
      { error: { code: '42501', message: 'permission denied' } },
    ];

    await expect(load(specs)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('trafficWindow', () => {
  it('agrupa clics y llegadas por canal y calcula la conversión', () => {
    const window = trafficWindow(EVENT_ROWS);

    expect(window.shareClicks.map((g) => [g.key, g.count])).toEqual([
      ['whatsapp', 2],
      ['copy', 1],
    ]);
    expect(window.arrivals.map((g) => [g.key, g.count])).toEqual([
      ['invite:challenge', 1],
      ['invite:g', 1],
      ['via:whatsapp', 1],
    ]);
    expect(window.quizStarts).toBe(1);
    expect(window.quizCompletes).toBe(2);
    expect(window.arrivalCompletionShare).toBeCloseTo(1 / 3);
  });

  it('sin llegadas la conversión es 0', () => {
    const window = trafficWindow([
      { name: 'quiz_complete', source: 'via:whatsapp', created_at: '2026-11-03T15:00:00Z' },
    ]);
    expect(window.arrivalCompletionShare).toBe(0);
  });
});

describe('buildTraffic', () => {
  it('marca no disponible cuando la tabla no existe', () => {
    const traffic = buildTraffic(null, NOW);
    expect(traffic.available).toBe(false);
    expect(traffic.days7.arrivals).toEqual([]);
  });

  it('la ventana de 7 días solo incluye eventos desde 2026-10-29 UTC', () => {
    const traffic = buildTraffic({ rows: EVENT_ROWS, truncated: false }, NOW);
    expect(traffic.available).toBe(true);
    // En 7 días: 2 clics whatsapp, 1 llegada via:whatsapp, 1 start, 1 completa.
    expect(traffic.days7.shareClicks.map((g) => [g.key, g.count])).toEqual([['whatsapp', 2]]);
    expect(traffic.days7.arrivals.map((g) => [g.key, g.count])).toEqual([['via:whatsapp', 1]]);
    expect(traffic.days7.quizStarts).toBe(1);
    expect(traffic.days7.quizCompletes).toBe(1);
    expect(traffic.days30.arrivals).toHaveLength(3);
    expect(traffic.truncated).toBe(false);
  });
});
