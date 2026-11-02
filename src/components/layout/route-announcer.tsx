'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

// A11Y-06: el announcer que Next inyecta queda vacío en esta app (medido con
// axe + Playwright), así que anunciamos nosotros: tras cada navegación interna
// leemos el h1 del nuevo <main> (o document.title si no hay) y movemos el foco
// al landmark. En back/forward (popstate) no movemos el foco para no pelear
// con la restauración de scroll del navegador. El timeout corto da tiempo a
// que el árbol nuevo y el title streameado estén comprometidos.
export function RouteAnnouncer() {
  const pathname = usePathname();
  const [message, setMessage] = React.useState('');
  const isFirstRender = React.useRef(true);
  const isPopstate = React.useRef(false);

  React.useEffect(() => {
    const onPopstate = () => {
      isPopstate.current = true;
    };
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Limpiar primero fuerza el anuncio aunque dos páginas compartan h1.
    setMessage('');
    const timer = window.setTimeout(() => {
      const main = document.getElementById('main-content');
      const heading = main?.querySelector('h1');
      setMessage(heading?.textContent?.trim() || document.title);
      if (!isPopstate.current) {
        main?.focus({ preventScroll: true });
      }
      isPopstate.current = false;
    }, 100);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
