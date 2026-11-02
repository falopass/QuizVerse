/**
 * Sustituye placeholders `{clave}` por valores en una plantilla del
 * diccionario. Las claves desconocidas quedan literales: mejor un
 * `{placeholder}` visible que un hueco silencioso.
 */
export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match
  );
}
