/**
 * Returns true if the caught error represents a StackBlitz VM connection timeout.
 *
 * The StackBlitz SDK throws a non-Error string/object on timeout, so we check
 * the stringified value rather than relying on instanceof Error.
 */
export function isTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('Timeout') || msg.includes('Unable to establish a connection')
  );
}

/**
 * Build the StackBlitz GitHub project path from a normalized repo, branch, and projectRoot.
 *
 * Branch names must NOT be percent-encoded. StackBlitz uses "/" as its own path separator
 * (same as github.com URLs), so encoding slashes (e.g. "feature/foo" -> "feature%2Ffoo")
 * causes an "Invalid Element" error in the SDK.
 *
 * For GitHub API URL segments, use encodeURIComponent separately — that is a different concern.
 */
export function buildStackblitzPath(
  normalizedRepo: string,
  branch: string,
  projectRoot: string,
): string {
  const branchSegment = branch ? `/tree/${branch}` : '';
  const rootSegment = projectRoot.trim() ? `/${projectRoot.trim()}` : '';
  return `${normalizedRepo}${branchSegment}${rootSegment}`;
}
