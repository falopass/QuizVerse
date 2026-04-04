'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { Category } from '@/types/quiz';

export interface CategoryPillProps {
  category: Pick<Category, 'name' | 'slug' | 'icon' | 'color'>;
  isActive?: boolean;
  onClick?: () => void;
}

export function CategoryPill({ category, isActive = false, onClick }: CategoryPillProps) {
  return (
    <Link
      href={`/category/${category.slug}`}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
        'transition-all duration-200 whitespace-nowrap',
        'border cursor-pointer select-none',
        isActive
          ? 'bg-accent-primary border-accent-primary text-white shadow-glow'
          : 'bg-bg-secondary border-border-subtle text-text-secondary hover:border-accent-primary/50 hover:text-text-primary hover:bg-bg-tertiary'
      )}
    >
      {category.icon && <span className="text-base">{category.icon}</span>}
      {category.name}
    </Link>
  );
}

export default CategoryPill;
