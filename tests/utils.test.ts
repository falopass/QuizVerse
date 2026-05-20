import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/utils/slugify';
import { formatCompactNumber, formatRelativeDate, formatNumber } from '@/lib/utils/format';

describe('slugify', () => {
  it('debería convertir texto básico', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('debería eliminar acentos', () => {
    expect(slugify('Canción Épica')).toBe('cancion-epica');
  });

  it('debería eliminar caracteres especiales', () => {
    expect(slugify('¿Qué eres hoy?')).toBe('que-eres-hoy');
  });

  it('debería manejar guiones múltiples', () => {
    expect(slugify('a---b___c')).toBe('a-b-c');
  });

  it('debería eliminar guiones al inicio y final', () => {
    expect(slugify('-hello-')).toBe('hello');
  });

  it('debería manejar string vacío', () => {
    expect(slugify('')).toBe('');
  });

  it('debería manejar solo caracteres especiales', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('formatNumber', () => {
  it('debería formatear números grandes', () => {
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('debería formatear cero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatCompactNumber', () => {
  it('debería compactar miles', () => {
    expect(formatCompactNumber(1500)).toBe('1.5K');
  });

  it('debería compactar millones', () => {
    expect(formatCompactNumber(2000000)).toBe('2M');
  });

  it('debería mantener números pequeños', () => {
    expect(formatCompactNumber(42)).toBe('42');
  });
});

describe('formatRelativeDate', () => {
  it('debería mostrar "just now"', () => {
    const result = formatRelativeDate(new Date());
    expect(result).toBe('just now');
  });

  it('debería mostrar minutos', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelativeDate(date);
    expect(result).toContain('min');
  });

  it('debería mostrar horas', () => {
    const date = new Date(Date.now() - 3 * 3600 * 1000);
    const result = formatRelativeDate(date);
    expect(result).toContain('hours');
  });

  it('debería mostrar días', () => {
    const date = new Date(Date.now() - 2 * 86400 * 1000);
    const result = formatRelativeDate(date);
    expect(result).toContain('days');
  });

  it('debería mostrar fecha completa para más de 7 días', () => {
    const date = new Date(Date.now() - 10 * 86400 * 1000);
    const result = formatRelativeDate(date);
    expect(result).toMatch(/\w{3}\s\d{1,2},\s\d{4}/);
  });
});
