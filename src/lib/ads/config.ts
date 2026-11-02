/**
 * Configuración de AdSense leída de variables públicas.
 *
 * `NEXT_PUBLIC_*` se incrusta en el bundle del navegador en tiempo de build:
 * cambiar el publisher o un slot exige reconstruir. Mientras falte cualquiera
 * de los dos, el slot no se renderiza ni reserva espacio.
 */

export type AdPlacement = 'home' | 'explore' | 'detail';

/**
 * Publisher ID en la forma del snippet de AdSense (`ca-pub-…`). Se acepta
 * también el `pub-…` del panel y se normaliza.
 */
export function normalizePublisherId(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.startsWith('ca-') ? value : `ca-${value}`;
}

/** Publisher para el componente cliente; sale del build. */
export function adsPublisherId(): string | null {
  return normalizePublisherId(process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID);
}

/** ID de la unidad de anuncio de una ubicación; sin valor, ese slot queda inerte. */
export function adsSlotId(placement: AdPlacement): string | null {
  let raw: string | undefined;
  switch (placement) {
    case 'home':
      raw = process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT;
      break;
    case 'explore':
      raw = process.env.NEXT_PUBLIC_ADSENSE_EXPLORE_SLOT;
      break;
    case 'detail':
      raw = process.env.NEXT_PUBLIC_ADSENSE_DETAIL_SLOT;
      break;
  }
  return raw?.trim() || null;
}
