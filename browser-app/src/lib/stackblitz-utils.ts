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

/**
 * Build the StackBlitz GitHub project path from a normalized repo, branch, and projectRoot.
 *
 * Branch names are URL-encoded to handle slashes (e.g. "claude/fix-foo" becomes
 * "claude%2Ffix-foo"), preventing StackBlitz from misinterpreting path segments.
 */
export function buildStackblitzPath(normalizedRepo: string, branch: string, projectRoot: string): string {
  const branchSegment = branch ? `/tree/${encodeURIComponent(branch)}` : '';
  const rootSegment = projectRoot.trim() ? `/${projectRoot.trim()}` : '';
  return `${normalizedRepo}${branchSegment}${rootSegment}`;
}
