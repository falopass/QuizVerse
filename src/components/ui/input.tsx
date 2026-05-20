'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, type = 'text', ...props }, ref) => {
    const inputId = React.useId();

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-text-secondary mb-1.5 block text-sm font-medium">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              `bg-bg-secondary text-text-primary border-border-subtle placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary w-full rounded-lg border px-4 py-2.5 transition-all duration-200 focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50`,
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-error focus:border-error focus:ring-error',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="text-text-muted absolute top-1/2 right-3 -translate-y-1/2">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-error mt-1.5 text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
