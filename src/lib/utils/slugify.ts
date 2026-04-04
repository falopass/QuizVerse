/**
 * Convierte un string en un slug URL-safe
 * Ej: "¿Qué eres hoy?" -> "que-eres-hoy"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')                   // Separar caracteres compuestos
    .replace(/[\u0300-\u036f]/g, '')    // Eliminar diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')           // Eliminar caracteres especiales
    .replace(/[\s_-]+/g, '-')           // Reemplazar espacios y guiones múltiples
    .replace(/^-+|-+$/g, '');           // Eliminar guiones al inicio/fin
}
