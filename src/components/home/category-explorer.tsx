'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

// Datos de categorías (deberían venir de la DB)
const CATEGORIES = [
  { slug: 'personality', name: 'Personality', icon: '🧠', color: '#7c3aed', gradientFrom: '#7c3aed', gradientTo: '#a855f7', quizCount: 1250 },
  { slug: 'movies-tv', name: 'Movies & TV', icon: '🎬', color: '#ef4444', gradientFrom: '#ef4444', gradientTo: '#f97316', quizCount: 890 },
  { slug: 'music', name: 'Music', icon: '🎵', color: '#ec4899', gradientFrom: '#ec4899', gradientTo: '#f472b6', quizCount: 567 },
  { slug: 'gaming', name: 'Gaming', icon: '🎮', color: '#06b6d4', gradientFrom: '#06b6d4', gradientTo: '#22d3ee', quizCount: 743 },
  { slug: 'science', name: 'Science', icon: '🔬', color: '#22c55e', gradientFrom: '#22c55e', gradientTo: '#4ade80', quizCount: 432 },
  { slug: 'history', name: 'History', icon: '📜', color: '#f59e0b', gradientFrom: '#f59e0b', gradientTo: '#fbbf24', quizCount: 321 },
  { slug: 'sports', name: 'Sports', icon: '⚽', color: '#3b82f6', gradientFrom: '#3b82f6', gradientTo: '#60a5fa', quizCount: 289 },
  { slug: 'geography', name: 'Geography', icon: '🌍', color: '#14b8a6', gradientFrom: '#14b8a6', gradientTo: '#2dd4bf', quizCount: 234 },
  { slug: 'anime-manga', name: 'Anime & Manga', icon: '⛩️', color: '#e11d48', gradientFrom: '#e11d48', gradientTo: '#f43f5e', quizCount: 678 },
  { slug: 'food-drink', name: 'Food & Drink', icon: '🍕', color: '#f97316', gradientFrom: '#f97316', gradientTo: '#fb923c', quizCount: 198 },
  { slug: 'literature', name: 'Literature', icon: '📚', color: '#8b5cf6', gradientFrom: '#8b5cf6', gradientTo: '#a78bfa', quizCount: 167 },
  { slug: 'technology', name: 'Technology', icon: '💻', color: '#0ea5e9', gradientFrom: '#0ea5e9', gradientTo: '#38bdf8', quizCount: 245 },
];

export function CategoryExplorer() {
  return (
    <section className="px-4 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-2">
            Explore by Category
          </h2>
          <p className="text-text-secondary">
            Find quizzes that match your interests
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>

        {/* View All Link */}
        <div className="text-center mt-8">
          <Link
            href="/quiz"
            className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            View all categories
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ============================================
// CATEGORY CARD
// ============================================

interface CategoryCardProps {
  category: typeof CATEGORIES[0];
}

function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className="group block"
    >
      <div
        className={cn(
          'relative p-4 rounded-xl',
          'border border-border-subtle',
          'transition-all duration-300',
          'hover:scale-105 hover:border-opacity-50',
          'bg-gradient-to-br'
        )}
        style={{
          '--tw-gradient-from': category.gradientFrom,
          '--tw-gradient-to': category.gradientTo,
          background: `linear-gradient(135deg, ${category.gradientFrom}15, ${category.gradientTo}15)`,
        } as React.CSSProperties}
      >
        {/* Icon */}
        <div className="text-3xl mb-2 transform group-hover:scale-110 transition-transform duration-300">
          {category.icon}
        </div>

        {/* Name */}
        <div className="font-medium text-sm text-text-primary line-clamp-2 group-hover:text-accent-primary transition-colors">
          {category.name}
        </div>

        {/* Count */}
        <div className="text-xs text-text-muted mt-1">
          {category.quizCount} quizzes
        </div>

        {/* Hover glow effect */}
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${category.color}20, transparent 70%)`,
          }}
        />
      </div>
    </Link>
  );
}
