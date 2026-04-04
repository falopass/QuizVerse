'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { ShareButtons } from '@/components/shared/share-buttons';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getLocalizedLanguageLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Answer, PersonalityResult, Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

interface ResultScreenV2Props {
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

export function ResultScreenV2({
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
}: ResultScreenV2Props) {
  const uiLocale: Locale = locale === 'es' ? 'es' : 'en';
  const [showShare, setShowShare] = React.useState(false);
  const copy =
    uiLocale === 'es'
      ? {
          eyebrow: 'Resultado',
          fallbackBody: 'Completaste toda la partida. Ahora el resultado está presentado como algo que vale la pena compartir, repetir y guardar.',
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
          fallbackBody: 'You finished the full run. Now the result is framed as something worth sharing, replaying and keeping.',
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

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(181,94,44,0.12),transparent_42%),linear-gradient(180deg,rgba(246,239,229,0.8),rgba(236,228,216,0.92))]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(24,20,16,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(24,20,16,0.05)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="surface-panel p-8 md:p-10">
            <p className="eyebrow">{copy.eyebrow}</p>
            <motion.h1
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-5 text-4xl font-semibold tracking-tight text-text-primary md:text-6xl"
            >
              {result?.title || scoreMessage}
            </motion.h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-text-secondary">
              {result?.description ||
                copy.fallbackBody}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <ResultMetric label={copy.questions} value={String(triviaScore?.total ?? answers.length)} />
              <ResultMetric label={copy.bestStreak} value={String(streak)} />
              <ResultMetric label={copy.bonus} value={`+${bonusPoints}`} />
            </div>

            {triviaScore && (
              <div className="mt-8 rounded-[2rem] border border-border-subtle bg-bg-primary p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {copy.scoreline}
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <p className="text-6xl font-semibold text-text-primary">
                    {triviaScore.percentage}%
                  </p>
                  <p className="pb-2 text-sm uppercase tracking-[0.18em] text-text-muted">
                    {triviaScore.correct}/{triviaScore.total} {copy.correct}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="inline-flex items-center justify-center rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                {uiLocale === 'es' ? 'Compartir resultado' : 'Share result'}
              </button>
              <button
                type="button"
                onClick={onPlayAgain || (() => window.location.reload())}
                className="inline-flex items-center justify-center rounded-full border border-border-subtle bg-bg-primary px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent-primary/40"
              >
                {uiLocale === 'es' ? 'Jugar de nuevo' : 'Play again'}
              </button>
              <Link
                href={localizeHref(uiLocale, '/quiz')}
                className="inline-flex items-center justify-center rounded-full border border-transparent px-6 py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
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
              <h2 className="mt-3 font-display text-3xl text-text-primary">{quiz.title}</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} · {quiz.estimated_minutes} min ·{' '}
                {getLocalizedLanguageLabel(quiz.language, uiLocale)}
              </p>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="kicker">{copy.review}</p>
                  <h3 className="mt-2 font-display text-2xl text-text-primary">{copy.answerTrail}</h3>
                </div>
                <button
                  type="button"
                  onClick={onReview || (() => {})}
                  className="rounded-full border border-border-subtle px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-primary"
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
                      const question = quiz.questions.find((item) => item.id === answer.question_id);
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
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                            {copy.question} {index + 1}
                          </p>
                          <p className="mt-2 text-sm font-medium text-text-primary">
                            {question?.question}
                          </p>
                          <p className="mt-3 text-sm text-text-secondary">
                            {copy.yourAnswer}: {selectedOption?.text || copy.skipped}
                          </p>
                          {!answer.is_correct && correctOption && (
                            <p className="mt-2 text-sm text-success">{uiLocale === 'es' ? 'Correcta' : 'Correct'}: {correctOption.text}</p>
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
                <h3 className="font-display text-2xl text-text-primary">{copy.shareTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="text-sm text-text-muted"
                >
                  {copy.close}
                </button>
              </div>
              <ShareButtons
                title={uiLocale === 'es' ? `Obtuve ${result?.title || `${triviaScore?.percentage}%`} en "${quiz.title}"` : `I got ${result?.title || `${triviaScore?.percentage}%`} on "${quiz.title}"`}
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
    <div className="rounded-[1.5rem] border border-border-subtle bg-bg-primary p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-text-primary">{value}</p>
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


