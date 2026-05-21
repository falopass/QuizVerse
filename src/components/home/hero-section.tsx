'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 24, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const floatingParticles = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 4,
  duration: 8 + Math.random() * 10,
  size: 2 + Math.random() * 6,
  opacity: 0.06 + Math.random() * 0.1,
}));

export function HeroSection({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = React.useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );

  return (
    <div className="relative overflow-hidden">
      {!prefersReducedMotion && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {floatingParticles.map((particle) => (
            <motion.div
              key={particle.id}
              className="bg-accent-primary absolute rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                left: `${particle.x}%`,
                opacity: 0,
              }}
              animate={{
                y: [0, -60, -120, -180],
                opacity: [0, particle.opacity, particle.opacity, 0],
              }}
              transition={{
                duration: particle.duration,
                repeat: Infinity,
                delay: particle.delay,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {children}
      </motion.div>
    </div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={itemVariants}>{children}</motion.div>;
}
