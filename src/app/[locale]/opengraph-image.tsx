import { ImageResponse } from 'next/og';
import { arcadeOgOptions } from '@/lib/seo/og-font';
import { hasLocale } from '@/lib/i18n/dictionaries';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function LocaleOpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const es = hasLocale(locale) && locale === 'es';
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56, background: '#101019', color: '#f6f3ff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 34, fontFamily: 'Archivo Black', letterSpacing: '-0.06em' }}>QUIZ<span style={{ color: '#d9ff43' }}>VERSE</span></div>
        <div style={{ display: 'flex', border: '2px solid #d9ff43', borderRadius: 999, padding: '12px 22px', color: '#d9ff43', fontSize: 20, fontWeight: 800 }}>{es ? 'ELIGE UN JUEGO >' : 'PICK A GAME >'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1020 }}>
        <div style={{ display: 'flex', color: '#d9ff43', fontSize: 22, fontWeight: 800, letterSpacing: '0.2em' }}>{es ? 'PERSONALIDAD / TRIVIA / FANDOM' : 'PERSONALITY / TRIVIA / FANDOM'}</div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 108, lineHeight: 0.94, fontFamily: 'Archivo Black', letterSpacing: '-0.07em', textTransform: 'uppercase' }}>{es ? 'Juega tu cultura pop.' : 'Play your pop culture.'}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #474558', paddingTop: 24 }}>
        <div style={{ display: 'flex', fontSize: 24 }}>{es ? 'Encuentra tu personaje. Demuestra que eres fan.' : 'Find your character. Prove you are a superfan.'}</div>
        <div style={{ display: 'flex', width: 64, height: 64, alignItems: 'center', justifyContent: 'center', background: '#ff4d97', color: '#101019', fontSize: 24, fontFamily: 'Archivo Black' }}>QV</div>
      </div>
    </div>,
    await arcadeOgOptions()
  );
}
