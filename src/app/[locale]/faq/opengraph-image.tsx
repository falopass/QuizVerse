import { ImageResponse } from 'next/og';
import { arcadeOgOptions } from '@/lib/seo/og-font';
import { hasLocale } from '@/lib/i18n/dictionaries';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
};

export default async function FaqOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const uiLocale = hasLocale(locale) ? locale : 'en';
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 48,
        background: '#101019',
        color: '#f6f3ff',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 30,
          fontFamily: 'Archivo Black',
          letterSpacing: '-0.06em',
        }}
      >
        QUIZ<span style={{ color: '#d9ff43' }}>VERSE</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            color: '#d9ff43',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          {uiLocale === 'es'
            ? 'jugar · gratis · puntos · crear tu quiz'
            : 'play · free · points · create your quiz'}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 18,
            fontSize: 78,
            lineHeight: 0.98,
            fontFamily: 'Archivo Black',
            letterSpacing: '-0.05em',
          }}
        >
          {uiLocale === 'es' ? 'Preguntas frecuentes' : 'FAQ'}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: 300,
          borderRadius: 999,
          padding: '16px 24px',
          background: '#d9ff43',
          color: '#101019',
          fontSize: 20,
          fontWeight: 800,
          textTransform: 'uppercase',
        }}
      >
        {uiLocale === 'es' ? 'Jugar gratis >' : 'Play for free >'}
      </div>
    </div>,
    { ...(await arcadeOgOptions()), headers: CACHE_HEADERS }
  );
}
