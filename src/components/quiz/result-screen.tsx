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
    <div className="relative min-h-screen overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(181,94,44,0.12),transparent_42%),linear-gradient(180deg,rgba(246,239,229,0.8),rgba(236,228,216,0.92))]" />
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(24,20,16,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(24,20,16,0.05)_1px,transparent_1px)] [background-size:48px_48px] opacity-40" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="surface-panel p-8 md:p-10">
            <p className="eyebrow">{copy.eyebrow}</p>
            <motion.h1
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-text-primary mt-5 text-4xl font-semibold tracking-tight md:text-6xl"
            >
              {result?.title || scoreMessage}
            </motion.h1>
            <p className="text-text-secondary mt-5 max-w-2xl text-lg leading-8">
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
              <div className="border-border-subtle bg-bg-primary mt-8 rounded-[2rem] border p-6">
                <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
                  {copy.scoreline}
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <p className="text-text-primary text-6xl font-semibold">
                    {triviaScore.percentage}%
                  </p>
                  <p className="text-text-muted pb-2 text-sm tracking-[0.18em] uppercase">
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
                className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
              >
                {uiLocale === 'es' ? 'Jugar de nuevo' : 'Play again'}
              </button>
              <Link
                href={localizeHref(uiLocale, '/quiz')}
                className="text-text-secondary hover:text-text-primary inline-flex items-center justify-center rounded-full border border-transparent px-6 py-3 text-sm font-semibold transition-colors"
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
              <p className="kicker">{copy.sessionSnapshot}</p>
              <h2 className="font-display text-text-primary mt-3 text-3xl">{quiz.title}</h2>
              <p className="text-text-secondary mt-3 text-sm leading-6">
                {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} · {quiz.estimated_minutes} min ·{' '}
                {getLocalizedLanguageLabel(quiz.language, uiLocale)}
              </p>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="kicker">{copy.review}</p>
                  <h3 className="font-display text-text-primary mt-2 text-2xl">
                    {copy.answerTrail}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onReview || (() => {})}
                  className="border-border-subtle text-text-primary rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase"
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
                            'rounded-[1.5rem] border p-4',
                            answer.is_correct
                              ? 'border-success/30 bg-success/10'
                              : 'border-border-subtle bg-bg-primary'
                          )}
                        >
                          <p className="text-text-muted text-[11px] font-semibold tracking-[0.18em] uppercase">
                            {copy.question} {index + 1}
                          </p>
                          <p className="text-text-primary mt-2 text-sm font-medium">
                            {question?.question}
                          </p>
                          <p className="text-text-secondary mt-3 text-sm">
                            {copy.yourAnswer}: {selectedOption?.text || copy.skipped}
                          </p>
                          {!answer.is_correct && correctOption && (
                            <p className="text-success mt-2 text-sm">
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
              className="surface-card w-full max-w-md p-6"
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
    <div className="border-border-subtle bg-bg-primary rounded-[1.5rem] border p-5">
      <p className="text-text-muted text-[11px] font-semibold tracking-[0.18em] uppercase">
        {label}
      </p>
      <p className="text-text-primary mt-2 text-3xl font-semibold">{value}</p>
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
