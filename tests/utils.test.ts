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

  it('debería usar separador de miles español con locale es', () => {
    expect(formatNumber(1000000, 'es')).toBe('1.000.000');
  });

  it('debería mantener el formato en-US con locale en', () => {
    expect(formatNumber(1000000, 'en')).toBe('1,000,000');
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

  it('debería compactar con unidades en español con locale es', () => {
    expect(formatCompactNumber(1500, 'es')).toBe('1,5\u00a0mil');
    expect(formatCompactNumber(2000000, 'es')).toBe('2\u00a0M');
  });

  it('debería mantener el formato en-US con locale en', () => {
    expect(formatCompactNumber(1500, 'en')).toBe('1.5K');
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

  it('debería mostrar "ahora mismo" con locale es', () => {
    expect(formatRelativeDate(new Date(), 'es')).toBe('ahora mismo');
  });

  it('debería mostrar minutos en español', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeDate(date, 'es')).toBe('hace 5 min');
  });

  it('debería mostrar horas en español con singular y plural', () => {
    expect(formatRelativeDate(new Date(Date.now() - 3600 * 1000), 'es')).toBe('hace 1 hora');
    expect(formatRelativeDate(new Date(Date.now() - 3 * 3600 * 1000), 'es')).toBe('hace 3 horas');
  });

  it('debería mostrar días en español con singular y plural', () => {
    expect(formatRelativeDate(new Date(Date.now() - 86400 * 1000), 'es')).toBe('hace 1 día');
    expect(formatRelativeDate(new Date(Date.now() - 2 * 86400 * 1000), 'es')).toBe('hace 2 días');
  });

  it('debería mostrar fecha en español para más de 7 días', () => {
    const result = formatRelativeDate(new Date('2020-01-15T12:00:00Z'), 'es');
    expect(result).toBe('15 ene 2020');
  });

  it('debería mantener los textos en inglés con locale en', () => {
    expect(formatRelativeDate(new Date(), 'en')).toBe('just now');
    expect(formatRelativeDate(new Date(Date.now() - 2 * 86400 * 1000), 'en')).toBe('2 days ago');
  });
});
