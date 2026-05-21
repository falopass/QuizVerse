'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  intensity?: 'low' | 'medium' | 'high';
}

/**
 * Card con efecto de luz que sigue el mouse
 * Implementado con CSS variables actualizadas por mousemove
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = 'rgba(124, 58, 237, 0.15)',
  intensity = 'medium',
}: SpotlightCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);
  const prefersReducedMotion = React.useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );

  const intensities = {
    low: 0.1,
    medium: 0.15,
    high: 0.25,
  };

  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) {
        rafRef.current = null;
        return;
      }
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setPosition({ x, y });
      setOpacity(1);
      rafRef.current = null;
    });
  }, []);

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'bg-bg-secondary border-border-subtle relative rounded-xl border',
        'overflow-hidden',
        'transition-all duration-300',
        'hover:border-accent-primary/40 hover:shadow-lg',
        className
      )}
      onMouseMove={prefersReducedMotion ? undefined : handleMouseMove}
      onMouseLeave={prefersReducedMotion ? undefined : handleMouseLeave}
    >
      {/* Spotlight effect */}
      {!prefersReducedMotion && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(
              600px circle at ${position.x}px ${position.y}px,
              ${spotlightColor},
              transparent 40%
            )`,
          }}
        />
      )}

      {/* Border glow effect */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(
              400px circle at ${position.x}px ${position.y}px,
              rgba(124, 58, 237, 0.4),
              transparent 40%
            )`,
            mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '1px',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
