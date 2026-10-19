import { describe, expect, it } from 'vitest';
import { achievementToastMessage } from '@/lib/quiz/achievement-toast';

describe('achievementToastMessage', () => {
  it('devuelve null cuando no hay logros', () => {
    expect(achievementToastMessage('es', [])).toBeNull();
    expect(achievementToastMessage('en', [])).toBeNull();
  });

  it('arma el copy en singular con un logro', () => {
    expect(achievementToastMessage('es', [{ id: 'first_quiz', name: 'First Steps' }])).toEqual({
      title: '¡Logro desbloqueado!',
      description: 'Primeros pasos',
    });
    expect(achievementToastMessage('en', [{ id: 'first_quiz', name: 'First Steps' }])).toEqual({
      title: 'Achievement unlocked!',
      description: 'First Steps',
    });
  });

  it('lista todos los nombres en plural', () => {
    const unlocked = [
      { id: 'first_quiz', name: 'First Steps' },
      { id: 'perfect_score', name: 'Flawless' },
    ];
    expect(achievementToastMessage('es', unlocked)).toEqual({
      title: '¡Logros desbloqueados!',
      description: 'Primeros pasos · Impecable',
    });
    const en = achievementToastMessage('en', unlocked);
    expect(en?.title).toBe('Achievements unlocked!');
    expect(en?.description).toBe('First Steps · Flawless');
  });

  it('mantiene el nombre del servidor para ids desconocidos', () => {
    const message = achievementToastMessage('es', [
      { id: 'logro_nuevo', name: 'Server Provided Name' },
    ]);
    expect(message?.description).toBe('Server Provided Name');
  });
});
