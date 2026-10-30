/**
 * IP del cliente para rate limiting. En Cloudflare Workers gana
 * `cf-connecting-ip` (la fija la plataforma y el cliente no puede falsificarla);
 * detrás de Vercel o el VPS se acepta `x-real-ip` y luego el primer valor de
 * `x-forwarded-for`. `fallback` conserva el valor previo de cada caller
 * ('unknown' o 'anonymous').
 */
export function clientIpFromHeaders(headerList: Headers, fallback = 'unknown'): string {
  const cfIp = headerList.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = headerList.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return fallback;
}
