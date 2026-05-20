'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { Quiz } from '@/types/quiz';
import type { GameMode } from '@/stores/quiz-store';

interface GameModeSelectorProps {
  quiz: Quiz;
  onSelectMode: (mode: GameMode) => void;
}

interface GameModeInfo {
  id: GameMode;
  name: string;
  icon: string;
  description: string;
  color: string;
  bgGradient: string;
}

const GAME_MODES: GameModeInfo[] = [
  {
    id: 'normal',
    name: 'Classic',
    icon: '🎯',
    description: 'Answer at your own pace. No pressure!',
    color: 'from-violet-500 to-purple-500',
    bgGradient: 'from-violet-500/10 to-purple-500/10',
  },
  {
    id: 'timed',
    name: 'Time Attack',
    icon: '⏱️',
    description: 'Answer as many questions as possible before time runs out!',
    color: 'from-red-500 to-orange-500',
    bgGradient: 'from-red-500/10 to-orange-500/10',
  },
  {
    id: 'survival',
    name: 'Survival',
    icon: '💀',
    description: "One mistake and you're out! How far can you go?",
    color: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-500/10 to-emerald-500/10',
  },
  {
    id: 'practice',
    name: 'Practice',
    icon: '📚',
    description: 'Learn at your own pace with instant explanations.',
    color: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
];

export function GameModeSelector({ quiz, onSelectMode }: GameModeSelectorProps) {
  const [selectedMode, setSelectedMode] = React.useState<GameMode | null>(null);

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    // Pequeña animación antes de iniciar
    setTimeout(() => {
      onSelectMode(mode);
    }, 300);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-text-primary mb-2 text-3xl font-bold md:text-4xl">
            Choose Your Mode
          </h1>
          <p className="text-text-secondary">{quiz.title}</p>
          <p className="text-text-muted mt-2 text-sm">
            {quiz.questions.length} questions •{' '}
            {quiz.quiz_type === 'trivia' ? 'Test your knowledge' : 'Discover your result'}
          </p>
        </div>

        {/* Game Modes Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {GAME_MODES.map((mode, index) => (
            <motion.button
              key={mode.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleModeSelect(mode.id)}
              disabled={selectedMode !== null}
              className={cn(
                'relative rounded-2xl p-6 text-left',
                'border-2 transition-all duration-300',
                'hover:scale-[1.02] active:scale-[0.98]',
                selectedMode === mode.id
                  ? 'border-accent-primary bg-accent-primary/10'
                  : 'border-border-subtle bg-bg-secondary hover:border-accent-primary/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'group'
              )}
            >
              {/* Background gradient */}
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100',
                  mode.bgGradient
                )}
              />

              <div className="relative">
                {/* Icon */}
                <div className="mb-3 text-4xl">{mode.icon}</div>

                {/* Name */}
                <h3
                  className={cn(
                    'mb-1 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent',
                    mode.color
                  )}
                >
                  {mode.name}
                </h3>

                {/* Description */}
                <p className="text-text-secondary text-sm">{mode.description}</p>
              </div>

              {/* Arrow indicator */}
              <div
                className={cn(
                  'absolute top-1/2 right-4 -translate-y-1/2',
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  'bg-bg-tertiary group-hover:bg-accent-primary/20',
                  'transition-all duration-200',
                  'opacity-0 group-hover:opacity-100'
                )}
              >
                <svg
                  className="text-text-secondary h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Info text */}
        <p className="text-text-muted mt-6 text-center text-xs">
          Press <kbd className="bg-bg-tertiary rounded px-1.5 py-0.5">1-4</kbd> to select with
          keyboard
        </p>
      </motion.div>
    </div>
  );
}
