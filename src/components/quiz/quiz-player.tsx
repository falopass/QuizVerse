'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { submitQuizResult } from '@/actions/quiz.actions';
import { cn } from '@/lib/utils/cn';
import { useQuizStore, type GameMode } from '@/stores/quiz-store';
import type { PersonalityResult, Quiz } from '@/types/quiz';
import { GameModeSelector } from './game-mode-selector';
import { PowerUpBar } from './power-up-bar';
import { QuestionCard } from './question-card';
import { QuizProgress } from './quiz-progress';
import { ResultScreen } from './result-screen';
import { StreakIndicator } from './streak-indicator';
import type { Locale } from '@/lib/i18n/dictionaries';
import { getLocalizedLanguageLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { trackEvent } from '@/lib/telemetry/client';

interface QuizPlayerProps {
  quiz: Quiz;
  locale?: Locale;
}

let _audioContext: AudioContext | null = null;
const NO_HIDDEN_OPTIONS: string[] = [];
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_audioContext && _audioContext.state !== 'closed') return _audioContext;
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  _audioContext = new AudioContextClass();
  return _audioContext;
}

const playSound = (type: 'correct' | 'incorrect' | 'click' | 'powerup') => {
  const audioContext = getAudioContext();
  if (!audioContext) return;

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
  const [hiddenOptions, setHiddenOptions] = React.useState<{ questionIndex: number; ids: string[] }>({ questionIndex: -1, ids: [] });
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
    startGame,
    selectOption,
    submitAnswer,
    skipQuestion,
    usePowerUp: activatePowerUp,
    togglePause,
    resetGame,
    getCurrentQuestion,
    getScore,
    getPersonalityResult,
  } = useQuizStore();
  const hiddenOptionIds = hiddenOptions.questionIndex === currentQuestionIndex ? hiddenOptions.ids : NO_HIDDEN_OPTIONS;

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
    if (showModeSelector || isCompleted || isPaused || showFeedback || gameMode !== 'timed') return;
    const timer = setInterval(() => {
      useQuizStore.setState((state) => {
        if (state.timeRemaining <= 1) {
          return { timeRemaining: 0, isCompleted: true };
        }
        return { timeRemaining: state.timeRemaining - 1, totalTimeUsed: state.totalTimeUsed + 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameMode, isCompleted, isPaused, showFeedback, showModeSelector]);

  React.useEffect(() => {
    if (!showFeedback || lastAnswerCorrect === null || quiz.quiz_type !== 'trivia') return;
    playSound(lastAnswerCorrect ? 'correct' : 'incorrect');
    if (navigator.vibrate) navigator.vibrate(lastAnswerCorrect ? 50 : 100);
  }, [lastAnswerCorrect, showFeedback, quiz.quiz_type]);

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
      if (showModeSelector || isCompleted || isPaused || showFeedback) return;
      const currentQuestion = getCurrentQuestion();
      if (!currentQuestion) return;

      if (event.key >= '1' && event.key <= '4') {
        const index = Number(event.key) - 1;
        if (index < currentQuestion.options.length && !hiddenOptionIds.includes(currentQuestion.options[index].id)) {
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
    hiddenOptionIds,
    isCompleted,
    isPaused,
    showModeSelector,
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
    startGame(quiz, mode);
    setShowModeSelector(false);
    setHiddenOptions({ questionIndex: -1, ids: [] });
    playSound('click');
  };

  if (showModeSelector) {
    return <GameModeSelector quiz={quiz} locale={uiLocale} onSelectMode={handleStartGame} />;
  }

  if (isPaused) {
    return (
      <div className="arcade-play-page arcade-wrap">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="arcade-pause w-full max-w-xl p-10 text-center"
          >
            <div className="border-border-subtle bg-bg-primary text-text-primary mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border text-3xl font-black">
              II
            </div>
            <p className="arcade-play-label">{copy.pause}</p>
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
                className="arcade-button"
              >
                {copy.resume}
              </button>
              <button
                onClick={() => {
                  setShowModeSelector(true);
                  togglePause();
                }}
                className="arcade-pause-secondary"
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
      <ResultScreen
        locale={uiLocale}
        quiz={quiz}
        result={submission?.result ?? getPersonalityResult()}
        triviaScore={quiz.quiz_type === 'trivia' ? getScore() : undefined}
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
      />
    );
  }

  if (!currentQuestion) {
    return <div className="text-text-muted py-24 text-center">{copy.quizNotFound}</div>;
  }

  return (
    <div className="arcade-play-screen">
      <div className="flex min-h-screen flex-col">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="arcade-play-top"
        >
          <div className="px-4 py-4">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <StreakIndicator streak={streak} locale={uiLocale} />
              <div className="max-w-xl flex-1">
                <QuizProgress
                  currentQuestion={currentQuestionIndex + 1}
                  totalQuestions={totalQuestions}
                  locale={uiLocale}
                  timeRemaining={gameMode === 'timed' ? timeRemaining : undefined}
                  timeLimit={gameMode === 'timed' ? quiz.questions.reduce((total, question) => total + (question.time_limit_seconds || 30), 0) : undefined}
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
          {!showFeedback && <PowerUpBar
            locale={uiLocale}
            powerUps={powerUps.filter((powerUp) => (gameMode === 'timed' || powerUp.id !== 'extra-time') && (quiz.quiz_type === 'trivia' || powerUp.id !== 'fifty-fifty'))}
            onUsePowerUp={(id) => {
              if (id === 'fifty-fifty') {
                const hidden = currentQuestion.options.filter((option) => !option.is_correct).slice(0, 2).map((option) => option.id);
                setHiddenOptions({ questionIndex: currentQuestionIndex, ids: hidden });
                if (selectedOptionId && hidden.includes(selectedOptionId)) useQuizStore.setState({ selectedOptionId: null });
              }
              activatePowerUp(id);
              playSound('powerup');
            }}
          />}
        </motion.div>

        <div className="arcade-play-body flex-1 px-4 py-8 md:py-10">
          {showFeedback && lastAnswerCorrect !== null && quiz.quiz_type === 'trivia' && <p className="arcade-answer-feedback" role="status">{lastAnswerCorrect ? copy.correct : copy.miss}</p>}
          <div className="mx-auto mb-6 flex max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="arcade-play-label">{copy.nowPlaying}</p>
              <h1 className="arcade-play-title">
                {quiz.title}
              </h1>
              <p className="arcade-play-meta">
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
                <QuestionCard
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
                  showFeedback={showFeedback}
                  locale={uiLocale}
                  hiddenOptionIds={hiddenOptionIds}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="arcade-play-actions">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <button
              onClick={() => {
                skipQuestion();
                playSound('click');
              }}
              disabled={showFeedback}
              className="arcade-play-skip"
            >
              {copy.skip}
            </button>
            <button
              onClick={() => submitAnswer()}
              disabled={!selectedOptionId || showFeedback}
              className={cn(
                'arcade-play-submit',
                selectedOptionId && !showFeedback
                  ? 'arcade-play-submit-ready'
                  : 'cursor-not-allowed opacity-50'
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
