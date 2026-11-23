// Contrato del script de hidratación de portadas stock (L8): importarlo no
// lee el entorno ni escribe nada, por defecto solo reporta y señala las fotos
// de origen repetidas dentro de un mismo locale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(process.cwd(), 'src', 'lib', 'data', 'stock-cover-manifest.json');
const before = fs.readFileSync(manifestPath, 'utf8');

const {
  shouldWrite,
  findLocaleDuplicates,
  sourceFileKey,
  slugLocale,
  stockImageVariantUrl,
  coverVersion,
} = await import('../scripts/hydrate-stock-covers.mjs');

test('importar el script no escribe el manifest', () => {
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), before);
});

test('por defecto es un reporte: solo --write o STOCK_COVER_WRITE=1 escriben', () => {
  assert.equal(shouldWrite(['node', 'script'], {}), false);
  assert.equal(shouldWrite(['node', 'script', '--prune'], {}), false);
  assert.equal(shouldWrite(['node', 'script', '--write'], {}), true);
  assert.equal(shouldWrite(['node', 'script'], { STOCK_COVER_WRITE: '1' }), true);
});

test('slugLocale lee el prefijo del slug', () => {
  assert.equal(slugLocale('es-trivia-x'), 'es');
  assert.equal(slugLocale('en-quiz'), 'en');
  assert.equal(slugLocale('launch-x'), null);
});

test('el archivo de origen ignora la query y el sufijo de tamaño', () => {
  const a = sourceFileKey({
    image_url: 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg?w=960&h=640',
  });
  const b = sourceFileKey({ image_url: 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg' });
  assert.equal(a, b);
  assert.equal(
    sourceFileKey({ image_url: 'https://cdn.pixabay.com/photo/a/b_640.jpg' }),
    sourceFileKey({ image_url: 'https://cdn.pixabay.com/photo/a/b_1280.jpg' })
  );
});

test('el par de traducción es/en no es duplicado; dos del mismo locale sí', () => {
  const url = 'https://images.pexels.com/photos/9/pexels-photo-9.jpeg?w=960';
  const manifest = {
    'es-a': { slug: 'es-a', image_url: url },
    'en-a': { slug: 'en-a', image_url: url },
  };
  assert.deepEqual(findLocaleDuplicates(manifest), []);

  manifest['en-b'] = { slug: 'en-b', image_url: url };
  const duplicates = findLocaleDuplicates(manifest);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].locale, 'en');
  assert.deepEqual(duplicates[0].slugs, ['en-a', 'en-b']);
});

test('el manifest versionado: variante servida, versión estable y duplicados visibles', () => {
  const manifest = JSON.parse(before);
  for (const [slug, entry] of Object.entries(manifest)) {
    assert.equal(entry.slug, slug);
    assert.equal(entry.image_url, stockImageVariantUrl(entry.image_url));
    assert.equal(entry.v, coverVersion(entry.image_url));
    assert.ok(entry.source_url?.startsWith('https://'), `${slug} sin página de origen`);
    assert.ok(entry.attribution, `${slug} sin atribución`);
  }
  // El reporte expone las fotos repetidas por locale para que Diego las cure;
  // ninguna entrada nueva puede sumar otro duplicado.
  const repeated = findLocaleDuplicates(manifest).reduce(
    (count, group) => count + group.slugs.length - 1,
    0
  );
  assert.ok(repeated <= 7, `duplicados por locale: ${repeated} (línea base 7)`);
});
