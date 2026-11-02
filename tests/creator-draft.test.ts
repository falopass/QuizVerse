import { describe, expect, it } from 'vitest';
import {
  buildCreatorDraft,
  creatorErrors,
  normalizeCreatorDraft,
  resultGraphValid,
  tagFromTitle,
  validateCreatorDraft,
  type CreatorDraftInput,
} from '@/lib/quiz/creator-draft';
import type { PersonalityResult, Question } from '@/types/quiz';
import { validateQuiz } from '@/lib/quiz/validator';

const question = (id: string): Question => ({
  id,
  question: `Pregunta ${id}`,
  options: ['a', 'b', 'c', 'd'].map((suffix) => ({
    id: `${id}-${suffix}`,
    text: `Opción ${suffix}`,
  })),
});

const result = (id: string, title: string, tag: string): PersonalityResult => ({
  id,
  title,
  description: `Descripción ${id}`,
  personality_tag: tag,
});

const personalityInput = (): CreatorDraftInput => ({
  title: 'Qué resultado eres',
  description: 'Un quiz de personalidad',
  quizType: 'personality',
  difficulty: 'medium',
  categoryId: '',
  language: 'es',
  questions: [question('q1'), question('q2'), question('q3')],
  results: [
    result('r1', 'La Curadora', 'la-curadora'),
    result('r2', 'El Explorador', 'el-explorador'),
  ],
  assignments: Object.fromEntries(
    ['q1', 'q2', 'q3'].flatMap((id) =>
      ['a', 'b', 'c', 'd'].map((suffix, index) => [
        `${id}-${suffix}`,
        index % 2 === 0 ? 'r1' : 'r2',
      ])
    )
  ),
});

const triviaInput = (): CreatorDraftInput => ({
  ...personalityInput(),
  quizType: 'trivia',
  questions: ['q1', 'q2', 'q3'].map((id) => ({
    ...question(id),
    options: question(id).options.map((option, index) => ({
      ...option,
      is_correct: index === 0,
    })),
  })),
});

describe('tagFromTitle', () => {
  it('genera un tag ASCII estable desde el título', () => {
    expect(tagFromTitle('La Curadora del Caos')).toBe('la-curadora-del-caos');
    expect(tagFromTitle('Café & Música')).toBe('cafe-musica');
    expect(tagFromTitle('  ¡Sí!  ')).toBe('si');
  });
});

describe('buildCreatorDraft', () => {
  it('materializa la asignación opción→resultado en personality_tags', () => {
    const draft = buildCreatorDraft(personalityInput());

    expect(draft.quiz_type).toBe('personality');
    expect(draft.results?.map((item) => item.personality_tag)).toEqual([
      'la-curadora',
      'el-explorador',
    ]);
    expect(draft.questions[0].options[0].personality_tags).toEqual(['la-curadora']);
    expect(draft.questions[0].options[1].personality_tags).toEqual(['el-explorador']);
    expect(validateCreatorDraft(personalityInput(), 'es').valid).toBe(true);
  });

  it('deja los resultados sin tag para que el validador los delate', () => {
    const input = personalityInput();
    input.results[1].personality_tag = '';

    const result = validateCreatorDraft(input, 'es');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Cada resultado debe tener un tag de personalidad único y no vacío'
    );
  });

  it('delata la opción que no suma a ningún resultado', () => {
    const input = personalityInput();
    delete input.assignments['q2-b'];

    const result = validateCreatorDraft(input, 'es');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Pregunta 2: cada opción debe usar tags de resultados existentes'
    );
  });

  it('rechaza preguntas, opciones y resultados que solo son espacios', () => {
    const input = personalityInput();
    input.questions[0].options[0].text = '   ';
    input.results[0].title = '   ';
    input.results[0].description = '   ';

    const result = validateCreatorDraft(input, 'es');

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.startsWith('questions.0.options.0.text:'))).toBe(
      true
    );
    expect(result.errors.some((error) => error.startsWith('results.0.title:'))).toBe(true);
    expect(result.errors.some((error) => error.startsWith('results.0.description:'))).toBe(true);
  });

  it('mantiene trivia igual: sin resultados y sin tags de personalidad', () => {
    const draft = buildCreatorDraft(triviaInput());

    expect(draft.quiz_type).toBe('trivia');
    expect(draft.results).toBeUndefined();
    draft.questions.forEach((item) =>
      item.options.forEach((option) => expect(option.personality_tags).toBeUndefined())
    );
    expect(validateCreatorDraft(triviaInput(), 'es').valid).toBe(true);
  });

  it('pasa el borrador manual por normalizeQuizDraft antes de enviar', () => {
    const input = personalityInput();
    input.results[0].id = 'r2';

    const normalized = normalizeCreatorDraft(input);

    expect(new Set(normalized.results?.map((item) => item.id)).size).toBe(2);
    expect(validateQuiz(normalized, 'es').valid).toBe(true);
  });
});

describe('creatorErrors', () => {
  it('ubica errores estructurales y semánticos en su tarjeta', () => {
    const errors = creatorErrors([
      'title: Too small: expected string to have >=5 characters',
      'description: Too big: expected string to have <=300 characters',
      'questions.1.options.0.text: Too small: expected string to have >=1 characters',
      'Pregunta 3: cada opción debe usar tags de resultados existentes',
      'results.0.personality_tag: Too small',
      'Resultado 2: el tag "x" no se usa en ninguna opción',
      'Cada resultado debe tener un tag de personalidad único y no vacío',
    ]);

    expect(errors.map((error) => error.target)).toEqual([
      { kind: 'title' },
      { kind: 'description' },
      { kind: 'question', index: 1 },
      { kind: 'question', index: 2 },
      { kind: 'result', index: 0 },
      { kind: 'result', index: 1 },
      { kind: 'form' },
    ]);
  });
});

describe('resultGraphValid', () => {
  it('ignora el texto de preguntas y opciones', () => {
    const input = personalityInput();
    input.questions[0].question = '';
    input.questions[0].options[0].text = '';

    expect(resultGraphValid(input)).toBe(true);
  });

  it('exige tags, asignaciones y resultados alcanzables', () => {
    const missingAssignment = personalityInput();
    delete missingAssignment.assignments['q1-a'];
    expect(resultGraphValid(missingAssignment)).toBe(false);

    const emptyTag = personalityInput();
    emptyTag.results[1].personality_tag = '';
    expect(resultGraphValid(emptyTag)).toBe(false);

    const duplicateTag = personalityInput();
    duplicateTag.results[1].personality_tag = 'la-curadora';
    expect(resultGraphValid(duplicateTag)).toBe(false);

    const unusedResult = personalityInput();
    Object.keys(unusedResult.assignments).forEach((id) => {
      unusedResult.assignments[id] = 'r1';
    });
    expect(resultGraphValid(unusedResult)).toBe(false);
  });

  it('sí exige el contenido de los resultados', () => {
    const emptyTitle = personalityInput();
    emptyTitle.results[0].title = '';
    expect(resultGraphValid(emptyTitle)).toBe(false);

    const emptyDescription = personalityInput();
    emptyDescription.results[1].description = '';
    expect(resultGraphValid(emptyDescription)).toBe(false);
  });

  it('no aplica a trivia', () => {
    expect(resultGraphValid(triviaInput())).toBe(true);
  });
});
