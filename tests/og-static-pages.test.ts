/**
 * Contract test for the /indice and /faq OG cards (SEO-48).
 *
 * Next registers an `opengraph-image` route from the module's static exports:
 * `size` fixes the PNG at 1200×630 and `contentType` declares the format. The
 * default export renders the card via ImageResponse at request time — running
 * Satori inside vitest is out of scope, so this suite only pins the exports
 * the framework consumes; rendering is exercised in the Vercel preview.
 *
 * It also pins the metadata wiring: buildMetadata always sets
 * `openGraph.images` and `twitter.images`, which shadows the file convention
 * at meta-tag level, so each page must pass `image:` pointing at its dynamic
 * route (same pattern as homeOgImage/quizOgImage/categoryOgImage).
 */

import { describe, expect, it } from 'vitest';
import * as indiceOg from '@/app/[locale]/indice/opengraph-image';
import * as faqOg from '@/app/[locale]/faq/opengraph-image';
import { generateMetadata as indiceMetadata } from '@/app/[locale]/indice/page';
import { generateMetadata as faqMetadata } from '@/app/[locale]/faq/page';
import { SITE_URL } from '@/lib/seo/site';
import type { Metadata } from 'next';

const cases = [
  { route: '/indice', mod: indiceOg, generateMetadata: indiceMetadata },
  { route: '/faq', mod: faqOg, generateMetadata: faqMetadata },
];

describe('opengraph-image for /indice and /faq', () => {
  it.each(cases)('$route declares a 1200×630 PNG card', ({ mod }) => {
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe('image/png');
    expect(typeof mod.default).toBe('function');
  });

  it.each(cases)(
    '$route metadata points og:image and twitter:image at the dynamic card',
    async ({ route, generateMetadata }) => {
      const metadata: Metadata = await generateMetadata({
        params: Promise.resolve({ locale: 'es' }),
      });
      const expected = `${SITE_URL}/es${route}/opengraph-image`;
      const og = metadata.openGraph as { images?: Array<{ url?: string }> };
      const twitter = metadata.twitter as { images?: Array<string | { url?: string }> };

      expect(og.images?.[0]?.url).toBe(expected);
      const twitterImage = twitter.images?.[0];
      expect(typeof twitterImage === 'string' ? twitterImage : twitterImage?.url).toBe(expected);
    }
  );
});
