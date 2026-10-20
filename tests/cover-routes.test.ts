/**
 * Contract tests for the two cover-serving routes.
 *
 * GET /covers/[slug] always renders the procedural SVG cover.
 * GET /stock-covers/[slug] proxies the stock photo when the manifest has an
 * entry and the upstream fetch succeeds, otherwise it falls back to the same
 * procedural SVG. Both routes are the only path every quiz cover takes, so a
 * regression here silently breaks every card and OG image.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { QuizCoverArt } from '@/components/shared/quiz-cover-art';

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getStockCoverEntry: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
}));

vi.mock('@/lib/data/stock-cover-manifest', () => ({
  getStockCoverEntry: mocks.getStockCoverEntry,
}));

import { GET as coverGet } from '@/app/covers/[slug]/route';
import { GET as stockCoverGet } from '@/app/stock-covers/[slug]/route';

const fakeQuiz = {
  slug: 'space-trivia',
  title: 'Space Trivia',
  description: 'How much do you know about space?',
  quiz_type: 'trivia',
  category: { name: 'Science', icon: 'S' },
};

const fakeEntry = {
  slug: 'space-trivia',
  provider: 'pexels' as const,
  image_url: 'https://images.example/space.jpg',
  source_url: 'https://example.com/photo',
  attribution: 'Someone',
  query: 'space',
};

function params(slug: string | undefined) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  mocks.getQuizBySlug.mockReset().mockResolvedValue(fakeQuiz);
  mocks.getStockCoverEntry.mockReset().mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /covers/[slug]', () => {
  it('returns 404 when the slug is empty', async () => {
    const response = await coverGet(new Request('http://test/covers/x'), params(undefined));

    expect(response.status).toBe(404);
    expect(mocks.getQuizBySlug).not.toHaveBeenCalled();
  });

  it('serves the procedural SVG with immutable caching for an existing quiz', async () => {
    const response = await coverGet(
      new Request('http://test/covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(await response.text()).toContain('<svg');
    expect(mocks.getQuizBySlug).toHaveBeenCalledWith('space-trivia');
  });

  it('returns 404 when the quiz does not exist', async () => {
    mocks.getQuizBySlug.mockResolvedValue(null);

    const response = await coverGet(new Request('http://test/covers/nope'), params('nope'));

    expect(response.status).toBe(404);
  });
});

describe('GET /stock-covers/[slug]', () => {
  it('proxies the stock photo preserving its content-type', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'image/webp' },
        })
      )
    );

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetch).toHaveBeenCalledWith(fakeEntry.image_url, expect.anything());
    expect(mocks.getQuizBySlug).not.toHaveBeenCalled();
  });

  it('falls back to short-lived procedural SVG when the upstream fetch fails', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toContain('max-age=60');
    expect(response.headers.get('cache-control')).not.toContain('immutable');
    expect(await response.text()).toContain('<svg');
  });

  it('falls back to short-lived procedural SVG when the upstream responds !ok', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('gone', { status: 404 })));

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toContain('max-age=60');
    expect(response.headers.get('cache-control')).not.toContain('immutable');
  });

  it('serves short-lived procedural SVG when the slug has no manifest entry', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toContain('max-age=60');
    expect(response.headers.get('cache-control')).not.toContain('immutable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 404 when there is no manifest entry and no quiz', async () => {
    mocks.getQuizBySlug.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/nope'),
      params('nope')
    );

    expect(response.status).toBe(404);
  });

  it('returns 404 when the slug is empty', async () => {
    const response = await stockCoverGet(
      new Request('http://test/stock-covers/x'),
      params(undefined)
    );

    expect(response.status).toBe(404);
    expect(mocks.getStockCoverEntry).not.toHaveBeenCalled();
  });

  // Une las dos mitades del contrato: la URL exacta que QuizCoverArt pinta en
  // la tarjeta, pedida a la ruta con el proveedor caído, devuelve un SVG que
  // el navegador sí renderiza en <img> (el optimizador lo rechazaba con 400).
  it('serves the SVG fallback at the exact URL the card renders when the provider is down', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { container } = render(
      React.createElement(QuizCoverArt, {
        quiz: {
          slug: 'space-trivia',
          title: 'Space Trivia',
          quiz_type: 'trivia',
          category: null,
          cover_image_url: '/stock-covers/space-trivia',
        },
        locale: 'es',
        decorative: true,
      })
    );
    const src = container.querySelector('img.arcade-cover-photo')?.getAttribute('src');
    expect(src).toBe('/stock-covers/space-trivia');

    const response = await stockCoverGet(new Request(`http://test${src}`), params('space-trivia'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(await response.text()).toContain('<svg');
  });
});
