import { describe, expect, it } from 'vitest';
import { normalizeQuizDraft } from '@/lib/quiz/normalize-draft';
import { validateQuiz } from '@/lib/quiz/validator';
import type { PersonalityResult, Question } from '@/types/quiz';

const question = (id: string, tags: string[] | undefined): Question => ({
  id,
  question: `Question ${id}`,
  options: [0, 1, 2, 3].map((index) => ({
    id: `${id}-o${index}`,
    text: `Option ${index}`,
    personality_tags: tags ? [tags[index % tags.length]] : undefined,
  })),
});

const result = (id: string, tag?: string): PersonalityResult => ({
  id,
  title: `Result ${id}`,
  description: `Description ${id}`,
  personality_tag: tag,
});

const personalityDraft = () => ({
  title: 'Draft personality',
  quiz_type: 'personality' as const,
  difficulty: 'medium' as const,
  questions: [question('q1', ['a']), question('q2', ['b'])],
  results: [result('r1', 'a'), result('r2', 'b')],
});

describe('normalizeQuizDraft', () => {
  it('deja intacto un borrador ya válido', () => {
    const draft = personalityDraft();
    expect(normalizeQuizDraft(draft)).toEqual(draft);
  });

  it('repara ids duplicados de preguntas, opciones y resultados', () => {
    const draft = personalityDraft();
    draft.questions[1].id = 'q1';
    draft.questions[0].options[1].id = 'q1-o0';
    draft.results[1].id = 'r1';
    const normalized = normalizeQuizDraft(draft);
    expect(new Set(normalized.questions.map((item) => item.id)).size).toBe(2);
    expect(new Set(normalized.questions[0].options.map((item) => item.id)).size).toBe(4);
    expect(new Set(normalized.results!.map((item) => item.id)).size).toBe(2);
    expect(validateQuiz({ ...normalized, language: 'es' }).valid).toBe(true);
  });

  it('asigna tags a resultados sin tag y deduplica los repetidos', () => {
    const draft = personalityDraft();
    draft.results = [result('r1'), result('r2', 'a'), result('r3', 'a')];
    const normalized = normalizeQuizDraft(draft);
    const tags = normalized.results!.map((item) => item.personality_tag);
    expect(tags.every((tag) => Boolean(tag?.trim()))).toBe(true);
    expect(new Set(tags).size).toBe(tags.length);
    expect(validateQuiz({ ...normalized, language: 'es' }).valid).toBe(true);
  });

  it('elimina tags fantasma y reparte tags reales en opciones sin voto', () => {
    const draft = personalityDraft();
    draft.questions[0].options[0].personality_tags = ['ghost'];
    draft.questions[1].options.forEach((option) => (option.personality_tags = undefined));
    const normalized = normalizeQuizDraft(draft);
    const tags = new Set(normalized.results!.map((item) => item.personality_tag));
    normalized.questions.forEach((item) =>
      item.options.forEach((option) => {
        expect(option.personality_tags?.length).toBeGreaterThan(0);
        option.personality_tags?.forEach((tag) => expect(tags.has(tag)).toBe(true));
      })
    );
    expect(validateQuiz({ ...normalized, language: 'es' }).valid).toBe(true);
  });

  it('hace alcanzable un resultado añadido sin voto', () => {
    const draft = personalityDraft();
    draft.results.push(result('r3', 'c'));
    const normalized = normalizeQuizDraft(draft);
    const used = new Set(
      normalized.questions.flatMap((item) =>
        item.options.flatMap((option) => option.personality_tags ?? [])
      )
    );
    expect(used.has('c')).toBe(true);
    expect(validateQuiz({ ...normalized, language: 'es' }).valid).toBe(true);
  });

  it('no toca los enlaces de un draft trivia más allá de los ids', () => {
    const draft = {
      title: 'Draft trivia',
      quiz_type: 'trivia' as const,
      difficulty: 'easy' as const,
      questions: [
        {
          id: 'q1',
          question: 'Q',
          options: [
            { id: 'o1', text: 'A', is_correct: true },
            { id: 'o2', text: 'B', is_correct: false },
          ],
        },
      ],
    };
    expect(normalizeQuizDraft(draft)).toEqual(draft);
  });
});
