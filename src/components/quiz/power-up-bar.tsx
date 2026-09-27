'use client';

import type { Locale } from '@/lib/i18n/dictionaries';
import type { PowerUp } from '@/stores/quiz-store';

interface PowerUpBarProps {
  powerUps: PowerUp[];
  onUsePowerUp: (id: string) => void;
  locale: Locale;
}

export function PowerUpBar({ powerUps, onUsePowerUp, locale }: PowerUpBarProps) {
  const available = powerUps.filter((powerUp) => powerUp.available && !powerUp.used);
  if (!available.length) return null;
  const labels: Record<string, Record<Locale, string>> = {
    'fifty-fifty': { en: 'Remove two wrong answers', es: 'Elimina dos respuestas incorrectas' },
    'extra-time': { en: 'Add ten seconds', es: 'Añade diez segundos' },
    skip: { en: 'Skip this question', es: 'Salta esta pregunta' },
  };
  return (
    <div className="arcade-power-ups">
      <div className="arcade-play-wrap">
        <span>{locale === 'es' ? 'AYUDAS' : 'POWER-UPS'}</span>
        <div>
          {available.map((powerUp) => (
            <button key={powerUp.id} type="button" onClick={() => onUsePowerUp(powerUp.id)} title={labels[powerUp.id]?.[locale]} aria-label={`${powerUp.name}: ${labels[powerUp.id]?.[locale]}`}>
              {powerUp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
