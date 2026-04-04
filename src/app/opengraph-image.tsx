import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
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
            'radial-gradient(circle at top left, rgba(255,255,255,0.85), transparent 34%), linear-gradient(135deg, #f4eadb 0%, #efe5d6 42%, #e2d7c7 100%)',
          color: '#181410',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 16,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: '#756758',
              }}
            >
              QuizVerse
            </div>
            <div style={{ fontSize: 76, lineHeight: 1.02, fontWeight: 700, maxWidth: 760 }}>
              Editorial quizzes with sharper taste.
            </div>
          </div>
          <div
            style={{
              width: 118,
              height: 118,
              borderRadius: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(145deg, #bb5c35, #5c3425)',
              color: '#fffaf3',
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            QV
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 24,
          }}
        >
          <div
            style={{
              borderRadius: 32,
              border: '1px solid rgba(24,20,16,0.08)',
              background: 'rgba(255,250,244,0.78)',
              padding: '26px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              width: 700,
            }}
          >
            <div style={{ fontSize: 15, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#8b7a68' }}>
              Play. Create. Share.
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.2 }}>
              Personality, trivia and fast editorial formats across English and Spanish.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              width: 360,
            }}
          >
            {['Featured', 'Bilingual', 'Launch-ready'].map((label) => (
              <div
                key={label}
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(24,20,16,0.08)',
                  background: 'rgba(255,255,255,0.7)',
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
      </div>
    ),
    size
  );
}
