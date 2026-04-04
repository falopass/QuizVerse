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
  const availablePowerUps = powerUps.filter(p => p.available && !p.used);
  
  if (availablePowerUps.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-border-subtle bg-bg-secondary/30">
      <div className="max-w-2xl mx-auto flex items-center gap-2">
        <span className="text-xs text-text-muted mr-2">Power-ups:</span>
        {availablePowerUps.map((powerUp) => (
          <motion.button
            key={powerUp.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onUsePowerUp(powerUp.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
              'bg-bg-tertiary hover:bg-accent-primary/20',
              'border border-border-subtle hover:border-accent-primary/50',
              'transition-all duration-200',
              'group'
            )}
            title={powerUp.description}
          >
            <span className="text-lg">{powerUp.icon}</span>
            <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary">
              {powerUp.name}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}