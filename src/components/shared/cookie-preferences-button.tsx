'use client';

import { COOKIE_PREFERENCES_EVENT } from './cookie-consent';

/** Reabre el banner de consentimiento; vive en el footer, que es servidor. */
export function CookiePreferencesButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))}
    >
      {label}
    </button>
  );
}
