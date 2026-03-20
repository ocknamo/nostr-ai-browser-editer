/**
 * Parse a GitHub URL or owner/repo string to normalized owner/repo format.
 *
 * - Returns '' for empty input.
 * - Returns the string as-is if it already matches owner/repo format.
 * - Extracts owner/repo from a full GitHub URL (https://github.com/owner/repo).
 * - Returns the trimmed input unchanged if no GitHub URL is detected.
 */
export function parseGitHubRepo(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^[^/]+\/[^/]+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter((p) => p);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    // Not a valid URL; fall through.
  }
  return trimmed;
}
