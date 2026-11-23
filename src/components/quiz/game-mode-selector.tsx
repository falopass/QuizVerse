'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { entrance } from '@/lib/ui/motion';
import { cn } from '@/lib/utils/cn';
import { availableGameModes } from '@/lib/quiz/game-modes';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';
import type { GameMode } from '@/stores/quiz-store';

interface GameModeSelectorProps {
  quiz: Quiz;
  locale?: Locale;
  onSelectMode: (mode: GameMode) => void;
  currentMode?: GameMode;
}

interface GameModeInfo {
  id: GameMode;
  name: Record<'en' | 'es', string>;
  description: Record<'en' | 'es', string>;
}

const GAME_MODES: GameModeInfo[] = [
  {
    id: 'normal',
    name: { en: 'Classic', es: 'Clásico' },
    description: {
      en: 'Answer at your own pace. No pressure.',
      es: 'Responde a tu ritmo. Sin presión.',
    },
  },
  {
    id: 'timed',
    name: { en: 'Time attack', es: 'Contrarreloj' },
    description: {
      en: 'Answer as many questions as possible before time runs out.',
      es: 'Responde la mayor cantidad posible antes de que se acabe el tiempo.',
    },
  },
  {
    id: 'survival',
    name: { en: 'Survival', es: 'Supervivencia' },
    description: {
      en: "One mistake and you're out. How far can you go?",
      es: 'Un error y quedas fuera. ¿Hasta dónde llegas?',
    },
  },
  {
    id: 'practice',
    name: { en: 'Practice', es: 'Práctica' },
    description: {
      en: 'Learn at your own pace with instant explanations.',
      es: 'Aprende a tu ritmo con explicaciones instantáneas.',
    },
  },
];

export function GameModeSelector({
  quiz,
  locale = 'en',
  onSelectMode,
  currentMode,
}: GameModeSelectorProps) {
  const [selectedMode, setSelectedMode] = React.useState<GameMode | null>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const modes = React.useMemo(() => {
    const allowed = availableGameModes(quiz);
    return GAME_MODES.filter((mode) => allowed.includes(mode.id));
  }, [quiz]);
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  // Pantalla nueva tras «Cambiar modo»: el foco va a su título y se anuncia.
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const copy =
    locale === 'es'
      ? {
          title: 'Elige tu modo',
          current: 'Modo actual',
          knowledge: 'Pon a prueba lo que sabes',
          result: 'Descubre tu resultado',
          questions: 'preguntas',
          keyboardPrefix: 'Pulsa',
          keyboardSuffix: 'para elegir con el teclado',
        }
      : {
          title: 'Choose your mode',
          current: 'Current mode',
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
        event.defaultPrevented ||
        event.repeat ||
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
      <motion.div
        {...entrance(reduceMotion, {
          initial: { y: 20, opacity: 0 },
          animate: { y: 0, opacity: 1 },
        })}
        className="w-full"
      >
        <div className="arcade-mode-intro">
          <h1 ref={headingRef} tabIndex={-1}>
            {copy.title}
          </h1>
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
              {...entrance(reduceMotion, {
                initial: { y: 20, opacity: 0 },
                animate: { y: 0, opacity: 1 },
                transition: { delay: index * 0.1 },
              })}
              type="button"
              aria-keyshortcuts={String(index + 1)}
              data-current={currentMode === mode.id || undefined}
              onClick={() => handleModeSelect(mode.id)}
              disabled={selectedMode !== null}
              className={cn(
                'arcade-mode-card',
                selectedMode === mode.id && 'arcade-mode-card-selected'
              )}
            >
              <kbd className="arcade-mode-number" aria-hidden="true">
                {index + 1}
              </kbd>
              <span className="arcade-mode-name">{mode.name[locale]}</span>
              <span className="arcade-mode-description">{mode.description[locale]}</span>
              {currentMode === mode.id && (
                <span className="qv-l10-current-mode">{copy.current}</span>
              )}
              <span className="arcade-mode-arrow" aria-hidden="true">
                ↗
              </span>
            </motion.button>
          ))}
        </div>

        {modes.length > 1 && (
          <p className="arcade-mode-hint">
            {copy.keyboardPrefix} 1-{modes.length} {copy.keyboardSuffix}
          </p>
        )}
      </motion.div>
    </div>
  );
}
