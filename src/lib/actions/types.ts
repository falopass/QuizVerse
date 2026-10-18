/**
 * Result contract shared by every server action.
 *
 * Server actions are a public boundary: the browser can call them with any
 * payload. They always resolve — never throw — so the UI can render an error
 * state, and they always carry a machine-readable `code` next to the message.
 */

export type ActionErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'rate_limited'
  | 'conflict'
  | 'unexpected';

export interface ActionFailure {
  success: false;
  code: ActionErrorCode;
  /** Human-readable, already localized message safe to show in a toast. */
  error: string;
}

export type ActionSuccess<T extends object = Record<never, never>> = { success: true } & T;

export type ActionResult<T extends object = Record<never, never>> =
  | ActionSuccess<T>
  | ActionFailure;

export function actionFailure(code: ActionErrorCode, error: string): ActionFailure {
  return { success: false, code, error };
}

/** First human-readable message from a Zod error. */
export function zodMessage(error: {
  issues: Array<{ message: string; path: PropertyKey[] }>;
}): string {
  const first = error.issues[0];
  if (!first) return 'Invalid input';
  const path = first.path.join('.');
  return path ? `${path}: ${first.message}` : first.message;
}
