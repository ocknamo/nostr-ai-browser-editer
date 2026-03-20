<script lang="ts">
  import sdk from '@stackblitz/sdk';
  import type { VM } from '@stackblitz/sdk';
  import { fetchLatestCommit } from '../github/github-api';
  import { RepoWatcher } from '../github/repo-watcher';

  let { repo = $bindable(''), branch = $bindable(''), openFile = $bindable(''), projectRoot = $bindable('') }: {
    repo?: string;
    branch?: string;
    openFile?: string;
    projectRoot?: string;
  } = $props();

  let loading = $state(false);
  let checking = $state(false);
  let error = $state('');
  let loaded = $state(false);
  let statusMessage = $state('');
  let containerEl = $state<HTMLDivElement | null>(null);

  let vm: VM | null = null;
  let watcher: RepoWatcher | null = null;

  // Reset loaded state when repo or branch changes
  $effect(() => {
    if (repo !== undefined && branch !== undefined) {
      loaded = false;
      error = '';
      statusMessage = '';
      stopWatcher();
      vm = null;
    }
  });

  // Clean up watcher on component destroy
  $effect(() => {
    return () => stopWatcher();
  });

  /** Parse a GitHub URL or owner/repo string into owner/repo format. */
  function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
    const trimmed = input.trim();

    // owner/repo format
    if (/^[^/]+\/[^/]+$/.test(trimmed)) {
      const [owner, repoName] = trimmed.split('/');
      return { owner, repo: repoName };
    }

    // https://github.com/owner/repo URL
    try {
      const url = new URL(trimmed);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter((p) => p);
        if (parts.length >= 2) {
          return { owner: parts[0], repo: parts[1] };
        }
      }
    } catch {
      // Not a valid URL
    }

    return null;
  }

  function stopWatcher(): void {
    if (watcher) {
      watcher.stop();
      watcher = null;
    }
  }

  async function handleLoad() {
    if (!repo.trim()) {
      error = 'Please enter a repository';
      return;
    }

    const parsed = parseGitHubRepo(repo);
    if (!parsed) {
      error = 'Invalid repository format. Use "owner/repo" or a GitHub URL.';
      return;
    }

    const { owner, repo: repoName } = parsed;
    const ref = branch.trim() || 'main';
    const root = projectRoot.trim();

    loading = true;
    loaded = false;
    error = '';
    statusMessage = '';
    stopWatcher();
    vm = null;

    try {
      // 1. Fetch the latest commit SHA for update polling
      statusMessage = 'Fetching repository info...';
      const commitResult = await fetchLatestCommit(owner, repoName, ref);
      const sha = commitResult?.sha ?? ref;
      const etag = commitResult?.etag ?? null;

      // 2. Embed via StackBlitz SDK.
      // embedGithubProject handles npm install and starts the dev server internally.
      // The path format mirrors GitHub URLs: owner/repo/tree/branch[/subdir].
      // Slashes in the branch name must NOT be percent-encoded because StackBlitz
      // uses "/" as its own path separator (same as github.com/owner/repo/tree/...).
      const projectPath = root
        ? `${owner}/${repoName}/tree/${ref}/${root}`
        : `${owner}/${repoName}/tree/${ref}`;

      statusMessage = 'Starting preview (npm install in progress)...';

      if (!containerEl) throw new Error('Container element not found');

      // Clear any existing iframe from a previous embed before re-embedding.
      containerEl.innerHTML = '';

      vm = await sdk.embedGithubProject(
        containerEl,
        projectPath,
        {
          view: 'preview',
          hideExplorer: true,
          hideNavigation: true,
          forceEmbedLayout: true,
          crossOriginIsolated: true,
          ...(openFile.trim() ? { openFile: openFile.trim() } : {}),
        },
      );

      loaded = true;
      statusMessage = '';

      // DEBUG: expose vm for manual applyFsDiff testing from the browser console.
      // Usage: await window.__previewVm.applyFsDiff({ create: { 'src/App.svelte': '...' } })
      // Remove before release.
      (window as unknown as Record<string, unknown>)['__previewVm'] = vm;

      // 3. Start polling for new commits; apply file diffs via the VM
      watcher = new RepoWatcher(owner, repoName, ref, vm, root);
      if (commitResult) {
        watcher.setBaseCommit(sha, etag);
      }
      watcher.start();
    } catch (err) {
      if (err instanceof Error) {
        error = `Failed to load preview: ${err.message}`;
      } else {
        try {
          error = `Failed to load preview: ${JSON.stringify(err)}`;
        } catch {
          error = `Failed to load preview: ${String(err)}`;
        }
      }
      loaded = false;
    } finally {
      loading = false;
    }
  }

  /** Manually trigger an immediate commit check and apply any diff to the VM. */
  async function handleCheckNow() {
    if (!watcher) return;
    checking = true;
    await watcher.checkNow();
    checking = false;
  }
</script>

<div class="preview-view">
  <div class="controls">
    <div class="button-row">
      <button class="load-button" onclick={handleLoad} disabled={loading || !repo.trim()}>
        {#if loading}
          Loading...
        {:else if loaded}
          Reload Preview
        {:else}
          Load Preview
        {/if}
      </button>
      {#if loaded}
        <button class="check-button" onclick={handleCheckNow} disabled={checking}>
          {checking ? 'Checking...' : 'Check Updates'}
        </button>
      {/if}
    </div>
    {#if statusMessage && loading}
      <p class="status">{statusMessage}</p>
    {/if}
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>

  <div class="preview-container">
    <!-- StackBlitz iframe is injected into this element. Must always be in the
         DOM and visible so the SDK can measure and embed into it correctly. -->
    <div bind:this={containerEl} class="stackblitz-container"></div>
    <!-- Overlay shown before the embed is ready -->
    {#if !loaded}
      <div class="placeholder">
        {#if loading}
          <p>{statusMessage || 'Loading...'}</p>
        {:else}
          <p>Enter a GitHub repository and click "Load Preview"</p>
          <p class="help">Example: facebook/react or https://github.com/owner/repo</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .preview-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: white;
  }

  .controls {
    padding: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .button-row {
    display: flex;
    gap: 0.5rem;
  }

  .load-button {
    flex: 1;
    width: 100%;
    padding: 0.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .load-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .load-button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .check-button {
    padding: 0.5rem 0.75rem;
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .check-button:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .check-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #eff6ff;
    color: #1e40af;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .error {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .preview-container {
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: white;
    color: #6b7280;
    text-align: center;
    padding: 2rem;
    z-index: 1;
  }

  .placeholder p {
    margin: 0.5rem 0;
  }

  .placeholder .help {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .stackblitz-container {
    width: 100%;
    height: 100%;
  }

  /* StackBlitz injects an iframe; make it fill the container */
  .stackblitz-container :global(iframe) {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
