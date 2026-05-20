'use client';

import { usePathname } from 'next/navigation';
import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function LocaleLoadingPage() {
  const pathname = usePathname();
  const isSpanish = pathname?.startsWith('/es');

  return (
    <EditorialLoadingStage
      eyebrow={isSpanish ? 'Cargando' : 'Loading'}
      title={isSpanish ? 'Cargando el universo de quizzes...' : 'Loading the quiz universe...'}
      body={
        isSpanish
          ? 'Estamos preparando la experiencia perfecta para ti.'
          : 'We are preparing the right experience for you.'
      }
    />
  );
}
