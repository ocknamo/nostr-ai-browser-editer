/**
 * Polls a GitHub branch for new commits and reports changed files.
 * Uses ETag-based conditional requests to avoid redundant API calls and stay
 * within the 60 requests/hour unauthenticated rate limit.
 * On change, updates the VFS with raw file content and invokes the callback.
 * Bundling / re-rendering is the responsibility of the caller's callback.
 */
import { fetchLatestCommit, fetchChangedFiles, fetchRawFile } from './github-api';
import { vfs } from '../vfs/virtual-fs';

/** Interval between commit checks in milliseconds. */
const POLL_INTERVAL_MS = 60_000;

/** Callback invoked after the VFS has been updated with changed files. */
export type OnUpdateCallback = (changedPaths: string[]) => void | Promise<void>;

export class RepoWatcher {
  private owner: string;
  private repo: string;
  private branch: string;
  private onUpdate: OnUpdateCallback;

  private currentSha = '';
  private currentEtag: string | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(
    owner: string,
    repo: string,
    branch: string,
    onUpdate: OnUpdateCallback,
  ) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
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

  /** Update the watched repository coordinates. */
  updateRef(owner: string, repo: string, branch: string): void {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
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

    if (changedFiles.length === 0 && removedFiles.length === 0) return;

    // Fetch changed files and update VFS with raw content.
    // Bundling is triggered by the caller via the onUpdate callback.
    await Promise.all(
      changedFiles.map(async (path) => {
        try {
          const raw = await fetchRawFile(this.owner, this.repo, this.branch, path);
          vfs.set(path, raw);
        } catch (err) {
          console.warn(`[repo-watcher] Failed to update file ${path}:`, err);
        }
      }),
    );

    for (const path of removedFiles) {
      vfs.delete(path);
    }

    await this.onUpdate([...changedFiles, ...removedFiles]);
  }
}
