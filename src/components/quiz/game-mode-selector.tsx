'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';
import type { GameMode } from '@/stores/quiz-store';

interface GameModeSelectorProps {
  quiz: Quiz;
  locale?: Locale;
  onSelectMode: (mode: GameMode) => void;
}

interface GameModeInfo {
  id: GameMode;
  name: Record<'en' | 'es', string>;
  icon: string;
  description: Record<'en' | 'es', string>;
  color: string;
  bgGradient: string;
}

const GAME_MODES: GameModeInfo[] = [
  {
    id: 'normal',
    name: { en: 'Classic', es: 'Clásico' },
    icon: 'T',
    description: {
      en: 'Answer at your own pace. No pressure.',
      es: 'Responde a tu ritmo. Sin presión.',
    },
    color: 'from-violet-500 to-purple-500',
    bgGradient: 'from-violet-500/10 to-purple-500/10',
  },
  {
    id: 'timed',
    name: { en: 'Time Attack', es: 'Contra reloj' },
    icon: 'R',
    description: {
      en: 'Answer as many questions as possible before time runs out.',
      es: 'Responde la mayor cantidad posible antes de que se acabe el tiempo.',
    },
    color: 'from-red-500 to-orange-500',
    bgGradient: 'from-red-500/10 to-orange-500/10',
  },
  {
    id: 'survival',
    name: { en: 'Survival', es: 'Supervivencia' },
    icon: 'S',
    description: {
      en: "One mistake and you're out. How far can you go?",
      es: 'Un error y quedas fuera. ¿Hasta dónde llegas?',
    },
    color: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-500/10 to-emerald-500/10',
  },
  {
    id: 'practice',
    name: { en: 'Practice', es: 'Práctica' },
    icon: 'P',
    description: {
      en: 'Learn at your own pace with instant explanations.',
      es: 'Aprende a tu ritmo con explicaciones instantáneas.',
    },
    color: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
];

export function GameModeSelector({ quiz, locale = 'en', onSelectMode }: GameModeSelectorProps) {
  const [selectedMode, setSelectedMode] = React.useState<GameMode | null>(null);
  const copy =
    locale === 'es'
      ? {
          title: 'Elige tu modo',
          knowledge: 'Pon a prueba lo que sabes',
          result: 'Descubre tu resultado',
          questions: 'preguntas',
          keyboardPrefix: 'Pulsa',
          keyboardSuffix: 'para elegir con el teclado',
        }
      : {
          title: 'Choose your mode',
          knowledge: 'Test your knowledge',
          result: 'Discover your result',
          questions: 'questions',
          keyboardPrefix: 'Press',
          keyboardSuffix: 'to select with keyboard',
        };

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    setTimeout(() => onSelectMode(mode), 300);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-3xl"
      >
        <div className="mb-8 text-center">
          <h1 className="font-display text-text-primary mb-2 text-3xl font-bold md:text-4xl">
            {copy.title}
          </h1>
          <p className="text-text-secondary">{quiz.title}</p>
          <p className="text-text-muted mt-2 text-sm">
            {quiz.questions.length} {copy.questions} ·{' '}
            {quiz.quiz_type === 'trivia' ? copy.knowledge : copy.result}
          </p>
        </div>

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
                'group relative rounded-2xl border-2 p-6 text-left transition-all duration-300',
                'hover:scale-[1.02] active:scale-[0.98]',
                selectedMode === mode.id
                  ? 'border-accent-primary bg-accent-primary/10'
                  : 'border-border-subtle bg-bg-secondary hover:border-accent-primary/50',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100',
                  mode.bgGradient
                )}
              />

              <div className="relative min-w-0 pr-10">
                <div className="border-border-subtle text-text-primary mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border bg-white/60 text-lg font-semibold">
                  {mode.icon}
                </div>

                <h3
                  className={cn(
                    'mb-2 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent',
                    mode.color
                  )}
                >
                  {mode.name[locale]}
                </h3>

                <p className="text-text-secondary text-sm leading-7">{mode.description[locale]}</p>
              </div>

              <div
                className={cn(
                  'bg-bg-tertiary group-hover:bg-accent-primary/20 absolute top-1/2 right-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-200',
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

        <p className="text-text-muted mt-6 text-center text-xs">
          {copy.keyboardPrefix} <kbd className="bg-bg-tertiary rounded px-1.5 py-0.5">1-4</kbd>{' '}
          {copy.keyboardSuffix}
        </p>
      </motion.div>
    </div>
  );
}
