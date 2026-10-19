import { describe, expect, it } from 'vitest';
import { rankFriends } from '@/lib/profile/friends-ranking';
import type { FriendsRankingRow } from '@/lib/profile/friends-ranking';

function row(id: string, points: number, quizzesPlayed = 0): FriendsRankingRow {
  return {
    id,
    username: `user_${id}`,
    display_name: null,
    avatar_url: null,
    points,
    quizzes_played: quizzesPlayed,
  };
}

describe('rankFriends', () => {
  it('ordena por puntos descendente y numera rank desde 1', () => {
    const entries = rankFriends([row('a', 10), row('me', 90), row('b', 50)], 'me');

    expect(entries.map((e) => e.id)).toEqual(['me', 'b', 'a']);
    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(entries.map((e) => e.isMe)).toEqual([true, false, false]);
  });

  it('mantiene el orden de entrada cuando hay empate en puntos', () => {
    const entries = rankFriends([row('a', 10), row('b', 10), row('c', 10)], 'me');

    expect(entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('devuelve lista vacía sin lanzar', () => {
    expect(rankFriends([], 'me')).toEqual([]);
  });

  it('mapea a la misma forma que entries[] de la ruta', () => {
    const [entry] = rankFriends(
      [
        {
          id: 'x',
          username: 'ana',
          display_name: 'Ana',
          avatar_url: 'https://x.test/y.png',
          points: 5,
          quizzes_played: 3,
        },
      ],
      'me'
    );

    expect(entry).toEqual({
      rank: 1,
      id: 'x',
      username: 'ana',
      displayName: 'Ana',
      avatarUrl: 'https://x.test/y.png',
      points: 5,
      quizzesPlayed: 3,
      isMe: false,
    });
  });
});
