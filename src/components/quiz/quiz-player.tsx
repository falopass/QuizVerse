'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { submitQuizResult } from '@/actions/quiz.actions';
import { cn } from '@/lib/utils/cn';
import { useQuizStore, type GameMode } from '@/stores/quiz-store';
import type { PersonalityResult, Quiz } from '@/types/quiz';
import { GameModeSelectorV2 } from './game-mode-selector-v2';
import { PowerUpBar } from './power-up-bar';
import { QuestionCardV2 } from './question-card-v2';
import { QuizProgress } from './quiz-progress';
import { ResultScreenV2 } from './result-screen-v2';
import { StreakIndicator } from './streak-indicator';
import type { Locale } from '@/lib/i18n/dictionaries';
import { getLocalizedLanguageLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { trackEvent } from '@/lib/telemetry/client';

interface QuizPlayerProps {
  quiz: Quiz;
  locale?: Locale;
}

const playSound = (type: 'correct' | 'incorrect' | 'click' | 'powerup') => {
  if (typeof window === 'undefined') return;
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const frequencies = { correct: 523.25, incorrect: 220, click: 440, powerup: 659.25 };
  oscillator.frequency.value = frequencies[type];
  oscillator.type = type === 'correct' ? 'sine' : 'square';
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
};

export function QuizPlayer({ quiz, locale }: QuizPlayerProps) {
  const uiLocale: Locale = locale === 'es' ? 'es' : 'en';
  const copy =
    uiLocale === 'es'
      ? {
          pause: 'Pausa',
          pauseTitle: 'Respira un momento.',
          pauseBody: 'Puedes volver a esta partida o cambiar de modo antes de continuar.',
          resume: 'Volver',
          changeMode: 'Cambiar modo',
          quizNotFound: 'No encontramos este quiz.',
          pauseGame: 'Pausar juego',
          correct: 'Correcto',
          miss: 'Fallaste',
          nowPlaying: 'Jugando ahora',
          skip: 'Saltar',
          finish: 'Terminar',
          next: 'Siguiente',
        }
      : {
          pause: 'Pause',
          pauseTitle: 'Take a breath.',
          pauseBody: 'You can jump back into the current run or switch modes before continuing.',
          resume: 'Resume',
          changeMode: 'Change mode',
          quizNotFound: 'Quiz not found.',
          pauseGame: 'Pause game',
          correct: 'Correct',
          miss: 'Miss',
          nowPlaying: 'Now playing',
          skip: 'Skip',
          finish: 'Finish',
          next: 'Next',
        };
  const [showModeSelector, setShowModeSelector] = React.useState(true);
  const [submission, setSubmission] = React.useState<{
    result: PersonalityResult | null;
    pointsEarned: number;
    shareToken: string | null;
  } | null>(null);
  const [isSubmittingResult, setIsSubmittingResult] = React.useState(false);
  const hasSubmittedRef = React.useRef(false);

  const {
    gameMode,
    currentQuestionIndex,
    selectedOptionId,
    answers,
    isCompleted,
    isPaused,
    timeRemaining,
    streak,
    maxStreak,
    bonusPoints,
    powerUps,
    showFeedback,
    lastAnswerCorrect,
    showReview,
    startGame,
    selectOption,
    submitAnswer,
    skipQuestion,
    usePowerUp: activatePowerUp,
    togglePause,
    resetGame,
    setGameMode,
    toggleReview,
    getCurrentQuestion,
    getScore,
    getPersonalityResult,
  } = useQuizStore();

  React.useEffect(() => {
    startGame(quiz, 'normal');
    setSubmission(null);
    setIsSubmittingResult(false);
    hasSubmittedRef.current = false;
    setShowModeSelector(true);
  }, [quiz, startGame]);

  React.useEffect(() => {
    if (showModeSelector) return;

    void trackEvent({
      name: 'quiz_start',
      locale: uiLocale,
      quizId: quiz.id,
      quizSlug: quiz.slug,
      quizType: quiz.quiz_type,
    });
  }, [gameMode, quiz.id, quiz.quiz_type, quiz.slug, showModeSelector, uiLocale]);

  React.useEffect(() => {
    if (isCompleted || isPaused || gameMode === 'practice') return;
    const timer = setInterval(() => {
      useQuizStore.setState((state) => {
        if (state.timeRemaining <= 1) {
          if (state.selectedOptionId) submitAnswer();
          else skipQuestion();
          return {
            timeRemaining:
              state.quiz?.questions[state.currentQuestionIndex]?.time_limit_seconds || 30,
          };
        }
        return { timeRemaining: state.timeRemaining - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestionIndex, gameMode, isCompleted, isPaused, skipQuestion, submitAnswer]);

  React.useEffect(() => {
    if (!showFeedback || lastAnswerCorrect === null) return;
    playSound(lastAnswerCorrect ? 'correct' : 'incorrect');
    if (navigator.vibrate) navigator.vibrate(lastAnswerCorrect ? 50 : 100);
  }, [lastAnswerCorrect, showFeedback]);

  React.useEffect(() => {
    if (!isCompleted || hasSubmittedRef.current || isSubmittingResult) return;
    hasSubmittedRef.current = true;
    setIsSubmittingResult(true);

    const persistSession = async () => {
      try {
        const totalTimeSeconds = Math.max(
          0,
          Math.round(answers.reduce((total, answer) => total + answer.time_ms, 0) / 1000)
        );
        const result = await submitQuizResult(quiz.id, answers, totalTimeSeconds);
        if (result.success) {
          setSubmission({
            result: (result.result as PersonalityResult | null) ?? null,
            pointsEarned: result.points_earned ?? 0,
            shareToken:
              (result.session as { share_token?: string | null } | undefined)?.share_token ?? null,
          });
          void trackEvent({
            name: 'quiz_complete',
            locale: uiLocale,
            quizId: quiz.id,
            quizSlug: quiz.slug,
            quizType: quiz.quiz_type,
            value: result.points_earned ?? 0,
            metadata: {
              answers: answers.length,
            },
          });
        }
      } catch (error) {
        console.error('Failed to submit quiz result', error);
      } finally {
        setIsSubmittingResult(false);
      }
    };

    void persistSession();
  }, [answers, isCompleted, isSubmittingResult, quiz.id, quiz.quiz_type, quiz.slug, uiLocale]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isCompleted || isPaused) return;
      const currentQuestion = getCurrentQuestion();
      if (!currentQuestion) return;

      if (event.key >= '1' && event.key <= '4') {
        const index = Number(event.key) - 1;
        if (index < currentQuestion.options.length) {
          selectOption(currentQuestion.options[index].id);
          playSound('click');
        }
      }

      if (event.key === 'Enter' && selectedOptionId && !showFeedback) {
        submitAnswer();
      }

      if (event.key === 'Escape') {
        togglePause();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    getCurrentQuestion,
    isCompleted,
    isPaused,
    selectOption,
    selectedOptionId,
    showFeedback,
    submitAnswer,
    togglePause,
  ]);

  const currentQuestion = getCurrentQuestion();
  const totalQuestions = quiz.questions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleStartGame = (mode: GameMode) => {
    setGameMode(mode);
    startGame(quiz, mode);
    setShowModeSelector(false);
    playSound('click');
  };

  if (showModeSelector) {
    return <GameModeSelectorV2 quiz={quiz} locale={uiLocale} onSelectMode={handleStartGame} />;
  }

  if (isPaused) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="surface-panel w-full max-w-xl p-10 text-center"
          >
            <div className="border-border-subtle bg-bg-primary text-text-primary mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border text-3xl font-black">
              II
            </div>
            <p className="eyebrow">{copy.pause}</p>
            <h1 className="text-text-primary mt-3 text-4xl font-semibold tracking-tight">
              {copy.pauseTitle}
            </h1>
            <p className="text-text-secondary mt-4 text-base leading-7">{copy.pauseBody}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  togglePause();
                  playSound('click');
                }}
                className="bg-accent-primary hover:bg-accent-hover rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
              >
                {copy.resume}
              </button>
              <button
                onClick={() => {
                  setShowModeSelector(true);
                  togglePause();
                }}
                className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
              >
                {copy.changeMode}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <ResultScreenV2
        locale={uiLocale}
        quiz={quiz}
        result={submission?.result ?? getPersonalityResult()}
        triviaScore={getScore()}
        answers={answers}
        streak={maxStreak}
        bonusPoints={bonusPoints + (submission?.pointsEarned ?? 0)}
        shareUrl={
          submission?.shareToken && typeof window !== 'undefined'
            ? `${window.location.origin}/${uiLocale}/quiz/${quiz.slug}/result?s=${submission.shareToken}`
            : undefined
        }
        onPlayAgain={() => {
          resetGame();
          setSubmission(null);
          hasSubmittedRef.current = false;
          setShowModeSelector(true);
        }}
        onReview={() => toggleReview()}
        showReview={showReview}
      />
    );
  }

  if (!currentQuestion) {
    return <div className="text-text-muted py-24 text-center">{copy.quizNotFound}</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(181,94,44,0.1),transparent_38%),linear-gradient(180deg,rgba(246,239,229,0.86),rgba(235,228,216,0.94))]" />
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(24,20,16,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(24,20,16,0.05)_1px,transparent_1px)] [background-size:48px_48px] opacity-35" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="border-border-subtle bg-bg-glass sticky top-0 z-10 border-b backdrop-blur-xl"
        >
          <div className="px-4 py-4">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <StreakIndicator streak={streak} />
              <div className="max-w-xl flex-1">
                <QuizProgress
                  currentQuestion={currentQuestionIndex + 1}
                  totalQuestions={totalQuestions}
                  timeRemaining={timeRemaining}
                  timeLimit={currentQuestion.time_limit_seconds || 30}
                />
              </div>
              <button
                onClick={() => {
                  togglePause();
                  playSound('click');
                }}
                className="bg-bg-secondary hover:bg-bg-tertiary rounded-lg p-2 transition-colors"
                aria-label={copy.pauseGame}
              >
                <svg
                  className="text-text-secondary h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <PowerUpBar
            powerUps={powerUps}
            onUsePowerUp={(id) => {
              activatePowerUp(id);
              playSound('powerup');
            }}
          />
        </motion.div>

        <AnimatePresence>
          {showFeedback && lastAnswerCorrect !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'pointer-events-none fixed inset-0 z-50 flex items-center justify-center',
                lastAnswerCorrect ? 'bg-success/10' : 'bg-error/10'
              )}
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.5 }}
                className="border-border-subtle text-text-primary rounded-full border bg-white/85 px-8 py-6 text-3xl font-semibold shadow-xl"
              >
                {lastAnswerCorrect ? copy.correct : copy.miss}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 px-4 py-8 md:py-10">
          <div className="mx-auto mb-6 flex max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">{copy.nowPlaying}</p>
              <h1 className="text-text-primary mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                {quiz.title}
              </h1>
              <p className="text-text-muted mt-3 text-sm tracking-[0.18em] uppercase">
                {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} · {quiz.estimated_minutes} min ·{' '}
                {getLocalizedLanguageLabel(quiz.language, uiLocale)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-5xl"
              >
                <QuestionCardV2
                  question={currentQuestion}
                  questionNumber={currentQuestionIndex + 1}
                  totalQuestions={totalQuestions}
                  selectedOptionId={selectedOptionId}
                  onSelectOption={(optionId) => {
                    selectOption(optionId);
                    playSound('click');
                  }}
                  showExplanation={gameMode === 'practice'}
                  disabled={showFeedback}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="border-border-subtle bg-bg-glass sticky bottom-0 border-t px-4 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <button
              onClick={() => {
                skipQuestion();
                playSound('click');
              }}
              disabled={showFeedback}
              className="text-text-muted hover:text-text-secondary text-sm font-medium transition-colors disabled:opacity-50"
            >
              {copy.skip}
            </button>
            <button
              onClick={() => submitAnswer()}
              disabled={!selectedOptionId || showFeedback}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold transition-all duration-200',
                selectedOptionId && !showFeedback
                  ? 'bg-accent-primary hover:bg-accent-hover text-white hover:scale-105'
                  : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
              )}
            >
              {showFeedback ? '...' : isLastQuestion ? copy.finish : copy.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuizPlayer;
