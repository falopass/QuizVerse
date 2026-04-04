'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

export interface PointsDisplayProps {
  points: number;
  earned?: number;
  className?: string;
}

export function PointsDisplay({ points, earned = 0, className }: PointsDisplayProps) {
  const [displayed, setDisplayed] = useState(points);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (earned > 0) {
      setIsAnimating(true);
      const duration = 1500;
      const start = displayed;
      const end = points;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function (ease-out-cubic)
        const eased = 1 - Math.pow(1 - progress, 3);

        setDisplayed(Math.floor(start + (end - start) * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [points, earned]);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <motion.div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center font-bold',
          'bg-gradient-to-br from-accent-warm/20 to-accent-warm/10',
          'border-2 border-accent-warm/50',
          isAnimating && 'animate-pulse'
        )}
        animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        ⭐
      </motion.div>
      <div>
        <motion.div
          className={cn(
            'text-2xl font-bold text-accent-warm',
            isAnimating && 'animate-pulse'
          )}
        >
          {displayed.toLocaleString()}
        </motion.div>
        {earned > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-success"
          >
            +{earned} earned!
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default PointsDisplay;
