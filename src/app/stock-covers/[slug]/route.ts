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

/**
 * Límites del proxy: la URL sale del manifest (repo-controlado), así que el
 * SSRF clásico no aplica, pero un origen lento o enorme consumiría memoria y
 * tiempo del Worker. Timeout duro, tope de bytes leyendo el stream (nunca un
 * arrayBuffer sin cap) y solo `image/*` sobre HTTPS de un host del manifest.
 */
const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(['images.pexels.com', 'cdn.pixabay.com', 'pixabay.com']);

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/** Lee el body con tope real: `null` si supera `maxBytes` (cancela el stream). */
async function readBodyWithCap(response: Response, maxBytes: number): Promise<ArrayBuffer | null> {
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return buffer.byteLength <= maxBytes ? buffer : null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer.buffer;
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
  const imageUrl = entry ? stockImageVariantUrl(entry.image_url) : null;

  if (entry && imageUrl && isAllowedImageUrl(imageUrl)) {
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'QuizVerse/1.0',
        },
        // La allowlist solo cubre la URL inicial: un 30x del proveedor podría
        // llevar el proxy a cualquier host. Sin seguimiento, el 30x no es ok
        // y cae al SVG procedural.
        redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        next: { revalidate: 60 * 60 * 24 },
      });

      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      // Un content-length que ya supera el tope evita leer el body; si falta
      // (chunked) o miente, readBodyWithCap corta igualmente al límite.
      const declaredHeader = response.headers.get('content-length');
      const declared = declaredHeader === null ? null : Number(declaredHeader);
      const withinCap =
        declared === null || (Number.isFinite(declared) && declared <= MAX_IMAGE_BYTES);

      if (response.ok && contentType?.startsWith('image/') && withinCap) {
        const arrayBuffer = await readBodyWithCap(response, MAX_IMAGE_BYTES);
        if (arrayBuffer !== null) {
          // ?v= es un hash de la URL de origen: coincide solo mientras la foto
          // no cambie, así que una URL versionada puede cachearse un año entero.
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
