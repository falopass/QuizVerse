/**
 * Pantalla de resultado: diálogo de compartir accesible (A11Y-04), contraste
 * AA de los botones de red (A11Y-11) y copy neutro sin calcos (C15).
 */

import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('@/actions/quiz.actions', () => ({
  incrementShares: vi.fn(async () => ({ success: true })),
  markSessionShared: vi.fn(async () => ({ success: true })),
}));

import { ResultScreen } from '@/components/quiz/result-screen';
import type { Quiz } from '@/types/quiz';

const TOKEN = 'aaaa1111bbbb2222';

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
    questions: [],
    results: null,
    tags: [],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: '2026-05-21T00:00:00.000Z',
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: true })),
  });
});

function renderScreen(props: Partial<React.ComponentProps<typeof ResultScreen>> = {}) {
  return render(
    <ResultScreen
      locale="es"
      quiz={makeQuiz({ quiz_type: 'personality', title: 'What Animal Are You' })}
      result={{ id: 'r1', title: 'The Wolf', description: 'Loyal and fierce.' }}
      answers={[]}
      shareUrl={`https://quizverse.org/es/quiz/space-trivia/result?s=${TOKEN}`}
      shareToken={TOKEN}
      onPlayAgain={() => {}}
      {...props}
    />
  );
}

describe('ResultScreen · diálogo de compartir accesible', () => {
  it.each(['es', 'en'] as const)('adelanta la acción al resumen y las métricas (%s)', (locale) => {
    const { container } = renderScreen({ locale });
    const primary = screen.getByRole('button', {
      name: locale === 'es' ? 'Compartir resultado' : 'Share result',
    });

    expect(primary).toHaveClass('arcade-result-primary');
    expect(primary).not.toHaveClass('uppercase');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelector('.arcade-result-cover .arcade-cover-title')).toBeNull();
    for (const selector of ['.arcade-result-body', '.arcade-result-metrics']) {
      expect(
        primary.compareDocumentPosition(container.querySelector(selector)!) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it('atrapa el foco, cierra con Escape desde fuera y lo devuelve al botón', async () => {
    renderScreen();
    const trigger = screen.getByRole('button', { name: 'Compartir resultado' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Compartir resultado' });
    const close = within(dialog).getByRole('button', { name: 'Cerrar' });
    await waitFor(() => expect(close).toHaveFocus());

    const copyLink = within(dialog).getByRole('button', { name: /Copiar enlace/i });

    copyLink.focus();
    fireEvent.keyDown(copyLink, { key: 'Tab' });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(copyLink).toHaveFocus();

    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('devuelve el foco a «Reta a un amigo» cuando ese fue el botón que abrió', async () => {
    renderScreen({
      challengeShareUrl: `https://quizverse.org/es/quiz/space-trivia/result?s=${TOKEN}&challenge=${TOKEN}`,
    });
    const trigger = screen.getByRole('button', { name: 'Reta a un amigo' });
    trigger.focus();
    fireEvent.click(trigger);

    screen.getByRole('dialog', { name: 'Reta a un amigo' });
    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/../g)!
    .map((pair) => parseInt(pair, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function backgroundOf(element: HTMLElement): string {
  if (/\bbg-black\b/.test(element.className)) return '#000000';
  const match = element.className.match(/bg-\[(#[0-9a-fA-F]{6})\]/);
  if (!match) throw new Error(`Sin color de fondo explícito: ${element.className}`);
  return match[1];
}

describe('ResultScreen · contraste de los botones de compartir', () => {
  it('WhatsApp, X y Facebook cumplen AA (≥ 4,5:1) con texto blanco', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Compartir resultado' }));
    const dialog = screen.getByRole('dialog', { name: 'Compartir resultado' });

    for (const name of [/whatsapp/i, /^x$/i, /facebook/i]) {
      const link = within(dialog).getByRole('link', { name });
      expect(contrastRatio(backgroundOf(link), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('ResultScreen · copy del resultado', () => {
  it('comparte en español neutro y con CTAs sin calcos', () => {
    renderScreen();

    expect(screen.getByRole('link', { name: 'Jugar a otro quiz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jugar otra vez' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compartir resultado' }));
    const whatsapp = screen.getByRole('link', { name: /whatsapp/i });
    const shared = decodeURIComponent(whatsapp.getAttribute('href') ?? '');
    expect(shared).toContain('The Wolf');
    expect(shared).toContain('What Animal Are You');
    // Sin voseo ni calcos del inglés en el gancho.
    expect(shared).not.toMatch(/\b(sacaste|ganás|superás|vos)\b/i);
  });

  it('mantiene el mismo sentido en inglés', () => {
    renderScreen({ locale: 'en' });

    expect(screen.getByRole('link', { name: 'Play another quiz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });
});
