/**
 * GitHub REST API client for fetching public repository contents.
 * Uses the Tree API + raw.githubusercontent.com to avoid CORS issues with the tarball API.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

/** Extensions of files that should be treated as binary and excluded from the VFS. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm',
  '.pdf', '.zip', '.gz', '.tar', '.wasm',
  '.exe', '.dll', '.so', '.dylib',
]);

/** Paths that should never be fetched into the VFS. */
const EXCLUDED_PATHS = ['.git/', 'node_modules/'];

/** Represents a single file entry returned from the GitHub Tree API. */
export interface TreeFile {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

/** Result of a commit fetch including the SHA and optional ETag for caching. */
export interface CommitResult {
  sha: string;
  etag: string | null;
}

/** Result of fetching changed files from the compare API. */
export interface CompareResult {
  changedFiles: string[];
  removedFiles: string[];
}

/**
 * Fetch the recursive file tree for a repository at a given commit SHA or branch.
 * Returns only blob (file) entries, excluding binary files and excluded paths.
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  sha: string,
): Promise<TreeFile[]> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(sha)}?recursive=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch repo tree: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { tree: TreeFile[]; truncated?: boolean };
  if (data.truncated) {
    console.warn('[github-api] Tree response was truncated - repository may be too large');
  }
  return data.tree.filter((entry) => {
    if (entry.type !== 'blob') return false;
    if (isBinaryPath(entry.path)) return false;
    if (EXCLUDED_PATHS.some((prefix) => entry.path.startsWith(prefix))) return false;
    return true;
  });
}

/**
 * Fetch raw text content of a single file from raw.githubusercontent.com.
 * This endpoint supports CORS and does not count against the API rate limit.
 */
export async function fetchRawFile(
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<string> {
  const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${encodeURIComponent(ref)}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch file ${path}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Fetch the latest commit SHA for a branch.
 * Accepts an optional ETag from a previous response to avoid redundant transfers.
 * Returns null when the ETag matches (no change detected).
 */
export async function fetchLatestCommit(
  owner: string,
  repo: string,
  branch: string,
  etag?: string,
): Promise<CommitResult | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`;
  const headers: HeadersInit = { Accept: 'application/vnd.github+json' };
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  const res = await fetch(url, { headers });
  if (res.status === 304) {
    return null; // No change
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch latest commit: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { sha: string };
  return {
    sha: data.sha,
    etag: res.headers.get('etag'),
  };
}

/**
 * Fetch the list of changed files between two commits using the compare API.
 * Returns file paths split into changed (added/modified) and removed.
 */
export async function fetchChangedFiles(
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<CompareResult> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${base}...${head}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch compare: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    files?: Array<{ filename: string; status: string }>;
  };

  const changedFiles: string[] = [];
  const removedFiles: string[] = [];

  for (const file of data.files ?? []) {
    if (isBinaryPath(file.filename)) continue;
    if (EXCLUDED_PATHS.some((prefix) => file.filename.startsWith(prefix))) continue;
    if (file.status === 'removed') {
      removedFiles.push(file.filename);
    } else {
      changedFiles.push(file.filename);
    }
  }

  return { changedFiles, removedFiles };
}

/** Return true if the file extension is likely binary (not text). */
function isBinaryPath(path: string): boolean {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = path.slice(lastDot).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
