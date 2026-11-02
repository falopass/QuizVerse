import { getStockCoverEntry } from '@/lib/data/stock-cover-manifest';
import { getQuizBySlug } from '@/lib/data/public';
import { buildQuizCoverSvg } from '@/lib/design/cover-svg';

// La caja más grande real es la portada de la ficha (≈480×320 CSS); 960×640
// cubre pantallas 2x sin pasarse. fit=crop fija un 3:2 exacto para que el
// <img> pueda declarar width/height. WebP baja 201–478 KB a ~20–110 KB.
const PEXELS_VARIANT_PARAMS: Record<string, string> = {
  auto: 'compress',
  cs: 'tinysrgb',
  w: '960',
  h: '640',
  fit: 'crop',
  fm: 'webp',
};

/**
 * Reescribe la URL de origen a la variante que el sitio realmente pinta.
 * Pexels acepta parámetros imgix en la query; Pixabay no tiene resize por
 * query y los tamaños van en el sufijo del path (_180/_340/_640/_1280).
 */
export function stockImageVariantUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    if (url.hostname === 'images.pexels.com') {
      url.search = '';
      for (const [key, value] of Object.entries(PEXELS_VARIANT_PARAMS)) {
        url.searchParams.set(key, value);
      }
      return url.toString();
    }
    if (url.hostname === 'cdn.pixabay.com' || url.hostname === 'pixabay.com') {
      url.pathname = url.pathname.replace(/_(1280|1920)(\.[a-z]+)$/i, '_640$2');
      return url.toString();
    }
    return imageUrl;
  } catch {
    return imageUrl;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  const params = await context.params;
  const slug = typeof params.slug === 'string' ? params.slug : '';

  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const entry = getStockCoverEntry(slug);

  if (entry) {
    try {
      const response = await fetch(stockImageVariantUrl(entry.image_url), {
        headers: {
          'User-Agent': 'QuizVerse/1.0',
        },
        next: { revalidate: 60 * 60 * 24 },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        // ?v= es un hash de la URL de origen: coincide solo mientras la foto no
        // cambie, así que una URL versionada puede cachearse un año entero.
        const version = new URL(request.url).searchParams.get('v');
        const cacheControl =
          entry.v && version === entry.v
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=86400, s-maxage=86400';
        return new Response(arrayBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': cacheControl,
          },
        });
      }
    } catch (error) {
      console.error('stock-cover-fetch-failed', { slug, error });
    }
  }

  const quiz = await getQuizBySlug(slug);

  if (!quiz) {
    return new Response('Not found', { status: 404 });
  }

  const svg = buildQuizCoverSvg(quiz);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}
