import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

import type { PersonalityResult } from '@/types/quiz';

export interface ShareImageOptions {
  title: string;
  result: string;
  description?: string;
  score?: string;
  username?: string;
  avatarUrl?: string;
  backgroundTheme?: PersonalityResult['background_theme'];
}

const themeGradients: Record<NonNullable<ShareImageOptions['backgroundTheme']>, string> = {
  fire: 'url(#fireGradient)',
  ice: 'url(#iceGradient)',
  stars: 'url(#starsGradient)',
  ocean: 'url(#oceanGradient)',
  forest: 'url(#forestGradient)',
  mystic: 'url(#mysticGradient)',
};

export async function generateShareImage(options: ShareImageOptions): Promise<Buffer> {
  const {
    title,
    result,
    description,
    score,
    username,
    avatarUrl,
    backgroundTheme = 'mystic',
  } = options;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '48px',
          background: themeGradients[backgroundTheme],
          fontFamily: 'Inter, sans-serif',
        },
        children: [
          // Gradients definition
          {
            type: 'svg',
            props: {
              style: { position: 'absolute', width: 0, height: 0 },
              children: [
                {
                  type: 'defs',
                  props: {
                    children: [
                      {
                        type: 'linearGradient',
                        props: {
                          id: 'fireGradient',
                          x1: '0%',
                          y1: '0%',
                          x2: '0%',
                          y2: '100%',
                          children: [
                            { type: 'stop', props: { offset: '0%', stopColor: '#ef4444' } },
                            { type: 'stop', props: { offset: '100%', stopColor: '#f59e0b' } },
                          ],
                        },
                      },
                      {
                        type: 'linearGradient',
                        props: {
                          id: 'iceGradient',
                          x1: '0%',
                          y1: '0%',
                          x2: '0%',
                          y2: '100%',
                          children: [
                            { type: 'stop', props: { offset: '0%', stopColor: '#06b6d4' } },
                            { type: 'stop', props: { offset: '100%', stopColor: '#3b82f6' } },
                          ],
                        },
                      },
                      {
                        type: 'linearGradient',
                        props: {
                          id: 'starsGradient',
                          x1: '0%',
                          y1: '0%',
                          x2: '0%',
                          y2: '100%',
                          children: [
                            { type: 'stop', props: { offset: '0%', stopColor: '#7c3aed' } },
                            { type: 'stop', props: { offset: '100%', stopColor: '#ec4899' } },
                          ],
                        },
                      },
                      {
                        type: 'linearGradient',
                        props: {
                          id: 'oceanGradient',
                          x1: '0%',
                          y1: '0%',
                          x2: '0%',
                          y2: '100%',
                          children: [
                            { type: 'stop', props: { offset: '0%', stopColor: '#1e3a5f' } },
                            { type: 'stop', props: { offset: '100%', stopColor: '#06b6d4' } },
                          ],
                        },
                      },
                      {
                        type: 'linearGradient',
                        props: {
                          id: 'forestGradient',
                          x1: '0%',
                          y1: '0%',
                          x2: '0%',
                          y2: '100%',
                          children: [
                            { type: 'stop', props: { offset: '0%', stopColor: '#166534' } },
                            { type: 'stop', props: { offset: '100%', stopColor: '#22c55e' } },
                          ],
                        },
                      },
                      {
                        type: 'linearGradient',
                        props: {
                          id: 'mysticGradient',
                          x1: '0%',
                          y1: '0%',
                          x2: '0%',
                          y2: '100%',
                          children: [
                            { type: 'stop', props: { offset: '0%', stopColor: '#7c3aed' } },
                            { type: 'stop', props: { offset: '50%', stopColor: '#06b6d4' } },
                            { type: 'stop', props: { offset: '100%', stopColor: '#7c3aed' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // Main content
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'space-between',
              },
              children: [
                // Header
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      marginBottom: '32px',
                    },
                    children: [
                      // Logo/branding
                      {
                        type: 'div',
                        props: {
                          style: {
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                          },
                          children: '🧠',
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '28px',
                            fontWeight: '700',
                            color: 'white',
                          },
                          children: 'QuizVerse',
                        },
                      },
                    ],
                  },
                },
                // Main result
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    },
                    children: [
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '20px',
                            color: 'rgba(255,255,255,0.8)',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                          },
                          children: 'Your Result',
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '64px',
                            fontWeight: '800',
                            color: 'white',
                            textShadow: '0 4px 24px rgba(0,0,0,0.3)',
                          },
                          children: result,
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '24px',
                            color: 'rgba(255,255,255,0.9)',
                            maxWidth: '800px',
                          },
                          children: description || '',
                        },
                      },
                    ],
                  },
                },
                // Footer with quiz title and score
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '32px',
                      borderTop: '2px solid rgba(255,255,255,0.2)',
                    },
                    children: [
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '20px',
                            color: 'rgba(255,255,255,0.9)',
                            maxWidth: '600px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                          children: title,
                        },
                      },
                      score && {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 24px',
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: '9999px',
                          },
                          children: [
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '20px',
                                  color: 'white',
                                  fontWeight: '600',
                                },
                                children: score,
                              },
                            },
                          ],
                        },
                      },
                    ].filter(Boolean),
                  },
                },
              ],
            },
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: await fetch(
            'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2'
          ).then((res) => res.arrayBuffer()),
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: await fetch(
            'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhRz5jV.woff2'
          ).then((res) => res.arrayBuffer()),
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: await fetch(
            'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuOKfY9xKlyLj.woff2'
          ).then((res) => res.arrayBuffer()),
          weight: 800,
          style: 'normal',
        },
      ],
    }
  );

  const resvg = new Resvg(svg);
  const pngData = resvg.render();
  return pngData.asPng();
}

export default generateShareImage;
