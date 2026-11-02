import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category } from '@/types/quiz';

const mocks = vi.hoisted(() => ({
  createQuiz: vi.fn(),
  signOutAction: vi.fn(),
  signOut: vi.fn(),
  useSupabase: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  trackEvent: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/actions/quiz.actions', () => ({ createQuiz: mocks.createQuiz }));
vi.mock('@/actions/auth.actions', () => ({ signOutAction: mocks.signOutAction }));
vi.mock('@/providers/supabase-provider', () => ({ useSupabase: mocks.useSupabase }));
vi.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('@/lib/telemetry/client', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from })),
}));
vi.mock('@/components/quiz/quiz-creator-form', () => ({
  QuizCreatorForm: () => <div data-testid="quiz-creator-form" />,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  usePathname: () => '/es',
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

import { AIQuizGenerator } from '@/components/quiz/ai-quiz-generator';
import { UserMenu, UserMenuMobile } from '@/components/layout/user-menu';
import CreatePage from '@/app/[locale]/create/page';
import { isTopicCategory, suggestCategorySlug } from '@/lib/quiz/category-suggest';

const USER = { id: 'user-1', email: 'ada@example.com', user_metadata: { name: 'Ada' } };

const category = (id: string, slug: string, name: string, sort_order: number): Category => ({
  id,
  slug,
  name,
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 5,
  sort_order,
});

const CATEGORIES = [
  category('cat-0', 'personality', 'Personality', 0),
  category('cat-1', 'gaming', 'Gaming', 1),
  category('cat-2', 'music', 'Music', 2),
];

const option = (id: string, is_correct = false) => ({
  id,
  text: `Opción ${id}`,
  is_correct,
});

const triviaDraft = (overrides: Record<string, unknown> = {}) => ({
  title: 'Trivia de videojuegos retro',
  description: 'Una trivia sobre clásicos de los videojuegos.',
  quiz_type: 'trivia',
  questions: ['q1', 'q2', 'q3'].map((id) => ({
    id,
    question: `¿Pregunta ${id}?`,
    options: [option('a', true), option('b'), option('c'), option('d')],
    explanation: null,
  })),
  tags: ['gaming'],
  estimated_minutes: 5,
  ...overrides,
});

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

const generateOk = () =>
  mocks.fetch.mockResolvedValue(
    jsonResponse(200, {
      quiz: triviaDraft(),
      validationWarnings: [],
      rateLimit: { limited: false, remaining: 9 },
    })
  );

function renderGenerator(categories: Category[] = CATEGORIES) {
  return render(<AIQuizGenerator locale="es" categories={categories} />);
}

async function generate(topic: string) {
  fireEvent.change(screen.getByLabelText('Tema o ángulo'), { target: { value: topic } });
  fireEvent.click(screen.getByRole('button', { name: 'Generar con AI' }));
  await screen.findByLabelText('Categoría');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.trackEvent.mockResolvedValue(undefined);
  mocks.useSupabase.mockReturnValue({ user: null, loading: false, signOut: mocks.signOut });
  mocks.createQuiz.mockResolvedValue({ success: true, quiz: { id: 'q-1', slug: 'mi-quiz' } });
});

describe('estudio AI enlazado', () => {
  it('/create muestra un CTA visible al estudio AI', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    const order = vi.fn().mockResolvedValue({ data: CATEGORIES });
    mocks.from.mockReturnValue({ select: vi.fn(() => ({ order })) });

    render(await CreatePage({ params: Promise.resolve({ locale: 'es' }) }));

    expect(screen.getByRole('link', { name: 'Crear con AI' })).toHaveAttribute(
      'href',
      '/es/create/ai'
    );
  });

  it('el menú de usuario enlaza al estudio AI en desktop y móvil', () => {
    mocks.useSupabase.mockReturnValue({ user: USER, loading: false, signOut: mocks.signOut });

    render(<UserMenu locale="es" />);
    fireEvent.click(screen.getByRole('button', { name: /ada/i }));
    expect(screen.getByRole('menuitem', { name: 'Crear con AI' })).toHaveAttribute(
      'href',
      '/es/create/ai'
    );

    render(<UserMenuMobile locale="en" />);
    expect(screen.getByRole('link', { name: 'Create with AI' })).toHaveAttribute(
      'href',
      '/en/create/ai'
    );
  });
});

describe('suggestCategorySlug', () => {
  it('sugiere categorías razonables desde el tema', () => {
    expect(suggestCategorySlug('Trivia de videojuegos')).toBe('gaming');
    expect(suggestCategorySlug('World capitals')).toBe('geography');
    expect(suggestCategorySlug('Eras del pop')).toBe('music');
    expect(suggestCategorySlug('Trivia de cine moderno')).toBe('movies-tv');
  });

  it('«cultura pop» gana a Música y las palabras acentuadas cuentan', () => {
    expect(suggestCategorySlug('Trivia de cultura pop')).toBe('pop-culture');
    expect(suggestCategorySlug('Cultura del café')).toBe('food-drink');
    expect(suggestCategorySlug('Álbum de estudio')).toBe('music');
  });

  it('devuelve null cuando ningún tema encaja', () => {
    expect(suggestCategorySlug('zzz qqq')).toBeNull();
  });

  it('los hubs de tipo no son categorías de tema', () => {
    expect(isTopicCategory('personality')).toBe(false);
    expect(isTopicCategory('trivia')).toBe(false);
    expect(isTopicCategory('gaming')).toBe(true);
  });
});

describe('AIQuizGenerator', () => {
  it('sugiere la categoría desde el tema, la muestra en español y la envía al guardar', async () => {
    generateOk();
    renderGenerator();
    await generate('Trivia de videojuegos');

    const select = screen.getByLabelText('Categoría');
    expect(select).toHaveValue('cat-1');
    expect(screen.getByRole('option', { name: 'Videojuegos' })).toBeInTheDocument();
    // `personality` es un hub de tipo, no una categoría de tema.
    expect(screen.queryByRole('option', { name: 'Personalidad' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() => expect(mocks.createQuiz).toHaveBeenCalledTimes(1));
    const payload = mocks.createQuiz.mock.calls[0][0];
    expect(payload.category_id).toBe('cat-1');
    expect(payload.language).toBe('es');
    expect(payload.is_ai_generated).toBe(true);
  });

  it('bloquea el guardado mientras la categoría sea obligatoria y no esté elegida', async () => {
    generateOk();
    renderGenerator();
    await generate('zzz qqq');

    const save = screen.getByRole('button', { name: 'Guardar borrador' });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(mocks.createQuiz).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'cat-2' } });
    await waitFor(() => expect(save).toBeEnabled());

    fireEvent.click(save);
    await waitFor(() => expect(mocks.createQuiz).toHaveBeenCalledTimes(1));
    expect(mocks.createQuiz.mock.calls[0][0].category_id).toBe('cat-2');
  });

  it('bloquea el guardado cuando los checks de validación fallan', async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse(200, {
        quiz: triviaDraft({ title: 'abc' }),
        validationWarnings: [],
        rateLimit: { limited: false, remaining: 9 },
      })
    );
    renderGenerator();
    await generate('Trivia de videojuegos');

    const save = screen.getByRole('button', { name: 'Guardar borrador' });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(mocks.createQuiz).not.toHaveBeenCalled();
  });

  it('muestra los errores del proveedor localizados y accionables, nunca crudos', async () => {
    mocks.fetch.mockResolvedValue(jsonResponse(502, { error: 'generation_failed' }));
    renderGenerator();
    fireEvent.change(screen.getByLabelText('Tema o ángulo'), {
      target: { value: 'Trivia de videojuegos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar con AI' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'La IA no pudo generar el quiz. Ajusta el tema e inténtalo de nuevo.'
      )
    );
    expect(mocks.error).not.toHaveBeenCalledWith(expect.stringContaining('DeepSeek'));
  });

  it('localiza el límite de generaciones como mensaje accionable', async () => {
    mocks.fetch.mockResolvedValue(jsonResponse(429, { error: 'rate_limited' }));
    renderGenerator();
    fireEvent.change(screen.getByLabelText('Tema o ángulo'), {
      target: { value: 'Trivia de videojuegos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar con AI' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'Llegaste al límite de generaciones. Espera un minuto e inténtalo otra vez.'
      )
    );
  });

  it('no deja generar si las categorías no cargaron', () => {
    renderGenerator([]);

    expect(screen.getByRole('button', { name: 'Generar con AI' })).toBeDisabled();
    expect(
      screen.getByText('No pudimos cargar las categorías. Recarga la página antes de generar.')
    ).toBeInTheDocument();
  });

  it('avisa que la generación tarda mientras espera la respuesta', async () => {
    mocks.fetch.mockReturnValue(new Promise(() => {}));
    renderGenerator();
    fireEvent.change(screen.getByLabelText('Tema o ángulo'), {
      target: { value: 'Trivia de videojuegos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar con AI' }));

    expect(
      await screen.findByText('La IA puede tardar hasta un minuto en escribir el borrador.')
    ).toBeInTheDocument();
  });
});
