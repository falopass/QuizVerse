import { describe, expect, it } from 'vitest';
import { achievementToastMessage } from '@/lib/quiz/achievement-toast';

describe('achievementToastMessage', () => {
  it('devuelve null cuando no hay logros', () => {
    expect(achievementToastMessage('es', [])).toBeNull();
    expect(achievementToastMessage('en', [])).toBeNull();
  });

  it('arma el copy en singular con un logro', () => {
    expect(achievementToastMessage('es', [{ id: 'first_quiz', name: 'Primer quiz' }])).toEqual({
      title: '¡Logro desbloqueado!',
      description: 'Primer quiz',
    });
    expect(achievementToastMessage('en', [{ id: 'first_quiz', name: 'First quiz' }])).toEqual({
      title: 'Achievement unlocked!',
      description: 'First quiz',
    });
  });

  it('lista todos los nombres en plural', () => {
    const unlocked = [
      { id: 'first_quiz', name: 'Primer quiz' },
      { id: 'perfect_score', name: 'Perfeccionista' },
    ];
    expect(achievementToastMessage('es', unlocked)).toEqual({
      title: '¡Logros desbloqueados!',
      description: 'Primer quiz · Perfeccionista',
    });
    const en = achievementToastMessage('en', unlocked);
    expect(en?.title).toBe('Achievements unlocked!');
    expect(en?.description).toBe('Primer quiz · Perfeccionista');
  });
});
