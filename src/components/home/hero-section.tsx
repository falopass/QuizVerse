'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HeroSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {children}
      </motion.div>
    </div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={itemVariants}>{children}</motion.div>;
}
