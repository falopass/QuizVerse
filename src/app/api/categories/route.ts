import { getPublicCategories } from '@/lib/data/public';
import { LocaleSchema } from '@/lib/api/query';
import { jsonError, jsonOk } from '@/lib/api/query';

export const revalidate = 300;

/**
 * GET /api/categories
 *
 * Lista de categorías del catálogo. `locale` solo valida el parámetro: las
 * etiquetas de `categories` son bilingües por fila y el cliente elige el campo.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale');
  if (locale && !LocaleSchema.safeParse(locale).success) {
    return jsonError(400, 'invalid_locale', { locale: ['en | es'] });
  }

  try {
    const categories = await getPublicCategories();
    return jsonOk({ categories, total: categories.length });
  } catch {
    return jsonError(503, 'catalog_unavailable');
  }
}
