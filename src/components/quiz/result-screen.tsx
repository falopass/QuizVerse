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
}: ResultScreenProps) {
  const uiLocale: Locale = locale === 'es' ? 'es' : 'en';
  const [showShare, setShowShare] = React.useState(false);
  const copy =
    uiLocale === 'es'
      ? {
          eyebrow: 'Resultado',
          fallbackBody: 'Partida terminada. Revisa tus respuestas y vuelve a jugar cuando quieras.',
          questions: 'Preguntas',
          bestStreak: 'Mejor racha',
          bonus: 'Puntos',
          scoreline: 'Marcador',
          correct: 'correctas',
          sessionSnapshot: 'Resumen de sesión',
          answerTrail: 'Tus respuestas',
          question: 'Pregunta',
          yourAnswer: 'Tu respuesta',
          skipped: 'Omitida',
          close: 'Cerrar',
          shareTitle: 'Compartir resultado',
          shareText: 'Mira mi resultado en QuizVerse.',
        }
      : {
          eyebrow: 'Result',
          fallbackBody: 'Game complete. Review your answers and jump back in whenever you like.',
          questions: 'Questions',
          bestStreak: 'Best streak',
          bonus: 'Points',
          scoreline: 'Scoreline',
          correct: 'correct',
          sessionSnapshot: 'Session snapshot',
          answerTrail: 'Your answers',
          question: 'Question',
          yourAnswer: 'Your answer',
          skipped: 'Skipped',
          close: 'Close',
          shareTitle: 'Share result',
          shareText: 'Check out my result on QuizVerse.',
        };
  const scorePercentage = triviaScore?.percentage;
  const scoreMessage = getScoreMessage(scorePercentage, uiLocale);

  React.useEffect(() => {
    if (scorePercentage === undefined || scorePercentage < 60 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
  }, [scorePercentage]);

  return (
    <div className="arcade-result arcade-wrap">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="arcade-result-main">
            <motion.h1
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="arcade-result-verdict"
            >
              {result?.title || scoreMessage}
            </motion.h1>
            <p className="arcade-result-body">
              {result?.description || copy.fallbackBody}
            </p>

            <div className="arcade-result-metrics">
              <ResultMetric
                label={copy.questions}
                value={String(triviaScore?.total ?? answers.length)}
              />
              <ResultMetric label={copy.bestStreak} value={String(streak)} />
              <ResultMetric label={copy.bonus} value={`+${bonusPoints}`} />
            </div>

            {triviaScore && (
              <div className="arcade-result-score">
                <span className="arcade-play-label">{copy.scoreline}</span>
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <p className="arcade-result-number">
                    {triviaScore.percentage}%
                  </p>
                  <p className="text-text-primary pb-2 text-sm font-bold tracking-wider uppercase">
                    {triviaScore.correct}/{triviaScore.total} {copy.correct}
                  </p>
                </div>
              </div>
            )}

            <div className="arcade-result-actions">
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="arcade-button arcade-button-pink"
              >
                {uiLocale === 'es' ? 'Compartir resultado' : 'Share result'}
              </button>
              <Link href={localizeHref(uiLocale, '/quiz')} className="arcade-button arcade-result-secondary">
                {uiLocale === 'es' ? 'Jugar otro' : 'Play another'}
              </Link>
              {onPlayAgain && <button type="button" onClick={onPlayAgain} className="arcade-result-ranking">
                {uiLocale === 'es' ? 'Repetir partida' : 'Replay this quiz'}
              </button>}
              <Link
                href={localizeHref(uiLocale, '/leaderboard')}
                className="arcade-result-ranking"
              >
                {uiLocale === 'es' ? 'Ver ranking ↗' : 'View ranking ↗'}
              </Link>
            </div>
          </section>

          <section className="space-y-6">
            <div className="arcade-result-cover">
              <QuizCoverArt quiz={quiz} locale={uiLocale} compact ratioClassName="aspect-[16/9]" />
            </div>

            <div className="arcade-result-summary">
              <span className="arcade-play-label">{copy.sessionSnapshot}</span>
              <h2 className="font-display text-text-primary mt-3 text-2xl font-bold md:text-3xl">
                {quiz.title}
              </h2>
              <p className="text-text-secondary mt-3 text-sm leading-relaxed">
                {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} · {quiz.estimated_minutes} min ·{' '}
                {getLocalizedLanguageLabel(quiz.language, uiLocale)}
              </p>
            </div>

            <div className="arcade-result-review">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-text-primary mt-2 text-xl font-bold md:text-2xl">
                    {copy.answerTrail}
                  </h3>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {(
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
                          className={cn('arcade-review-item', quiz.quiz_type === 'trivia' && (answer.is_correct ? 'arcade-review-correct' : 'arcade-review-incorrect'))}
                        >
                          <span className="arcade-play-label">
                            {copy.question} {index + 1}
                          </span>
                          <p className="text-text-primary mt-2 text-sm leading-relaxed font-medium">
                            {question?.question}
                          </p>
                          <p className="text-text-secondary mt-3 text-sm">
                            {copy.yourAnswer}: {selectedOption?.text || copy.skipped}
                          </p>
                          {quiz.quiz_type === 'trivia' && !answer.is_correct && correctOption && (
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
              className="arcade-share-panel w-full max-w-md p-6 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-text-primary text-2xl">{copy.shareTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="text-text-primary text-sm font-bold"
                >
                  {copy.close}
                </button>
              </div>
              <ShareButtons
                locale={uiLocale}
                title={
                  uiLocale === 'es'
                    ? `Obtuve ${result?.title || (scorePercentage !== undefined ? `${scorePercentage}%` : 'un resultado')} en "${quiz.title}"`
                    : `I got ${result?.title || (scorePercentage !== undefined ? `${scorePercentage}%` : 'a result')} on "${quiz.title}"`
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
    <div className="arcade-result-metric">
      <span>{label}</span>
      <p>{value}</p>
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
