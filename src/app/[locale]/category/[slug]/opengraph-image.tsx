import { ImageResponse } from 'next/og';
import { arcadeOgOptions } from '@/lib/seo/og-font';
import { OG_CACHE_HEADERS } from '@/lib/seo/og-cache';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getCategoryPayload } from '@/lib/data/public';
import { getLocalizedTypeLabel, localizeCategory } from '@/lib/i18n/catalog';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function CategoryOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const uiLocale = hasLocale(locale) ? locale : 'en';
  const payload = await getCategoryPayload(slug, uiLocale);
  if (!payload || payload.quizzes.length === 0) {
    return new ImageResponse(
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
      </div>,
      await arcadeOgOptions()
    );
  }
  const category = localizeCategory(payload.category, uiLocale)!;
  const types = [...new Set(payload.quizzes.map((quiz) => quiz.quiz_type))]
    .map((type) => getLocalizedTypeLabel(type, uiLocale))
    .join(' & ');
  const contextLine =
    uiLocale === 'es'
      ? `${payload.quizzes.length} quizzes en español`
      : `${payload.quizzes.length} quizzes · ${types}`;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: 48,
        gap: 34,
        background: '#101019',
        color: '#f6f3ff',
      }}
    >
      <div
        style={{
          width: 700,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
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
            {contextLine}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 18,
              maxHeight: 390,
              overflow: 'hidden',
              fontSize: category.name.length > 65 ? 52 : category.name.length > 40 ? 64 : 78,
              lineHeight: 0.98,
              fontFamily: 'Archivo Black',
              letterSpacing: '-0.05em',
            }}
          >
            {category.name}
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
          {uiLocale === 'es' ? 'Jugar ahora >' : 'Play now >'}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 370,
          overflow: 'hidden',
          border: '8px solid #d9ff43',
          background: category.color ?? '#8458ff',
          transform: 'rotate(3deg)',
          fontFamily: 'Archivo Black',
          fontSize: 260,
          color: '#f6f3ff',
        }}
      >
        {category.name.charAt(0).toUpperCase()}
      </div>
    </div>,
    { ...(await arcadeOgOptions()), headers: OG_CACHE_HEADERS }
  );
}
