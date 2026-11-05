'use client';

import * as React from 'react';
import { startQuizAttempt } from '@/actions/quiz.actions';
import { submitDailyResult } from '@/actions/daily.actions';
import { recordRecent } from '@/lib/history/recent-quizzes';
import { localizeCategory } from '@/lib/i18n/catalog';
import { requestAnswerVerdict } from '@/lib/quiz/reveal-client';
import { FEEDBACK_AUTO_ADVANCE_MS, NO_VERDICT_AUTO_ADVANCE_MS } from '@/stores/quiz-store';
import { trackEvent } from '@/lib/telemetry/client';
import { dayKey as editorialDayKey } from '@/lib/content/daily-pick';
import {
  currentDailyStreak,
  readDailyResult,
  recordDailyResult,
  type DailyRecord,
} from '@/lib/quiz/daily';
import { QuestionCard } from '@/components/quiz/question-card';
import { DailyResult } from '@/components/daily/daily-result';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

interface DailyPlayerProps {
  /** El quiz del día ya saneado por `toClientQuiz`, solo con sus 5 preguntas. */
  quiz: Quiz;
  locale: Locale;
  challengeNumber: number;
  /** Día editorial (America/Santiago) de este reto; fija el «ya jugaste hoy». */
  dayKey: string;
}

interface DailyChallengeState {
  quiz: Quiz;
  challengeNumber: number;
  dayKey: string;
}

const COPY = {
  es: {
    eyebrow: 'El quiz diario de QuizVerse',
    challenge: 'Reto',
    introBody: 'Cinco preguntas, el mismo reto para todo el mundo hoy.',
    shareHint: 'Al terminar comparte tu resultado en emojis, sin spoilers.',
    play: 'Jugar el reto de hoy',
    streak: 'racha',
    correct: 'Correcto',
    miss: 'Fallaste',
    failedTitle: 'No pudimos calificar el reto.',
    failedBody: 'El servidor no respondió. Tu partida sigue aquí: reintenta para no perderla.',
    retry: 'Reintentar',
  },
  en: {
    eyebrow: 'The QuizVerse daily quiz',
    challenge: 'Challenge',
    introBody: 'Five questions, the same challenge for everyone today.',
    shareHint: 'When you finish, share your result as emojis — no spoilers.',
    play: 'Play today’s challenge',
    streak: 'streak',
    correct: 'Correct',
    miss: 'Miss',
    failedTitle: 'We could not grade the challenge.',
    failedBody: 'The server did not answer. Your game is still here: retry to keep it.',
    retry: 'Retry',
  },
} as const;

interface GivenAnswer {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean | null;
}

function isFreshChallenge(value: unknown): value is DailyChallengeState {
  if (!value || typeof value !== 'object') return false;
  const challenge = value as DailyChallengeState;
  return (
    typeof challenge.dayKey === 'string' &&
    typeof challenge.challengeNumber === 'number' &&
    Boolean(challenge.quiz) &&
    Array.isArray(challenge.quiz.questions) &&
    challenge.quiz.questions.length > 0
  );
}

/**
 * El reto diario en el cliente: la página manda el quiz saneado, los
 * veredictos salen de `/api/quiz/reveal` y el marcador final lo recalcula
 * `submitDailyResult`. Racha y «ya jugaste hoy» viven en localStorage, así
 * que el HTML de la página sigue siendo cacheable e igual para todos.
 */
export function DailyPlayer({ quiz, locale, challengeNumber, dayKey }: DailyPlayerProps) {
  const copy = COPY[locale];
  const [challenge, setChallenge] = React.useState<DailyChallengeState>({
    quiz,
    challengeNumber,
    dayKey,
  });
  const [phase, setPhase] = React.useState<'intro' | 'playing' | 'done' | 'failed'>('intro');
  const [record, setRecord] = React.useState<DailyRecord | null>(null);
  const [introStreak, setIntroStreak] = React.useState(0);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
  const [verdict, setVerdict] = React.useState<{ correctOptionId: string | null } | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);

  const answersRef = React.useRef<GivenAnswer[]>([]);
  const attemptPromiseRef = React.useRef<Promise<string | null> | null>(null);
  const attemptTokenRef = React.useRef<string | null>(null);
  const startedAtRef = React.useRef(0);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = React.useRef(false);

  // «Ya jugaste hoy» y la racha son por dispositivo e idioma: se leen tras
  // montar, sin desajuste de hidratación (el SSR siempre pinta la intro).
  // Además la página ISR puede quedar con el reto de ayer unos minutos tras
  // la medianoche de Chile: si el dayKey no es el de hoy se pide el vigente.
  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      let effective: DailyChallengeState = { quiz, challengeNumber, dayKey };
      if (editorialDayKey(new Date()) !== dayKey) {
        try {
          const response = await fetch(`/api/daily/today?locale=${locale}`, {
            cache: 'no-store',
          });
          const fresh: unknown = response.ok ? await response.json() : null;
          if (isFreshChallenge(fresh)) effective = fresh;
        } catch {
          // Sin endpoint la página vieja sigue funcionando para su día.
        }
      }
      if (cancelled) return;
      setChallenge(effective);
      const stored = readDailyResult(locale);
      if (stored?.dayKey === effective.dayKey) {
        setRecord(stored);
        setPhase('done');
      } else {
        setIntroStreak(currentDailyStreak(stored, effective.dayKey));
      }
    });
    return () => {
      cancelled = true;
    };
    // Solo al montar: el reto de las props no cambia durante la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, locale]);

  React.useEffect(
    () => () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    []
  );

  const beginAttempt = React.useCallback(() => {
    attemptPromiseRef.current = startQuizAttempt(challenge.quiz.id)
      .then((result) => {
        const token = result.success ? result.attempt : null;
        attemptTokenRef.current = token;
        return token;
      })
      .catch(() => null);
  }, [challenge.quiz.id]);

  const handlePlay = () => {
    answersRef.current = [];
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    beginAttempt();
    setQuestionIndex(0);
    setSelectedOptionId(null);
    setVerdict(null);
    setPhase('playing');
    void trackEvent({
      name: 'quiz_start',
      locale,
      quizId: challenge.quiz.id,
      quizSlug: challenge.quiz.slug,
      quizType: challenge.quiz.quiz_type,
    });
  };

  const finish = React.useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const seconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    const total = challenge.quiz.questions.length;
    const answers = answersRef.current;

    // El marcador lo recalcula el servidor contra la clave y el conjunto del
    // reto; si el envío falla se degradan los veredictos que sí llegaron.
    // Si el attempt aún estaba en vuelo se espera aquí: terminar rápido no
    // debe costar el envío autoritativo por un token que ya venía llegando.
    const attempt = attemptTokenRef.current ?? (await attemptPromiseRef.current);
    const submitted = await submitDailyResult({
      quizId: challenge.quiz.id,
      locale,
      dayKey: challenge.dayKey,
      answers: answers.map((answer) => ({
        question_id: answer.questionId,
        selected_option_id: answer.selectedOptionId,
      })),
      attempt: attempt ?? undefined,
    }).catch(() => null);

    // Sin calificación del servidor ni todos los veredictos no hay marcador
    // honesto que guardar (p. ej. el quiz del reto se retiró o la red cayó):
    // no se persiste nada y el jugador reintenta en vez de cargar un 0 falso.
    const verdictsComplete = answers.every((answer) => answer.isCorrect !== null);
    if (submitted?.success !== true && !verdictsComplete) {
      finishedRef.current = false;
      setPhase('failed');
      return;
    }

    const marks =
      submitted?.success === true
        ? submitted.marks
        : challenge.quiz.questions.map(
            (question) =>
              answers.find((answer) => answer.questionId === question.id)?.isCorrect === true
          );
    const score = submitted?.success === true ? submitted.score : marks.filter(Boolean).length;

    const stored = recordDailyResult(locale, {
      dayKey: challenge.dayKey,
      score,
      total,
      marks,
      seconds,
    });
    setRecord(stored);
    setPhase('done');

    recordRecent({
      slug: challenge.quiz.slug,
      title: challenge.quiz.title,
      quizType: 'trivia',
      locale,
      categoryName: challenge.quiz.category
        ? (localizeCategory(challenge.quiz.category, locale)?.name ?? challenge.quiz.category.name)
        : null,
      coverImageUrl: challenge.quiz.cover_image_url,
      minutes: challenge.quiz.estimated_minutes,
      score: `${score}/${total}`,
      playedAt: new Date().toISOString(),
    });
    void trackEvent({
      name: 'quiz_complete',
      locale,
      quizId: challenge.quiz.id,
      quizSlug: challenge.quiz.slug,
      quizType: challenge.quiz.quiz_type,
      value: score,
      metadata: { answers: answers.length },
    });
  }, [challenge, locale]);

  const handleSelect = async (optionId: string) => {
    if (isChecking || verdict || selectedOptionId) return;
    const question = challenge.quiz.questions[questionIndex];
    if (!question) return;

    setSelectedOptionId(optionId);
    setIsChecking(true);
    const attempt = attemptTokenRef.current ?? (await attemptPromiseRef.current);
    const revealed = await requestAnswerVerdict({
      quizId: challenge.quiz.id,
      questionId: question.id,
      selectedOptionId: optionId,
      attempt: attempt ?? undefined,
    });
    setIsChecking(false);

    answersRef.current.push({
      questionId: question.id,
      selectedOptionId: optionId,
      isCorrect: revealed?.isCorrect ?? null,
    });
    if (revealed) setVerdict({ correctOptionId: revealed.correctOptionId });

    const isLast = questionIndex + 1 >= challenge.quiz.questions.length;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(
      () => {
        if (isLast) {
          void finish();
          return;
        }
        setSelectedOptionId(null);
        setVerdict(null);
        setQuestionIndex((index) => index + 1);
      },
      revealed ? FEEDBACK_AUTO_ADVANCE_MS : NO_VERDICT_AUTO_ADVANCE_MS
    );
  };

  if (phase === 'done' && record) {
    return (
      <DailyResult
        locale={locale}
        challengeNumber={challenge.challengeNumber}
        quizTitle={challenge.quiz.title}
        score={record.score}
        total={record.total}
        marks={record.marks}
        seconds={record.seconds}
        streak={record.streak}
      />
    );
  }

  if (phase === 'failed') {
    return (
      <section className="arcade-hero">
        <div className="arcade-hero-copy">
          <span className="arcade-live">
            {copy.challenge} #{challenge.challengeNumber}
          </span>
          <h1>{copy.failedTitle}</h1>
          <p>{copy.failedBody}</p>
          <div className="arcade-daily-intro-actions">
            <button
              type="button"
              className="arcade-button arcade-button-pink"
              onClick={() => void finish()}
            >
              {copy.retry} ↗
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'playing') {
    const question = challenge.quiz.questions[questionIndex];
    return (
      <section aria-label={`${copy.challenge} #${challenge.challengeNumber}`}>
        {question ? (
          <QuestionCard
            question={question}
            questionNumber={questionIndex + 1}
            totalQuestions={challenge.quiz.questions.length}
            selectedOptionId={selectedOptionId}
            onSelectOption={(optionId) => void handleSelect(optionId)}
            showFeedback={verdict !== null}
            correctOptionId={verdict?.correctOptionId}
            disabled={isChecking || verdict !== null}
            locale={locale}
            verdictText={
              verdict
                ? selectedOptionId === verdict.correctOptionId
                  ? copy.correct
                  : copy.miss
                : null
            }
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="arcade-hero">
      <div className="arcade-hero-copy">
        <span className="arcade-live">
          {copy.eyebrow} · {copy.challenge} #{challenge.challengeNumber}
        </span>
        <h1>{challenge.quiz.title}</h1>
        <p>
          {copy.introBody} {copy.shareHint}
        </p>
        <div className="arcade-daily-intro-actions">
          <button type="button" className="arcade-button arcade-button-pink" onClick={handlePlay}>
            {copy.play} ↗
          </button>
          {introStreak > 0 && (
            <span className="arcade-tag" aria-label={`${copy.streak} ${introStreak}`}>
              🔥 {copy.streak} {introStreak}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
