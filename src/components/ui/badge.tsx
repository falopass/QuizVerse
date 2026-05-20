'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { className, variant = 'default', size = 'md', leftIcon, rightIcon, children, ...props },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center gap-1
      font-medium rounded-full
      whitespace-nowrap
    `;

    const variants = {
      default: 'bg-bg-tertiary text-text-secondary border border-border-subtle',
      success: 'bg-success/10 text-success border border-success/20',
      error: 'bg-error/10 text-error border border-error/20',
      warning: 'bg-warning/10 text-warning border border-warning/20',
      info: 'bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3 py-1.5 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
