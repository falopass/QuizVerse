import { cn } from '@/lib/utils/cn';
import { ProgressBar } from '@/components/ui/progress-bar';
import { formatClock } from '@/lib/quiz/format-clock';
import type { Locale } from '@/lib/i18n/dictionaries';

interface QuizProgressProps {
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining?: number;
  timeLimit?: number;
  /** Aciertos confirmados por el servidor hasta ahora (trivia). */
  correctAnswers?: number;
  /** Respuestas enviadas hasta ahora (trivia). Va junto a correctAnswers. */
  answeredCount?: number;
  /** Segundos transcurridos de la partida: cronómetro visible en todo modo. */
  elapsedSeconds?: number;
  locale: Locale;
}

function getTimerGradient(remaining: number, limit: number): 'safe' | 'medium' | 'low' {
  const ratio = remaining / limit;
  if (ratio > 0.5) return 'safe';
  if (ratio > 0.25) return 'medium';
  return 'low';
}

export function QuizProgress({
  currentQuestion,
  totalQuestions,
  timeRemaining,
  timeLimit,
  correctAnswers,
  answeredCount,
  elapsedSeconds,
  locale,
}: QuizProgressProps) {
  const timerText = timeRemaining !== undefined ? formatClock(timeRemaining) : undefined;
  return (
    <div className="w-full">
      {/* Progress bar (decorativa: el contador de abajo es quien anuncia) */}
      <div className="mb-2" aria-hidden="true">
        <ProgressBar
          value={currentQuestion}
          max={totalQuestions}
          size="md"
          variant="gradient"
          animated={false}
        />
      </div>

      {/* Info row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-text-primary font-semibold"
        >
          {locale === 'es' ? 'Pregunta' : 'Question'} {currentQuestion}{' '}
          {locale === 'es' ? 'de' : 'of'} {totalQuestions}
        </span>
        {/* Marcador vivo: lo anuncia la región sr-only del player; aquí solo se ve. */}
        {correctAnswers !== undefined && answeredCount !== undefined && answeredCount > 0 && (
          <span
            key={answeredCount}
            className="qv-l10-score-tick text-text-secondary font-semibold tabular-nums"
            aria-hidden="true"
          >
            {correctAnswers}/{answeredCount} {locale === 'es' ? 'correctas' : 'correct'}
          </span>
        )}
        {/* Cronómetro: texto plano (no región viva): no anuncia cada segundo
            pero el lector de pantalla puede consultarlo — no va aria-hidden. */}
        {elapsedSeconds !== undefined && (
          <span className="text-text-secondary font-mono tabular-nums">
            {formatClock(elapsedSeconds)}
          </span>
        )}
        {timeRemaining !== undefined && timeLimit !== undefined && (
          <div className="flex items-center gap-2">
            <ProgressBar
              value={timeRemaining}
              max={timeLimit}
              size="sm"
              animated={timeRemaining <= 10}
              timerGradient={getTimerGradient(timeRemaining, timeLimit)}
              className="w-20"
              ariaLabel={locale === 'es' ? 'Tiempo restante' : 'Time remaining'}
              ariaValueText={timerText}
            />
            <div
              className={cn(
                'flex items-center gap-1.5 font-mono tabular-nums',
                timeRemaining <= 10 ? 'text-warning' : 'text-text-primary'
              )}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{timerText}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
