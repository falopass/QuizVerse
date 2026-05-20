import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sourcePath = process.env.SEED_SOURCE_PATH
  ? path.resolve(rootDir, process.env.SEED_SOURCE_PATH)
  : path.join(rootDir, 'generated', 'trending-seed-openrouter.json');
const isDryRun = process.env.SEED_DRY_RUN === '1';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CATEGORY_PRESETS = {
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

function maybeDecodeMojibake(value) {
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

function normalizeStringsDeep(value) {
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

function slugToTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function validateQuiz(quiz) {
  const issues = [];

  if (!quiz.slug || typeof quiz.slug !== 'string') issues.push('missing slug');
  if (!quiz.title || typeof quiz.title !== 'string') issues.push('missing title');
  if (!['en', 'es'].includes(quiz.language)) issues.push(`invalid language ${quiz.language}`);
  if (!['trivia', 'personality', 'poll'].includes(quiz.quiz_type))
    issues.push(`invalid type ${quiz.quiz_type}`);
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 3)
    issues.push('not enough questions');
  if (!quiz.category_slug || typeof quiz.category_slug !== 'string')
    issues.push('missing category_slug');

  if (quiz.quiz_type === 'trivia') {
    const triviaIssues = quiz.questions.some((question) => {
      if (!Array.isArray(question.options) || question.options.length < 2) return true;
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

async function ensureCategories(categorySlugs) {
  const uniqueSlugs = [...new Set(categorySlugs)];
  const { data: existing, error: fetchError } = await supabase
    .from('categories')
    .select('id, slug')
    .in('slug', uniqueSlugs);

  if (fetchError) throw fetchError;

  const categoryMap = new Map((existing ?? []).map((row) => [row.slug, row.id]));
  const missingSlugs = uniqueSlugs.filter((slug) => !categoryMap.has(slug));

  if (missingSlugs.length > 0) {
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
      .upsert(inserts, { onConflict: 'slug' })
      .select('id, slug');

    if (insertError) throw insertError;

    for (const row of inserted ?? []) {
      categoryMap.set(row.slug, row.id);
    }
  }

  return categoryMap;
}

function buildQuizRow(quiz, categoryId) {
  const now = new Date().toISOString();

  return {
    category_id: categoryId ?? null,
    title: quiz.title,
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

async function syncCategoryCounts() {
  const { data: quizzes, error: quizError } = await supabase
    .from('quizzes')
    .select('category_id, status')
    .eq('status', 'published');

  if (quizError) throw quizError;

  const counts = new Map();
  for (const quiz of quizzes ?? []) {
    if (!quiz.category_id) continue;
    counts.set(quiz.category_id, (counts.get(quiz.category_id) ?? 0) + 1);
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
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Seed file not found: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);
  const normalized = normalizeStringsDeep(parsed);
  const quizzes = Array.isArray(normalized) ? normalized : [];

  const validQuizzes = [];
  const skipped = [];

  for (const quiz of quizzes) {
    const issues = validateQuiz(quiz);
    if (issues.length > 0) {
      skipped.push({ slug: quiz.slug ?? '(missing-slug)', issues });
      continue;
    }
    validQuizzes.push(quiz);
  }

  if (validQuizzes.length === 0) {
    throw new Error('No valid quizzes found in seed file.');
  }

  const categoryMap = await ensureCategories(validQuizzes.map((quiz) => quiz.category_slug));
  const rows = validQuizzes.map((quiz) => buildQuizRow(quiz, categoryMap.get(quiz.category_slug)));

  if (!isDryRun) {
    const batchSize = 25;
    let processed = 0;

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const { error } = await supabase.from('quizzes').upsert(batch, { onConflict: 'slug' });

      if (error) throw error;
      processed += batch.length;
      console.log(`Imported ${processed}/${rows.length}`);
    }

    await syncCategoryCounts();
  }

  const summary = {
    sourcePath,
    dryRun: isDryRun,
    totalInFile: quizzes.length,
    imported: rows.length,
    skipped: skipped.length,
    byLanguage: rows.reduce((acc, row) => {
      acc[row.language] = (acc[row.language] ?? 0) + 1;
      return acc;
    }, {}),
    byType: rows.reduce((acc, row) => {
      acc[row.quiz_type] = (acc[row.quiz_type] ?? 0) + 1;
      return acc;
    }, {}),
    byCategory: validQuizzes.reduce((acc, quiz) => {
      acc[quiz.category_slug] = (acc[quiz.category_slug] ?? 0) + 1;
      return acc;
    }, {}),
    skippedItems: skipped,
  };

  const reportPath = path.join(rootDir, 'generated', 'supabase-import-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
  console.error('Import failed.');
  console.error(error);
  process.exit(1);
});
