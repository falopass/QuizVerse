import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');

interface Quiz {
  slug: string;
  title: string;
  description: string;
  quiz_type: string;
  difficulty: string;
  language: string;
  category: string;
  tags: string[];
  estimated_minutes: number;
  questions: unknown[];
}

function question(correctCount = 1) {
  return {
    id: `q${Math.random().toString(36).slice(2, 8)}`,
    question: 'Which of these facts is stable and checkable enough to answer?',
    options: [
      { id: 'a', text: 'First option', is_correct: correctCount > 0 },
      { id: 'b', text: 'Second option', is_correct: correctCount > 1 },
      { id: 'c', text: 'Third option', is_correct: false },
      { id: 'd', text: 'Fourth option', is_correct: false },
    ],
    explanation: 'A short explanation for the correct answer.',
  };
}

function validQuiz(slug: string, language: 'en' | 'es'): Quiz {
  return {
    slug,
    title: 'A perfectly valid editorial quiz title',
    description: 'A description comfortably longer than the forty character minimum.',
    quiz_type: 'trivia',
    difficulty: 'medium',
    language,
    category: 'history',
    tags: ['history', 'trivia'],
    estimated_minutes: 3,
    questions: Array.from({ length: 5 }, () => question()),
  };
}

function runSeed(quizzes: Quiz[], extraArgs: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'seed-emit-'));
  const fixture = join(dir, 'seed.json');
  writeFileSync(fixture, JSON.stringify({ quizzes }));
  try {
    const stdout = execFileSync('node', [SCRIPT, '--input', fixture, ...extraArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? -1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }
}

describe('emit-editorial-seed', () => {
  it('emite INSERT ... ON CONFLICT con un seed válido', () => {
    const { status, stdout } = runSeed([
      validQuiz('en-valid-history-quiz', 'en'),
      validQuiz('es-valid-history-quiz', 'es'),
    ]);
    expect(status).toBe(0);
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('falla si una pregunta trivia tiene dos respuestas correctas', () => {
    const quiz = validQuiz('en-two-correct-quiz', 'en');
    quiz.questions[0] = question(2);
    const { status, stderr } = runSeed([quiz]);
    expect(status).toBe(1);
    expect(stderr).toContain('en-two-correct-quiz');
    expect(stderr).toContain('trivia needs exactly one correct option');
  });

  it('falla con una categoría inexistente', () => {
    const quiz = { ...validQuiz('en-bad-category-quiz', 'en'), category: 'not-a-category' };
    const { status, stderr } = runSeed([quiz]);
    expect(status).toBe(1);
    expect(stderr).toContain('unknown category');
  });

  it('falla si el slug no lleva el prefijo de idioma', () => {
    const quiz = validQuiz('es-mismatched-prefix', 'en');
    const { status, stderr } = runSeed([quiz]);
    expect(status).toBe(1);
    expect(stderr).toContain('slug must start with the language prefix');
  });

  it('falla con una descripción de menos de 40 caracteres', () => {
    const quiz = { ...validQuiz('en-short-description', 'en'), description: 'Too short.' };
    const { status, stderr } = runSeed([quiz]);
    expect(status).toBe(1);
    expect(stderr).toContain('description too short');
  });
});
