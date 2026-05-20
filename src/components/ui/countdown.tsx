'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

export interface CountdownProps {
  seconds: number;
  onComplete?: () => void;
  paused?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Countdown({
  seconds,
  onComplete,
  paused = false,
  className,
  size = 'md',
}: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [isRunning, setIsRunning] = useState(!paused);

  useEffect(() => {
    setIsRunning(!paused);
  }, [paused]);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onComplete, remaining]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (remaining / seconds) * 100;
  const isLow = remaining <= 5;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl font-bold',
  };

  return (
    <div className={cn('relative inline-flex items-center gap-2', className)}>
      {/* Circular progress (optional, for lg size) */}
      {size === 'lg' && (
        <svg className="-ml-2 h-16 w-16" viewBox="0 0 100 100">
          <circle
            className="text-bg-tertiary"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r="42"
            cx="50"
            cy="50"
          />
          <motion.circle
            className={isLow ? 'text-error' : 'text-accent-primary'}
            strokeWidth="8"
            strokeDasharray={264}
            strokeDashoffset={264 - (progress / 100) * 264}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="42"
            cx="50"
            cy="50"
            initial={false}
            animate={{ strokeDashoffset: 264 - (progress / 100) * 264 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </svg>
      )}
      <motion.span
        className={cn(
          'font-mono tabular-nums',
          sizeClasses[size],
          isLow && 'text-error animate-pulse'
        )}
        initial={false}
        animate={{
          scale: isLow ? [1, 1.1, 1] : 1,
          color: isLow ? 'var(--color-error)' : 'var(--color-text-primary)',
        }}
        transition={{
          scale: { repeat: isLow ? Infinity : 0, duration: 0.5 },
          color: { duration: 0.3 },
        }}
      >
        {formatTime(remaining)}
      </motion.span>
    </div>
  );
}

export default Countdown;
