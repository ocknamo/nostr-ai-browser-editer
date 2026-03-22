<script lang="ts">
  import sdk from '@stackblitz/sdk';
  import { isTimeoutError, buildStackblitzPath } from '../stackblitz-utils';
  import { parseGitHubRepo } from '../github-utils';
  import { fetchLatestCommit } from '../github/github-api';
  import { RepoWatcher } from '../github/repo-watcher';

  let { repo = $bindable(''), branch = $bindable(''), openFile = $bindable(''), projectRoot = $bindable('') }: {
    repo?: string;
    branch?: string;
    openFile?: string;
    projectRoot?: string;
  } = $props();

  let loading = $state(false);
  let retrying = $state(false);
  let error = $state('');
  let errorDetail = $state('');
  let loaded = $state(false);
  let checking = $state(false);

  // Current incremental update watcher; not reactive (template does not reference it).
  let watcher: RepoWatcher | null = null;

  // Stop watcher and reset UI state when repo or branch changes.
  $effect(() => {
    // Referencing repo and branch registers them as reactive dependencies.
    if (repo !== undefined && branch !== undefined) {
      loaded = false;
      error = '';
      errorDetail = '';
      watcher?.stop();
      watcher = null;
    }
  });

  // Stop watcher when the component is destroyed.
  $effect(() => {
    return () => {
      watcher?.stop();
    };
  });

  async function handleLoad() {
    if (!repo.trim()) {
      error = 'Please enter a repository';
      return;
    }

    // Stop any existing watcher before starting a new embed.
    watcher?.stop();
    watcher = null;

    const MAX_RETRIES = 1;
    loading = true;
    retrying = false;
    error = '';
    errorDetail = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Clear existing preview and get container height.
        const container = document.getElementById('preview-container');
        if (container) {
          container.innerHTML = '';
        }

        // Normalize repo format and build the StackBlitz project path.
        const normalizedRepo = parseGitHubRepo(repo);
        const repoPath = buildStackblitzPath(normalizedRepo, branch, projectRoot);

        // Get container height for full-height iframe.
        const containerHeight = container?.parentElement?.clientHeight || 600;

        const vm = await sdk.embedGithubProject(
          'preview-container',
          repoPath,
          {
            forceEmbedLayout: true,
            view: 'preview',
            height: containerHeight,
            ...(openFile.trim() ? { openFile: openFile.trim() } : {}),
            theme: 'light',
            // Required when the parent page is cross-origin isolated (COOP + COEP headers).
            // This adds allow="cross-origin-isolated" to the embedded iframe element.
            // Without this, the StackBlitz VM connection times out in isolated contexts.
            // See: https://blog.stackblitz.com/posts/cross-browser-with-coop-coep/
            crossOriginIsolated: true,
          },
        );

        loaded = true;
        retrying = false;

        // Start incremental diff polling after a successful embed.
        await startWatcher(normalizedRepo, vm);

        break;
      } catch (err) {
        console.error('StackBlitz error:', err);

        // On the first timeout, silently retry once instead of showing an error.
        if (isTimeoutError(err) && attempt < MAX_RETRIES) {
          retrying = true;
          continue;
        }

        retrying = false;
        if (err instanceof Error) {
          error = `Failed to load preview: ${err.message}`;
          errorDetail = err.stack ?? '';
        } else {
          error = 'Failed to load preview: Unknown error';
          try {
            errorDetail = JSON.stringify(err, null, 2);
          } catch {
            errorDetail = String(err);
          }
        }
      }
    }

    loading = false;
  }

  /**
   * Create and start a RepoWatcher for the embedded VM.
   *
   * Fetches the current HEAD commit to seed the base SHA so the first poll
   * does not perform a redundant compare against an unknown state.
   * If the initial commit fetch fails, the watcher is not started and watcher
   * remains null, preventing silent no-op syncs.
   */
  async function startWatcher(normalizedRepo: string, vm: Awaited<ReturnType<typeof sdk.embedGithubProject>>) {
    const [owner, repoName] = normalizedRepo.split('/');
    if (!owner || !repoName) return;

    try {
      const commit = await fetchLatestCommit(owner, repoName, branch);
      if (!commit) return;

      const newWatcher = new RepoWatcher(owner, repoName, branch, projectRoot);
      newWatcher.setVm(vm);
      newWatcher.setBaseCommit(commit.sha, commit.etag);
      newWatcher.start();
      watcher = newWatcher;
    } catch (err) {
      console.warn('[PreviewView] Could not fetch initial commit for watcher:', err);
    }
  }

  /** Immediately apply any new commits without waiting for the next poll cycle. */
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
          ⏳ Loading...
        {:else if loaded}
          Reload Preview
        {:else}
          ▶ Load Preview
        {/if}
      </button>
      {#if loaded}
        <button class="check-button" onclick={handleCheckNow} disabled={checking || loading}>
          {checking ? 'Syncing...' : 'Sync'}
        </button>
      {/if}
    </div>
    {#if error}
      <p class="error">{error}</p>
      {#if errorDetail}
        <pre class="error-detail">{errorDetail}</pre>
      {/if}
    {/if}
  </div>

  
  <div class="preview-container">
    {#if !loaded && !loading}
      <div class="placeholder">
        <p>Enter a GitHub repository and click "Load Preview"</p>
        <p class="help">Example: facebook/react</p>
      </div>
    {:else if loading && !loaded}
      <div class="placeholder">
        <p>{retrying ? 'Retrying...' : 'Loading StackBlitz preview...'}</p>
        <p class="help">This may take a moment</p>
      </div>
    {/if}
    <div id="preview-container" style:display={loaded || loading ? 'block' : 'none'}></div>
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
    flex: 1;
    padding: 0.5rem;
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
  
  .error {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .error-detail {
    margin-top: 0.25rem;
    padding: 0.5rem;
    background: #fff1f2;
    color: #7f1d1d;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 10rem;
    overflow-y: auto;
  }
  
  .preview-container {
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    text-align: center;
    padding: 2rem;
  }
  
  .placeholder p {
    margin: 0.5rem 0;
  }
  
  .placeholder .help {
    font-size: 0.875rem;
    opacity: 0.7;
  }
  
  #preview-container {
    width: 100%;
    flex: 1;
    min-height: 0;
  }
  
  #preview-container :global(iframe) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
