import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StreakIndicator } from '@/components/quiz/streak-indicator';

describe('StreakIndicator', () => {
  it('no pinta nada con racha menor a 2', () => {
    const { container } = render(<StreakIndicator streak={1} locale="es" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra la racha con texto en español e inglés', () => {
    const { rerender } = render(<StreakIndicator streak={3} locale="es" />);
    expect(screen.getByText(/Racha/)).toHaveTextContent('3× Racha');

    rerender(<StreakIndicator streak={4} locale="en" />);
    expect(screen.getByText(/Streak/)).toHaveTextContent('4× Streak');
  });

  it('la key por valor re-monta el número al subir la racha y repite el pop', () => {
    const { rerender } = render(<StreakIndicator streak={2} locale="es" />);
    const first = screen.getByText('2×');
    expect(first).toHaveClass('qv-l1-streak-pop');

    rerender(<StreakIndicator streak={3} locale="es" />);
    const second = screen.getByText('3×');
    expect(second).toHaveClass('qv-l1-streak-pop');
    expect(second).not.toBe(first);
  });
});
