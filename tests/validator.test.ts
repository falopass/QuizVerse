import { describe, it, expect } from 'vitest';
import { validateQuiz, validateQuestion, validatePersonalityResult } from '@/lib/quiz/validator';

describe('validateQuiz', () => {
  const validTrivia = {
    title: 'Test Quiz Title',
    quiz_type: 'trivia',
    difficulty: 'easy',
    language: 'es',
    category_id: '550e8400-e29b-41d4-a716-446655440000',
    questions: [
      {
        id: 'q1',
        question: 'What is 2+2?',
        options: [
          { id: 'o1', text: '4', is_correct: true },
          { id: 'o2', text: '5', is_correct: false },
        ],
      },
    ],
  };

  const validPersonality = {
    title: 'Personality Quiz',
    quiz_type: 'personality',
    difficulty: 'medium',
    language: 'es',
    questions: [
      {
        id: 'q1',
        question: 'How do you feel?',
        options: [
          { id: 'o1', text: 'Happy', personality_tags: ['happy'] },
          { id: 'o2', text: 'Sad', personality_tags: ['sad'] },
        ],
      },
    ],
    results: [
      { id: 'r1', title: 'Happy', description: 'You are happy', personality_tag: 'happy' },
      { id: 'r2', title: 'Sad', description: 'You are sad', personality_tag: 'sad' },
    ],
  };

  it('debería validar trivia correcto', () => {
    const result = validateQuiz(validTrivia);
    expect(result.valid).toBe(true);
  });

  it('debería validar personality correcto', () => {
    const result = validateQuiz(validPersonality);
    expect(result.valid).toBe(true);
  });

  it('debería rechazar título muy corto', () => {
    const result = validateQuiz({ ...validTrivia, title: 'AB' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('title'))).toBe(true);
  });

  it('debería rechazar título muy largo', () => {
    const result = validateQuiz({ ...validTrivia, title: 'A'.repeat(121) });
    expect(result.valid).toBe(false);
  });

  it('debería rechazar sin preguntas', () => {
    const result = validateQuiz({ ...validTrivia, questions: [] });
    expect(result.valid).toBe(false);
  });

  it('debería rechazar pregunta con una sola opción', () => {
    const invalid = {
      ...validTrivia,
      questions: [
        {
          id: 'q1',
          question: 'Q',
          options: [{ id: 'o1', text: 'A', is_correct: true }],
        },
      ],
    };
    const result = validateQuiz(invalid);
    expect(result.valid).toBe(false);
  });

  it('debería rechazar trivia sin respuesta correcta única', () => {
    const invalid = {
      ...validTrivia,
      questions: [
        {
          id: 'q1',
          question: 'Q',
          options: [
            { id: 'o1', text: 'A', is_correct: false },
            { id: 'o2', text: 'B', is_correct: false },
          ],
        },
      ],
    };
    const result = validateQuiz(invalid);
    expect(result.valid).toBe(false);
  });

  it('debería rechazar trivia con múltiples respuestas correctas', () => {
    const invalid = {
      ...validTrivia,
      questions: [
        {
          id: 'q1',
          question: 'Q',
          options: [
            { id: 'o1', text: 'A', is_correct: true },
            { id: 'o2', text: 'B', is_correct: true },
          ],
        },
      ],
    };
    const result = validateQuiz(invalid);
    expect(result.valid).toBe(false);
  });

  it('debería rechazar personality sin resultados', () => {
    const result = validateQuiz({ ...validPersonality, results: [] });
    expect(result.valid).toBe(false);
  });

  it('rechaza tags sin resultado y resultados sin tag', () => {
    expect(
      validateQuiz({ ...validPersonality, results: [validPersonality.results[0]] }).valid
    ).toBe(false);
    expect(
      validateQuiz({
        ...validPersonality,
        results: validPersonality.results.map((result) => ({
          ...result,
          personality_tag: undefined,
        })),
      }).valid
    ).toBe(false);
  });

  it('rechaza opciones de personality sin tags o con tags fantasma', () => {
    const withoutTags = {
      ...validPersonality,
      questions: validPersonality.questions.map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option, personality_tags: undefined })),
      })),
    };
    expect(validateQuiz(withoutTags).valid).toBe(false);

    const ghostTag = {
      ...validPersonality,
      questions: [
        {
          id: 'q1',
          question: 'How do you feel?',
          options: [
            { id: 'o1', text: 'Happy', personality_tags: ['happy'] },
            { id: 'o2', text: 'Sad', personality_tags: ['ghost'] },
          ],
        },
      ],
    };
    const result = validateQuiz(ghostTag);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('Pregunta 1'))).toBe(true);
  });

  it('rechaza ids de resultado duplicados', () => {
    const result = validateQuiz({
      ...validPersonality,
      results: validPersonality.results.map((item) => ({ ...item, id: 'r1' })),
    });
    expect(result.valid).toBe(false);
  });

  it('devuelve los errores semánticos en el idioma pedido', () => {
    const invalid = { ...validTrivia, questions: [{ ...validTrivia.questions[0], id: 'q1' }] };
    invalid.questions.push({ ...validTrivia.questions[0] });
    const spanish = validateQuiz(invalid, 'es');
    expect(spanish.errors.some((error) => error.includes('identificadores únicos'))).toBe(true);
    const english = validateQuiz(invalid, 'en');
    expect(english.errors.some((error) => error.includes('unique identifiers'))).toBe(true);
    expect(english.errors.some((error) => error.includes('identificadores'))).toBe(false);
  });

  it('debería rechazar difficulty inválido', () => {
    const result = validateQuiz({ ...validTrivia, difficulty: 'extreme' });
    expect(result.valid).toBe(false);
  });

  it('debería rechazar quiz_type inválido', () => {
    const result = validateQuiz({ ...validTrivia, quiz_type: 'survey' });
    expect(result.valid).toBe(false);
  });

  it('debería rechazar poll mientras no esté implementado', () => {
    const pollQuiz = {
      title: 'Poll Quiz',
      quiz_type: 'poll',
      difficulty: 'easy',
      language: 'es',
      questions: [
        {
          id: 'q1',
          question: 'Favorite color?',
          options: [
            { id: 'o1', text: 'Red' },
            { id: 'o2', text: 'Blue' },
          ],
        },
      ],
    };
    const result = validateQuiz(pollQuiz);
    expect(result.valid).toBe(false);
  });

  it('debería rechazar objetos mal formados', () => {
    const result = validateQuiz({});
    expect(result.valid).toBe(false);
  });

  it('devuelve los errores estructurales en el idioma pedido', () => {
    const tooShort = { ...validTrivia, title: 'AB' };

    const spanish = validateQuiz(tooShort, 'es');
    expect(spanish.errors).toContain('title: debe tener al menos 5 caracteres');
    const english = validateQuiz(tooShort, 'en');
    expect(english.errors).toContain('title: must have at least 5 characters');
    expect(english.errors.some((error) => error.includes('caracteres'))).toBe(false);
  });

  it('debería rechazar null', () => {
    const result = validateQuiz(null);
    expect(result.valid).toBe(false);
  });
});

describe('validateQuestion', () => {
  it('debería validar pregunta correcta', () => {
    const result = validateQuestion({
      id: 'q1',
      question: 'What?',
      options: [
        { id: 'o1', text: 'A' },
        { id: 'o2', text: 'B' },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('debería rechazar pregunta sin opciones suficientes', () => {
    const result = validateQuestion({
      id: 'q1',
      question: 'What?',
      options: [{ id: 'o1', text: 'A' }],
    });
    expect(result.valid).toBe(false);
  });
});

describe('validatePersonalityResult', () => {
  it('debería validar resultado correcto', () => {
    const result = validatePersonalityResult({
      id: 'r1',
      title: 'Introvert',
      description: 'You are introverted',
      background_theme: 'ocean',
    });
    expect(result.valid).toBe(true);
  });

  it('debería rechazar resultado sin título', () => {
    const result = validatePersonalityResult({
      id: 'r1',
      title: '',
      description: 'Desc',
    });
    expect(result.valid).toBe(false);
  });
});
