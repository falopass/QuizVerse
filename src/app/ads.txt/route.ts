import { serverAdsPublisherId } from '@/lib/ads/server';

/** ID de certificación de Google para AdSense (fijo, publicado por Google). */
const ADSENSE_CERT_AUTHORITY = 'f08c47fec0942fa0';

// La variable no pública se lee en cada request: activar o desactivar el
// archivo en el Worker no exige otro build.
export const dynamic = 'force-dynamic';

export function GET() {
  const client = serverAdsPublisherId();
  if (!client) return new Response('Not found', { status: 404 });

  const publisherId = client.replace(/^ca-/, '');
  return new Response(`google.com, ${publisherId}, DIRECT, ${ADSENSE_CERT_AUTHORITY}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
