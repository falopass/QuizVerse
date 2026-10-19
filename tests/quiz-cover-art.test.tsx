import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { QuizCoverArt } from '@/components/shared/quiz-cover-art';

const quizConFoto = {
  slug: 'test-quiz',
  title: 'Test Quiz',
  quiz_type: 'trivia' as const,
  category: null,
  cover_image_url: '/stock-covers/test-quiz.jpg',
};

describe('QuizCoverArt · foto', () => {
  it('héroe (decorative + priorityLabel): eager y fetchpriority=high', () => {
    const { container } = render(
      <QuizCoverArt quiz={quizConFoto} locale="es" decorative priorityLabel="Novedades / 001" />
    );
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('tarjeta (decorative sin priorityLabel): lazy y sin fetchpriority', () => {
    const { container } = render(<QuizCoverArt quiz={quizConFoto} locale="es" decorative />);
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).not.toHaveAttribute('fetchpriority');
  });

  it('detalle (decorative + priorityLabel=""): eager sin fetchpriority (above the fold)', () => {
    const { container } = render(
      <QuizCoverArt quiz={quizConFoto} locale="es" decorative priorityLabel="" />
    );
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).not.toHaveAttribute('fetchpriority');
  });

  it('quiz sin foto no renderiza ningún <img>', () => {
    const { container } = render(
      <QuizCoverArt quiz={{ ...quizConFoto, cover_image_url: null }} locale="es" decorative />
    );
    expect(container.querySelector('img')).toBeNull();
  });
});
