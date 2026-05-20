'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { Achievement } from '@/types/quiz';

export interface AchievementBadgeProps {
  achievement: Achievement & { unlocked?: boolean; unlocked_at?: string };
  size?: 'sm' | 'md' | 'lg';
  unlocked?: boolean;
}

export function AchievementBadge({ achievement, size = 'md', unlocked }: AchievementBadgeProps) {
  const sizeClasses = {
    sm: 'w-16 h-16 text-2xl',
    md: 'w-20 h-20 text-3xl',
    lg: 'w-24 h-24 text-4xl',
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'relative flex flex-col items-center gap-2',
        !unlocked && 'opacity-40 grayscale'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-bold',
          'from-accent-primary/20 to-accent-secondary/20 bg-gradient-to-br',
          'border-2',
          unlocked ? 'border-accent-primary shadow-glow' : 'border-border-subtle',
          sizeClasses[size]
        )}
      >
        {achievement.icon}
      </div>
      <div className="text-center">
        <div className="text-text-primary text-xs font-medium">{achievement.name}</div>
        <div className="text-text-muted text-xs">{achievement.points_reward} pts</div>
      </div>
      {unlocked && (
        <div className="bg-success border-bg-secondary absolute -top-1 -right-1 h-4 w-4 rounded-full border-2" />
      )}
    </motion.div>
  );
}

export default AchievementBadge;
