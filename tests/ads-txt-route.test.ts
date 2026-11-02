import { afterEach, describe, expect, it, vi } from 'vitest';

async function getAdsTxt() {
  const { GET } = await import('../src/app/ads.txt/route');
  return GET();
}

afterEach(() => vi.unstubAllEnvs());

describe('/ads.txt', () => {
  it('responde 404 mientras no haya publisher ID', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', '');

    const response = await getAdsTxt();

    expect(response.status).toBe(404);
  });

  it('emite la línea de AdSense cuando el publisher está configurado', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', 'ca-pub-1234567890123456');

    const response = await getAdsTxt();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe(
      'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n'
    );
  });

  it('acepta el publisher sin el prefijo ca-', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', 'pub-1234567890123456');

    const response = await getAdsTxt();

    expect(await response.text()).toContain('google.com, pub-1234567890123456, DIRECT');
  });
});
