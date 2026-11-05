import { compatibilityLabel, type CompatibilityTier } from '@/lib/quiz/compatibility';
import type { Locale } from '@/lib/i18n/dictionaries';

interface CompatibilityCardProps {
  locale: Locale;
  /** Título del resultado propio («Tú eres Goku»). */
  myResult: string;
  /** Título del resultado del amigo; puede faltar en sesiones antiguas. */
  theirResult: string | null;
  /** Nombre visible del amigo; sin él se dice «tu amigo» / «your friend». */
  theirName?: string | null;
  /** 0–100, igual para los dos jugadores. */
  percent: number;
  tier: CompatibilityTier;
  /** Abre el diálogo de compartir con el enlace de invitación propio. */
  onShareChallenge?: React.MouseEventHandler<HTMLButtonElement>;
}

/**
 * Tarjeta de compatibilidad entre dos resultados de personalidad.
 *
 * Vive dentro de `ResultScreen` (componente cliente), así que no necesita
 * directiva propia. Todo lo que pinta llega por props serializables.
 */
export function CompatibilityCard({
  locale,
  myResult,
  theirResult,
  theirName,
  percent,
  tier,
  onShareChallenge,
}: CompatibilityCardProps) {
  const es = locale === 'es';
  const copy = es
    ? {
        eyebrow: 'Compatibilidad',
        you: 'Tú',
        friend: 'tu amigo',
        compare: 'Compara con otro amigo',
      }
    : {
        eyebrow: 'Compatibility',
        you: 'You',
        friend: 'your friend',
        compare: 'Compare with another friend',
      };

  const name = theirName || copy.friend;
  const label = compatibilityLabel(tier, locale);

  const side = (role: string, value: string, accent: boolean) => (
    <div className="min-w-0 flex-1">
      <span className="arcade-play-label">{role}</span>
      <p
        className={`mt-1 truncate text-sm font-semibold ${accent ? 'text-accent-primary' : 'text-text-primary'}`}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div
      className="border-accent-primary/40 bg-bg-primary/60 mt-6 rounded-2xl border px-5 py-4"
      role="status"
    >
      <p className="arcade-play-label">{copy.eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-accent-primary text-3xl font-semibold md:text-4xl">{percent}%</p>
        <p className="text-text-primary text-base font-semibold md:text-lg">{label}</p>
      </div>
      <div className="mt-3 flex gap-4">
        {side(copy.you, myResult, true)}
        {side(name, theirResult ?? '—', false)}
      </div>
      {onShareChallenge && (
        <button
          type="button"
          onClick={onShareChallenge}
          className="arcade-button arcade-result-secondary mt-4"
        >
          {copy.compare}
        </button>
      )}
    </div>
  );
}
