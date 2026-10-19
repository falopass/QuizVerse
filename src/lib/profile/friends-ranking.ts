/**
 * Ranking entre amigos del leaderboard (`?scope=friends`).
 *
 * Puro: recibe las filas de `profiles` del jugador y de a quienes sigue —la
 * misma consulta que `GET /api/leaderboard?scope=friends`— y devuelve
 * entradas con la misma forma que `entries[]` de la ruta, más `isMe` para
 * que la página ubique al jugador sin comparar ids de nuevo.
 */
export interface FriendsRankingRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  quizzes_played: number;
}

export interface FriendsRankingEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  points: number;
  quizzesPlayed: number;
  isMe: boolean;
}

export function rankFriends(
  rows: readonly FriendsRankingRow[],
  meId: string
): FriendsRankingEntry[] {
  return [...rows]
    .sort((a, b) => b.points - a.points)
    .map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      points: row.points,
      quizzesPlayed: row.quizzes_played,
      isMe: row.id === meId,
    }));
}
