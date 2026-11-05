'use client';

/**
 * Ranking del grupo por enlace (`?g=<token>`).
 *
 * Punto único de montaje en `result-screen.tsx` (la página ligera
 * `ranking/[token]` lo usa en `readOnly`): muestra la tabla, resalta al
 * jugador actual y ofrece entrar con un apodo moderado cuando hay una sesión
 * propia (`shareToken` + `gameSessionId`). El puntaje nunca sale del cliente:
 * el servidor lo toma de la sesión ya puntuada.
 *
 * Antes de la migración 021 la action responde `unavailable` y aquí se pinta
 * un aviso claro sin romper el resultado.
 */

import * as React from 'react';
import { getQuizGroupLeaderboard, joinQuizGroup } from '@/actions/group.actions';
import { groupPositionOf, type GroupEntry } from '@/lib/quiz/group';
import { formatTime } from '@/lib/quiz/engine';
import { isNicknameAllowed } from '@/lib/moderation/nickname';
import { cn } from '@/lib/utils/cn';
import type { Locale } from '@/lib/i18n/dictionaries';

const NICK_STORAGE_KEY = 'qv_group_nick';

interface GroupLeaderboardProps {
  locale: Locale;
  groupToken: string;
  creatorNickname: string;
  /** Sesión propia: resalta su fila y habilita el alta con `shareToken`. */
  gameSessionId?: string;
  /** Token bearer de la sesión propia: prueba la titularidad al entrar. */
  shareToken?: string;
  /** Apodo sugerido (nombre de usuario con sesión); localStorage gana si existe. */
  suggestedNickname?: string;
  /** Entradas ya resueltas en el servidor (página /ranking en readOnly). */
  initialEntries?: GroupEntry[];
  /** Conteo real de jugadores para readOnly (el RPC recorta filas a 100). */
  playerCount?: number;
  /** Sin fetch ni alta: la página ligera de ranking pinta solo la tabla. */
  readOnly?: boolean;
}

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

const COPY = {
  es: {
    eyebrow: 'Ranking del grupo',
    heading: (creator: string) => `Grupo de ${creator}`,
    joined: (n: number) => `${n} jugador${n === 1 ? '' : 'es'}`,
    position: '#',
    nickname: 'Apodo',
    score: 'Puntaje',
    time: 'Tiempo',
    you: 'tú',
    ahead: (n: number) => `Te superan ${n}`,
    first: 'Vas primero',
    notJoined: 'Entra al ranking con tu apodo.',
    nicknameLabel: 'Tu apodo',
    nicknamePlaceholder: 'Camila, Pato…',
    join: 'Entrar al ranking',
    joining: 'Entrando…',
    empty: 'Aún no hay jugadores. Sé el primero.',
    unavailable: 'El ranking de grupo aún no está disponible. Vuelve a intentarlo más tarde.',
    error: 'No pudimos cargar el ranking. Intenta de nuevo.',
    retry: 'Reintentar',
    rateLimited: 'Demasiados intentos. Espera un momento.',
    nickLength: 'El apodo debe tener entre 2 y 20 caracteres.',
    nickChars: 'Solo letras, números, espacios y _ - .',
    nickBlocked: 'Ese apodo no está permitido. Prueba con otro.',
    nickReserved: 'Ese nombre está reservado. Prueba con otro.',
    joinedAs: (nick: string) => `Entraste como ${nick}`,
    noTime: '—',
  },
  en: {
    eyebrow: 'Group leaderboard',
    heading: (creator: string) => `${creator}'s group`,
    joined: (n: number) => `${n} player${n === 1 ? '' : 's'}`,
    position: '#',
    nickname: 'Nickname',
    score: 'Score',
    time: 'Time',
    you: 'you',
    ahead: (n: number) => `${n} ahead of you`,
    first: "You're first",
    notJoined: 'Join the leaderboard with a nickname.',
    nicknameLabel: 'Your nickname',
    nicknamePlaceholder: 'Camila, Pat…',
    join: 'Join the leaderboard',
    joining: 'Joining…',
    empty: 'No players yet. Be the first.',
    unavailable: 'The group leaderboard is not available yet. Please try again later.',
    error: "We couldn't load the leaderboard. Try again.",
    retry: 'Retry',
    rateLimited: 'Too many attempts. Wait a moment.',
    nickLength: 'Nickname must be 2–20 characters.',
    nickChars: 'Only letters, numbers, spaces and _ - .',
    nickBlocked: 'That nickname is not allowed. Try another one.',
    nickReserved: 'That name is reserved. Try another one.',
    joinedAs: (nick: string) => `You joined as ${nick}`,
    noTime: '—',
  },
} as const;

export function GroupLeaderboard({
  locale,
  groupToken,
  creatorNickname,
  gameSessionId,
  shareToken,
  suggestedNickname,
  initialEntries,
  playerCount,
  readOnly = false,
}: GroupLeaderboardProps) {
  const copy = locale === 'es' ? COPY.es : COPY.en;
  const [entries, setEntries] = React.useState<GroupEntry[] | null>(initialEntries ?? null);
  const [total, setTotal] = React.useState(playerCount ?? initialEntries?.length ?? 0);
  const [state, setState] = React.useState<LoadState>(initialEntries ? 'ready' : 'loading');
  const [nickname, setNickname] = React.useState(() => {
    // localStorage gana sobre el nombre de usuario: es la elección previa real.
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(NICK_STORAGE_KEY);
        if (saved) return saved;
      } catch {
        // Sin storage (modo estricto): queda el sugerido.
      }
    }
    return suggestedNickname ?? '';
  });
  const [joinError, setJoinError] = React.useState('');
  const [joining, setJoining] = React.useState(false);
  const [justJoined, setJustJoined] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const result = await getQuizGroupLeaderboard(groupToken, gameSessionId);
    if (!result.success) {
      setState(result.code === 'unavailable' ? 'unavailable' : 'error');
      return false;
    }
    setEntries(result.entries);
    setTotal(result.group.playerCount);
    setState('ready');
    return true;
  }, [groupToken, gameSessionId]);

  React.useEffect(() => {
    if (readOnly || initialEntries) return;
    // El fetch corre en un timer: la regla react-hooks/set-state-in-effect
    // prohíbe setState síncrono en el efecto.
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupToken, readOnly]);

  const alreadyJoined =
    justJoined !== null ||
    Boolean(gameSessionId && entries?.some((entry) => entry.gameSessionId === gameSessionId));
  const canJoin = Boolean(shareToken && gameSessionId && !alreadyJoined);
  const position = groupPositionOf(entries ?? [], gameSessionId);
  const ahead = position > 0 ? position - 1 : 0;

  const nickError = (reason: string): string => {
    if (reason.endsWith('_length')) return copy.nickLength;
    if (reason.endsWith('_chars')) return copy.nickChars;
    if (reason.endsWith('_reserved')) return copy.nickReserved;
    return copy.nickBlocked;
  };

  const onJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shareToken || !gameSessionId) return;

    const verdict = isNicknameAllowed(nickname);
    if (!verdict.ok) {
      setJoinError(nickError(`nickname_${verdict.reason}`));
      return;
    }

    setJoining(true);
    setJoinError('');
    const result = await joinQuizGroup({
      groupToken,
      sessionToken: shareToken,
      nickname: verdict.value,
    });
    setJoining(false);

    if (!result.success) {
      if (result.code === 'rate_limited') setJoinError(copy.rateLimited);
      else if (result.code === 'unavailable') setJoinError(copy.unavailable);
      else if (result.error.startsWith('nickname_')) setJoinError(nickError(result.error));
      else setJoinError(copy.error);
      return;
    }

    try {
      window.localStorage.setItem(NICK_STORAGE_KEY, verdict.value);
    } catch {
      // Guardar es conveniencia, no requisito.
    }
    setJustJoined(verdict.value);
    setJoinError('');
    await refresh();
  };

  const rows = entries ?? [];

  return (
    <section
      className="arcade-related relative z-10 mx-auto max-w-6xl"
      aria-labelledby="group-leaderboard-title"
    >
      <div className="border-border-subtle bg-bg-primary/60 rounded-2xl border px-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow text-accent-primary text-[11px] font-semibold">{copy.eyebrow}</p>
            <h2
              id="group-leaderboard-title"
              className="font-display text-text-primary mt-1 text-xl font-bold md:text-2xl"
            >
              {copy.heading(creatorNickname)}
            </h2>
          </div>
          <p className="text-text-secondary text-sm">
            {copy.joined(total)}
            {position > 0 && ` · ${ahead === 0 ? copy.first : copy.ahead(ahead)}`}
          </p>
        </div>

        {justJoined && (
          <p className="text-success mt-2 text-sm font-medium" role="status">
            {copy.joinedAs(justJoined)}
          </p>
        )}

        {state === 'loading' && <p className="text-text-secondary mt-4 text-sm">…</p>}

        {state === 'unavailable' && (
          <p className="text-text-secondary mt-4 text-sm" role="status">
            {copy.unavailable}
          </p>
        )}

        {state === 'error' && (
          <div className="mt-4 flex flex-wrap items-center gap-3" role="alert">
            <p className="text-text-secondary text-sm">{copy.error}</p>
            <button
              type="button"
              onClick={() => {
                setState('loading');
                void refresh();
              }}
              className="arcade-result-ranking inline-flex min-h-11 items-center"
            >
              {copy.retry}
            </button>
          </div>
        )}

        {state === 'ready' && rows.length === 0 && (
          <p className="text-text-secondary mt-4 text-sm">{copy.empty}</p>
        )}

        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-0 text-left text-sm">
              <thead>
                <tr className="text-text-secondary border-border-subtle border-b">
                  <th scope="col" className="w-10 py-2 pr-3 font-semibold">
                    {copy.position}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {copy.nickname}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {copy.score}
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    {copy.time}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, index) => {
                  const mine = Boolean(gameSessionId && entry.gameSessionId === gameSessionId);
                  return (
                    <tr
                      key={entry.gameSessionId}
                      className={cn(
                        'border-border-subtle/60 border-b last:border-0',
                        mine && 'bg-accent-primary/10'
                      )}
                    >
                      <td className="text-text-secondary py-2.5 pr-3 font-semibold">
                        {entry.position ?? index + 1}
                      </td>
                      <td className="text-text-primary py-2.5 pr-3 font-semibold">
                        {entry.nickname}
                        {mine && (
                          <span className="text-accent-primary ml-1 font-semibold">
                            ({copy.you})
                          </span>
                        )}
                      </td>
                      <td className="text-text-primary py-2.5 pr-3">
                        {entry.score}/{entry.maxScore}
                      </td>
                      <td className="text-text-secondary py-2.5">
                        {entry.timeTakenSeconds != null
                          ? formatTime(entry.timeTakenSeconds)
                          : copy.noTime}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!readOnly && canJoin && (
          <form onSubmit={onJoin} className="mt-5">
            <label
              htmlFor="group-nickname"
              className="text-text-primary block text-sm font-semibold"
            >
              {copy.nicknameLabel}
            </label>
            <p className="text-text-secondary mt-1 text-sm">{copy.notJoined}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="group-nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  if (joinError) setJoinError('');
                }}
                placeholder={copy.nicknamePlaceholder}
                maxLength={30}
                autoComplete="nickname"
                className="border-border-subtle bg-bg-secondary text-text-primary focus-visible:border-accent-primary min-h-11 flex-1 rounded-xl border px-4 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={joining}
                className="arcade-button arcade-result-primary min-h-11"
              >
                {joining ? copy.joining : copy.join}
              </button>
            </div>
            {joinError && (
              <p className="text-accent-primary mt-2 text-sm font-medium" role="alert">
                {joinError}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

export default GroupLeaderboard;
