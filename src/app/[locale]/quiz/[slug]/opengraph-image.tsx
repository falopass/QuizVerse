import { ImageResponse } from 'next/og';
import { hasLocale } from '@/lib/i18n/dictionaries';
import {
  getLocalizedCategoryLabel,
  getLocalizedDifficultyLabel,
  getLocalizedTypeLabel,
} from '@/lib/i18n/catalog';
import { getCoverTheme } from '@/lib/design/cover-system';
import { getQuizBySlug } from '@/lib/data/public';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function QuizOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const uiLocale = hasLocale(locale) ? locale : 'en';
  const quiz = await getQuizBySlug(slug, uiLocale);

  if (!quiz) {
    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3eadf',
          color: '#181410',
          fontSize: 48,
        }}
      >
        QuizVerse
      </div>,
      size
    );
  }

  const theme = getCoverTheme(quiz);
  const category = getLocalizedCategoryLabel(quiz.category?.slug ?? 'culture', uiLocale);

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 42,
        background: `linear-gradient(135deg, ${theme.base} 0%, ${theme.highlight} 52%, ${theme.deep} 100%)`,
        color: '#fffaf3',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top left, rgba(255,255,255,0.22), transparent 30%), linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.34))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 52,
          top: 68,
          width: 220,
          height: 220,
          borderRadius: 56,
          background: `linear-gradient(145deg, ${theme.deep}, ${theme.highlight})`,
          opacity: 0.92,
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            getLocalizedTypeLabel(quiz.quiz_type, uiLocale),
            getLocalizedDifficultyLabel(quiz.difficulty, uiLocale),
            category,
          ].map((label) => (
            <div
              key={label}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.1)',
                padding: '10px 16px',
                fontSize: 14,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 16,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(255,250,243,0.74)',
          }}
        >
          QuizVerse
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          maxWidth: 780,
        }}
      >
        <div style={{ fontSize: 82, lineHeight: 1.02, fontWeight: 700 }}>{quiz.title}</div>
        <div style={{ fontSize: 28, lineHeight: 1.34, color: 'rgba(255,250,243,0.82)' }}>
          {quiz.description}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ fontSize: 18, color: 'rgba(255,250,243,0.74)' }}>
          {quiz.questions.length} {uiLocale === 'es' ? 'preguntas' : 'questions'} ·{' '}
          {quiz.estimated_minutes} min
        </div>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 32,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          {(quiz.category?.icon ?? quiz.title.charAt(0)).slice(0, 1)}
        </div>
      </div>
    </div>,
    size
  );
}
