import { adsPublisherId } from '@/lib/ads/config';

/** ID de certificación de Google para AdSense (fijo, publicado por Google). */
const ADSENSE_CERT_AUTHORITY = 'f08c47fec0942fa0';

// Se lee en cada request: el publisher vive en el entorno del Worker, así que
// activar o desactivar el archivo no exige otro build.
export const dynamic = 'force-dynamic';

export function GET() {
  const client = adsPublisherId();
  if (!client) return new Response('Not found', { status: 404 });

  const publisherId = client.replace(/^ca-/, '');
  return new Response(`google.com, ${publisherId}, DIRECT, ${ADSENSE_CERT_AUTHORITY}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
