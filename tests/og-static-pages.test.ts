/**
 * Contract test for the /indice and /faq OG cards (SEO-48).
 *
 * Next registers an `opengraph-image` route from the module's static exports:
 * `size` fixes the PNG at 1200×630 and `contentType` declares the format. The
 * default export renders the card via ImageResponse at request time — running
 * Satori inside vitest is out of scope, so this suite only pins the exports
 * the framework consumes; rendering is exercised in the Vercel preview.
 */

import { describe, expect, it } from 'vitest';
import * as indiceOg from '@/app/[locale]/indice/opengraph-image';
import * as faqOg from '@/app/[locale]/faq/opengraph-image';

const cases = [
  { route: '/indice', mod: indiceOg },
  { route: '/faq', mod: faqOg },
];

describe('opengraph-image for /indice and /faq', () => {
  it.each(cases)('$route declares a 1200×630 PNG card', ({ mod }) => {
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe('image/png');
    expect(typeof mod.default).toBe('function');
  });
});
