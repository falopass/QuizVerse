'use client';

import * as React from 'react';
import Link from 'next/link';
import { localizeHref } from '@/lib/i18n/navigation';
import { copyText } from '@/lib/utils/clipboard';
import { buildDailyShareText, formatDailySeconds, nextDailyReset } from '@/lib/quiz/daily';
import type { Locale } from '@/lib/i18n/dictionaries';

interface DailyResultProps {
  locale: Locale;
  challengeNumber: number;
  /** Título del quiz del que salieron las preguntas (el tema del día). */
  quizTitle: string;
  score: number;
  total: number;
  /** Un emoji por pregunta, en orden: true = 🟩, false = 🟥. */
  marks: boolean[];
  seconds: number;
  streak: number;
}

const COPY = {
  es: {
    eyebrow: 'Quiz del día',
    playedToday: 'Ya jugaste el reto de hoy.',
    gridLabel: 'Resultado por pregunta, en orden',
    correctSr: 'acierto',
    missSr: 'fallo',
    scoreLabel: 'Puntaje',
    timeLabel: 'Tiempo',
    streakLabel: 'Racha',
    streakDays: (n: number) => (n === 1 ? '1 día' : `${n} días`),
    nextChallenge: 'Próximo reto en',
    copy: 'Copiar resultado',
    copied: '¡Copiado!',
    share: 'Compartir',
    keepPlaying: 'Más quizzes',
    summary: (score: number, total: number) => `${score} de ${total} correctas`,
  },
  en: {
    eyebrow: 'Daily quiz',
    playedToday: 'You already played today’s challenge.',
    gridLabel: 'Result per question, in order',
    correctSr: 'correct',
    missSr: 'miss',
    scoreLabel: 'Score',
    timeLabel: 'Time',
    streakLabel: 'Streak',
    streakDays: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    nextChallenge: 'Next challenge in',
    copy: 'Copy result',
    copied: 'Copied!',
    share: 'Share',
    keepPlaying: 'More quizzes',
    summary: (score: number, total: number) => `${score} out of ${total} correct`,
  },
} as const;

/**
 * Marcador del reto diario: grilla de emojis, puntaje, tiempo, racha y cuenta
 * regresiva al próximo reto. El texto compartible viaja sin preguntas ni
 * respuestas — es seguro pegarlo en cualquier chat.
 */
export function DailyResult({
  locale,
  challengeNumber,
  quizTitle,
  score,
  total,
  marks,
  seconds,
  streak,
}: DailyResultProps) {
  const copy = COPY[locale];
  const [copied, setCopied] = React.useState(false);
  const [supportsShare, setSupportsShare] = React.useState(false);
  const [remainingMs, setRemainingMs] = React.useState<number | null>(null);

  const shareText = buildDailyShareText({
    challengeNumber,
    score,
    total,
    marks,
    seconds,
    streak,
    locale,
  });

  React.useEffect(() => {
    queueMicrotask(() => setSupportsShare('share' in navigator));
    const tick = () => setRemainingMs(Math.max(0, nextDailyReset().getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = async () => {
    if (await copyText(shareText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    try {
      // `navigator.share` lleva solo texto: viaja igual por WhatsApp y X.
      await navigator.share({ text: shareText });
    } catch {
      // Cancelado por el usuario o sin soporte en el último momento.
    }
  };

  const totalSecondsLeft = remainingMs === null ? null : Math.floor(remainingMs / 1000);
  const countdown =
    totalSecondsLeft === null
      ? null
      : `${Math.floor(totalSecondsLeft / 3600)}:${String(
          Math.floor((totalSecondsLeft % 3600) / 60)
        ).padStart(2, '0')}:${String(totalSecondsLeft % 60).padStart(2, '0')}`;

  return (
    <section className="arcade-result">
      <div className="arcade-result-main">
        <span className="arcade-tag">
          {copy.eyebrow} · QuizVerse #{challengeNumber}
        </span>
        <h1 className="arcade-result-verdict">{quizTitle}</h1>
        <p className="arcade-result-body">
          {copy.playedToday} {copy.summary(score, total)}.
        </p>
        <p className="arcade-daily-grid" role="img" aria-label={copy.gridLabel}>
          {marks.map((mark, index) => (
            <span key={index} aria-hidden="true">
              {mark ? '🟩' : '🟥'}
            </span>
          ))}
        </p>
        <span className="sr-only">
          {marks
            .map((mark, index) => `${index + 1}: ${mark ? copy.correctSr : copy.missSr}`)
            .join(', ')}
        </span>
        <div className="arcade-result-metrics">
          <div className="arcade-result-metric">
            <span>{copy.scoreLabel}</span>
            <p>
              {score}/{total}
            </p>
          </div>
          <div className="arcade-result-metric">
            <span>{copy.timeLabel}</span>
            <p>{formatDailySeconds(seconds)}</p>
          </div>
          <div className="arcade-result-metric">
            <span>{copy.streakLabel}</span>
            <p>🔥 {copy.streakDays(streak)}</p>
          </div>
        </div>
        <div className="arcade-result-score">
          {countdown !== null && (
            <p className="arcade-daily-countdown">
              {copy.nextChallenge} <strong>{countdown}</strong>
            </p>
          )}
          <div className="arcade-result-actions">
            <button type="button" className="arcade-button arcade-button-lime" onClick={handleCopy}>
              {copied ? copy.copied : copy.copy}
            </button>
            {supportsShare && (
              <button type="button" className="arcade-button" onClick={handleShare}>
                {copy.share}
              </button>
            )}
            <Link href={localizeHref(locale, '/quiz')} className="arcade-result-ranking">
              {copy.keepPlaying} ↗
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
