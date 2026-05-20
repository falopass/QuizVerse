'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
    }
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'text-text-primary absolute z-50 px-3 py-1.5 text-sm font-medium',
              'bg-bg-tertiary border-border-subtle rounded-md border shadow-lg',
              'pointer-events-none whitespace-nowrap',
              getPositionClasses(),
              className
            )}
          >
            {content}
            {/* Arrow */}
            <div
              className={cn(
                'bg-bg-tertiary border-border-subtle absolute h-2 w-2',
                position === 'top' &&
                  '-bottom-1 left-1/2 -translate-x-1/2 rotate-45 border-r border-b',
                position === 'bottom' &&
                  '-top-1 left-1/2 -translate-x-1/2 rotate-45 border-t border-l',
                position === 'left' &&
                  'top-1/2 -right-1 -translate-y-1/2 rotate-45 border-t border-r',
                position === 'right' &&
                  'top-1/2 -left-1 -translate-y-1/2 rotate-45 border-b border-l'
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Tooltip;
