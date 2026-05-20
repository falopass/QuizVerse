'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface StreakIndicatorProps {
  streak: number;
}

export function StreakIndicator({ streak }: StreakIndicatorProps) {
  if (streak < 2) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5',
        'bg-gradient-to-r from-orange-500/20 to-red-500/20',
        'border border-orange-500/30'
      )}
    >
      <motion.span
        animate={{ rotate: [0, -10, 10, 0] }}
        transition={{ repeat: Infinity, duration: 0.5 }}
        className="text-lg"
      >
        🔥
      </motion.span>
      <span className="text-sm font-bold text-orange-400">{streak}x</span>
      {streak >= 5 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-xs text-orange-300"
        >
          HOT!
        </motion.span>
      )}
    </motion.div>
  );
}
