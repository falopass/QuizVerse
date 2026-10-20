import { describe, it, expect } from 'vitest';
import { entrance } from '@/lib/ui/motion';

describe('entrance (prefers-reduced-motion)', () => {
  const props = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
    transition: { type: 'spring' as const, delay: 0.2 },
  };

  it('con reduced solo deja opacity y quita el transition', () => {
    const out = entrance(true, props);
    expect(out.initial).toEqual({ opacity: 0 });
    expect(out.animate).toEqual({ opacity: 1 });
    expect(out.exit).toEqual({ opacity: 0 });
    expect(out).not.toHaveProperty('transition');
  });

  it('con labels de variant neutraliza la animación con reduced', () => {
    const out = entrance(true, {
      initial: 'hidden',
      animate: 'visible',
      exit: 'exit',
      transition: { delay: 0.1 },
    });
    expect(out.initial).toEqual({});
    expect(out.animate).toEqual({});
    expect(out.exit).toEqual({});
    expect(out).not.toHaveProperty('transition');
  });

  it('con reduced = false devuelve las mismas props', () => {
    expect(entrance(false, props)).toEqual(props);
  });

  it('no muta el objeto de entrada', () => {
    const snapshot = structuredClone(props);
    entrance(true, props);
    entrance(false, props);
    expect(props).toEqual(snapshot);
  });
});
