'use client';

import { usePathname } from 'next/navigation';
import { EditorialLoadingStage } from '@/components/home/app-placeholders';

export default function Loading() {
  const es = usePathname()?.split('/')[1] === 'es';
  return (
    <EditorialLoadingStage
      variant="my-quizzes"
      eyebrow={es ? 'Cargando' : 'Loading'}
      title={es ? 'Cargando tus quizzes.' : 'Loading your quizzes.'}
    />
  );
}
