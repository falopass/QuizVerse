import type { JsonLdGraph } from '@/lib/seo/structured-data';

/**
 * Renders one JSON-LD graph per page.
 *
 * The payload is serialized with `<`, `>` and `&` escaped so user-controlled
 * quiz titles can never break out of the script tag. Google reads JSON-LD from
 * the body just as well as from the head.
 */
export function JsonLd({ data }: { data: JsonLdGraph | Record<string, unknown> | null }) {
  if (!data) return null;

  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export default JsonLd;
