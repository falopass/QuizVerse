import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';

const quiz = {
  slug: 'quiz-de-prueba',
  title: '¿Cuánto sabes de videojuegos?',
  quiz_type: 'trivia' as const,
  estimated_minutes: 3,
  cover_image_url: null,
  category: { name: 'Videojuegos' },
};

describe('EditorialQuizCard', () => {
  it('el hero mantiene el título impreso en la portada', () => {
    const { container } = render(<EditorialQuizCard quiz={quiz} locale="es" size="hero" />);
    expect(container.querySelector('.arcade-cover-title')).not.toBeNull();
    expect(container.querySelector('.arcade-card')).toHaveClass('arcade-card-hero');
  });

  it('la tarjeta normal no repite el título sobre la portada', () => {
    const { container } = render(<EditorialQuizCard quiz={quiz} locale="es" />);
    expect(container.querySelector('.arcade-cover-title')).toBeNull();
  });

  it('el metadato ya no usa la etiqueta en mayúsculas', () => {
    const { container } = render(<EditorialQuizCard quiz={quiz} locale="es" />);
    const meta = container.querySelector('.arcade-card-meta');
    expect(meta).not.toBeNull();
    expect(meta!.textContent).toBe('Trivia · Videojuegos');
    expect(container.querySelector('.arcade-tag')).toBeNull();
  });
});
