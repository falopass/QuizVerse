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
    description: 'One mistake and you\'re out! How far can you go?',
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-2xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-text-primary mb-2">
            Choose Your Mode
          </h1>
          <p className="text-text-secondary">
            {quiz.title}
          </p>
          <p className="text-sm text-text-muted mt-2">
            {quiz.questions.length} questions • {quiz.quiz_type === 'trivia' ? 'Test your knowledge' : 'Discover your result'}
          </p>
        </div>

        {/* Game Modes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GAME_MODES.map((mode, index) => (
            <motion.button
              key={mode.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleModeSelect(mode.id)}
              disabled={selectedMode !== null}
              className={cn(
                'relative p-6 rounded-2xl text-left',
                'border-2 transition-all duration-300',
                'hover:scale-[1.02] active:scale-[0.98]',
                selectedMode === mode.id
                  ? 'border-accent-primary bg-accent-primary/10'
                  : 'border-border-subtle bg-bg-secondary hover:border-accent-primary/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'group'
              )}
            >
              {/* Background gradient */}
              <div className={cn(
                'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity',
                mode.bgGradient
              )} />

              <div className="relative">
                {/* Icon */}
                <div className="text-4xl mb-3">{mode.icon}</div>

                {/* Name */}
                <h3 className={cn(
                  'text-xl font-bold mb-1 bg-gradient-to-r bg-clip-text text-transparent',
                  mode.color
                )}>
                  {mode.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-text-secondary">
                  {mode.description}
                </p>
              </div>

              {/* Arrow indicator */}
              <div className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2',
                'w-8 h-8 rounded-full flex items-center justify-center',
                'bg-bg-tertiary group-hover:bg-accent-primary/20',
                'transition-all duration-200',
                'opacity-0 group-hover:opacity-100'
              )}>
                <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Info text */}
        <p className="text-center text-xs text-text-muted mt-6">
          Press <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">1-4</kbd> to select with keyboard
        </p>
      </motion.div>
    </div>
  );
}