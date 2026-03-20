/**
 * Returns true if the caught error represents a StackBlitz VM connection timeout.
 *
 * The StackBlitz SDK throws a non-Error string/object on timeout, so we check
 * the stringified value rather than relying on instanceof Error.
 */
export function isTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Timeout') || msg.includes('Unable to establish a connection');
}
