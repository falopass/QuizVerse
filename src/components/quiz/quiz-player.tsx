'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { entrance } from '@/lib/ui/motion';
import { startQuizAttempt, submitQuizResult } from '@/actions/quiz.actions';
import { recordRecent } from '@/lib/history/recent-quizzes';
import { cn } from '@/lib/utils/cn';
import { useQuizStore, type GameMode } from '@/stores/quiz-store';
import { availableGameModes } from '@/lib/quiz/game-modes';
import { EditorialEmptyState } from '@/components/home/app-placeholders';
import { localizeHref } from '@/lib/i18n/navigation';
import type { PersonalityResult, Quiz, QuizReviewItem } from '@/types/quiz';
import type { ChallengeInfo } from '@/lib/quiz/challenge';
import type { CompatibilityPeer } from '@/lib/quiz/compatibility';
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
  /** Reto de personalidad: resultado y tags del retador, para la tarjeta de compatibilidad. */
  compatibility?: CompatibilityPeer | null;
  /**
   * Modo con el que arranca la partida. Los CTA de la ficha y el hero piden
   * Clásico (`?mode=classic`); el selector queda tras «Cambiar modo» o la pausa.
   */
  initialMode?: GameMode;
  /** Relacionados saneados en el servidor; el resultado los pinta. */
  related?: Quiz[];
}

let _audioContext: AudioContext | null = null;
const NO_HIDDEN_OPTIONS: string[] = [];
/** Mismo tope que `MAX_TOTAL_SECONDS` en `src/lib/quiz/submission.ts`. */
const MAX_GAME_SECONDS = 2 * 60 * 60;

/**
 * Aviso de envío fallido. Vive a nivel de módulo (no en `copy`) porque el toast
 * se dispara dentro del callback de envío: depender del objeto `copy`, que se
 * recrea en cada render, cambiaría la identidad del callback y re-dispararía el
 * efecto tras cada fallo — un auto-reintento infinito contra el rate limit.
 */
const SUBMIT_FAILED_COPY = {
  es: {
    title: 'No pudimos guardar tu partida.',
    body: 'Reintenta desde la pantalla de resultado para no perder tus puntos.',
  },
  en: {
    title: "We couldn't save your game.",
    body: 'Retry from the result screen so your points are not lost.',
  },
} as const;
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

export function QuizPlayer({
  quiz,
  locale,
  challenge,
  compatibility,
  initialMode,
  related,
}: QuizPlayerProps) {
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
          quizNotFoundEyebrow: 'Sin partida',
          quizNotFoundBody:
            'No pudimos cargar las preguntas de este quiz. Vuelve a su ficha o explora otros.',
          browseQuizzes: 'Explorar quizzes',
          backToQuiz: 'Ver la ficha',
          pauseGame: 'Pausar juego',
          correct: 'Correcto',
          miss: 'Fallaste',
          nowPlaying: 'Jugando ahora',
          skip: 'Saltar',
          finish: 'Terminar',
          next: 'Siguiente',
          answersRemoved: 'Dos respuestas eliminadas',
          answerRemoved: 'Una respuesta eliminada',
          secondsAdded: 'Diez segundos añadidos',
          secondsLeft30: 'Quedan 30 segundos',
          secondsLeft10: 'Quedan 10 segundos',
        }
      : {
          pause: 'Pause',
          pauseTitle: 'Take a breath.',
          pauseBody: 'You can jump back into the current run or switch modes before continuing.',
          resume: 'Resume',
          changeMode: 'Change mode',
          quizNotFound: 'Quiz not found.',
          quizNotFoundEyebrow: 'No game',
          quizNotFoundBody:
            "We couldn't load this quiz's questions. Head back to its page or browse others.",
          browseQuizzes: 'Browse quizzes',
          backToQuiz: 'View the quiz page',
          pauseGame: 'Pause game',
          correct: 'Correct',
          miss: 'Miss',
          nowPlaying: 'Now playing',
          skip: 'Skip',
          finish: 'Finish',
          next: 'Next',
          answersRemoved: 'Two answers removed',
          answerRemoved: 'One answer removed',
          secondsAdded: 'Ten seconds added',
          secondsLeft30: '30 seconds left',
          secondsLeft10: '10 seconds left',
        };
  const [showModeSelector, setShowModeSelector] = React.useState(false);
  /** Avisos puntuales (ayudas, hitos del reloj) en una región polite propia. */
  const [liveMessage, setLiveMessage] = React.useState('');
  const cardWrapRef = React.useRef<HTMLDivElement | null>(null);
  const pausePanelRef = React.useRef<HTMLDivElement | null>(null);
  const pauseTitleRef = React.useRef<HTMLHeadingElement | null>(null);
  const pauseButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const wasPausedRef = React.useRef(false);
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
    explanation: string | null;
  } | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = React.useState(false);
  const [submission, setSubmission] = React.useState<{
    result: PersonalityResult | null;
    pointsEarned: number;
    shareToken: string | null;
    score: number;
    maxScore: number;
    review: QuizReviewItem[] | null;
  } | null>(null);
  const [isSubmittingResult, setIsSubmittingResult] = React.useState(false);
  const [submitFailed, setSubmitFailed] = React.useState(false);
  const hasSubmittedRef = React.useRef(false);
  /**
   * Emisión del attempt de la partida en curso. Las respuestas esperan esta
   * promesa si el token aún no llegó: el primer toque no debe quedarse sin
   * veredicto por una carrera con el arranque.
   */
  const attemptPromiseRef = React.useRef<Promise<string | null> | null>(null);
  /** Segundos de la partida, congelados al completar: un reintento no suma espera. */
  const elapsedSecondsRef = React.useRef<number | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();
  const reduceMotion = useReducedMotion() ?? false;

  const {
    quiz: activeQuiz,
    gameId,
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
  /**
   * El store arranca vacío en el servidor y puede traer la partida de otro
   * quiz al navegar. `startGame` corre en un efecto, así que hasta que el
   * `gameId` avance se pinta un marco estable (mismo HTML en servidor y
   * cliente) en vez de la pregunta anterior o el estado «quiz no encontrado».
   */
  const [initialGameId] = React.useState(gameId);
  const isGameStarted = gameId > initialGameId && activeQuiz?.id === quiz.id;
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
   * Pide al servidor el attempt firmado de la partida que acaba de arrancar.
   * Si falla (sin secreto configurado, red caída), el token queda en `null`:
   * el reveal se intenta igual — el servidor puede responder en modo
   * degradado — y la partida se puntúa al enviar pase lo que pase.
   */
  const beginAttempt = React.useCallback((quizId: string) => {
    const gameId = useQuizStore.getState().gameId;
    useQuizStore.getState().setAttemptToken(null);

    const promise = startQuizAttempt(quizId)
      .then((result) => {
        if (!result.success || useQuizStore.getState().gameId !== gameId) return null;
        useQuizStore.getState().setAttemptToken(result.attempt);
        return result.attempt;
      })
      .catch(() => null);

    attemptPromiseRef.current = promise;
    return promise;
  }, []);

  /**
   * Asks the server whether the chosen option is right, then records the
   * answer. If the reveal fails the answer is still recorded (without feedback)
   * because submission re-grades everything server-side.
   *
   * Tocar una opción la envía: la selección y el veredicto van en el mismo
   * gesto. En Práctica y con movimiento reducido el feedback no se auto-avanza;
   * el jugador sigue con «Siguiente».
   */
  const submitCurrentAnswer = React.useCallback(
    async (optionId?: string) => {
      if (isCheckingAnswer || showFeedback) return;
      const question = getCurrentQuestion();
      const chosenOptionId = optionId ?? selectedOptionId;
      if (!question || !chosenOptionId) return;

      if (optionId) {
        selectOption(optionId);
        playSound('click');
      }

      const answeredIndex = currentQuestionIndex;
      const gameId = useQuizStore.getState().gameId;
      setIsCheckingAnswer(true);
      const attempt =
        useQuizStore.getState().attemptToken ?? (await attemptPromiseRef.current) ?? null;
      // Se pide el veredicto aunque no haya attempt: si el servidor no tiene
      // secreto configurado responde en modo degradado y el feedback sigue.
      const revealed = await requestAnswerVerdict({
        quizId: quiz.id,
        questionId: question.id,
        selectedOptionId: chosenOptionId,
        attempt: attempt ?? undefined,
      });
      const current = useQuizStore.getState();
      if (current.gameId !== gameId) return;
      setIsCheckingAnswer(false);
      if (current.isCompleted || current.currentQuestionIndex !== answeredIndex) return;

      setVerdict({
        questionIndex: answeredIndex,
        correctOptionId: revealed?.correctOptionId ?? null,
        explanation: revealed?.explanation ?? null,
      });
      submitAnswer(
        revealed ? { isCorrect: revealed.isCorrect } : undefined,
        revealed && (gameMode === 'practice' || reduceMotion) ? { autoAdvanceMs: null } : undefined
      );
    },
    [
      currentQuestionIndex,
      gameMode,
      getCurrentQuestion,
      isCheckingAnswer,
      quiz.id,
      reduceMotion,
      selectOption,
      selectedOptionId,
      showFeedback,
      submitAnswer,
    ]
  );

  // Cuando cambia el quiz, la partida anterior se descarta durante el propio
  // render (patrón "adjust state during render"): los estados locales vuelven a
  // sus valores iniciales y el store se reinicia en el efecto de abajo.
  const [prevQuizId, setPrevQuizId] = React.useState(quiz.id);
  if (prevQuizId !== quiz.id) {
    setPrevQuizId(quiz.id);
    setSubmission(null);
    setIsSubmittingResult(false);
    setIsCheckingAnswer(false);
    setSubmitFailed(false);
    setShowModeSelector(false);
  }

  React.useEffect(() => {
    hasSubmittedRef.current = false;
    elapsedSecondsRef.current = null;
    startGame(quiz, initialMode ?? 'normal');
    void beginAttempt(quiz.id);
  }, [quiz, startGame, initialMode, beginAttempt]);

  React.useEffect(() => {
    // Solo cuando la partida ya arrancó con este quiz: el primer render puede
    // traer el modo de una partida anterior y duplicaría el evento.
    if (showModeSelector || !isGameStarted) return;

    void trackEvent({
      name: 'quiz_start',
      locale: uiLocale,
      quizId: quiz.id,
      quizSlug: quiz.slug,
      quizType: quiz.quiz_type,
    });
  }, [gameMode, isGameStarted, quiz.id, quiz.quiz_type, quiz.slug, showModeSelector, uiLocale]);

  React.useEffect(() => {
    if (showModeSelector || isCompleted || isPaused || showFeedback || gameMode !== 'timed') return;
    const timer = setInterval(() => {
      const remaining = useQuizStore.getState().timeRemaining;
      useQuizStore.setState((state) => {
        if (state.timeRemaining <= 1) {
          return { timeRemaining: 0, isCompleted: true };
        }
        return { timeRemaining: state.timeRemaining - 1, totalTimeUsed: state.totalTimeUsed + 1 };
      });
      // Hitos, no cada segundo: el reloj visible no vive en una región viva.
      if (remaining === 31) {
        setLiveMessage(uiLocale === 'es' ? 'Quedan 30 segundos' : '30 seconds left');
      } else if (remaining === 11) {
        setLiveMessage(uiLocale === 'es' ? 'Quedan 10 segundos' : '10 seconds left');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [gameMode, isCompleted, isPaused, showFeedback, showModeSelector, uiLocale]);

  React.useEffect(() => {
    if (!showFeedback || lastAnswerCorrect === null || quiz.quiz_type !== 'trivia') return;
    playSound(lastAnswerCorrect ? 'correct' : 'incorrect');
    if (navigator.vibrate) navigator.vibrate(lastAnswerCorrect ? 50 : 100);
  }, [lastAnswerCorrect, showFeedback, quiz.quiz_type]);

  /**
   * Sends the finished game to the server. `hasSubmittedRef` is the
   * double-submit guard: it stays set after a success, and only a failure
   * releases it so the "Retry" button can call this again without duplicating
   * the session (a second call while one is in flight is a no-op).
   */
  const persistSession = React.useCallback(async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setIsSubmittingResult(true);
    // Stale guard: if a new game started while the submit was in flight, its
    // result must not overwrite the new game's state.
    const gameId = useQuizStore.getState().gameId;
    const isStale = () => useQuizStore.getState().gameId !== gameId;

    const notifySubmitFailed = () => {
      hasSubmittedRef.current = false;
      setSubmitFailed(true);
      const failed = SUBMIT_FAILED_COPY[uiLocale];
      toastError(failed.title, failed.body);
    };

    try {
      // Tiempo real de la partida en todos los modos: inicio → envío. Antes
      // solo Contrarreloj medía (el resto guardaba 0). Se congela la primera
      // vez para que un reintento no cuente el rato en la pantalla de resultado.
      if (elapsedSecondsRef.current === null) {
        const startedAt = useQuizStore.getState().startedAt;
        // Con tope: una pestaña olvidada horas no debe volver inválido el envío
        // (el esquema rechaza más de 2 h y el reintento arrastraría el valor).
        elapsedSecondsRef.current = startedAt
          ? Math.min(MAX_GAME_SECONDS, Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
          : 0;
      }
      const totalTimeSeconds = elapsedSecondsRef.current;
      // Only the choices travel: the server re-grades every answer.
      const payload = answers.map(({ question_id, selected_option_id, time_ms }) => ({
        question_id,
        selected_option_id,
        time_ms,
      }));
      // A esta altura la partida ya respondió al menos una pregunta (o terminó
      // por tiempo): si el attempt iba a llegar, ya está en el store. No se
      // espera la promesa para que un cuelgue de red no bloquee el resultado.
      const attemptToken = useQuizStore.getState().attemptToken;
      const result = attemptToken
        ? await submitQuizResult(quiz.id, payload, totalTimeSeconds, attemptToken)
        : await submitQuizResult(quiz.id, payload, totalTimeSeconds);
      if (isStale()) return;
      if (!result.success) {
        notifySubmitFailed();
        return;
      }
      setSubmission({
        result: (result.result as PersonalityResult | null) ?? null,
        pointsEarned: result.points_earned ?? 0,
        shareToken:
          (result.session as { share_token?: string | null } | undefined)?.share_token ?? null,
        score: result.score ?? 0,
        maxScore: result.max_score ?? quiz.questions.length,
        review: result.review ?? null,
      });
      setSubmitFailed(false);
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
    } catch (error) {
      console.error('Failed to submit quiz result', error);
      if (!isStale()) notifySubmitFailed();
    } finally {
      if (!isStale()) setIsSubmittingResult(false);
    }
  }, [
    answers,
    quiz.category,
    quiz.cover_image_url,
    quiz.estimated_minutes,
    quiz.id,
    quiz.questions.length,
    quiz.quiz_type,
    quiz.slug,
    quiz.title,
    toastError,
    toastSuccess,
    uiLocale,
  ]);

  React.useEffect(() => {
    if (!isCompleted) return;
    // El envío corre en un timer: persistSession hace setState y la regla
    // react-hooks/set-state-in-effect prohíbe setState síncrono en el efecto.
    const timer = setTimeout(() => void persistSession(), 0);
    return () => clearTimeout(timer);
  }, [isCompleted, persistSession]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showModeSelector || isCompleted || isPaused) return;
      if (event.key === 'Escape') {
        togglePause();
        return;
      }
      const currentQuestion = getCurrentQuestion();
      if (!currentQuestion) return;

      // Pulsar 1-4 responde igual que tocar la opción.
      if (!showFeedback && event.key >= '1' && event.key <= '4') {
        const index = Number(event.key) - 1;
        if (
          !isCheckingAnswer &&
          index < currentQuestion.options.length &&
          !hiddenOptionIds.includes(currentQuestion.options[index].id)
        ) {
          void submitCurrentAnswer(currentQuestion.options[index].id);
        }
      }

      // Enter avanza tras el feedback; sobre un control manda el control.
      if (
        event.key === 'Enter' &&
        !(event.target instanceof HTMLElement && event.target.closest('button, a'))
      ) {
        const answered = useQuizStore
          .getState()
          .answers.some((answer) => answer.question_id === currentQuestion.id);
        if (answered) {
          useQuizStore.getState().nextQuestion();
        } else {
          void submitCurrentAnswer();
        }
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
  const canChangeMode = availableGameModes(quiz).length > 1;
  const hasAnsweredCurrent = currentQuestion
    ? answers.some((answer) => answer.question_id === currentQuestion.id)
    : false;

  /**
   * A11Y-03: la pausa es un diálogo modal. Al abrir, el foco va al título; Tab
   * queda atrapado en el panel y Escape reanuda. Al volver, el foco regresa al
   * botón de pausa.
   */
  React.useEffect(() => {
    if (!isPaused) return;
    pauseTitleRef.current?.focus();
  }, [isPaused]);

  React.useEffect(() => {
    if (isPaused) {
      wasPausedRef.current = true;
      return;
    }
    if (!wasPausedRef.current) return;
    wasPausedRef.current = false;
    pauseButtonRef.current?.focus();
  }, [isPaused]);

  React.useEffect(() => {
    if (!isPaused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        togglePause();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = pausePanelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !panel.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isPaused, togglePause]);

  /** A11Y-08: tras usar una ayuda el foco sigue en algo útil, no en <body>. */
  const focusFirstAvailableOption = React.useCallback(() => {
    cardWrapRef.current?.querySelector<HTMLButtonElement>('.arcade-option:not(:disabled)')?.focus();
  }, []);

  const handleStartGame = (mode: GameMode) => {
    startGame(quiz, mode);
    void beginAttempt(quiz.id);
    setSubmission(null);
    setIsSubmittingResult(false);
    setIsCheckingAnswer(false);
    setVerdict(null);
    hasSubmittedRef.current = false;
    setShowModeSelector(false);
    setHiddenOptions({ questionIndex: -1, ids: [] });
    elapsedSecondsRef.current = null;
    playSound('click');
  };

  if (showModeSelector) {
    return <GameModeSelector quiz={quiz} locale={uiLocale} onSelectMode={handleStartGame} />;
  }

  if (!isGameStarted) {
    return (
      <div className="arcade-play-page arcade-wrap">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center px-4 py-16">
          <div>
            <p className="arcade-play-label">{copy.nowPlaying}</p>
            <h1 className="arcade-play-title">{quiz.title}</h1>
          </div>
        </div>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="arcade-play-page arcade-wrap">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-pause-title"
            aria-describedby="quiz-pause-body"
            {...entrance(reduceMotion, {
              initial: { scale: 0.96, opacity: 0 },
              animate: { scale: 1, opacity: 1 },
            })}
            className="arcade-pause w-full max-w-xl p-10 text-center"
          >
            <div ref={pausePanelRef}>
              <div className="border-border-subtle bg-bg-primary text-text-primary mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border text-3xl font-black">
                II
              </div>
              <p className="arcade-play-label">{copy.pause}</p>
              <h1
                id="quiz-pause-title"
                ref={pauseTitleRef}
                tabIndex={-1}
                className="text-text-primary mt-3 text-4xl font-semibold tracking-tight"
              >
                {copy.pauseTitle}
              </h1>
              <p id="quiz-pause-body" className="text-text-secondary mt-4 text-base leading-7">
                {copy.pauseBody}
              </p>
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
                {canChangeMode && (
                  <button
                    onClick={() => {
                      setShowModeSelector(true);
                      togglePause();
                    }}
                    className="arcade-pause-secondary"
                  >
                    {copy.changeMode}
                  </button>
                )}
              </div>
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
        // La revisión la calcula el servidor al persistir (igual que /result):
        // nunca se reconstruye con el is_correct local, que puede quedar
        // desactualizado si un reveal falló durante la partida.
        review={submission?.review ?? undefined}
        streak={maxStreak}
        bonusPoints={bonusPoints + (submission?.pointsEarned ?? 0)}
        submitFailed={submitFailed}
        isSubmittingResult={isSubmittingResult}
        onRetrySubmit={persistSession}
        // La comparativa solo se declara con la sesión ya persistida: un reveal
        // fallido deja el marcador local sin verificar y podría dibujar un
        // veredicto distinto al que quedó en el servidor (y en la tarjeta OG).
        challenge={submission ? challenge : null}
        // Misma regla que el marcador: la compatibilidad solo se declara con
        // la partida ya persistida en el servidor.
        compatibility={submission ? compatibility : null}
        related={related}
        shareUrl={
          submission?.shareToken && typeof window !== 'undefined'
            ? `${window.location.origin}/${uiLocale}/quiz/${quiz.slug}/result?s=${submission.shareToken}${challenge ? `&challenge=${challenge.token}` : ''}`
            : undefined
        }
        shareToken={submission?.shareToken ?? undefined}
        // Invitación propia (`s` y `challenge` apuntan a esta sesión): la
        // tarjeta de compatibilidad la ofrece como «Compara con otro amigo».
        challengeShareUrl={
          submission?.shareToken && typeof window !== 'undefined'
            ? `${window.location.origin}/${uiLocale}/quiz/${quiz.slug}/result?s=${submission.shareToken}&challenge=${submission.shareToken}`
            : undefined
        }
        onPlayAgain={() => {
          resetGame();
          setSubmission(null);
          setSubmitFailed(false);
          hasSubmittedRef.current = false;
          setShowModeSelector(true);
        }}
      />
    );
  }

  if (!currentQuestion) {
    // /play no lleva nav ni footer: sin enlaces este estado era un callejón.
    return (
      <div className="arcade-play-page arcade-wrap">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center px-4 py-16">
          <div className="w-full">
            <EditorialEmptyState
              eyebrow={copy.quizNotFoundEyebrow}
              title={copy.quizNotFound}
              body={copy.quizNotFoundBody}
              primaryHref={localizeHref(uiLocale, '/quiz')}
              primaryLabel={copy.browseQuizzes}
              secondaryHref={localizeHref(uiLocale, `/quiz/${quiz.slug}`)}
              secondaryLabel={copy.backToQuiz}
            />
          </div>
        </div>
      </div>
    );
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
              <div className="flex items-center gap-2">
                {canChangeMode && (
                  <button
                    onClick={() => {
                      setShowModeSelector(true);
                      playSound('click');
                    }}
                    className="text-text-secondary hover:text-text-primary inline-flex min-h-11 items-center text-xs font-semibold"
                  >
                    {copy.changeMode}
                  </button>
                )}
                <button
                  ref={pauseButtonRef}
                  onClick={() => {
                    togglePause();
                    playSound('click');
                  }}
                  className="bg-bg-secondary hover:bg-bg-tertiary inline-flex h-11 w-11 items-center justify-center rounded-lg p-2 transition-colors"
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
          </div>
          {!showFeedback && !isCheckingAnswer && (
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
                    const gameId = useQuizStore.getState().gameId;
                    const attempt =
                      useQuizStore.getState().attemptToken ??
                      (await attemptPromiseRef.current) ??
                      null;
                    const eliminated = await requestEliminatedOptions({
                      quizId: quiz.id,
                      questionId: currentQuestion.id,
                      attempt: attempt ?? undefined,
                    });
                    // Without an answer from the server the power-up is not spent.
                    if (!eliminated) return;
                    const current = useQuizStore.getState();
                    if (
                      current.gameId !== gameId ||
                      current.isCompleted ||
                      current.currentQuestionIndex !== currentQuestionIndex ||
                      current.answers.some((answer) => answer.question_id === currentQuestion.id)
                    )
                      return;
                    setHiddenOptions({ questionIndex: currentQuestionIndex, ids: eliminated });
                    if (current.selectedOptionId && eliminated.includes(current.selectedOptionId)) {
                      useQuizStore.setState({ selectedOptionId: null });
                    }
                    activatePowerUp(id);
                    playSound('powerup');
                    // El botón usado desaparece: el foco pasa a la primera
                    // opción que sigue disponible y el efecto se anuncia.
                    setLiveMessage(
                      eliminated.length === 1 ? copy.answerRemoved : copy.answersRemoved
                    );
                    setTimeout(focusFirstAvailableOption, 0);
                  })();
                  return;
                }
                activatePowerUp(id);
                playSound('powerup');
                if (id === 'extra-time') {
                  setLiveMessage(copy.secondsAdded);
                  focusFirstAvailableOption();
                }
              }}
            />
          )}
        </motion.div>

        <div className="arcade-play-body flex-1 px-4 py-8 md:py-10">
          {/* Marcador/racha: región aparte para no repetir el veredicto */}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {scoreAnnouncement}
          </p>
          {/* Avisos puntuales (ayudas, hitos del reloj): no tocan el marcador. */}
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {liveMessage}
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
                ref={cardWrapRef}
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
                    // Un toque responde: la selección y el veredicto van juntos.
                    void submitCurrentAnswer(optionId);
                  }}
                  showExplanation={gameMode === 'practice'}
                  disabled={showFeedback || isCheckingAnswer}
                  showFeedback={showFeedback}
                  correctOptionId={
                    verdict?.questionIndex === currentQuestionIndex ? verdict.correctOptionId : null
                  }
                  explanation={
                    verdict?.questionIndex === currentQuestionIndex ? verdict.explanation : null
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
              disabled={showFeedback || isCheckingAnswer}
              className="arcade-play-skip"
            >
              {copy.skip}
            </button>
            <button
              onClick={() => {
                playSound('click');
                if (hasAnsweredCurrent) {
                  // Tras el feedback «Siguiente» avanza sin esperar el auto-avance.
                  useQuizStore.getState().nextQuestion();
                  return;
                }
                void submitCurrentAnswer();
              }}
              disabled={isCheckingAnswer || (!hasAnsweredCurrent && !selectedOptionId)}
              className={cn(
                'arcade-play-submit',
                hasAnsweredCurrent || (selectedOptionId && !isCheckingAnswer)
                  ? 'arcade-play-submit-ready'
                  : 'cursor-not-allowed opacity-50'
              )}
            >
              {isCheckingAnswer ? '...' : isLastQuestion ? copy.finish : copy.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuizPlayer;
