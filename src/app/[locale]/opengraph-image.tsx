import { ImageResponse } from 'next/og';
import { hasLocale } from '@/lib/i18n/dictionaries';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function LocaleOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const uiLocale = hasLocale(locale) ? locale : 'en';
  const copy =
    uiLocale === 'es'
      ? {
          eyebrow: 'QuizVerse',
          title: 'Quizzes editoriales con más carácter.',
          body: 'Personalidad, trivia y formatos rápidos listos para jugar, crear y compartir.',
          badges: ['Destacados', 'Bilingüe', 'Lanzamiento'],
        }
      : {
          eyebrow: 'QuizVerse',
          title: 'Editorial quizzes with stronger character.',
          body: 'Personality, trivia and fast formats ready to play, create and share.',
          badges: ['Featured', 'Bilingual', 'Launch-ready'],
        };

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 48,
          background:
            'radial-gradient(circle at top left, rgba(255,255,255,0.82), transparent 35%), linear-gradient(135deg, #f4eadb 0%, #efe5d6 40%, #e1d4c4 100%)',
          color: '#181410',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
            <div style={{ fontSize: 16, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#756758' }}>
              {copy.eyebrow}
            </div>
            <div style={{ fontSize: 78, lineHeight: 1.02, fontWeight: 700 }}>{copy.title}</div>
            <div style={{ fontSize: 28, lineHeight: 1.34, color: '#51463e' }}>{copy.body}</div>
          </div>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 36,
              background: 'linear-gradient(145deg, #bb5c35, #5c3425)',
              color: '#fffaf3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 40,
            }}
          >
            {uiLocale.toUpperCase()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {copy.badges.map((label) => (
            <div
              key={label}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(24,20,16,0.08)',
                background: 'rgba(255,255,255,0.72)',
                padding: '12px 18px',
                fontSize: 18,
                color: '#5f5247',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}

