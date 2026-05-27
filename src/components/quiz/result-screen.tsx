'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils/cn';
import { ShareButtons } from '@/components/shared/share-buttons';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getLocalizedLanguageLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Answer, PersonalityResult, Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

interface ResultScreenProps {
  locale?: Locale;
  quiz: Quiz;
  result: PersonalityResult | null;
  triviaScore?: { correct: number; total: number; percentage: number };
  answers: Answer[];
  streak?: number;
  bonusPoints?: number;
  shareUrl?: string;
  onPlayAgain?: () => void;
  onReview?: () => void;
  showReview?: boolean;
}

export function ResultScreen({
  locale,
  quiz,
  result,
  triviaScore,
  answers,
  streak = 0,
  bonusPoints = 0,
  shareUrl,
  onPlayAgain,
  onReview,
  showReview = false,
}: ResultScreenProps) {
  const uiLocale: Locale = locale === 'es' ? 'es' : 'en';
  const [showShare, setShowShare] = React.useState(false);
  const copy =
    uiLocale === 'es'
      ? {
          eyebrow: 'Resultado',
          fallbackBody:
            'Completaste toda la partida. Ahora el resultado está presentado como algo que vale la pena compartir, repetir y guardar.',
          questions: 'Preguntas',
          bestStreak: 'Mejor racha',
          bonus: 'Bonus',
          scoreline: 'Marcador',
          correct: 'correctas',
          sessionSnapshot: 'Resumen de sesión',
          review: 'Revisión',
          answerTrail: 'Rastro de respuestas',
          hideReview: 'Ocultar revisión',
          showReview: 'Ver revisión',
          question: 'Pregunta',
          yourAnswer: 'Tu respuesta',
          skipped: 'Omitida',
          close: 'Cerrar',
          shareTitle: 'Compartir resultado',
          shareText: 'Mira mi resultado en QuizVerse.',
        }
      : {
          eyebrow: 'Result',
          fallbackBody:
            'You finished the full run. Now the result is framed as something worth sharing, replaying and keeping.',
          questions: 'Questions',
          bestStreak: 'Best streak',
          bonus: 'Bonus',
          scoreline: 'Scoreline',
          correct: 'correct',
          sessionSnapshot: 'Session snapshot',
          review: 'Review',
          answerTrail: 'Answer trail',
          hideReview: 'Hide review',
          showReview: 'Show review',
          question: 'Question',
          yourAnswer: 'Your answer',
          skipped: 'Skipped',
          close: 'Close',
          shareTitle: 'Share result',
          shareText: 'Check out my result on QuizVerse.',
        };
  const scoreMessage = getScoreMessage(triviaScore?.percentage, uiLocale);

  React.useEffect(() => {
    if (!triviaScore || triviaScore.percentage < 60) return;
    const duration = 3000;
    const end = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 999 };

    const interval = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      void confetti({
        ...defaults,
        particleCount,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
      });
    }, 250);

    return () => clearInterval(interval);
  }, [triviaScore?.percentage]);

  return (
    <div className="relative min-h-screen px-4 py-12">

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="surface-panel p-6 md:p-10">
            <span className="eyebrow">{copy.eyebrow}</span>
            <motion.h1
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="font-display text-text-primary mt-5 text-3xl font-bold tracking-tight md:text-5xl"
            >
              {result?.title || scoreMessage}
            </motion.h1>
            <p className="text-text-secondary mt-5 max-w-2xl text-lg leading-relaxed">
              {result?.description || copy.fallbackBody}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <ResultMetric
                label={copy.questions}
                value={String(triviaScore?.total ?? answers.length)}
              />
              <ResultMetric label={copy.bestStreak} value={String(streak)} />
              <ResultMetric label={copy.bonus} value={`+${bonusPoints}`} />
            </div>

            {triviaScore && (
              <div className="bg-bg-tertiary mt-8 rounded-2xl p-6">
                <span className="eyebrow">{copy.scoreline}</span>
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <p className="font-display text-accent-primary text-5xl font-bold md:text-7xl">
                    {triviaScore.percentage}%
                  </p>
                  <p className="text-text-muted pb-2 text-sm tracking-wider uppercase">
                    {triviaScore.correct}/{triviaScore.total} {copy.correct}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
              >
                {uiLocale === 'es' ? 'Compartir resultado' : 'Share result'}
              </button>
              <button
                type="button"
                onClick={onPlayAgain || (() => window.location.reload())}
                className="border-border-subtle text-text-primary hover:border-border-hover inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
              >
                {uiLocale === 'es' ? 'Jugar de nuevo' : 'Play again'}
              </button>
              <Link
                href={localizeHref(uiLocale, '/quiz')}
                className="text-text-secondary hover:text-text-primary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
              >
                {uiLocale === 'es' ? 'Explorar más' : 'Explore more'}
              </Link>
            </div>
          </section>

          <section className="space-y-6">
            <div className="surface-card p-4">
              <QuizCoverArt quiz={quiz} locale={uiLocale} compact ratioClassName="aspect-[16/9]" />
            </div>

            <div className="surface-card p-6">
              <span className="eyebrow">{copy.sessionSnapshot}</span>
              <h2 className="font-display text-text-primary mt-3 text-2xl font-bold md:text-3xl">{quiz.title}</h2>
              <p className="text-text-secondary mt-3 text-sm leading-relaxed">
                {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} · {quiz.estimated_minutes} min ·{' '}
                {getLocalizedLanguageLabel(quiz.language, uiLocale)}
              </p>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="eyebrow">{copy.review}</span>
                  <h3 className="font-display text-text-primary mt-2 text-xl font-bold md:text-2xl">
                    {copy.answerTrail}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onReview || (() => {})}
                  className="border-border-subtle text-text-primary hover:border-border-hover rounded-full border px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
                >
                  {showReview ? copy.hideReview : copy.showReview}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showReview && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    className="mt-5 space-y-3"
                  >
                    {answers.map((answer, index) => {
                      const question = quiz.questions.find(
                        (item) => item.id === answer.question_id
                      );
                      const selectedOption = question?.options.find(
                        (option) => option.id === answer.selected_option_id
                      );
                      const correctOption = question?.options.find((option) => option.is_correct);

                      return (
                        <div
                          key={answer.question_id}
                          className={cn(
                            'rounded-xl border p-4',
                            answer.is_correct
                              ? 'border-success/20 bg-success/5'
                              : 'border-border-subtle bg-bg-tertiary'
                          )}
                        >
                          <span className="eyebrow">
                            {copy.question} {index + 1}
                          </span>
                          <p className="text-text-primary mt-2 text-sm font-medium leading-relaxed">
                            {question?.question}
                          </p>
                          <p className="text-text-secondary mt-3 text-sm">
                            {copy.yourAnswer}: {selectedOption?.text || copy.skipped}
                          </p>
                          {!answer.is_correct && correctOption && (
                            <p className="text-success mt-2 text-sm font-medium">
                              {uiLocale === 'es' ? 'Correcta' : 'Correct'}: {correctOption.text}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowShare(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="surface-card w-full max-w-md p-6 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-text-primary text-2xl">{copy.shareTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="text-text-muted text-sm"
                >
                  {copy.close}
                </button>
              </div>
              <ShareButtons
                locale={uiLocale}
                title={
                  uiLocale === 'es'
                    ? `Obtuve ${result?.title || `${triviaScore?.percentage}%`} en "${quiz.title}"`
                    : `I got ${result?.title || `${triviaScore?.percentage}%`} on "${quiz.title}"`
                }
                url={shareUrl || (typeof window !== 'undefined' ? window.location.href : '')}
                text={copy.shareText}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-tertiary rounded-2xl p-5">
      <span className="eyebrow">{label}</span>
      <p className="font-display text-text-primary mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function getScoreMessage(percentage: number | undefined, locale?: Locale) {
  if (locale === 'es') {
    if (typeof percentage !== 'number') return 'Quiz completado';
    if (percentage >= 90) return 'Final impecable';
    if (percentage >= 75) return 'Resultado fuerte';
    if (percentage >= 60) return 'Buena partida';
    return 'Inténtalo otra vez';
  }

  if (typeof percentage !== 'number') return 'Quiz complete';
  if (percentage >= 90) return 'Outstanding finish';
  if (percentage >= 75) return 'Strong result';
  if (percentage >= 60) return 'Solid run';
  return 'Run it back';
}
