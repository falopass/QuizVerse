/**
 * Read access to a quiz's answer key.
 *
 * Only the server needs the correct answers, so this module is the single door
 * to them: the reveal endpoint, the submission action and the result-page
 * review load the key through here instead of selecting `questions` ad hoc.
 *
 * Migration 015 moves the key out of `quizzes.questions` (sanitized in place,
 * public by design) into `quiz_answer_keys`, a table only service_role can
 * read. Reads therefore try the key table first and fall back to
 * `quizzes.questions`, which still holds the raw key until the migration is
 * applied. A trivia quiz whose key is unreachable — migration applied without
 * SUPABASE_SERVICE_ROLE_KEY — fails loudly instead of grading every answer
 * wrong in silence.
 */

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { parseQuestions, parseResults } from '@/lib/data/normalizers';
import type { PersonalityResult, Question } from '@/types/quiz';
import type { QuizType } from '@/types/database';

export interface AnswerKeyQuiz {
  id: string;
  slug: string;
  quiz_type: QuizType;
  questions: Question[];
  results: PersonalityResult[] | null;
}

interface AnswerKeyRow {
  id: string;
  slug: string;
  quiz_type: QuizType;
  questions: unknown;
  results: unknown;
}

type QuizClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

const QUIZ_COLUMNS = 'id, slug, quiz_type, questions, results';

/**
 * Cliente para leer la clave: service role cuando la key existe (único rol que
 * lee quiz_answer_keys tras la 015) y el SSR normal cuando no — suficiente
 * mientras la migración no esté aplicada.
 */
async function keyClient(): Promise<QuizClient> {
  return createServiceClient() ?? (await createClient());
}

function toAnswerKey(row: AnswerKeyRow, questions: unknown): AnswerKeyQuiz {
  return {
    id: row.id,
    slug: row.slug,
    quiz_type: row.quiz_type,
    questions: parseQuestions(questions as Parameters<typeof parseQuestions>[0]),
    results: parseResults(row.results as Parameters<typeof parseResults>[0]),
  };
}

/**
 * A trivia quiz missing its key comes back with options that have no
 * `is_correct` at all — grading that would score every answer wrong and look
 * like a legitimately lost game. Personality quizzes keep working without a
 * key row: their scoring data (`personality_tags`, `results`) is public.
 */
function keyMaterialMissing(quizType: QuizType, questions: Question[]): boolean {
  return (
    quizType === 'trivia' &&
    questions.every((question) =>
      question.options.every((option) => option.is_correct === undefined)
    )
  );
}

/**
 * The raw questions for a quiz row: `quiz_answer_keys` when it yields a row
 * (post-015), else the `questions` column itself (pre-015 or personality
 * quizzes, which never needed a key row).
 */
async function rawQuestions(client: QuizClient, quizId: string, fallback: unknown) {
  const { data: keyRow } = await client
    .from('quiz_answer_keys')
    .select('questions')
    .eq('quiz_id', quizId)
    .maybeSingle();
  // Tabla inexistente (PGRST205), sin grants (RLS devuelve vacío) o fila
  // ausente: cualquiera de las tres significa "usa la columna questions".
  return keyRow?.questions ?? fallback;
}

async function toKeyQuiz(
  client: QuizClient,
  data: AnswerKeyRow | null
): Promise<AnswerKeyQuiz | null> {
  if (!data) return null;
  const questions = parseQuestions(
    (await rawQuestions(client, data.id, data.questions)) as Parameters<typeof parseQuestions>[0]
  );
  if (keyMaterialMissing(data.quiz_type, questions)) {
    console.error(
      `[answer-key] ${data.id} (${data.slug}): la clave no es accesible. ` +
        '¿Migración 015 aplicada sin SUPABASE_SERVICE_ROLE_KEY? ' +
        'Los quizzes trivia no pueden puntuar así.'
    );
    return null;
  }
  return toAnswerKey(data, questions);
}

/**
 * Loads the answer key for a published quiz.
 *
 * Unpublished quizzes return `null`: a draft must not be playable even by id.
 */
export async function loadAnswerKeyByQuizId(quizId: string): Promise<AnswerKeyQuiz | null> {
  const client = await keyClient();
  const { data, error } = await client
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('id', quizId)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !data) return null;
  return toKeyQuiz(client, data as AnswerKeyRow);
}

/**
 * Same key lookup by slug — the result page builds its review from the real
 * key while the quiz payload it ships to the browser stays sanitized.
 */
export async function loadAnswerKeyBySlug(
  slug: string,
  locale?: string
): Promise<AnswerKeyQuiz | null> {
  const client = await keyClient();
  let query = client
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published');
  if (locale) query = query.eq('language', locale);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return toKeyQuiz(client, data as AnswerKeyRow);
}
