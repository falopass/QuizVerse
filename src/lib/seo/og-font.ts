import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// En Workers la fuente viaja como asset estático; fuera de Cloudflare
// (Vercel, Node, tests) se sigue leyendo del filesystem como antes.
async function loadFont(): Promise<ArrayBuffer> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    const response = await env.ASSETS.fetch(
      new URL('/fonts/ArchivoBlack-Regular.ttf', 'https://assets.local')
    );
    if (!response.ok) throw new Error(`asset ArchivoBlack: ${response.status}`);
    return response.arrayBuffer();
  } catch {
    const bytes = await readFile(
      join(process.cwd(), 'public', 'fonts', 'ArchivoBlack-Regular.ttf')
    );
    return Uint8Array.from(bytes).buffer;
  }
}

let fontPromise: Promise<ArrayBuffer> | undefined;

export async function arcadeOgOptions() {
  fontPromise ??= loadFont();
  return {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Archivo Black', data: await fontPromise, weight: 400 as const }],
  };
}
