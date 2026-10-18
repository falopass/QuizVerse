/**
 * Client helpers for the answer reveal endpoint.
 *
 * The play screen no longer receives the answer key with the quiz, so it asks
 * the server for exactly two things: whether the option just picked was right,
 * and which wrong options a 50/50 power-up may hide.
 *
 * Both helpers resolve to `null` on any failure. The player degrades to "no
 * feedback" instead of getting stuck, and the server re-grades every answer at
 * submission anyway, so a failed reveal can never corrupt a score.
 */

export interface AnswerVerdictResponse {
  isCorrect: boolean;
  correctOptionId: string | null;
  explanation: string | null;
}

const REVEAL_ENDPOINT = '/api/quiz/reveal';

async function postReveal(body: Record<string, unknown>): Promise<unknown | null> {
  try {
    const response = await fetch(REVEAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function requestAnswerVerdict(input: {
  quizId: string;
  questionId: string;
  selectedOptionId: string;
}): Promise<AnswerVerdictResponse | null> {
  const payload = await postReveal({ ...input, purpose: 'answer' });
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Partial<AnswerVerdictResponse>;
  if (typeof record.isCorrect !== 'boolean') return null;

  return {
    isCorrect: record.isCorrect,
    correctOptionId: typeof record.correctOptionId === 'string' ? record.correctOptionId : null,
    explanation: typeof record.explanation === 'string' ? record.explanation : null,
  };
}

export async function requestEliminatedOptions(input: {
  quizId: string;
  questionId: string;
}): Promise<string[] | null> {
  const payload = await postReveal({ ...input, purpose: 'hint' });
  if (!payload || typeof payload !== 'object') return null;

  const eliminated = (payload as { eliminated?: unknown }).eliminated;
  if (!Array.isArray(eliminated)) return null;

  return eliminated.filter((id): id is string => typeof id === 'string');
}
