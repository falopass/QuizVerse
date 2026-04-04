'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative px-4 py-16 md:py-24">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-secondary border border-border-subtle text-sm text-text-secondary mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>2M+ quizzes played this month</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
            <span className="gradient-text">What are you</span>
            <br />
            <span className="text-text-primary">today?</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-8">
            Discover your true self through fun and engaging personality quizzes.
            Share your results with the world.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/quiz"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-accent-primary rounded-lg hover:bg-accent-hover transition-all duration-200 shadow-lg shadow-accent-primary/25 hover:shadow-xl hover:shadow-accent-primary/30"
            >
              Explore Quizzes
              <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/create/ai"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-base font-medium text-text-primary bg-bg-secondary rounded-lg hover:bg-bg-tertiary transition-all duration-200 border border-border-subtle"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create with AI
            </Link>
          </div>
        </div>

        {/* Floating elements decoration */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-accent-primary/10 rounded-full blur-2xl animate-float" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-accent-secondary/10 rounded-full blur-2xl animate-float delay-1000" />
      </div>
    </section>
  );
}
