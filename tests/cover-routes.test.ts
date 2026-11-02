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
  image_url:
    'https://images.pexels.com/photos/12345/pexels-photo-12345.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  source_url: 'https://example.com/photo',
  attribution: 'Someone',
  query: 'space',
  v: 'v3rs10n',
};

const fakePixabayEntry = {
  ...fakeEntry,
  provider: 'pixabay' as const,
  image_url: 'https://cdn.pixabay.com/photo/2024/01/01/space_1280.jpg',
};

function stubOkImage(contentType = 'image/webp') {
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(bytes, { status: 200, headers: { 'content-type': contentType } })
      )
  );
}

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
    expect(response.headers.get('cache-control')).not.toContain('immutable');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(mocks.getQuizBySlug).not.toHaveBeenCalled();
  });

  it('reescribe la URL de Pexels a la variante 960x640 WebP (sin dpr)', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    stubOkImage();

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    const fetchedUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    const url = new URL(fetchedUrl);
    expect(url.hostname).toBe('images.pexels.com');
    expect(url.pathname).toBe('/photos/12345/pexels-photo-12345.jpeg');
    expect(url.searchParams.get('w')).toBe('960');
    expect(url.searchParams.get('h')).toBe('640');
    expect(url.searchParams.get('fit')).toBe('crop');
    expect(url.searchParams.get('fm')).toBe('webp');
    expect(url.searchParams.get('dpr')).toBeNull();
  });

  it('sirve caché inmutable de un año cuando ?v= coincide con el manifest', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    stubOkImage();

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia?v=v3rs10n'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('mantiene el TTL corto cuando ?v= no coincide', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    stubOkImage();

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia?v=otro'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
    expect(response.headers.get('cache-control')).not.toContain('immutable');
  });

  it('reescribe el sufijo de tamaño en URLs de Pixabay (_1280 → _640)', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakePixabayEntry);
    stubOkImage('image/jpeg');

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      'https://cdn.pixabay.com/photo/2024/01/01/space_640.jpg'
    );
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

  it('falls back to the procedural SVG when the upstream is not an image', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>oops</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(await response.text()).toContain('<svg');
  });

  it('falls back to the procedural SVG when the declared size exceeds the cap', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const body = new ReadableStream({ start() {} });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'image/webp', 'content-length': String(3 * 1024 * 1024) },
        })
      )
    );

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
  });

  it('falls back to the procedural SVG when the streamed body exceeds the cap', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(oversized, {
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
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
  });

  it('never fetches a manifest URL outside the allowed hosts', async () => {
    mocks.getStockCoverEntry.mockReturnValue({
      ...fakeEntry,
      image_url: 'https://evil.internal/metadata.jpg',
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes a timeout signal to the upstream fetch', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    stubOkImage();

    await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // Workers solo admite 'follow'/'manual': 'error' lanza TypeError y la ruta
    // siempre caía al fallback en producción. Tampoco va `next` (data cache).
    expect(init.redirect).toBe('manual');
    expect(init).not.toHaveProperty('next');
  });

  it('sigue un 3xx cuyo Location es HTTPS y host de la allowlist', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const bytes = new Uint8Array([9, 9]).buffer;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://images.pexels.com/photos/999/ok.jpeg' },
        })
      )
      .mockResolvedValueOnce(
        new Response(bytes, { status: 200, headers: { 'content-type': 'image/webp' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://images.pexels.com/photos/999/ok.jpeg');
    // La cadena comparte un solo presupuesto de timeout, no 8 s por salto.
    expect(fetchMock.mock.calls[1][1]?.signal).toBe(fetchMock.mock.calls[0][1]?.signal);
  });

  it('cae al SVG cuando el 3xx apunta a un host fuera de la allowlist', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.internal/track.png' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(await response.text()).toContain('<svg');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'stock-cover-redirect-rejected',
      expect.objectContaining({ slug: 'space-trivia', locationHost: 'evil.internal' })
    );
    warnSpy.mockRestore();
  });

  it('cae al SVG cuando el 3xx no usa HTTPS', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://images.pexels.com/photos/999/ok.jpeg' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('corta la cadena de 3xx tras el máximo de saltos', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: 'https://images.pexels.com/photos/999/loop.jpeg' },
        })
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    // 1 petición inicial + 2 saltos permitidos; el tercer 3xx se rechaza.
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

  it('logs status and content-type when the upstream responds !ok', async () => {
    mocks.getStockCoverEntry.mockReturnValue(fakeEntry);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>denied</html>', {
          status: 403,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      )
    );

    const response = await stockCoverGet(
      new Request('http://test/stock-covers/space-trivia'),
      params('space-trivia')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(warnSpy).toHaveBeenCalledWith('stock-cover-fetch-not-ok', {
      slug: 'space-trivia',
      status: 403,
      contentType: 'text/html',
    });
    warnSpy.mockRestore();
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
