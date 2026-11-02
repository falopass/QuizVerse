'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Los flags viven a nivel de módulo: sobreviven al remontaje del shell al
// cambiar de idioma (/en <-> /es), que también es una navegación y sí debe
// anunciarse. Solo la primera montada de la sesión (carga inicial) queda en
// silencio, y un Atrás/Adelante que cruza el cambio de idioma sigue contando
// como navegación histórica en la instancia nueva.
let mountedOnce = false;
let historyNavigation = false;

// A11Y-06: el announcer que Next inyecta queda vacío en esta app (medido con
// axe + Playwright), así que anunciamos nosotros: tras cada navegación interna
// —cambio de pathname o de query (paginación, pestañas)— leemos el h1 del
// nuevo <main> (o document.title si no hay) y movemos el foco al landmark. En
// back/forward (popstate) no movemos el foco para no pelear con la
// restauración de scroll del navegador. El timeout corto da tiempo a que el
// árbol nuevo y el title streameado estén comprometidos, y la región se
// muta por DOM (no por estado) para re-anunciar títulos repetidos.
export function RouteAnnouncer() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const regionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onPopstate = () => {
      historyNavigation = true;
    };
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);

  React.useEffect(() => {
    if (!mountedOnce) {
      mountedOnce = true;
      return;
    }
    const timer = window.setTimeout(() => {
      const main = document.getElementById('main-content');
      const text = main?.querySelector('h1')?.textContent?.trim() || document.title;
      const region = regionRef.current;
      if (region) {
        // Vaciar y rellenar en el frame siguiente fuerza el anuncio aunque la
        // página nueva tenga el mismo h1 (p. ej. página 2 → 3 de una categoría).
        region.textContent = '';
        requestAnimationFrame(() => {
          region.textContent = text;
        });
      }
      if (!historyNavigation) {
        main?.focus({ preventScroll: true });
      }
      historyNavigation = false;
    }, 100);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  return (
    <div ref={regionRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
  );
}
