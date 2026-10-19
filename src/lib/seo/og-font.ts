import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const font = readFile(join(process.cwd(), 'public', 'fonts', 'ArchivoBlack-Regular.ttf')).then(
  (bytes) => Uint8Array.from(bytes).buffer
);

export async function arcadeOgOptions() {
  return {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Archivo Black', data: await font, weight: 400 as const }],
  };
}
