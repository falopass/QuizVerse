'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'text', width, height, lines = 1, ...props }, ref) => {
    const baseStyles = `
      animate-shimmer
      bg-bg-tertiary
      relative
      overflow-hidden
    `;

    const variants = {
      text: 'rounded',
      circular: 'rounded-full',
      rectangular: 'rounded-none',
      rounded: 'rounded-lg',
    };

    const style: React.CSSProperties = {};

    if (width) {
      style.width = typeof width === 'string' ? width : `${width}px`;
    }

    if (height) {
      style.height = typeof height === 'string' ? height : `${height}px`;
    }

    if (lines > 1 && variant === 'text') {
      return (
        <div className="flex flex-col gap-2" ref={ref} {...props}>
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={cn(baseStyles, variants[variant], className)}
              style={{
                ...style,
                height: typeof height === 'string' ? height : `${height || 16}px`,
              }}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        style={style}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export { Skeleton };
