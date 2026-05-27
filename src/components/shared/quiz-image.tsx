'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface QuizImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  quizType?: 'personality' | 'trivia' | string;
}

const TYPE_EMOJI: Record<string, string> = {
  personality: '🎭',
  trivia: '🧠',
  default: '📊',
};

export function QuizImage({ src, alt, className, quizType = 'default' }: QuizImageProps) {
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <div
        className={cn(
          'bg-bg-tertiary flex items-center justify-center',
          className
        )}
        aria-label={alt}
      >
        <span className="text-4xl opacity-50" role="img" aria-hidden="true">
          {TYPE_EMOJI[quizType] ?? TYPE_EMOJI.default}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn('object-cover', className)}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
