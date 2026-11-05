'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils/cn';
import { ShareButtons } from '@/components/shared/share-buttons';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import {
  getLocalizedLanguageLabel,
  getLocalizedTypeLabel,
  localizeCategory,
} from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { challengeOutcome, type ChallengeScore } from '@/lib/quiz/challenge';
import {
  compatibilityVerdict,
  personalityTagsFromAnswers,
  samePersonalityResult,
  type CompatibilityPeer,
} from '@/lib/quiz/compatibility';
import { CompatibilityCard } from '@/components/quiz/compatibility-card';
import type { QuizGroupInfo } from '@/lib/quiz/group';
import { isNicknameAllowed } from '@/lib/moderation/nickname';
import { createQuizGroup, joinQuizGroup } from '@/actions/group.actions';
import { GroupLeaderboard } from '@/components/quiz/group-leaderboard';
import type { Answer, PersonalityResult, Quiz, QuizReviewItem } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

interface ResultScreenProps {
  locale?: Locale;
  quiz: Quiz;
  result: PersonalityResult | null;
  triviaScore?: { correct: number; total: number; percentage: number };
  answers: Answer[];
  /**
   * Review computed on the server from the stored session. Preferred over
   * `answers` because the quiz handed to this screen no longer carries the
   * answer key.
   */
  review?: QuizReviewItem[];
  streak?: number;
  bonusPoints?: number;
  /**
   * `false` cuando la partida fue anónima y nadie recibió puntos: la métrica
   * muestra el aviso de cuenta en vez de un `+N` que no existe.
   */
  pointsSaved?: boolean;
  shareUrl?: string;
  /** Token de la sesión propia: al compartir marca `was_shared` en la partida. */
  shareToken?: string;
  /** URL de invitación (`?s=<sesión>&challenge=<sesión>`) para «Reta a un amigo». */
  challengeShareUrl?: string;
  /** Registro con vuelta a este resultado; el servidor solo lo pasa a anónimos. */
  accountCtaHref?: string;
  onPlayAgain?: () => void;
  /** El guardado in-game falló: muestra un aviso persistente con reintento. */
  submitFailed?: boolean;
  /** Desactiva el botón de reintento mientras un envío está en vuelo. */
  isSubmittingResult?: boolean;
  onRetrySubmit?: () => void;
  /** Marcador del retador: pinta la comparativa retador vs retado. */
  challenge?: ChallengeScore | null;
  /**
   * Partida del retador en un test de personalidad: su resultado y los tags
   * que acumuló. Activa la tarjeta de compatibilidad en lugar del marcador.
   */
  compatibility?: CompatibilityPeer | null;
  /** Enlace para aceptar el reto desde un resultado compartido (`/play?challenge=`). */
  challengeHref?: string;
  /** Relacionados ya saneados con `toClientQuiz` en el servidor; se muestran hasta 3. */
  related?: Quiz[];
  /** Grupo de ranking activo (`?g=` o uno ya creado/entrado por esta sesión). */
  group?: QuizGroupInfo | null;
  /** Sesión propia persistida: resalta su fila y autoriza el alta vía shareToken. */
  gameSessionId?: string;
  /** Apodo sugerido para entrar al grupo (username de perfil si hay sesión). */
  suggestedNickname?: string;
}

export function ResultScreen({
  locale,
  quiz,
  result,
  triviaScore,
  answers,
  review,
  streak = 0,
  bonusPoints = 0,
  pointsSaved = true,
  shareUrl,
  shareToken,
  challengeShareUrl,
  accountCtaHref,
  onPlayAgain,
  submitFailed = false,
  isSubmittingResult = false,
  onRetrySubmit,
  challenge = null,
  compatibility = null,
  challengeHref,
  related,
  group = null,
  gameSessionId,
  suggestedNickname,
}: ResultScreenProps) {
  const uiLocale: Locale = locale === 'es' ? 'es' : 'en';
  const [shareMode, setShareMode] = React.useState<'result' | 'challenge' | null>(null);
  // El grupo activo decide qué comparte «Reta a un amigo»: el link ?g= une a
  // todos en un ranking; si no hay tabla todavía se comparte el reto clásico.
  const [activeGroup, setActiveGroup] = React.useState<QuizGroupInfo | null>(group);
  const [groupNick, setGroupNick] = React.useState(suggestedNickname ?? '');
  const [groupBusy, setGroupBusy] = React.useState(false);
  const [groupError, setGroupError] = React.useState('');
  const [groupUnavailable, setGroupUnavailable] = React.useState(false);
  const [accountCtaDismissed, setAccountCtaDismissed] = React.useState(false);
  const verdictRef = React.useRef<HTMLHeadingElement | null>(null);
  const sharePanelRef = React.useRef<HTMLDivElement | null>(null);
  const shareTriggerRef = React.useRef<HTMLElement | null>(null);
  const wasSharingRef = React.useRef(false);
  // A11Y-02: al terminar la partida el foco cae aquí y el veredicto se anuncia;
  // también cubre /result, que es una pantalla nueva.
  React.useEffect(() => {
    verdictRef.current?.focus();
  }, []);

  // A11Y-04: al cerrar el diálogo de compartir el foco vuelve al botón que lo
  // abrió (hay dos: «Compartir resultado» y «Reta a un amigo»).
  React.useEffect(() => {
    if (shareMode !== null) {
      wasSharingRef.current = true;
      return;
    }
    if (!wasSharingRef.current) return;
    wasSharingRef.current = false;
    shareTriggerRef.current?.focus();
  }, [shareMode]);

  // A11Y-04: Escape cierra siempre, aunque el foco se haya escapado del panel,
  // y Tab queda atrapado entre los controles del diálogo.
  React.useEffect(() => {
    if (shareMode === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShareMode(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = sharePanelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        isTabbable
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
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
  }, [shareMode]);

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
          challengeFriend: 'Reta a un amigo',
          pointsAccountHint: 'Los puntos se guardan con una cuenta',
          accountCtaBody: 'Guarda este resultado y tu racha.',
          accountCtaAction: 'Crea una cuenta',
          accountCtaDismiss: 'Descartar',
          challengeEyebrow: 'Comparativa del reto',
          challenger: 'Retador',
          challenged: 'Retado',
          challengeWin: 'Reto superado',
          challengeTie: 'Empate',
          challengeLose: 'El reto sigue en pie',
          challengeSame: 'Mismo resultado',
          challengeDiff: 'Resultados distintos',
          rematch: 'Revancha',
          acceptChallenge: 'Aceptar el reto',
          keepPlaying: 'Sigue jugando',
          explanation: 'Explicación',
          saveFailed: 'No pudimos guardar tu partida: sin guardarla no hay puntos ni enlace.',
          retrySubmit: 'Reintentar',
          groupEyebrow: 'Ranking del grupo',
          groupNameLabel: 'Tu apodo para el grupo',
          groupNamePlaceholder: 'Camila, Pato…',
          groupCreate: 'Crear ranking',
          groupCreating: 'Creando…',
          groupHint: 'Un mismo enlace junta a todos los que juegan desde él.',
          groupUnavailable: 'El ranking de grupo aún no está disponible; comparte el reto clásico.',
          groupErrNickLength: 'El apodo debe tener entre 2 y 20 caracteres.',
          groupErrNickChars: 'Solo letras, números, espacios y _ - .',
          groupErrNickBlocked: 'Ese apodo no está permitido. Prueba con otro.',
          groupErrNickReserved: 'Ese nombre está reservado. Prueba con otro.',
          groupErrRate: 'Demasiados intentos. Espera un momento.',
          groupErrGeneric: 'No pudimos crear el grupo. Intenta de nuevo.',
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
          challengeFriend: 'Challenge a friend',
          pointsAccountHint: 'Points are saved with an account',
          accountCtaBody: 'Save this result and your streak.',
          accountCtaAction: 'Create an account',
          accountCtaDismiss: 'Dismiss',
          challengeEyebrow: 'Challenge showdown',
          challenger: 'Challenger',
          challenged: 'Challenged',
          challengeWin: 'Challenge beaten',
          challengeTie: 'Tied',
          challengeLose: 'The challenge stands',
          challengeSame: 'Same result',
          challengeDiff: 'Different results',
          rematch: 'Rematch',
          acceptChallenge: 'Take the challenge',
          keepPlaying: 'Keep playing',
          explanation: 'Explanation',
          saveFailed: "We couldn't save your game — no points or share link until it's saved.",
          retrySubmit: 'Retry',
          groupEyebrow: 'Group leaderboard',
          groupNameLabel: 'Your nickname for the group',
          groupNamePlaceholder: 'Camila, Pat…',
          groupCreate: 'Create leaderboard',
          groupCreating: 'Creating…',
          groupHint: 'One link gathers everyone who plays from it.',
          groupUnavailable:
            "The group leaderboard isn't available yet — share the classic challenge instead.",
          groupErrNickLength: 'Nickname must be 2–20 characters.',
          groupErrNickChars: 'Only letters, numbers, spaces and _ - .',
          groupErrNickBlocked: 'That nickname is not allowed. Try another one.',
          groupErrNickReserved: 'That name is reserved. Try another one.',
          groupErrRate: 'Too many attempts. Wait a moment.',
          groupErrGeneric: "We couldn't create the group. Try again.",
        };
  const scorePercentage = triviaScore?.percentage;
  const scoreMessage = getScoreMessage(scorePercentage, uiLocale);
  const shareResultTitle =
    uiLocale === 'es'
      ? `Saqué ${result?.title || (scorePercentage !== undefined ? `${scorePercentage}%` : 'un resultado')} en «${quiz.title}»`
      : `I got ${result?.title || (scorePercentage !== undefined ? `${scorePercentage}%` : 'a result')} on "${quiz.title}"`;

  // Comparativa del reto: mi marca contra la del retador. En personality el
  // score persistido son preguntas respondidas (n/N), no aciertos: el veredicto
  // compara títulos de resultado, no puntos.
  const personality = quiz.quiz_type === 'personality';
  // La pantalla se renderiza desde /result y desde QuizPlayer al terminar la
  // partida; localizar aquí cubre ambas vías sin depender de cada página.
  const category = localizeCategory(quiz.category, uiLocale);
  const myScore: ChallengeScore = triviaScore
    ? { score: triviaScore.correct, maxScore: triviaScore.total, resultTitle: result?.title }
    : { score: 0, maxScore: 0, resultTitle: result?.title };
  const outcome = challenge ? challengeOutcome(myScore, challenge) : null;
  const challengeVerdict = challenge
    ? personality
      ? myScore.resultTitle === challenge.resultTitle
        ? copy.challengeSame
        : copy.challengeDiff
      : outcome === 'win'
        ? copy.challengeWin
        : outcome === 'tie'
          ? copy.challengeTie
          : copy.challengeLose
    : null;

  // Compatibilidad del reto de personalidad: coseno de los vectores de tags,
  // simétrico — los dos jugadores ven el mismo número. Sin tags en alguna de
  // las dos partidas no hay porcentaje: queda la comparativa clásica del reto.
  const compatVerdict =
    personality && compatibility
      ? compatibilityVerdict(
          personalityTagsFromAnswers(quiz.questions, answers),
          compatibility.tags,
          samePersonalityResult(
            { resultId: result?.id ?? null, resultTitle: result?.title ?? null },
            compatibility
          )
        )
      : null;
  const showCompatibility = Boolean(compatibility && compatVerdict && result?.title);

  // URL pública del grupo: `?g=` une a todos los que juegan desde el enlace.
  const groupShareUrl = activeGroup
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${localizeHref(
        uiLocale,
        `/quiz/${quiz.slug}/play`
      )}?g=${activeGroup.token}`
    : null;

  const groupNickError = (reason: string): string => {
    if (reason.endsWith('_length')) return copy.groupErrNickLength;
    if (reason.endsWith('_chars')) return copy.groupErrNickChars;
    if (reason.endsWith('_reserved')) return copy.groupErrNickReserved;
    return copy.groupErrNickBlocked;
  };

  /**
   * «Reta a un amigo» ahora crea (o reutiliza) el grupo: apodo del creador
   * moderado → grupo → su propia marca entra al ranking → el diálogo comparte
   * `?g=`. Si la tabla aún no existe, el diálogo cae al reto clásico.
   */
  const onCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shareToken) return;

    const verdict = isNicknameAllowed(groupNick);
    if (!verdict.ok) {
      setGroupError(groupNickError(`nickname_${verdict.reason}`));
      return;
    }

    setGroupBusy(true);
    setGroupError('');
    const created = await createQuizGroup({ shareToken, nickname: verdict.value });
    if (!created.success) {
      setGroupBusy(false);
      if (created.code === 'unavailable') {
        setGroupUnavailable(true);
        setGroupError('');
        return;
      }
      setGroupError(
        created.code === 'rate_limited'
          ? copy.groupErrRate
          : created.error.startsWith('nickname_')
            ? groupNickError(created.error)
            : copy.groupErrGeneric
      );
      return;
    }

    // La marca del creador también entra al ranking: sin esto el grupo nace
    // vacío y el ejemplo «Grupo de Diego: Camila 8/8, tú 7/8» no se cumple.
    if (gameSessionId) {
      await joinQuizGroup({
        groupToken: created.groupToken,
        sessionToken: shareToken,
        nickname: verdict.value,
      });
    }
    try {
      window.localStorage.setItem('qv_group_nick', verdict.value);
    } catch {
      // Conveniencia solamente.
    }
    setActiveGroup(created.group);
    setGroupBusy(false);
  };

  React.useEffect(() => {
    if (
      scorePercentage === undefined ||
      scorePercentage < 60 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
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
              ref={verdictRef}
              tabIndex={-1}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="arcade-result-verdict"
            >
              {result?.title || scoreMessage}
            </motion.h1>

            {submitFailed && (
              <div
                className="border-accent-primary/40 bg-bg-primary/60 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4"
                role="alert"
              >
                <p className="text-text-primary text-sm font-medium">{copy.saveFailed}</p>
                {onRetrySubmit && (
                  <button
                    type="button"
                    onClick={onRetrySubmit}
                    disabled={isSubmittingResult}
                    className="arcade-result-ranking"
                  >
                    {isSubmittingResult ? '…' : copy.retrySubmit}
                  </button>
                )}
              </div>
            )}

            {triviaScore && (
              <div className="arcade-result-score">
                <span className="arcade-play-label">{copy.scoreline}</span>
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <p className="arcade-result-number">{triviaScore.percentage}%</p>
                  <p className="text-text-primary pb-2 text-sm font-semibold">
                    {triviaScore.correct}/{triviaScore.total} {copy.correct}
                  </p>
                </div>
              </div>
            )}

            <div className="arcade-result-actions">
              {challengeHref && (
                <Link href={challengeHref} className="arcade-button arcade-result-primary">
                  {copy.acceptChallenge}
                </Link>
              )}
              <button
                type="button"
                onClick={(event) => {
                  shareTriggerRef.current = event.currentTarget;
                  setShareMode('result');
                }}
                className={cn(
                  'arcade-button',
                  challengeHref ? 'arcade-result-secondary' : 'arcade-result-primary'
                )}
              >
                {uiLocale === 'es' ? 'Compartir resultado' : 'Share result'}
              </button>
              {challengeShareUrl && (
                <button
                  type="button"
                  onClick={(event) => {
                    shareTriggerRef.current = event.currentTarget;
                    setShareMode('challenge');
                  }}
                  className="arcade-button arcade-result-secondary"
                >
                  {copy.challengeFriend}
                </button>
              )}
              <Link
                href={
                  related?.[0]
                    ? localizeHref(uiLocale, `/quiz/${related[0].slug}/play?mode=classic`)
                    : localizeHref(uiLocale, '/quiz')
                }
                className="arcade-button arcade-result-secondary"
              >
                {uiLocale === 'es' ? 'Jugar a otro quiz' : 'Play another quiz'}
              </Link>
              {onPlayAgain && (
                <button type="button" onClick={onPlayAgain} className="arcade-result-ranking">
                  {challenge ? copy.rematch : uiLocale === 'es' ? 'Jugar otra vez' : 'Play again'}
                </button>
              )}
              <Link href={localizeHref(uiLocale, '/leaderboard')} className="arcade-result-ranking">
                {uiLocale === 'es' ? 'Ver ranking ↗' : 'View ranking ↗'}
              </Link>
            </div>

            <p className="arcade-result-body">{result?.description || copy.fallbackBody}</p>

            {showCompatibility && compatibility && compatVerdict ? (
              <CompatibilityCard
                locale={uiLocale}
                myResult={result?.title ?? ''}
                theirResult={compatibility.resultTitle ?? null}
                percent={compatVerdict.percent}
                tier={compatVerdict.tier}
                onShareChallenge={
                  challengeShareUrl
                    ? (event) => {
                        shareTriggerRef.current = event.currentTarget;
                        setShareMode('challenge');
                      }
                    : undefined
                }
              />
            ) : (
              challenge && (
                <div
                  className="border-accent-primary/40 bg-bg-primary/60 mt-6 rounded-2xl border px-5 py-4"
                  role="status"
                >
                  <p className="arcade-play-label">{copy.challengeEyebrow}</p>
                  <p className="text-accent-primary mt-2 text-2xl font-semibold md:text-3xl">
                    {challengeVerdict}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    <span className="text-text-secondary">
                      {copy.challenger}:{' '}
                      <strong className="text-text-primary">
                        {challengeMark(challenge, personality)}
                      </strong>
                    </span>
                    <span className="text-text-secondary">
                      {copy.challenged}:{' '}
                      <strong className="text-text-primary">
                        {challengeMark(myScore, personality)}
                      </strong>
                    </span>
                  </div>
                </div>
              )
            )}

            <div className="arcade-result-metrics">
              <ResultMetric
                label={copy.questions}
                value={String(triviaScore?.total ?? answers.length)}
              />
              <ResultMetric label={copy.bestStreak} value={String(streak)} />
              <ResultMetric
                label={copy.bonus}
                value={pointsSaved ? `+${bonusPoints}` : copy.pointsAccountHint}
                hint={!pointsSaved}
              />
            </div>

            {accountCtaHref && !accountCtaDismissed && (
              <div className="border-border-subtle bg-bg-primary/60 mt-6 flex items-start justify-between gap-4 rounded-2xl border px-5 py-4">
                <div>
                  <p className="text-text-primary inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-semibold">
                    {copy.accountCtaBody}
                  </p>
                  <Link
                    href={accountCtaHref}
                    className="text-accent-primary mt-2 inline-flex min-h-11 items-center text-sm font-semibold"
                  >
                    {copy.accountCtaAction}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountCtaDismissed(true)}
                  aria-label={copy.accountCtaDismiss}
                  className="text-text-secondary hover:text-text-primary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                >
                  ×
                </button>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="arcade-result-cover">
              <QuizCoverArt
                quiz={quiz}
                locale={uiLocale}
                compact
                decorative
                showTitle={false}
                ratioClassName="aspect-[16/9]"
              />
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
                {
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    className="mt-5 space-y-3"
                  >
                    {(
                      review ??
                      answers.map((answer) => {
                        const question = quiz.questions.find(
                          (item) => item.id === answer.question_id
                        );
                        return {
                          questionId: answer.question_id,
                          question: question?.question ?? '',
                          selectedOptionText:
                            question?.options.find(
                              (option) => option.id === answer.selected_option_id
                            )?.text ?? null,
                          correctOptionText: null,
                          isCorrect: answer.is_correct,
                          explanation: question?.explanation ?? null,
                        } satisfies QuizReviewItem;
                      })
                    ).map((item, index) => {
                      const isTrivia = quiz.quiz_type === 'trivia';

                      return (
                        <div
                          key={item.questionId}
                          className={cn(
                            'arcade-review-item',
                            isTrivia &&
                              (item.isCorrect ? 'arcade-review-correct' : 'arcade-review-incorrect')
                          )}
                        >
                          <span className="arcade-play-label">
                            {copy.question} {index + 1}
                          </span>
                          <p className="text-text-primary mt-2 text-sm leading-relaxed font-medium">
                            {item.question}
                          </p>
                          <p className="text-text-secondary mt-3 text-sm">
                            {copy.yourAnswer}: {item.selectedOptionText || copy.skipped}
                          </p>
                          {isTrivia && !item.isCorrect && item.correctOptionText && (
                            <p className="text-success mt-2 text-sm font-medium">
                              {uiLocale === 'es' ? 'Correcta' : 'Correct'}: {item.correctOptionText}
                            </p>
                          )}
                          {item.explanation && (
                            <div className="arcade-explanation">
                              <strong>{copy.explanation}</strong>
                              <p>{item.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </motion.div>
                }
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>

      {/* Único punto de montaje del ranking de grupo (migración 021). */}
      {activeGroup && (
        <GroupLeaderboard
          locale={uiLocale}
          groupToken={activeGroup.token}
          creatorNickname={activeGroup.creatorNickname}
          gameSessionId={gameSessionId}
          shareToken={shareToken}
          suggestedNickname={suggestedNickname}
        />
      )}

      {related && related.length > 0 && (
        <section
          className="arcade-related relative z-10 mx-auto max-w-6xl"
          aria-labelledby="related-quizzes"
        >
          <div className="arcade-section-head">
            <h2 id="related-quizzes">{copy.keepPlaying}</h2>
          </div>
          <div className="arcade-grid">
            {related.slice(0, 3).map((item) => (
              <EditorialQuizCard key={item.id} quiz={item} locale={uiLocale} />
            ))}
          </div>
        </section>
      )}

      {category?.slug && (
        <div className="arcade-related relative z-10 mx-auto max-w-6xl">
          <Link
            href={localizeHref(uiLocale, `/category/${category.slug}`)}
            className="arcade-result-ranking inline-block"
          >
            {uiLocale === 'es'
              ? `Ver todos los quizzes de ${category.name} ↗`
              : `See all ${category.name} quizzes ↗`}
          </Link>
        </div>
      )}

      <AnimatePresence>
        {shareMode !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShareMode(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              ref={sharePanelRef}
              className="arcade-share-panel w-full max-w-md p-6 shadow-lg"
              role="dialog"
              aria-modal="true"
              aria-label={shareMode === 'challenge' ? copy.challengeFriend : copy.shareTitle}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-text-primary text-2xl">
                  {shareMode === 'challenge' ? copy.challengeFriend : copy.shareTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShareMode(null)}
                  className="text-text-primary inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-semibold"
                  autoFocus
                >
                  {copy.close}
                </button>
              </div>
              {shareMode === 'challenge' && !groupShareUrl && shareToken && !groupUnavailable ? (
                // Antes de compartir hay que nombrar el grupo: el enlace `?g=`
                // junta a todos en un ranking moderado por apodo.
                <form onSubmit={onCreateGroup}>
                  <p className="text-text-secondary text-sm">{copy.groupHint}</p>
                  <label
                    htmlFor="group-creator-nick"
                    className="text-text-primary mt-3 block text-sm font-semibold"
                  >
                    {copy.groupNameLabel}
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="group-creator-nick"
                      type="text"
                      value={groupNick}
                      onChange={(event) => {
                        setGroupNick(event.target.value);
                        if (groupError) setGroupError('');
                      }}
                      placeholder={copy.groupNamePlaceholder}
                      maxLength={30}
                      autoComplete="nickname"
                      className="border-border-subtle bg-bg-secondary text-text-primary focus-visible:border-accent-primary min-h-11 flex-1 rounded-xl border px-4 text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={groupBusy}
                      className="arcade-button arcade-result-primary min-h-11"
                    >
                      {groupBusy ? copy.groupCreating : copy.groupCreate}
                    </button>
                  </div>
                  {groupError && (
                    <p className="text-accent-primary mt-2 text-sm font-medium" role="alert">
                      {groupError}
                    </p>
                  )}
                </form>
              ) : (
                <>
                  {shareMode === 'challenge' && groupUnavailable && (
                    <p className="text-text-secondary mb-3 text-sm">{copy.groupUnavailable}</p>
                  )}
                  <ShareButtons
                    locale={uiLocale}
                    quizId={quiz.id}
                    shareToken={shareToken}
                    title={shareResultTitle}
                    context={
                      personality
                        ? {
                            kind: 'personality_result',
                            slug: quiz.slug,
                            title: quiz.title,
                            resultTitle: result?.title ?? quiz.title,
                          }
                        : triviaScore
                          ? {
                              kind: 'trivia_result',
                              slug: quiz.slug,
                              title: quiz.title,
                              score: triviaScore.correct,
                              maxScore: triviaScore.total,
                            }
                          : { kind: 'quiz_invite', slug: quiz.slug, title: quiz.title }
                    }
                    url={
                      (shareMode === 'challenge' ? groupShareUrl || challengeShareUrl : shareUrl) ||
                      (typeof window !== 'undefined' ? window.location.href : '')
                    }
                    // El texto pegado en WhatsApp/X lleva el resultado: la vista
                    // previa del enlace no siempre lo muestra (WhatsApp/Facebook).
                    text={
                      shareMode === 'challenge' && groupShareUrl
                        ? uiLocale === 'es'
                          ? `${shareResultTitle} — entra al grupo y supéranos`
                          : `${shareResultTitle} — join the group and beat us`
                        : uiLocale === 'es'
                          ? `${shareResultTitle} — ¿puedes superarlo?`
                          : `${shareResultTitle} — can you beat it?`
                    }
                  />
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isTabbable(el: HTMLElement): boolean {
  if (el.closest('[hidden], fieldset[disabled]')) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function ResultMetric({
  label,
  value,
  hint = false,
}: {
  label: string;
  value: string;
  hint?: boolean;
}) {
  return (
    <div className="arcade-result-metric">
      <span>{label}</span>
      <p className={hint ? 'arcade-result-metric-hint' : undefined}>{value}</p>
    </div>
  );
}

/** Lo que se muestra como marca: aciertos en trivia, título en personality. */
function challengeMark(score: ChallengeScore, personality: boolean): string {
  return personality ? (score.resultTitle ?? '—') : `${score.score}/${score.maxScore}`;
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
  return 'Try again';
}
