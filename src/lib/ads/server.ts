import { normalizePublisherId } from './config';

/**
 * Publisher para rutas de servidor. `ADSENSE_PUBLISHER_ID` se lee en runtime
 * del Worker (activar /ads.txt no exige rebuild); la variable pública, que
 * Next incrusta en build, queda como respaldo.
 */
export function serverAdsPublisherId(): string | null {
  return normalizePublisherId(
    process.env.ADSENSE_PUBLISHER_ID || process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
  );
}
