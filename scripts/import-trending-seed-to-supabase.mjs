import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

export const ALLOWED_QUIZ_TYPES = ['trivia', 'personality'];
export const ALLOWED_LANGUAGES = ['en', 'es'];
const COUNT_PAGE_SIZE = 500;

export const CATEGORY_PRESETS = {
  culture: {
    name: 'Culture',
    description: 'Cinema, music, internet, books and modern shared references.',
    icon: 'C',
    color: '#7c3aed',
    gradient_from: '#7c3aed',
    gradient_to: '#b16eff',
    sort_order: 3,
  },
  personality: {
    name: 'Personality',
    description: 'Quizzes about instincts, identity and self-discovery.',
    icon: 'P',
    color: '#d87834',
    gradient_from: '#d87834',
    gradient_to: '#7d5f4f',
    sort_order: 1,
  },
  trivia: {
    name: 'Trivia',
    description: 'Fast knowledge rounds with polished pacing and clean reveals.',
    icon: 'T',
    color: '#1f6feb',
    gradient_from: '#1f6feb',
    gradient_to: '#37b4ff',
    sort_order: 2,
  },
  lifestyle: {
    name: 'Lifestyle',
    description: 'Coffee, routines, travel, work style and everyday rituals.',
    icon: 'L',
    color: '#0f9d58',
    gradient_from: '#0f9d58',
    gradient_to: '#7cd992',
    sort_order: 4,
  },
};

export function maybeDecodeMojibake(value) {
  if (typeof value !== 'string') return value;
  if (!/[ÃÂâ€™â€œâ€]/.test(value)) return value;

  try {
    const decoded = Buffer.from(value, 'latin1').toString('utf8');
    if (decoded.includes('\uFFFD')) {
      return value;
    }
    return decoded;
  } catch {
    return value;
  }
}

export function normalizeStringsDeep(value) {
  if (typeof value === 'string') {
    let current = value;
    for (let index = 0; index < 3; index += 1) {
      const next = maybeDecodeMojibake(current);
      if (next === current) break;
      current = next;
    }
    return current;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeStringsDeep);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [key, normalizeStringsDeep(innerValue)])
    );
  }

  return value;
}

export function slugToTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function validateQuiz(quiz) {
  const issues = [];

  if (!quiz || typeof quiz !== 'object') {
    return ['invalid quiz object'];
  }
  if (!quiz.slug || typeof quiz.slug !== 'string') issues.push('missing slug');
  if (!quiz.title || typeof quiz.title !== 'string') issues.push('missing title');
  if (!ALLOWED_LANGUAGES.includes(quiz.language)) issues.push(`invalid language ${quiz.language}`);
  if (!ALLOWED_QUIZ_TYPES.includes(quiz.quiz_type)) issues.push(`invalid type ${quiz.quiz_type}`);
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 3)
    issues.push('not enough questions');
  if (!quiz.category_slug || typeof quiz.category_slug !== 'string')
    issues.push('missing category_slug');

  if (quiz.quiz_type === 'trivia' && Array.isArray(quiz.questions)) {
    const triviaIssues = quiz.questions.some((question) => {
      if (!Array.isArray(question?.options) || question.options.length < 2) return true;
      const correctCount = question.options.filter((option) => option?.is_correct === true).length;
      return correctCount !== 1;
    });

    if (triviaIssues) issues.push('trivia questions require exactly one correct option');
  }

  if (quiz.quiz_type === 'personality') {
    const hasResults = Array.isArray(quiz.results) && quiz.results.length >= 2;
    if (!hasResults) issues.push('personality quiz missing results');
  }

  return issues;
}

export function loadTitleOverrides(rootDir = process.cwd()) {
  const map = new Map();
  const titleOverridesPath = path.join(rootDir, 'scripts', 'seed', 'quiz-title-overrides.json');
  if (fs.existsSync(titleOverridesPath)) {
    const { quizzes: overrides } = JSON.parse(fs.readFileSync(titleOverridesPath, 'utf8'));
    for (const entry of overrides ?? []) {
      if (typeof entry?.slug === 'string' && typeof entry?.title === 'string' && entry.title) {
        map.set(entry.slug, entry.title);
      }
    }
  }
  return map;
}

/**
 * Lee las categorías existentes y, solo cuando `dryRun === false`, inserta las
 * que falten con `ignoreDuplicates: true` (insert-only, sin pisar categorías
 * previas). En `dryRun === true` no realiza ninguna escritura.
 */
export async function ensureCategories(categorySlugs, { supabase, dryRun = false } = {}) {
  const uniqueSlugs = [...new Set(categorySlugs.filter(Boolean))];
  if (uniqueSlugs.length === 0) return new Map();

  const { data: existing, error: fetchError } = await supabase
    .from('categories')
    .select('id, slug')
    .in('slug', uniqueSlugs);

  if (fetchError) throw fetchError;

  const categoryMap = new Map((existing ?? []).map((row) => [row.slug, row.id]));
  const missingSlugs = uniqueSlugs.filter((slug) => !categoryMap.has(slug));

  if (!dryRun && missingSlugs.length > 0) {
    const inserts = missingSlugs.map((slug, index) => {
      const preset = CATEGORY_PRESETS[slug] ?? {
        name: slugToTitle(slug),
        description: `Auto-created launch category for ${slugToTitle(slug)} quizzes.`,
        icon: slug.charAt(0).toUpperCase(),
        color: '#7c3aed',
        gradient_from: '#7c3aed',
        gradient_to: '#b16eff',
        sort_order: 50 + index,
      };

      return {
        slug,
        ...preset,
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from('categories')
      .upsert(inserts, { onConflict: 'slug', ignoreDuplicates: true })
      .select('id, slug');

    if (insertError) throw insertError;

    for (const row of inserted ?? []) {
      categoryMap.set(row.slug, row.id);
    }
  }

  return categoryMap;
}

export function buildQuizRow(quiz, categoryId, titleOverrides = new Map(), nowIso) {
  const now = nowIso ?? new Date().toISOString();

  return {
    category_id: categoryId ?? null,
    title: titleOverrides.get(quiz.slug) ?? quiz.title,
    slug: quiz.slug,
    description: quiz.description ?? null,
    cover_image_url: quiz.cover_image_url ?? null,
    quiz_type: quiz.quiz_type,
    difficulty: quiz.difficulty ?? 'medium',
    language: quiz.language,
    questions: quiz.questions,
    results: quiz.results ?? null,
    tags: Array.isArray(quiz.tags) ? quiz.tags : [],
    estimated_minutes: typeof quiz.estimated_minutes === 'number' ? quiz.estimated_minutes : 3,
    plays_count: typeof quiz.plays_count === 'number' ? quiz.plays_count : 0,
    shares_count: typeof quiz.shares_count === 'number' ? quiz.shares_count : 0,
    avg_score: typeof quiz.avg_score === 'number' ? quiz.avg_score : null,
    likes_count: typeof quiz.likes_count === 'number' ? quiz.likes_count : 0,
    status: 'published',
    is_featured: quiz.is_featured === true,
    is_ai_generated: true,
    published_at: quiz.published_at ?? now,
    created_at: quiz.created_at ?? now,
    updated_at: now,
  };
}

/**
 * Recuenta todos los quizzes publicados paginando con orden estable (`id ASC`)
 * para no truncar en el límite `max-rows` (1000) de PostgREST.
 */
export async function syncCategoryCounts({ supabase, pageSize = COUNT_PAGE_SIZE } = {}) {
  const counts = new Map();

  for (let page = 0; page < 200; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: quizzes, error: quizError } = await supabase
      .from('quizzes')
      .select('id, category_id, status')
      .eq('status', 'published')
      .order('id', { ascending: true })
      .range(from, to);

    if (quizError) throw quizError;

    const batch = quizzes ?? [];
    for (const quiz of batch) {
      if (!quiz.category_id) continue;
      counts.set(quiz.category_id, (counts.get(quiz.category_id) ?? 0) + 1);
    }

    if (batch.length < pageSize) break;
  }

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, quiz_count');

  if (categoriesError) throw categoriesError;

  for (const category of categories ?? []) {
    const nextCount = counts.get(category.id) ?? 0;
    if (category.quiz_count === nextCount) continue;

    const { error: updateError } = await supabase
      .from('categories')
      .update({ quiz_count: nextCount })
      .eq('id', category.id);

    if (updateError) throw updateError;
  }

  return counts;
}

/**
 * Ejecuta la importación de un lote de quizzes hacia Supabase:
 * - En `dryRun: true` solo lee categorías y slugs existentes, con cero escrituras.
 * - En `dryRun: false` solo inserta slugs nuevos (`insert-only`), preservando
 *   métricas (`plays_count`, `likes_count`, `shares_count`), fechas, estado y
 *   referencias (`id`) de cualquier quiz que ya exista en la base.
 */
export async function importTrendingSeed({
  supabase,
  quizzes: rawInput,
  sourcePath = 'memory',
  dryRun = false,
  titleOverrides = new Map(),
  batchSize = 25,
  countPageSize = COUNT_PAGE_SIZE,
  reportPath = null,
} = {}) {
  const normalized = normalizeStringsDeep(rawInput);
  const quizzes = Array.isArray(normalized) ? normalized : [];

  const validQuizzes = [];
  const skipped = [];
  const seenSlugsInSeed = new Set();

  for (const quiz of quizzes) {
    const issues = validateQuiz(quiz);
    if (issues.length > 0) {
      skipped.push({ slug: quiz?.slug ?? '(missing-slug)', issues });
      continue;
    }
    if (seenSlugsInSeed.has(quiz.slug)) {
      skipped.push({ slug: quiz.slug, issues: ['duplicate slug in seed'] });
      continue;
    }
    seenSlugsInSeed.add(quiz.slug);
    validQuizzes.push(quiz);
  }

  if (validQuizzes.length === 0) {
    throw new Error('No valid quizzes found in seed file.');
  }

  const categoryMap = await ensureCategories(
    validQuizzes.map((quiz) => quiz.category_slug),
    { supabase, dryRun }
  );

  // Consulta qué slugs ya existen para no sobrescribir sus métricas ni fechas.
  const existingSlugs = new Set();
  for (let index = 0; index < validQuizzes.length; index += batchSize) {
    const slugBatch = validQuizzes.slice(index, index + batchSize).map((quiz) => quiz.slug);
    const { data: existingRows, error: existingError } = await supabase
      .from('quizzes')
      .select('slug')
      .in('slug', slugBatch);

    if (existingError) throw existingError;
    for (const row of existingRows ?? []) {
      if (row?.slug) existingSlugs.add(row.slug);
    }
  }

  const newQuizzes = validQuizzes.filter((quiz) => !existingSlugs.has(quiz.slug));
  const rowsToInsert = newQuizzes.map((quiz) =>
    buildQuizRow(quiz, categoryMap.get(quiz.category_slug), titleOverrides)
  );

  if (!dryRun) {
    let processed = 0;
    for (let index = 0; index < rowsToInsert.length; index += batchSize) {
      const batch = rowsToInsert.slice(index, index + batchSize);
      const { error } = await supabase
        .from('quizzes')
        .upsert(batch, { onConflict: 'slug', ignoreDuplicates: true });

      if (error) throw error;
      processed += batch.length;
      console.log(`Imported ${processed}/${rowsToInsert.length}`);
    }

    await syncCategoryCounts({ supabase, pageSize: countPageSize });
  }

  const allRows = validQuizzes.map((quiz) =>
    buildQuizRow(quiz, categoryMap.get(quiz.category_slug), titleOverrides)
  );

  const summary = {
    sourcePath,
    dryRun,
    totalInFile: quizzes.length,
    imported: rowsToInsert.length,
    preservedExisting: existingSlugs.size,
    titleOverridesApplied: allRows.filter((row) => titleOverrides.has(row.slug)).length,
    skipped: skipped.length,
    byLanguage: allRows.reduce((acc, row) => {
      acc[row.language] = (acc[row.language] ?? 0) + 1;
      return acc;
    }, {}),
    byType: allRows.reduce((acc, row) => {
      acc[row.quiz_type] = (acc[row.quiz_type] ?? 0) + 1;
      return acc;
    }, {}),
    byCategory: validQuizzes.reduce((acc, quiz) => {
      acc[quiz.category_slug] = (acc[quiz.category_slug] ?? 0) + 1;
      return acc;
    }, {}),
    skippedItems: skipped,
  };

  if (!dryRun && reportPath) {
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`Report written to ${reportPath}`);
  }

  return summary;
}

async function main() {
  const rootDir = process.cwd();
  dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const sourcePath = process.env.SEED_SOURCE_PATH
    ? path.resolve(rootDir, process.env.SEED_SOURCE_PATH)
    : path.join(rootDir, 'generated', 'trending-seed.json');
  const isDryRun = process.env.SEED_DRY_RUN === '1';

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Seed file not found: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);
  const titleOverrides = loadTitleOverrides(rootDir);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const reportPath = isDryRun
    ? null
    : path.join(rootDir, 'generated', 'supabase-import-report.json');

  const summary = await importTrendingSeed({
    supabase,
    quizzes: parsed,
    sourcePath,
    dryRun: isDryRun,
    titleOverrides,
    reportPath,
  });

  console.log(JSON.stringify(summary, null, 2));
}

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  main().catch((error) => {
    console.error('Import failed.');
    console.error(error);
    process.exit(1);
  });
}
