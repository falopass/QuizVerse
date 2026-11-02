import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { isMissingRpcFunction } from '@/lib/supabase/rpc';
import type { GameSessionRow } from '@/lib/data/normalizers';

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Lee una partida por su share_token.
 *
 * Con la migración 013 aplicada la policy de game_sessions solo deja leer las
 * sesiones propias, así que la lectura pública pasa por el RPC
 * `get_session_by_share_token`, que devuelve las columnas del resultado
 * compartido sin `player_id`. Mientras no exista la función (PGRST202, schema
 * cache sin recargar) cae al SELECT directo, que la policy antigua permitía.
 */
export async function fetchSessionByShareToken(
  supabase: Client,
  shareToken: string
): Promise<GameSessionRow | null> {
  const { data, error } = await supabase
    .rpc('get_session_by_share_token', { p_token: shareToken })
    .maybeSingle();

  // El RPC no devuelve attempt_id (no forma parte del resultado compartido):
  // la fila pública lo deja en null, igual que player_id.
  if (!error) return data ? { ...data, player_id: null, attempt_id: null } : null;
  if (!isMissingRpcFunction(error)) return null;

  const { data: row, error: fallbackError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('share_token', shareToken)
    .maybeSingle();

  return fallbackError ? null : row;
}
