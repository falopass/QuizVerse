/**
 * Página /[locale]/widget: la isla `EmbedBuilder` y la ruta `/embed/{locale}/{slug}`.
 *
 * Contrato: la búsqueda golpea /api/quizzes una vez por término (debounce de
 * 300 ms), se puede elegir un quiz solo con teclado, el código generado lleva
 * iframe + enlace de atribución normal (sin nofollow) y la ruta embed devuelve
 * el enlace «Juega … en QuizVerse» con target/rel correctos y sin is_correct.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EmbedBuilder } from '@/components/widget/embed-builder';
import type { EmbedBuilderLabels } from '@/components/widget/embed-builder';
import type { Quiz } from '@/types/quiz';

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  player: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
}));

vi.mock('@/components/quiz/quiz-player', () => ({
  QuizPlayer: (props: { quiz: Quiz; locale: string }) => {
    mocks.player(props);
    return <div data-testid="quiz-player" />;
  },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import EmbedQuizPage, { generateMetadata } from '@/app/embed/[locale]/[slug]/page';

const LABELS: EmbedBuilderLabels = {
  searchLabel: 'Elige un quiz',
  searchPlaceholder: 'Busca por título…',
  searching: 'Buscando…',
  noResults: 'No encontramos quizzes con ese título.',
  searchError: 'No pudimos cargar el catálogo. Inténtalo de nuevo.',
  pickQuiz: 'Elige un quiz en el buscador para generar el código.',
  changeQuiz: 'Elegir otro quiz',
  previewLabel: 'Vista previa',
  previewIframeTitle: 'Vista previa de {title}',
  heightLabel: 'Altura del widget',
  codeLabel: 'Código para incrustar',
  copyCode: 'Copiar código',
  copied: '¡Copiado!',
  copyFailed: 'No pudimos copiar: selecciona el código y cópialo a mano.',
};

const QUIZ_ITEM = { slug: 'mi-quiz', title: 'Mi Quiz', questionCount: 8, quizType: 'trivia' };

const QUIZ = {
  id: 'quiz-1',
  slug: 'mi-quiz',
  title: 'Mi Quiz',
  description: 'Un quiz de prueba',
  cover_image_url: null,
  quiz_type: 'trivia',
  difficulty: 'easy',
  language: 'es',
  questions: [
    {
      id: 'q1',
      question: '¿Pregunta?',
      options: [
        { id: 'o1', text: 'Bien', is_correct: true },
        { id: 'o2', text: 'Mal', is_correct: false },
      ],
    },
  ],
  results: null,
  tags: [],
  estimated_minutes: 3,
  plays_count: 10,
  shares_count: 0,
  avg_score: null,
  likes_count: 0,
  status: 'published',
  is_featured: false,
  is_ai_generated: false,
  published_at: '2026-01-01T00:00:00Z',
  updated_at: null,
  created_at: '2026-01-01T00:00:00Z',
} as unknown as Quiz;

function catalogResponse(items: unknown[] = [QUIZ_ITEM]) {
  return Response.json({ items, total: items.length, page: 1, limit: 50, hasMore: false });
}

async function flush(ms = 0) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('EmbedBuilder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aplica debounce: teclear rápido dispara una sola búsqueda con el último término', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => catalogResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(<EmbedBuilder locale="es" labels={LABELS} />);
    await flush();
    fetchMock.mockClear();

    const input = screen.getByRole('combobox', { name: 'Elige un quiz' });
    fireEvent.change(input, { target: { value: 'ha' } });
    await flush(200);
    fireEvent.change(input, { target: { value: 'har' } });
    await flush(300);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('q=har');
  });

  it('recorta el término a los 60 caracteres que admite la API', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => catalogResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(<EmbedBuilder locale="es" labels={LABELS} />);
    await flush();
    fetchMock.mockClear();

    const input = screen.getByRole('combobox', { name: 'Elige un quiz' });
    fireEvent.change(input, { target: { value: 'x'.repeat(80) } });
    await flush(300);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(`q=${'x'.repeat(60)}`);
    expect(fetchMock.mock.calls[0][0]).not.toContain('x'.repeat(61));
  });

  it('permite elegir un resultado solo con teclado y genera el código', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => catalogResponse())
    );
    render(<EmbedBuilder locale="es" labels={LABELS} />);
    await flush();

    const input = screen.getByRole('combobox', { name: 'Elige un quiz' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    const code = screen.getByLabelText('Código para incrustar') as HTMLTextAreaElement;
    expect(code.value).toContain('<iframe src="http://localhost:3000/embed/es/mi-quiz"');
    expect(code.value).toContain('width="600"');
    expect(code.value).toContain('height="720"');
    expect(code.value).toContain('href="http://localhost:3000/es/quiz/mi-quiz"');
    expect(code.value).toContain('rel="noopener"');
    expect(code.value).not.toContain('nofollow');

    const preview = screen.getByTitle('Vista previa de Mi Quiz');
    expect(preview).toHaveAttribute('src', 'http://localhost:3000/embed/es/mi-quiz');
  });

  it('el selector de altura cambia el iframe del código y la vista previa', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => catalogResponse())
    );
    render(<EmbedBuilder locale="es" labels={LABELS} />);
    await flush();

    const input = screen.getByRole('combobox', { name: 'Elige un quiz' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.change(screen.getByLabelText('Altura del widget'), { target: { value: '900' } });

    const code = screen.getByLabelText('Código para incrustar') as HTMLTextAreaElement;
    expect(code.value).toContain('height="900"');
    expect(screen.getByTitle('Vista previa de Mi Quiz')).toHaveStyle({ height: '900px' });
  });

  it('el botón copia el snippet y muestra el estado «Copiado»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => catalogResponse())
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<EmbedBuilder locale="es" labels={LABELS} />);
    await flush();

    const input = screen.getByRole('combobox', { name: 'Elige un quiz' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await act(async () => {});

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('<iframe src="http://localhost:3000/embed/es/mi-quiz"');
    expect(copied).toContain('<a href="http://localhost:3000/es/quiz/mi-quiz"');
    expect(screen.getByRole('button', { name: '¡Copiado!' })).toBeInTheDocument();
  });
});

describe('/embed/{locale}/{slug}', () => {
  beforeEach(() => {
    mocks.getQuizBySlug.mockResolvedValue(QUIZ);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('enlaza a la ficha con target _blank y rel noopener, sin nofollow', async () => {
    const ui = await EmbedQuizPage({
      params: Promise.resolve({ locale: 'es', slug: 'mi-quiz' }),
    });
    render(ui);

    const link = screen.getByRole('link', { name: /Juega “Mi Quiz” en QuizVerse/ });
    expect(link).toHaveAttribute('href', 'https://quizverse.org/es/quiz/mi-quiz');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(link.getAttribute('rel')).not.toContain('nofollow');
  });

  it('el jugador recibe el quiz sin clave de respuestas (is_correct)', async () => {
    const ui = await EmbedQuizPage({
      params: Promise.resolve({ locale: 'es', slug: 'mi-quiz' }),
    });
    render(ui);

    expect(mocks.player).toHaveBeenCalled();
    const quiz = mocks.player.mock.calls[0][0].quiz as Quiz;
    expect(quiz.questions[0].options[0]).not.toHaveProperty('is_correct');
  });

  it('genera metadata noindex', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'es', slug: 'mi-quiz' }),
    });
    expect(metadata.robots).toMatchObject({ index: false });
  });
});
