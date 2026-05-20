'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { PowerUp } from '@/stores/quiz-store';

interface PowerUpBarProps {
  powerUps: PowerUp[];
  onUsePowerUp: (id: string) => void;
}

export function PowerUpBar({ powerUps, onUsePowerUp }: PowerUpBarProps) {
  const availablePowerUps = powerUps.filter((p) => p.available && !p.used);

  if (availablePowerUps.length === 0) return null;

  return (
    <div className="border-border-subtle bg-bg-secondary/30 border-t px-4 py-2">
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <span className="text-text-muted mr-2 text-xs">Power-ups:</span>
        {availablePowerUps.map((powerUp) => (
          <motion.button
            key={powerUp.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onUsePowerUp(powerUp.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
              'bg-bg-tertiary hover:bg-accent-primary/20',
              'border-border-subtle hover:border-accent-primary/50 border',
              'transition-all duration-200',
              'group'
            )}
            title={powerUp.description}
          >
            <span className="text-lg">{powerUp.icon}</span>
            <span className="text-text-secondary group-hover:text-text-primary text-xs font-medium">
              {powerUp.name}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
