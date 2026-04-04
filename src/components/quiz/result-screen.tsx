'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { Quiz, PersonalityResult, Answer } from '@/types/quiz';
import { Button } from '@/components/ui/button';
import { ShareButtons } from '@/components/shared/share-buttons';

interface ResultScreenProps {
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
  const [showShare, setShowShare] = React.useState(false);

  // Obtener tema de fondo según resultado
  const getBackgroundTheme = () => {
    const theme = result?.background_theme || 'mystic';

    const themes: Record<string, string> = {
      fire: 'from-red-500 to-orange-500',
      ice: 'from-cyan-500 to-blue-500',
      stars: 'from-purple-500 to-pink-500',
      ocean: 'from-blue-600 to-cyan-500',
      forest: 'from-green-500 to-emerald-500',
      mystic: 'from-violet-500 to-purple-500',
    };

    return themes[theme] || themes.mystic;
  };

  const bgGradient = getBackgroundTheme();

  // Obtener mensaje según puntuación
  const getScoreMessage = () => {
    if (!triviaScore) return 'Quiz Complete!';
    const { percentage } = triviaScore;
    if (percentage >= 90) return 'Outstanding! 🌟';
    if (percentage >= 80) return 'Excellent! 🎉';
    if (percentage >= 70) return 'Great Job! 👍';
    if (percentage >= 60) return 'Good Effort! 💪';
    if (percentage >= 50) return 'Not Bad! 😊';
    return 'Keep Practicing! 📚';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-20',
        bgGradient
      )} />

      {/* Content */}
      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Icon/Emoji según resultado */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          className="text-6xl mb-6"
        >
          {result ? '🎉' : '🏆'}
        </motion.div>

        {/* Título del resultado */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl md:text-4xl font-display font-bold text-text-primary mb-2"
        >
          {result ? result.title : getScoreMessage()}
        </motion.h1>

        {/* Descripción del resultado */}
        {result && (
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-text-secondary mb-8"
          >
            {result.description}
          </motion.p>
        )}

        {/* Score para trivia */}
        {triviaScore && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-8 p-6 rounded-2xl bg-bg-secondary/50 backdrop-blur border border-border-subtle"
          >
            <div className="text-sm text-text-secondary mb-2">Your Score</div>
            <div className="text-5xl font-display font-bold text-text-primary mb-2">
              {triviaScore.correct} / {triviaScore.total}
            </div>
            <div className={cn(
              'text-lg font-semibold mb-4',
              triviaScore.percentage >= 80 ? 'text-success' :
              triviaScore.percentage >= 60 ? 'text-warning' : 'text-error'
            )}>
              {triviaScore.percentage}%
            </div>

            {/* Stats adicionales */}
            <div className="flex items-center justify-center gap-6 text-sm">
              {streak > 0 && (
                <div className="flex items-center gap-1.5 text-orange-400">
                  <span>🔥</span>
                  <span>Best streak: {streak}</span>
                </div>
              )}
              {bonusPoints > 0 && (
                <div className="flex items-center gap-1.5 text-accent-warm">
                  <span>⭐</span>
                  <span>+{bonusPoints} bonus</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Stats resumen */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-6 mb-8 text-sm text-text-muted"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {answers.length} questions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>
              {quiz.title.length > 20 ? quiz.title.slice(0, 20) + '...' : quiz.title}
            </span>
          </div>
        </motion.div>

        {/* Botones de acción */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          {/* Share button - grande y llamativo */}
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={() => setShowShare(true)}
            leftIcon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            }
          >
            Share My Result
          </Button>

          {/* Botones secundarios */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={onPlayAgain || (() => window.location.reload())}
            >
              Play Again
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={onReview || (() => {})}
            >
              Review Answers
            </Button>
          </div>

          {/* Explore more */}
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={() => window.location.href = '/quiz'}
          >
            Explore More Quizzes
          </Button>
        </motion.div>

        {/* Share modal */}
        <AnimatePresence>
          {showShare && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowShare(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-bg-secondary rounded-2xl p-6 max-w-sm w-full border border-border-subtle"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Share Result</h3>
                  <button
                    onClick={() => setShowShare(false)}
                    className="p-2 text-text-muted hover:text-text-primary"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <ShareButtons
                  title={`I got ${result?.title || `${triviaScore?.percentage}%`} on "${quiz.title}"`}
                  url={shareUrl || (typeof window !== 'undefined' ? window.location.href : '')}
                  text={`Check out my result on QuizVerse! 🎯`}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Review Panel */}
        <AnimatePresence>
          {showReview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 p-6 rounded-2xl bg-bg-secondary/50 border border-border-subtle text-left"
            >
              <h3 className="text-lg font-semibold text-text-primary mb-4">Answer Review</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {answers.map((answer, index) => {
                  const question = quiz.questions.find(q => q.id === answer.question_id);
                  const selectedOption = question?.options.find(o => o.id === answer.selected_option_id);
                  
                  return (
                    <div
                      key={answer.question_id}
                      className={cn(
                        'p-3 rounded-lg text-sm',
                        answer.is_correct ? 'bg-success/10 border border-success/30' : 'bg-error/10 border border-error/30'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">
                          {answer.is_correct ? '✅' : '❌'}
                        </span>
                        <div>
                          <p className="text-text-primary font-medium">
                            Q{index + 1}: {question?.question}
                          </p>
                          <p className="text-text-secondary mt-1">
                            Your answer: {selectedOption?.text || 'Skipped'}
                          </p>
                          {!answer.is_correct && question?.options.find(o => o.is_correct) && (
                            <p className="text-success mt-1">
                              Correct: {question.options.find(o => o.is_correct)?.text}
                            </p>
                          )}
                          {question?.explanation && (
                            <p className="text-text-muted mt-2 text-xs">
                              💡 {question.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
