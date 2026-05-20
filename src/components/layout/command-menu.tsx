'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface SearchResult {
  type: 'quiz' | 'category' | 'page';
  title: string;
  href: string;
  description?: string;
  icon?: string;
}

// Resultados estáticos (páginas y categorías)
const STATIC_RESULTS: SearchResult[] = [
  { type: 'page', title: 'Home', href: '/', icon: '🏠', description: 'Inicio de QuizVerse' },
  {
    type: 'page',
    title: 'Explore Quizzes',
    href: '/quiz',
    icon: '🔍',
    description: 'Explorar todos los quizzes',
  },
  {
    type: 'page',
    title: 'Create Quiz',
    href: '/create',
    icon: '✏️',
    description: 'Crear un quiz manualmente',
  },
  {
    type: 'page',
    title: 'AI Quiz Generator',
    href: '/create/ai',
    icon: '🤖',
    description: 'Generar quiz con IA',
  },
  {
    type: 'page',
    title: 'Leaderboard',
    href: '/leaderboard',
    icon: '🏆',
    description: 'Ranking global de jugadores',
  },
  { type: 'category', title: 'Personality', href: '/category/personality', icon: '🧠' },
  { type: 'category', title: 'Movies & TV', href: '/category/movies-tv', icon: '🎬' },
  { type: 'category', title: 'Music', href: '/category/music', icon: '🎵' },
  { type: 'category', title: 'Gaming', href: '/category/gaming', icon: '🎮' },
  { type: 'category', title: 'Science', href: '/category/science', icon: '🔬' },
];

export function CommandMenu({ isOpen, onClose }: CommandMenuProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>(STATIC_RESULTS);

  // Filtrar resultados
  useEffect(() => {
    if (!search.trim()) {
      setFilteredResults(STATIC_RESULTS);
      return;
    }

    const filtered = STATIC_RESULTS.filter(
      (result) =>
        result.title.toLowerCase().includes(search.toLowerCase()) ||
        result.description?.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredResults(filtered);
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredResults[selectedIndex]) {
            window.location.href = filteredResults[selectedIndex].href;
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, onClose]);

  // Atajo de teclado para abrir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen = true;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" showCloseButton={false}>
      <div className="relative">
        {/* Search Input */}
        <div className="mb-4 flex items-center gap-3">
          <svg
            className="text-text-muted h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quizzes, categories, pages..."
            className="border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {filteredResults.length === 0 ? (
            <div className="text-text-muted py-8 text-center">
              <p>No results found for &quot;{search}&quot;</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredResults.map((result, index) => (
                <a
                  key={`${result.type}-${result.href}`}
                  href={result.href}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5',
                    'transition-colors duration-150',
                    index === selectedIndex
                      ? 'bg-accent-primary/10 text-text-primary'
                      : 'hover:bg-bg-tertiary/50'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => onClose()}
                >
                  <span className="shrink-0 text-lg">{result.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{result.title}</span>
                      <span
                        className={cn(
                          'bg-bg-tertiary rounded px-1.5 py-0.5 text-xs',
                          result.type === 'page' && 'text-text-muted',
                          result.type === 'category' && 'text-accent-primary',
                          result.type === 'quiz' && 'text-accent-secondary'
                        )}
                      >
                        {result.type}
                      </span>
                    </div>
                    {result.description && (
                      <p className="text-text-muted truncate text-sm">{result.description}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border-subtle text-text-muted mt-4 flex items-center justify-between border-t pt-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-tertiary rounded px-1.5 py-0.5 text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-tertiary rounded px-1.5 py-0.5 text-[10px]">↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="bg-bg-tertiary rounded px-1.5 py-0.5 text-[10px]">ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// HOOK PARA ABRIR EL COMMAND MENU
// ============================================

export function useCommandMenu() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
