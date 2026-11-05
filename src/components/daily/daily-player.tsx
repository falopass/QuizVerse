'use client';

import * as React from 'react';
import { startQuizAttempt } from '@/actions/quiz.actions';
import { submitDailyResult } from '@/actions/daily.actions';
import { recordRecent } from '@/lib/history/recent-quizzes';
import { localizeCategory } from '@/lib/i18n/catalog';
import { requestAnswerVerdict } from '@/lib/quiz/reveal-client';
import { FEEDBACK_AUTO_ADVANCE_MS, NO_VERDICT_AUTO_ADVANCE_MS } from '@/stores/quiz-store';
import { trackEvent } from '@/lib/telemetry/client';
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
  },
} as const;

interface GivenAnswer {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean | null;
}

/**
 * El reto diario en el cliente: la página manda el quiz saneado, los
 * veredictos salen de `/api/quiz/reveal` y el marcador final lo recalcula
 * `submitDailyResult`. Racha y «ya jugaste hoy» viven en localStorage, así
 * que el HTML de la página sigue siendo cacheable e igual para todos.
 */
export function DailyPlayer({ quiz, locale, challengeNumber, dayKey }: DailyPlayerProps) {
  const copy = COPY[locale];
  const [phase, setPhase] = React.useState<'intro' | 'playing' | 'done'>('intro');
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

  // «Ya jugaste hoy» y la racha son por dispositivo: se leen tras montar, sin
  // desajuste de hidratación (el SSR siempre pinta la intro).
  React.useEffect(() => {
    queueMicrotask(() => {
      const stored = readDailyResult();
      if (stored?.dayKey === dayKey) {
        setRecord(stored);
        setPhase('done');
      } else {
        setIntroStreak(currentDailyStreak(stored, dayKey));
      }
    });
  }, [dayKey]);

  React.useEffect(
    () => () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    []
  );

  const beginAttempt = React.useCallback(() => {
    attemptPromiseRef.current = startQuizAttempt(quiz.id)
      .then((result) => {
        const token = result.success ? result.attempt : null;
        attemptTokenRef.current = token;
        return token;
      })
      .catch(() => null);
  }, [quiz.id]);

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
      quizId: quiz.id,
      quizSlug: quiz.slug,
      quizType: quiz.quiz_type,
    });
  };

  const finish = React.useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const seconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    const total = quiz.questions.length;
    const answers = answersRef.current;

    // El marcador lo recalcula el servidor contra la clave y el conjunto del
    // reto; si el envío falla se degradan los veredictos que sí llegaron.
    // Si el attempt aún estaba en vuelo se espera aquí: terminar rápido no
    // debe costar el envío autoritativo por un token que ya venía llegando.
    const attempt = attemptTokenRef.current ?? (await attemptPromiseRef.current);
    const submitted = await submitDailyResult({
      quizId: quiz.id,
      locale,
      dayKey,
      answers: answers.map((answer) => ({
        question_id: answer.questionId,
        selected_option_id: answer.selectedOptionId,
      })),
      attempt: attempt ?? undefined,
    }).catch(() => null);

    const marks =
      submitted?.success === true
        ? submitted.marks
        : quiz.questions.map(
            (question) =>
              answers.find((answer) => answer.questionId === question.id)?.isCorrect === true
          );
    const score = submitted?.success === true ? submitted.score : marks.filter(Boolean).length;

    const stored = recordDailyResult({ dayKey, score, total, marks, seconds });
    setRecord(stored);
    setPhase('done');

    recordRecent({
      slug: quiz.slug,
      title: quiz.title,
      quizType: 'trivia',
      locale,
      categoryName: quiz.category
        ? (localizeCategory(quiz.category, locale)?.name ?? quiz.category.name)
        : null,
      coverImageUrl: quiz.cover_image_url,
      minutes: quiz.estimated_minutes,
      score: `${score}/${total}`,
      playedAt: new Date().toISOString(),
    });
    void trackEvent({
      name: 'quiz_complete',
      locale,
      quizId: quiz.id,
      quizSlug: quiz.slug,
      quizType: quiz.quiz_type,
      value: score,
      metadata: { answers: answers.length },
    });
  }, [dayKey, locale, quiz]);

  const handleSelect = async (optionId: string) => {
    if (isChecking || verdict || selectedOptionId) return;
    const question = quiz.questions[questionIndex];
    if (!question) return;

    setSelectedOptionId(optionId);
    setIsChecking(true);
    const attempt = attemptTokenRef.current ?? (await attemptPromiseRef.current);
    const revealed = await requestAnswerVerdict({
      quizId: quiz.id,
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

    const isLast = questionIndex + 1 >= quiz.questions.length;
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
        challengeNumber={challengeNumber}
        quizTitle={quiz.title}
        score={record.score}
        total={record.total}
        marks={record.marks}
        seconds={record.seconds}
        streak={record.streak}
      />
    );
  }

  if (phase === 'playing') {
    const question = quiz.questions[questionIndex];
    return (
      <section aria-label={`${copy.challenge} #${challengeNumber}`}>
        {question ? (
          <QuestionCard
            question={question}
            questionNumber={questionIndex + 1}
            totalQuestions={quiz.questions.length}
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
          {copy.eyebrow} · {copy.challenge} #{challengeNumber}
        </span>
        <h1>{quiz.title}</h1>
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
