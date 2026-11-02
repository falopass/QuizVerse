'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { reconcileAchievements } from '@/actions/achievements.actions';

/**
 * Concede los logros pendientes que ya cumplen su meta y refresca la lista.
 * El render de la página no escribe: esta llamada sale del cliente y solo se
 * monta cuando hay pendientes.
 */
export function AchievementReconciler() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    reconcileAchievements()
      .then(({ unlocked }) => {
        if (active && unlocked.length > 0) router.refresh();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
