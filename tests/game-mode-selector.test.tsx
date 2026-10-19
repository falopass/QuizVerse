import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { GameModeSelector } from '@/components/quiz/game-mode-selector';
import type { Quiz } from '@/types/quiz';
import type { GameMode } from '@/stores/quiz-store';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'space-trivia',
    title: 'Space Trivia',
    description: 'A trivia quiz about space.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'Which planet has the most moons?',
        options: [
          { id: 'q1a', text: 'Saturn' },
          { id: 'q1b', text: 'Mars' },
        ],
      },
      {
        id: 'q2',
        question: 'Which planet is closest to the Sun?',
        options: [
          { id: 'q2a', text: 'Mercury' },
          { id: 'q2b', text: 'Venus' },
        ],
      },
    ],
    results: null,
    tags: ['space'],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: null,
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function renderSelector(props: {
  locale?: 'en' | 'es';
  quizType?: Quiz['quiz_type'];
  onSelectMode?: (mode: GameMode) => void;
} = {}) {
  const onSelectMode = props.onSelectMode ?? vi.fn();
  render(
    <GameModeSelector
      quiz={makeQuiz({ quiz_type: props.quizType ?? 'trivia' })}
      locale={props.locale ?? 'es'}
      onSelectMode={onSelectMode}
    />
  );
  return onSelectMode;
}

describe('GameModeSelector', () => {
  it('ofrece los cuatro modos con sus etiquetas en español para trivia', () => {
    renderSelector({ locale: 'es' });

    expect(screen.getByRole('button', { name: /Clásico/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contrarreloj/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Supervivencia/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Práctica/ })).toBeInTheDocument();
    expect(screen.getByText(/Pulsa 1-4/)).toBeInTheDocument();
  });

  it('ofrece los cuatro modos con sus etiquetas en inglés para trivia', () => {
    renderSelector({ locale: 'en' });

    expect(screen.getByRole('button', { name: /Classic/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Time Attack/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Survival/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Practice/ })).toBeInTheDocument();
    expect(screen.getByText(/Press 1-4/)).toBeInTheDocument();
  });

  it('no ofrece Supervivencia en quizzes de personalidad', () => {
    renderSelector({ locale: 'es', quizType: 'personality' });

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText(/Supervivencia/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pulsa 1-3/)).toBeInTheDocument();
  });

  it.each<[string, GameMode]>([
    ['Clásico', 'normal'],
    ['Contrarreloj', 'timed'],
    ['Supervivencia', 'survival'],
    ['Práctica', 'practice'],
  ])('llama onSelectMode("%s" → %s) al hacer clic', (label, mode) => {
    const onSelectMode = renderSelector({ locale: 'es' });

    fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

    expect(onSelectMode).toHaveBeenCalledWith(mode);
  });

  it('elige el modo correspondiente con un atajo de teclado', () => {
    const onSelectMode = renderSelector({ locale: 'es' });

    fireEvent.keyDown(window, { key: '2' });

    expect(onSelectMode).toHaveBeenCalledWith('timed');
  });
});
