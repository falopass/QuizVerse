import { ImageResponse } from 'next/og';
import { arcadeOgOptions } from '@/lib/seo/og-font';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getPublishedQuizCount } from '@/lib/data/public';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// La ruta es dinámica (el conteo lee cookies() vía el cliente SSR), así que
// `revalidate` no la cachearía: el cacheo va en cabeceras, como en la home.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
};

function brandCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#101019',
        color: '#d9ff43',
        fontSize: 72,
        fontWeight: 900,
      }}
    >
      QUIZVERSE
    </div>
  );
}

export default async function IndiceOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const uiLocale = hasLocale(locale) ? locale : 'en';
  const count = await getPublishedQuizCount(uiLocale);
  if (count === 0) {
    return new ImageResponse(brandCard(), {
      ...(await arcadeOgOptions()),
      headers: CACHE_HEADERS,
    });
  }
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
          {uiLocale === 'es' ? `${count} quizzes publicados` : `${count} published quizzes`}
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
          {uiLocale === 'es' ? 'Índice del catálogo' : 'Catalog index'}
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
        {uiLocale === 'es' ? 'Ver todo >' : 'See all >'}
      </div>
    </div>,
    { ...(await arcadeOgOptions()), headers: CACHE_HEADERS }
  );
}
