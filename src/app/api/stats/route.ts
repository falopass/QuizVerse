import { jsonError, jsonOk } from '@/lib/api/query';
import { getCatalogStats } from '@/lib/data/catalog';

export const revalidate = 300;

/**
 * GET /api/stats
 *
 * Agregados públicos del catálogo: quizzes publicados por idioma y tipo,
 * categorías y partidas acumuladas. Sin datos personales.
 */
export async function GET() {
  try {
    const stats = await getCatalogStats();
    return jsonOk(stats);
  } catch {
    return jsonError(503, 'stats_unavailable');
  }
}
