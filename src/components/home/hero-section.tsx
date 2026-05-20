'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          {/* Badge */}
          <div className="bg-bg-secondary border-border-subtle text-text-secondary animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
            <span className="bg-success h-2 w-2 animate-pulse rounded-full" />
            <span>2M+ quizzes played this month</span>
          </div>

          {/* Title */}
          <h1 className="font-display mb-6 text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="gradient-text">What are you</span>
            <br />
            <span className="text-text-primary">today?</span>
          </h1>

          {/* Subtitle */}
          <p className="text-text-secondary mx-auto mb-8 max-w-2xl text-lg md:text-xl">
            Discover your true self through fun and engaging personality quizzes. Share your results
            with the world.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/quiz"
              className="bg-accent-primary hover:bg-accent-hover shadow-accent-primary/25 hover:shadow-accent-primary/30 inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-medium text-white shadow-lg transition-all duration-200 hover:shadow-xl sm:w-auto"
            >
              Explore Quizzes
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link
              href="/create/ai"
              className="text-text-primary bg-bg-secondary hover:bg-bg-tertiary border-border-subtle inline-flex w-full items-center justify-center rounded-lg border px-6 py-3 text-base font-medium transition-all duration-200 sm:w-auto"
            >
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create with AI
            </Link>
          </div>
        </div>

        {/* Floating elements decoration */}
        <div className="bg-accent-primary/10 animate-float absolute top-10 left-10 h-20 w-20 rounded-full blur-2xl" />
        <div className="bg-accent-secondary/10 animate-float absolute right-10 bottom-10 h-32 w-32 rounded-full blur-2xl delay-1000" />
      </div>
    </section>
  );
}
