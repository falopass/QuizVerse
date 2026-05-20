'use client';

import * as React from 'react';
import { formatCompactNumber } from '@/lib/utils/format';

export function StatsBanner() {
  const stats = [
    { label: 'Quizzes Played', value: 2000000, suffix: '+' },
    { label: 'Quizzes Created', value: 50000, suffix: '+' },
    { label: 'Active Players', value: 150000, suffix: '+' },
    { label: 'Categories', value: 15, suffix: '' },
  ];

  return (
    <section className="border-border-subtle bg-bg-secondary/50 border-y px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-text-primary mb-1 text-2xl font-bold md:text-4xl">
                {formatCompactNumber(stat.value)}
                {stat.suffix}
              </div>
              <div className="text-text-secondary text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
