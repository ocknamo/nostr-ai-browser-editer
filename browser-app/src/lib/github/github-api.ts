/**
 * GitHub REST API client for fetching commit and file information.
 * All requests use unauthenticated public API (60 req/hr rate limit).
 */

/** File extensions treated as binary; these are skipped during diff updates. */
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.wasm',
  '.zip',
  '.tar',
  '.gz',
  '.pdf',
  '.mp4',
  '.mp3',
  '.webm',
]);

/** Paths that should always be excluded from diff processing. */
const EXCLUDED_PATH_PREFIXES = ['.git/', 'node_modules/'];

/** Returns true if the file path points to a binary file that cannot be text-diffed. */
function isBinaryPath(path: string): boolean {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return false;
  return BINARY_EXTENSIONS.has(path.slice(lastDot).toLowerCase());
}

/** Returns true if the path should be excluded from diff processing. */
function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Result of fetchLatestCommit; null when the response is 304 Not Modified. */
export interface CommitInfo {
  sha: string;
  etag: string;
}

/**
 * Fetch the latest commit SHA for a branch.
 *
 * Sends If-None-Match when an etag is provided; returns null on 304 (no change).
 * Branch names are encodeURIComponent-encoded for the API URL path segment.
 */
export async function fetchLatestCommit(
  owner: string,
  repo: string,
  branch: string,
  etag?: string,
): Promise<CommitInfo | null> {
  const encodedBranch = encodeURIComponent(branch);
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodedBranch}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${url}`);
  }

  const newEtag = response.headers.get('ETag') ?? '';
  const data = (await response.json()) as { sha: string };
  return { sha: data.sha, etag: newEtag };
}

/** Result of fetchChangedFiles. */
export interface ChangedFiles {
  /** Paths of added or modified text files. */
  changedFiles: string[];
  /** Paths of deleted files. */
  removedFiles: string[];
}

/**
 * Fetch the list of files changed between two commits.
 *
 * Binary files and excluded paths (.git, node_modules) are omitted.
 */
export async function fetchChangedFiles(
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<ChangedFiles> {
  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${url}`);
  }

  const data = (await response.json()) as {
    files: { filename: string; status: string }[];
  };

  const changedFiles: string[] = [];
  const removedFiles: string[] = [];

  for (const file of data.files ?? []) {
    const path = file.filename;
    if (isExcludedPath(path) || isBinaryPath(path)) continue;

    if (file.status === 'removed') {
      removedFiles.push(path);
    } else {
      changedFiles.push(path);
    }
  }

  return { changedFiles, removedFiles };
}

/**
 * Fetch the raw text content of a file from raw.githubusercontent.com.
 *
 * This endpoint has no rate limit and supports CORS for browser use.
 * Branch/ref values are encodeURIComponent-encoded in the URL path.
 */
export async function fetchRawFile(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string> {
  const encodedRef = encodeURIComponent(ref);
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodedRef}/${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch raw file ${response.status}: ${url}`);
  }

  return response.text();
}

/** A single entry in a repository tree. */
export interface TreeEntry {
  path: string;
  type: string;
}

/**
 * Fetch the full recursive tree for a commit SHA.
 *
 * Returns only blob (file) entries; trees (directories) are excluded.
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  sha: string,
): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${url}`);
  }

  const data = (await response.json()) as {
    tree: { path: string; type: string }[];
  };

  return (data.tree ?? [])
    .filter((entry) => entry.type === 'blob')
    .map((entry) => ({ path: entry.path, type: entry.type }));
}
