'use client';

import * as React from 'react';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Badge } from '@/components/ui/badge';
import { formatCompactNumber } from '@/lib/utils/format';

// Mock data - esto vendría de la DB
const TRENDING_QUIZZES = [
  {
    slug: 'which-harry-potter-house',
    title: 'Which Harry Potter House Do You Belong To?',
    category: 'Personality',
    categoryIcon: '🧠',
    plays: 142000,
    coverImage: null,
  },
  {
    slug: 'what-is-your-spirit-animal',
    title: 'What Is Your Spirit Animal?',
    category: 'Personality',
    categoryIcon: '🧠',
    plays: 98000,
    coverImage: null,
  },
  {
    slug: 'mcu-avengers-quiz',
    title: 'Which MCU Avenger Are You?',
    category: 'Movies & TV',
    categoryIcon: '🎬',
    plays: 87000,
    coverImage: null,
  },
  {
    slug: 'brain-language-style',
    title: "What Is Your Brain's Language Style?",
    category: 'Personality',
    categoryIcon: '🧠',
    plays: 76000,
    coverImage: null,
  },
  {
    slug: 'demon-slayer-breathing-style',
    title: 'Which Demon Slayer Breathing Style Suits You?',
    category: 'Anime & Manga',
    categoryIcon: '⛩️',
    plays: 65000,
    coverImage: null,
  },
  {
    slug: 'genius-or-not',
    title: 'Are You Actually A Genius?',
    category: 'Trivia',
    categoryIcon: '🔬',
    plays: 54000,
    coverImage: null,
  },
];

export function TrendingCarousel() {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-display text-text-primary text-2xl font-bold md:text-3xl">
              Trending Now
            </h2>
            <p className="text-text-secondary mt-1">Most played quizzes this week</p>
          </div>
          <a
            href="/quiz"
            className="text-accent-primary hover:text-accent-hover text-sm font-medium transition-colors"
          >
            View all →
          </a>
        </div>

        {/* Carousel */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRENDING_QUIZZES.map((quiz, index) => (
            <QuizCard key={quiz.slug} quiz={quiz} priority={index < 3} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// QUIZ CARD COMPONENT
// ============================================

interface QuizCardProps {
  quiz: (typeof TRENDING_QUIZZES)[0];
  priority?: boolean;
}

function QuizCard({ quiz, priority }: QuizCardProps) {
  return (
    <a href={`/quiz/${quiz.slug}`} className="group block">
      <SpotlightCard className="h-full">
        {/* Cover Image Placeholder */}
        <div className="from-bg-tertiary to-bg-secondary relative aspect-video overflow-hidden bg-gradient-to-br">
          {quiz.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quiz.coverImage}
              alt={quiz.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading={priority ? 'eager' : 'lazy'}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-6xl">
              {quiz.categoryIcon}
            </div>
          )}

          {/* Category Badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="default" size="sm">
              {quiz.categoryIcon} {quiz.category}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-display text-text-primary group-hover:text-accent-primary line-clamp-2 font-semibold transition-colors">
            {quiz.title}
          </h3>
          <div className="text-text-muted mt-3 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatCompactNumber(quiz.plays)} plays
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              3 min
            </span>
          </div>
        </div>
      </SpotlightCard>
    </a>
  );
}
