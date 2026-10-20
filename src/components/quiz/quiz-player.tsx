'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { entrance } from '@/lib/ui/motion';
import { submitQuizResult } from '@/actions/quiz.actions';
import { recordRecent } from '@/lib/history/recent-quizzes';
import { cn } from '@/lib/utils/cn';
import { useQuizStore, type GameMode } from '@/stores/quiz-store';
import type { PersonalityResult, Quiz } from '@/types/quiz';
import type { ChallengeInfo } from '@/lib/quiz/challenge';
import { GameModeSelector } from './game-mode-selector';
import { PowerUpBar } from './power-up-bar';
import { QuestionCard } from './question-card';
import { QuizProgress } from './quiz-progress';
import { ResultScreen } from './result-screen';
import { StreakIndicator } from './streak-indicator';
import type { Locale } from '@/lib/i18n/dictionaries';
import {
  getLocalizedLanguageLabel,
  getLocalizedTypeLabel,
  localizeCategory,
} from '@/lib/i18n/catalog';
import { trackEvent } from '@/lib/telemetry/client';
import { achievementToastMessage } from '@/lib/quiz/achievement-toast';
import { requestAnswerVerdict, requestEliminatedOptions } from '@/lib/quiz/reveal-client';
import { useToast } from '@/providers/toast-provider';

interface QuizPlayerProps {
  quiz: Quiz;
  locale?: Locale;
  /** Reto activo: el marcador del retador que hay que superar. */
  challenge?: ChallengeInfo | null;
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

export function QuizPlayer({ quiz, locale, challenge }: QuizPlayerProps) {
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
  const [hiddenOptions, setHiddenOptions] = React.useState<{
    questionIndex: number;
    ids: string[];
  }>({ questionIndex: -1, ids: [] });
  /**
   * What the server said about the answer given for a specific question. The
   * quiz payload does not carry the answer key, so the card can only paint the
   * right answer from this verdict.
   */
  const [verdict, setVerdict] = React.useState<{
    questionIndex: number;
    correctOptionId: string | null;
  } | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = React.useState(false);
  const [submission, setSubmission] = React.useState<{
    result: PersonalityResult | null;
    pointsEarned: number;
    shareToken: string | null;
    score: number;
    maxScore: number;
  } | null>(null);
  const [isSubmittingResult, setIsSubmittingResult] = React.useState(false);
  const hasSubmittedRef = React.useRef(false);
  const { success: toastSuccess } = useToast();
  const reduceMotion = useReducedMotion() ?? false;

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
  const hiddenOptionIds =
    hiddenOptions.questionIndex === currentQuestionIndex ? hiddenOptions.ids : NO_HIDDEN_OPTIONS;
  /**
   * The card remounts per question (AnimatePresence exit runs before the new
   * card mounts), so a plain effect on `currentQuestionIndex` would focus the
   * heading that is leaving. A ref callback fires when the new heading mounts:
   * that is when focus must land, or it falls to <body>.
   */
  const focusQuestionHeading = React.useCallback((heading: HTMLHeadingElement | null) => {
    heading?.focus();
  }, []);

  /**
   * Asks the server whether the selected option is right, then records the
   * answer. If the reveal fails the answer is still recorded (without feedback)
   * because submission re-grades everything server-side.
   */
  const submitCurrentAnswer = React.useCallback(async () => {
    if (isCheckingAnswer || showFeedback) return;
    const question = getCurrentQuestion();
    if (!question || !selectedOptionId) return;

    const answeredIndex = currentQuestionIndex;
    setIsCheckingAnswer(true);
    const revealed = await requestAnswerVerdict({
      quizId: quiz.id,
      questionId: question.id,
      selectedOptionId,
    });
    setIsCheckingAnswer(false);

    setVerdict({
      questionIndex: answeredIndex,
      correctOptionId: revealed?.correctOptionId ?? null,
    });
    submitAnswer(revealed ? { isCorrect: revealed.isCorrect } : undefined);
  }, [
    currentQuestionIndex,
    getCurrentQuestion,
    isCheckingAnswer,
    quiz.id,
    selectedOptionId,
    showFeedback,
    submitAnswer,
  ]);

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
        // Only the choices travel: the server re-grades every answer.
        const payload = answers.map(({ question_id, selected_option_id, time_ms }) => ({
          question_id,
          selected_option_id,
          time_ms,
        }));
        const result = await submitQuizResult(quiz.id, payload, totalTimeSeconds);
        if (result.success) {
          setSubmission({
            result: (result.result as PersonalityResult | null) ?? null,
            pointsEarned: result.points_earned ?? 0,
            shareToken:
              (result.session as { share_token?: string | null } | undefined)?.share_token ?? null,
            score: result.score ?? 0,
            maxScore: result.max_score ?? quiz.questions.length,
          });
          if (quiz.quiz_type === 'trivia' || quiz.quiz_type === 'personality') {
            recordRecent({
              slug: quiz.slug,
              title: quiz.title,
              quizType: quiz.quiz_type,
              locale: uiLocale,
              categoryName: quiz.category
                ? (localizeCategory(quiz.category, uiLocale)?.name ?? quiz.category.name)
                : null,
              coverImageUrl: quiz.cover_image_url,
              minutes: quiz.estimated_minutes,
              score:
                quiz.quiz_type === 'trivia'
                  ? `${result.score ?? 0}/${result.max_score ?? quiz.questions.length}`
                  : (result.result?.title ?? null),
              playedAt: new Date().toISOString(),
            });
          }
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
          const unlockedToast = achievementToastMessage(uiLocale, result.achievements_unlocked);
          if (unlockedToast) toastSuccess(unlockedToast.title, unlockedToast.description);
        }
      } catch (error) {
        console.error('Failed to submit quiz result', error);
      } finally {
        setIsSubmittingResult(false);
      }
    };

    void persistSession();
  }, [
    answers,
    isCompleted,
    isSubmittingResult,
    quiz.category,
    quiz.cover_image_url,
    quiz.estimated_minutes,
    quiz.id,
    quiz.questions.length,
    quiz.quiz_type,
    quiz.slug,
    quiz.title,
    toastSuccess,
    uiLocale,
  ]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showModeSelector || isCompleted || isPaused || showFeedback) return;
      const currentQuestion = getCurrentQuestion();
      if (!currentQuestion) return;

      if (event.key >= '1' && event.key <= '4') {
        const index = Number(event.key) - 1;
        if (
          !isCheckingAnswer &&
          index < currentQuestion.options.length &&
          !hiddenOptionIds.includes(currentQuestion.options[index].id)
        ) {
          selectOption(currentQuestion.options[index].id);
          playSound('click');
        }
      }

      if (event.key === 'Enter' && selectedOptionId && !showFeedback) {
        void submitCurrentAnswer();
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
    isCheckingAnswer,
    isCompleted,
    isPaused,
    showModeSelector,
    selectOption,
    selectedOptionId,
    showFeedback,
    submitCurrentAnswer,
    togglePause,
  ]);

  const currentQuestion = getCurrentQuestion();
  const totalQuestions = quiz.questions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  // Marcador para lectores de pantalla: cambia solo al responder, no por tecla.
  const answeredCount = answers.length;
  const announcementParts: string[] = [];
  if (quiz.quiz_type === 'trivia' && answeredCount > 0) {
    announcementParts.push(
      uiLocale === 'es'
        ? `${getScore().correct} de ${answeredCount} correctas`
        : `${getScore().correct} of ${answeredCount} correct`
    );
  }
  if (streak >= 2) {
    announcementParts.push(uiLocale === 'es' ? `Racha de ${streak}` : `Streak of ${streak}`);
  }
  const scoreAnnouncement = announcementParts.join(' · ');

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
            {...entrance(reduceMotion, {
              initial: { scale: 0.96, opacity: 0 },
              animate: { scale: 1, opacity: 1 },
            })}
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
        // El marcador del servidor manda cuando existe: un reveal fallido puede
        // haber dejado un acierto como mala en el store local.
        triviaScore={
          quiz.quiz_type === 'trivia'
            ? submission
              ? {
                  correct: submission.score,
                  total: submission.maxScore,
                  percentage:
                    submission.maxScore > 0
                      ? Math.round((submission.score / submission.maxScore) * 100)
                      : 0,
                }
              : getScore()
            : undefined
        }
        answers={answers}
        streak={maxStreak}
        bonusPoints={bonusPoints + (submission?.pointsEarned ?? 0)}
        // La comparativa solo se declara con la sesión ya persistida: un reveal
        // fallido deja el marcador local sin verificar y podría dibujar un
        // veredicto distinto al que quedó en el servidor (y en la tarjeta OG).
        challenge={submission ? challenge : null}
        shareUrl={
          submission?.shareToken && typeof window !== 'undefined'
            ? `${window.location.origin}/${uiLocale}/quiz/${quiz.slug}/result?s=${submission.shareToken}${challenge ? `&challenge=${challenge.token}` : ''}`
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
          {...entrance(reduceMotion, {
            initial: { y: -20, opacity: 0 },
            animate: { y: 0, opacity: 1 },
          })}
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
                  timeLimit={
                    gameMode === 'timed'
                      ? quiz.questions.reduce(
                          (total, question) => total + (question.time_limit_seconds || 30),
                          0
                        )
                      : undefined
                  }
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
          {!showFeedback && (
            <PowerUpBar
              locale={uiLocale}
              powerUps={powerUps.filter(
                (powerUp) =>
                  (gameMode === 'timed' || powerUp.id !== 'extra-time') &&
                  (quiz.quiz_type === 'trivia' || powerUp.id !== 'fifty-fifty')
              )}
              onUsePowerUp={(id) => {
                if (id === 'fifty-fifty') {
                  void (async () => {
                    const eliminated = await requestEliminatedOptions({
                      quizId: quiz.id,
                      questionId: currentQuestion.id,
                    });
                    // Without an answer from the server the power-up is not spent.
                    if (!eliminated) return;
                    setHiddenOptions({ questionIndex: currentQuestionIndex, ids: eliminated });
                    if (selectedOptionId && eliminated.includes(selectedOptionId)) {
                      useQuizStore.setState({ selectedOptionId: null });
                    }
                    activatePowerUp(id);
                    playSound('powerup');
                  })();
                  return;
                }
                activatePowerUp(id);
                playSound('powerup');
              }}
            />
          )}
        </motion.div>

        <div className="arcade-play-body flex-1 px-4 py-8 md:py-10">
          {/* Marcador/racha: región aparte para no repetir el veredicto */}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {scoreAnnouncement}
          </p>
          <div className="mx-auto mb-6 flex max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="arcade-play-label">{copy.nowPlaying}</p>
              <h1 className="arcade-play-title">{quiz.title}</h1>
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
                {...entrance(reduceMotion, {
                  initial: { x: 50, opacity: 0 },
                  animate: { x: 0, opacity: 1 },
                  exit: { x: -50, opacity: 0 },
                  transition: { type: 'spring', damping: 25, stiffness: 300 },
                })}
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
                  disabled={showFeedback || isCheckingAnswer}
                  showFeedback={showFeedback}
                  correctOptionId={
                    verdict?.questionIndex === currentQuestionIndex ? verdict.correctOptionId : null
                  }
                  locale={uiLocale}
                  hiddenOptionIds={hiddenOptionIds}
                  headingRef={focusQuestionHeading}
                  verdictText={
                    showFeedback && lastAnswerCorrect !== null && quiz.quiz_type === 'trivia'
                      ? lastAnswerCorrect
                        ? copy.correct
                        : copy.miss
                      : null
                  }
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
              onClick={() => {
                playSound('click');
                void submitCurrentAnswer();
              }}
              disabled={!selectedOptionId || showFeedback || isCheckingAnswer}
              className={cn(
                'arcade-play-submit',
                selectedOptionId && !showFeedback && !isCheckingAnswer
                  ? 'arcade-play-submit-ready'
                  : 'cursor-not-allowed opacity-50'
              )}
            >
              {showFeedback || isCheckingAnswer ? '...' : isLastQuestion ? copy.finish : copy.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuizPlayer;
