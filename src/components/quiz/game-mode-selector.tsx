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
  },
  {
    id: 'timed',
    name: { en: 'Time Attack', es: 'Contrarreloj' },
    icon: 'R',
    description: {
      en: 'Answer as many questions as possible before time runs out.',
      es: 'Responde la mayor cantidad posible antes de que se acabe el tiempo.',
    },
  },
  {
    id: 'survival',
    name: { en: 'Survival', es: 'Supervivencia' },
    icon: 'S',
    description: {
      en: "One mistake and you're out. How far can you go?",
      es: 'Un error y quedas fuera. ¿Hasta dónde llegas?',
    },
  },
  {
    id: 'practice',
    name: { en: 'Practice', es: 'Práctica' },
    icon: 'P',
    description: {
      en: 'Learn at your own pace with instant explanations.',
      es: 'Aprende a tu ritmo con explicaciones instantáneas.',
    },
  },
];

export function GameModeSelector({ quiz, locale = 'en', onSelectMode }: GameModeSelectorProps) {
  const [selectedMode, setSelectedMode] = React.useState<GameMode | null>(null);
  const modes = React.useMemo(
    () => GAME_MODES.filter((mode) => quiz.quiz_type === 'trivia' || mode.id !== 'survival'),
    [quiz.quiz_type]
  );
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
    onSelectMode(mode);
  };

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= modes.length ||
        selectedMode
      )
        return;
      setSelectedMode(modes[index].id);
      onSelectMode(modes[index].id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modes, onSelectMode, selectedMode]);

  return (
    <div className="arcade-play-page arcade-wrap">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full">
        <div className="arcade-mode-intro">
          <h1>{copy.title}</h1>
          <p className="arcade-mode-quiz">{quiz.title}</p>
          <p className="arcade-mode-count">
            {quiz.questions.length} {copy.questions} ·{' '}
            {quiz.quiz_type === 'trivia' ? copy.knowledge : copy.result}
          </p>
        </div>

        <div className="arcade-mode-grid">
          {modes.map((mode, index) => (
            <motion.button
              key={mode.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleModeSelect(mode.id)}
              disabled={selectedMode !== null}
              className={cn(
                'arcade-mode-card',
                selectedMode === mode.id && 'arcade-mode-card-selected'
              )}
            >
              <span className="arcade-mode-number">
                0{index + 1} / {mode.icon}
              </span>
              <span className="arcade-mode-name">{mode.name[locale]}</span>
              <span className="arcade-mode-description">{mode.description[locale]}</span>
              <span className="arcade-mode-arrow" aria-hidden="true">
                ↗
              </span>
            </motion.button>
          ))}
        </div>

        <p className="arcade-mode-hint">
          {copy.keyboardPrefix} 1-{modes.length} {copy.keyboardSuffix}
        </p>
      </motion.div>
    </div>
  );
}
