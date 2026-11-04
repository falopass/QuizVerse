/**
 * Tests de render de `/{locale}/fandom/{slug}`: el hub de franquicia.
 *
 * La página existe solo con ≥3 quizzes del idioma en la franquicia — el mock
 * de `getFandomHub` devuelve `null` igual que la capa real cuando el grupo no
 * llega al mínimo, así que el 404 queda cubierto por el mismo camino.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FandomQuizHub, FandomCardQuiz } from '@/lib/data/fandom';
import type { Locale } from '@/lib/i18n/dictionaries';

const dbMocks = vi.hoisted(() => ({
  getFandomHub: vi.fn(),
  getFandomAlternateSlug: vi.fn(),
}));

vi.mock('@/lib/data/fandom', () => ({
  getFandomHub: dbMocks.getFandomHub,
  getFandomAlternateSlug: dbMocks.getFandomAlternateSlug,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import LocalizedFandomPage, {
  generateMetadata,
  generateStaticParams,
} from '@/app/[locale]/fandom/[slug]/page';

const ANIME = { id: 'cat-anime', slug: 'anime-manga', name: 'Anime & Manga' };

function card(slug: string, title: string, quizType: 'trivia' | 'personality'): FandomCardQuiz {
  return {
    id: `id-${slug}`,
    slug,
    title,
    description: null,
    cover_image_url: null,
    quiz_type: quizType,
    estimated_minutes: 3,
    plays_count: 0,
    likes_count: 0,
    is_featured: false,
    tags: [],
    category: ANIME,
  };
}

const FRIEREN_HUB: FandomQuizHub = {
  slug: 'frieren',
  name: 'Frieren',
  quizzes: [
    card('es-trivia-fan-de-frieren', 'Trivia fan de Frieren', 'trivia'),
    card('es-frieren-energia', '¿Qué energía de Frieren combina mejor contigo?', 'personality'),
    card('es-frieren-rol', '¿Qué rol jugarías dentro de Frieren?', 'personality'),
    card('es-frieren-profundo', '¿Qué tan profundo llega tu conocimiento de Frieren?', 'trivia'),
  ],
};

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return (JSON.parse(script!.textContent!) as { '@graph': Array<Record<string, unknown>> })[
    '@graph'
  ];
}

async function renderPage(slug = 'frieren', locale: Locale = 'es') {
  return render(await LocalizedFandomPage({ params: Promise.resolve({ locale, slug }) }));
}

beforeEach(() => {
  dbMocks.getFandomHub.mockReset();
  dbMocks.getFandomAlternateSlug.mockReset();
  dbMocks.getFandomHub.mockResolvedValue(FRIEREN_HUB);
  dbMocks.getFandomAlternateSlug.mockResolvedValue(null);
});

describe('LocalizedFandomPage · render', () => {
  it('pinta el H1 «Quizzes de {franquicia}», la intro con conteo, tipos y categoría', async () => {
    await renderPage('frieren', 'es');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Quizzes de Frieren' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /los 4 quizzes de Frieren: trivia y tests de personalidad, dentro de Anime y manga/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('4 juegos mostrados')).toBeInTheDocument();
  });

  it('en inglés titula «{Franchise} quizzes»', async () => {
    await renderPage('frieren', 'en');
    expect(screen.getByRole('heading', { level: 1, name: 'Frieren quizzes' })).toBeInTheDocument();
  });

  it('enlaza una tarjeta por quiz del hub', async () => {
    await renderPage();
    for (const quiz of FRIEREN_HUB.quizzes) {
      expect(
        screen.getByRole('link', { name: new RegExp(quiz.title.slice(0, 15)) })
      ).toBeInTheDocument();
    }
  });

  it('enlaza la categoría dominante del hub', async () => {
    await renderPage('frieren', 'es');
    const link = screen.getByRole('link', { name: /Ver todos los quizzes de Anime y manga/ });
    expect(link).toHaveAttribute('href', '/es/category/anime-manga');
  });

  it('emite WebPage + BreadcrumbList + ItemList en el JSON-LD', async () => {
    const { container } = await renderPage();
    const types = jsonLd(container).map((node) => node['@type']);
    expect(types).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'ItemList']));
  });

  it('hace notFound cuando el hub no existe (menos de 3 quizzes)', async () => {
    dbMocks.getFandomHub.mockResolvedValue(null);
    await expect(renderPage('inexistente')).rejects.toThrow('notFound');
  });
});

describe('LocalizedFandomPage · ISR', () => {
  it('exporta generateStaticParams vacío: activa el ISR bajo demanda sin prerenderizar hubs', () => {
    expect(generateStaticParams()).toEqual([]);
  });
});

describe('LocalizedFandomPage · metadata', () => {
  it('construye título, canonical y descripción con buildMetadata', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'es', slug: 'frieren' }),
    });
    expect(metadata.title).toBe('Quizzes de Frieren');
    expect(metadata.alternates?.canonical).toBe('https://quizverse.org/es/fandom/frieren');
    expect(metadata.description).toContain('4 quizzes de Frieren');
  });

  it('emite hreflang solo cuando el otro idioma tiene hub', async () => {
    dbMocks.getFandomAlternateSlug.mockResolvedValue('frieren-en');
    const withPair = await generateMetadata({
      params: Promise.resolve({ locale: 'es', slug: 'frieren' }),
    });
    expect(withPair.alternates?.languages?.en).toBe('https://quizverse.org/en/fandom/frieren-en');

    dbMocks.getFandomAlternateSlug.mockResolvedValue(null);
    const withoutPair = await generateMetadata({
      params: Promise.resolve({ locale: 'en', slug: 'frieren' }),
    });
    expect(withoutPair.alternates?.languages?.es).toBeUndefined();
  });

  it('sin hub devuelve el título de no encontrado', async () => {
    dbMocks.getFandomHub.mockResolvedValue(null);
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'es', slug: 'nada' }),
    });
    expect(metadata.title).toBe('Página no encontrada');
  });
});
