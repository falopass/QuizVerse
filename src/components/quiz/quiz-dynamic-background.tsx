import type { VisualFamily } from '@/types/quiz';

const FAMILY_PALETTES: Record<VisualFamily, string> = {
  'space-opera': 'radial-gradient(circle_at_top,rgba(79,70,229,0.09),transparent_35%),linear-gradient(180deg,rgba(15,18,35,0.98),rgba(22,26,48,0.98))',
  'dark-fantasy': 'radial-gradient(circle_at_top,rgba(139,92,246,0.08),transparent_35%),linear-gradient(180deg,rgba(18,16,30,0.98),rgba(26,22,40,0.98))',
  'science-lab': 'radial-gradient(circle_at_top,rgba(14,165,233,0.07),transparent_35%),linear-gradient(180deg,rgba(14,20,32,0.98),rgba(20,28,44,0.98))',
  'retro-mystery': 'radial-gradient(circle_at_top,rgba(217,119,6,0.08),transparent_35%),linear-gradient(180deg,rgba(22,18,14,0.98),rgba(30,24,18,0.98))',
  'neon-drama': 'radial-gradient(circle_at_top,rgba(168,85,247,0.10),transparent_35%),linear-gradient(180deg,rgba(20,14,38,0.98),rgba(28,20,48,0.98))',
  'corporate-chaos': 'radial-gradient(circle_at_top,rgba(100,116,139,0.05),transparent_35%),linear-gradient(180deg,rgba(15,18,24,0.98),rgba(22,26,34,0.98))',
  'comedy-stage': 'radial-gradient(circle_at_top,rgba(251,146,60,0.10),transparent_35%),linear-gradient(180deg,rgba(28,18,14,0.98),rgba(38,24,18,0.98))',
  'academic-strategy': 'radial-gradient(circle_at_top,rgba(56,103,147,0.08),transparent_35%),linear-gradient(180deg,rgba(14,20,32,0.98),rgba(20,28,44,0.98))',
  'bright-platformer': 'radial-gradient(circle_at_top,rgba(250,204,21,0.10),transparent_35%),linear-gradient(180deg,rgba(20,18,10,0.98),rgba(28,24,14,0.98))',
  'editorial-generic': 'radial-gradient(circle_at_top,rgba(100,116,139,0.04),transparent_35%),linear-gradient(180deg,rgba(16,18,24,0.98),rgba(22,24,32,0.98))',
  'lifestyle-soft': 'radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_35%),linear-gradient(180deg,rgba(20,16,10,0.98),rgba(28,22,14,0.98))',
  'personality-pulse': 'radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_35%),linear-gradient(180deg,rgba(22,16,10,0.98),rgba(30,22,14,0.98))',
};

const FAMILY_ACCENTS: Record<VisualFamily, string> = {
  'space-opera': 'rgba(79,70,229,0.06)',
  'dark-fantasy': 'rgba(139,92,246,0.06)',
  'science-lab': 'rgba(14,165,233,0.06)',
  'retro-mystery': 'rgba(217,119,6,0.06)',
  'neon-drama': 'rgba(168,85,247,0.08)',
  'corporate-chaos': 'rgba(100,116,139,0.04)',
  'comedy-stage': 'rgba(251,146,60,0.08)',
  'academic-strategy': 'rgba(56,103,147,0.06)',
  'bright-platformer': 'rgba(250,204,21,0.08)',
  'editorial-generic': 'rgba(100,116,139,0.03)',
  'lifestyle-soft': 'rgba(251,191,36,0.06)',
  'personality-pulse': 'rgba(245,158,11,0.08)',
};

export function QuizDynamicBackground({ visualFamily }: { visualFamily?: VisualFamily }) {
  const family = visualFamily ?? 'editorial-generic';

  return (
    <>
      <div className="absolute inset-0" style={{ background: FAMILY_PALETTES[family] }} />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse_at_50%_0%,${FAMILY_ACCENTS[family]},transparent_70%)`,
        }}
      />
    </>
  );
}
