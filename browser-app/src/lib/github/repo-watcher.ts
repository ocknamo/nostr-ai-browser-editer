/**
 * RepoWatcher polls a GitHub branch for new commits and applies incremental
 * file diffs to a running StackBlitz VM via vm.applyFsDiff().
 *
 * Usage:
 *   const watcher = new RepoWatcher('owner', 'repo', 'main', 'packages/app');
 *   watcher.setVm(vm);
 *   watcher.setBaseCommit(sha, etag); // seed initial state after embed
 *   watcher.start();
 *   // ...later...
 *   watcher.stop();
 */

import type { VM } from '@stackblitz/sdk';
import {
  fetchChangedFiles,
  fetchLatestCommit,
  fetchRawFile,
} from './github-api';

/** Polling interval in milliseconds (60 seconds). */
const POLL_INTERVAL_MS = 60_000;

export class RepoWatcher {
  private readonly owner: string;
  private readonly repo: string;
  private readonly branch: string;
  private readonly projectRoot: string;

  private vm: VM | null = null;
  private baseSha: string | null = null;
  private baseEtag: string | undefined = undefined;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    owner: string,
    repo: string,
    branch: string,
    projectRoot: string,
  ) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.projectRoot = projectRoot;
  }

  /**
   * Set the StackBlitz VM instance that will receive applyFsDiff calls.
   * Must be called before start().
   */
  setVm(vm: VM): void {
    this.vm = vm;
  }

  /**
   * Seed the initial commit SHA and ETag so the first poll does not perform
   * a redundant compare against an unknown base.
   * Must be called before start().
   */
  setBaseCommit(sha: string, etag: string): void {
    this.baseSha = sha;
    this.baseEtag = etag;
  }

  /**
   * Start the polling loop. Logs a warning and returns early if the VM or
   * base commit has not been set.
   */
  start(): void {
    if (!this.vm) {
      console.warn('[RepoWatcher] start() called before setVm()');
      return;
    }
    if (!this.baseSha) {
      console.warn('[RepoWatcher] start() called before setBaseCommit()');
      return;
    }
    this.running = true;
    this.scheduleNext();
  }

  /** Stop the polling loop. */
  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Run a poll immediately without resetting the scheduled timer.
   * Useful for a manual "check now" button in the UI.
   */
  async checkNow(): Promise<void> {
    await this.poll();
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timerId = setTimeout(async () => {
      await this.poll();
      this.scheduleNext();
    }, POLL_INTERVAL_MS);
  }

  /**
   * One poll cycle:
   * 1. Fetch the latest commit SHA (ETag-gated; 304 = no change).
   * 2. If SHA changed, fetch the diff between baseSha and newSha.
   * 3. Filter files to the projectRoot prefix and strip the prefix.
   * 4. Fetch changed file contents in parallel.
   * 5. Apply the diff via vm.applyFsDiff().
   * 6. Update baseSha and baseEtag.
   */
  private async poll(): Promise<void> {
    if (!this.vm || !this.baseSha) return;

    try {
      const commit = await fetchLatestCommit(
        this.owner,
        this.repo,
        this.branch,
        this.baseEtag,
      );

      // 304 Not Modified — no change
      if (commit === null) return;

      const newSha = commit.sha;
      const newEtag = commit.etag;

      // SHA unchanged (ETag collision or re-seeded SHA)
      if (newSha === this.baseSha) {
        this.baseEtag = newEtag;
        return;
      }

      const { changedFiles, removedFiles } = await fetchChangedFiles(
        this.owner,
        this.repo,
        this.baseSha,
        newSha,
      );

      const prefix = this.projectRoot ? `${this.projectRoot}/` : '';

      /** Strip the projectRoot prefix from a path. */
      const stripPrefix = (path: string): string =>
        prefix ? path.slice(prefix.length) : path;

      /** Keep only paths inside the projectRoot. */
      const filterPath = (path: string): boolean =>
        prefix ? path.startsWith(prefix) : true;

      const filteredChanged = changedFiles.filter(filterPath);
      const filteredRemoved = removedFiles.filter(filterPath);

      if (filteredChanged.length === 0 && filteredRemoved.length === 0) {
        this.baseSha = newSha;
        this.baseEtag = newEtag;
        return;
      }

      // Fetch all changed file contents in parallel
      const contentEntries = await Promise.all(
        filteredChanged.map(async (path) => {
          const content = await fetchRawFile(
            this.owner,
            this.repo,
            path,
            newSha,
          );
          return [stripPrefix(path), content] as [string, string];
        }),
      );

      const createMap: Record<string, string> =
        Object.fromEntries(contentEntries);
      const destroyList = filteredRemoved.map(stripPrefix);

      await this.vm.applyFsDiff({
        create: createMap,
        destroy: destroyList,
      });

      this.baseSha = newSha;
      this.baseEtag = newEtag;
    } catch (err) {
      console.error('[RepoWatcher] poll error:', err);
    }
  }
}
