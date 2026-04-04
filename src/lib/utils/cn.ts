import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind de manera inteligente
 * Elimina duplicados y maneja conflictos correctamente
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
