/**
 * Polls a GitHub branch for new commits and applies file diffs to a StackBlitz VM.
 * Uses ETag-based conditional requests to avoid redundant API calls and stay
 * within the 60 requests/hour unauthenticated rate limit.
 *
 * On a new commit:
 *  - changed/added files are fetched and written via vm.applyFsDiff({ create })
 *  - removed files are passed via vm.applyFsDiff({ destroy })
 *  - Vite HMR inside the WebContainer picks up the changes without a full reload
 */
import type { VM } from '@stackblitz/sdk';
import { fetchLatestCommit, fetchChangedFiles, fetchRawFile } from './github-api';

/** Interval between commit checks in milliseconds. */
const POLL_INTERVAL_MS = 60_000;

/** Optional callback invoked after the VM diff has been applied. */
export type OnUpdateCallback = (changedPaths: string[]) => void;

export class RepoWatcher {
  private owner: string;
  private repo: string;
  private branch: string;
  /** StackBlitz VM used to apply incremental file diffs. */
  private vm: VM;
  /**
   * Repository subdirectory that was passed to embedGithubProject.
   * Changed file paths from the compare API are filtered to this prefix
   * and the prefix is stripped before being sent to vm.applyFsDiff.
   */
  private projectRoot: string;
  private onUpdate: OnUpdateCallback | null;

  private currentSha = '';
  private currentEtag: string | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(
    owner: string,
    repo: string,
    branch: string,
    vm: VM,
    projectRoot = '',
    onUpdate: OnUpdateCallback | null = null,
  ) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.vm = vm;
    this.projectRoot = projectRoot;
    this.onUpdate = onUpdate;
  }

  /**
   * Set the initial known commit SHA (from the load phase) and ETag so the
   * first poll skips an unnecessary compare step.
   */
  setBaseCommit(sha: string, etag: string | null): void {
    this.currentSha = sha;
    this.currentEtag = etag;
  }

  /** Start polling. Has no effect if already running. */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.scheduleNext();
  }

  /** Stop polling and clear state. */
  stop(): void {
    this.active = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.currentSha = '';
    this.currentEtag = null;
  }

  private scheduleNext(): void {
    if (!this.active) return;
    this.timerId = setTimeout(() => {
      this.poll()
        .catch((err) => {
          console.warn('[repo-watcher] Poll error:', err);
        })
        .finally(() => {
          this.scheduleNext();
        });
    }, POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    const result = await fetchLatestCommit(
      this.owner,
      this.repo,
      this.branch,
      this.currentEtag ?? undefined,
    );

    if (result === null) {
      // 304 Not Modified - no change
      return;
    }

    const newSha = result.sha;
    this.currentEtag = result.etag;

    if (!this.currentSha || newSha === this.currentSha) {
      // First poll or SHA unchanged
      this.currentSha = newSha;
      return;
    }

    const baseSha = this.currentSha;
    this.currentSha = newSha;

    const { changedFiles, removedFiles } = await fetchChangedFiles(
      this.owner,
      this.repo,
      baseSha,
      newSha,
    );

    // Filter paths to the project root subdirectory and strip the prefix.
    // Paths that fall outside the root are irrelevant to the embedded project.
    const rootPrefix = this.projectRoot ? `${this.projectRoot}/` : '';
    const toRelative = (p: string) => (rootPrefix ? p.slice(rootPrefix.length) : p);
    const inRoot = (p: string) => !rootPrefix || p.startsWith(rootPrefix);

    const relChanged = changedFiles.filter(inRoot).map(toRelative);
    const relRemoved = removedFiles.filter(inRoot).map(toRelative);

    if (relChanged.length === 0 && relRemoved.length === 0) return;

    // Fetch content for each changed/added file
    const create: Record<string, string> = {};
    await Promise.all(
      relChanged.map(async (relPath) => {
        const repoPath = rootPrefix + relPath;
        try {
          create[relPath] = await fetchRawFile(this.owner, this.repo, this.branch, repoPath);
        } catch (err) {
          console.warn(`[repo-watcher] Failed to fetch ${repoPath}:`, err);
        }
      }),
    );

    // Apply the diff; Vite HMR inside the WebContainer handles the rest
    await this.vm.applyFsDiff({ create, destroy: relRemoved });

    this.onUpdate?.([...relChanged, ...relRemoved]);
  }
}
