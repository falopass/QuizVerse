'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface QuizImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  quizType?: 'personality' | 'trivia' | string;
}

export function QuizImage({ src, alt, className, quizType = 'default' }: QuizImageProps) {
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <div
        className={cn('arcade-cover flex items-center justify-center', quizType === 'trivia' && 'arcade-cover-trivia', className)}
        aria-label={alt}
      >
        <span className="arcade-cover-title arcade-cover-title-small" aria-hidden="true">{alt.split(/\s+/).slice(0, 2).join(' ')}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn('object-cover', className)}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
