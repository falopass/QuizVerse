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
  const labels: Record<string, Record<Locale, { name: string; description: string }>> = {
    'fifty-fifty': {
      en: { name: '50/50', description: 'Remove two wrong answers' },
      es: { name: '50/50', description: 'Elimina dos respuestas incorrectas' },
    },
    'extra-time': {
      en: { name: '+10s', description: 'Add ten seconds' },
      es: { name: '+10s', description: 'Añade diez segundos' },
    },
    skip: {
      en: { name: 'Skip', description: 'Skip this question' },
      es: { name: 'Saltar', description: 'Salta esta pregunta' },
    },
  };
  return (
    <div className="arcade-power-ups">
      <div className="arcade-play-wrap">
        <span>{locale === 'es' ? 'Ayudas' : 'Power-ups'}</span>
        <div>
          {available.map((powerUp) => {
            const label = labels[powerUp.id]?.[locale];
            return (
              <button
                key={powerUp.id}
                type="button"
                onClick={() => onUsePowerUp(powerUp.id)}
                title={label?.description}
                aria-label={`${label?.name ?? powerUp.name}: ${label?.description}`}
              >
                {label?.name ?? powerUp.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
