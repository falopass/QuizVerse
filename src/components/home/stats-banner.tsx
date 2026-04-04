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
    <section className="px-4 py-8 border-y border-border-subtle bg-bg-secondary/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-4xl font-display font-bold text-text-primary mb-1">
                {formatCompactNumber(stat.value)}
                {stat.suffix}
              </div>
              <div className="text-sm text-text-secondary">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
