'use client';

import { usePathname } from 'next/navigation';
import { EditorialLoadingStage } from '@/components/home/app-placeholders';

// loading.tsx no recibe params, así que el locale sale del pathname: estas
// pantallas solo existen bajo /en|/es y el primer segmento siempre es real.
export function RouteLoading() {
  const es = usePathname()?.split('/')[1] === 'es';
  return (
    <EditorialLoadingStage
      eyebrow={es ? 'Cargando' : 'Loading'}
      title={es ? 'Preparando la siguiente pantalla.' : 'Preparing the next surface.'}
      body={
        es
          ? 'Estamos trayendo los últimos datos y dando forma a la página.'
          : 'We are pulling in the latest data and shaping the page for you.'
      }
    />
  );
}
