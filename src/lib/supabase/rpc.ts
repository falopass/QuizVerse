/**
 * PostgREST responde así cuando el RPC no está en su schema cache: es la señal
 * de que la migración que crea la función todavía no se aplicó y el código debe
 * caer al camino anterior. Cualquier otro error es un fallo real, no un
 * "todavía no existe".
 */
export function isMissingRpcFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|schema cache/i.test(error.message ?? '')
  );
}
