<script lang="ts">
  import { fetchRepoTree, fetchRawFile, fetchLatestCommit } from '../github/github-api';
  import { transformFile, initializeEsbuild } from '../preview/esbuild-transformer';
  import { vfs } from '../vfs/virtual-fs';
  import { registerPreviewSW, syncVFSToSW } from '../preview/sw-manager';
  import { RepoWatcher } from '../github/repo-watcher';

  let { repo = $bindable(''), branch = $bindable(''), openFile = $bindable(''), projectRoot = $bindable('') }: {
    repo?: string;
    branch?: string;
    openFile?: string;
    projectRoot?: string;
  } = $props();

  let loading = $state(false);
  let error = $state('');
  let loaded = $state(false);
  let statusMessage = $state('');
  let iframeEl = $state<HTMLIFrameElement | null>(null);

  let watcher: RepoWatcher | null = null;

  // Reset loaded state when repo or branch changes
  $effect(() => {
    if (repo !== undefined && branch !== undefined) {
      loaded = false;
      error = '';
      statusMessage = '';
      stopWatcher();
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

  /** Reload the preview iframe after a VFS update. */
  function reloadIframe(): void {
    if (iframeEl) {
      iframeEl.contentWindow?.location.reload();
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
    const ref = branch.trim() || 'HEAD';
    const root = projectRoot.trim();

    loading = true;
    loaded = false;
    error = '';
    statusMessage = '';
    stopWatcher();
    vfs.clear();

    console.log('[PreviewView] handleLoad start', { owner, repoName, ref, root });

    try {
      // 1. Register Service Worker
      statusMessage = 'Registering service worker...';
      console.log('[PreviewView] step 1: registering SW');
      await registerPreviewSW();
      console.log('[PreviewView] step 1: SW registered');

      // 2. Initialize esbuild-wasm (loads ~7MB wasm binary on first call)
      statusMessage = 'Initializing transpiler...';
      console.log('[PreviewView] step 2: initializing esbuild');
      await initializeEsbuild();
      console.log('[PreviewView] step 2: esbuild ready');

      // 3. Fetch the latest commit SHA for update polling
      statusMessage = 'Fetching repository info...';
      console.log('[PreviewView] step 3: fetchLatestCommit', { owner, repoName, ref });
      const commitResult = await fetchLatestCommit(owner, repoName, ref);
      const sha = commitResult?.sha ?? ref;
      const etag = commitResult?.etag ?? null;
      console.log('[PreviewView] step 3: commit', { sha, etag });

      // 4. Fetch the file tree using the branch ref (not commit SHA).
      // The Git Trees API accepts a branch name or tag as the ref parameter.
      statusMessage = 'Fetching file tree...';
      console.log('[PreviewView] step 4: fetchRepoTree', { owner, repoName, ref });
      const treeFiles = await fetchRepoTree(owner, repoName, ref);
      console.log('[PreviewView] step 4: tree files count', treeFiles.length);

      // Filter to project root subdirectory if specified
      const relevantFiles = root
        ? treeFiles.filter((f) => f.path.startsWith(root + '/'))
        : treeFiles;

      console.log('[PreviewView] relevant files count', relevantFiles.length, 'root:', root || '(none)');

      if (relevantFiles.length === 0) {
        throw new Error(
          root
            ? `No files found under "${root}" in ${owner}/${repoName}`
            : `No files found in ${owner}/${repoName}`,
        );
      }

      // 5. Fetch and transform each file
      const total = relevantFiles.length;
      let done = 0;
      console.log('[PreviewView] step 5: fetching and transforming', total, 'files');

      await Promise.all(
        relevantFiles.map(async (file) => {
          const vfsPath = root ? file.path.slice(root.length + 1) : file.path;
          console.log('[PreviewView] fetching file:', file.path, '->', vfsPath);
          const raw = await fetchRawFile(owner, repoName, ref, file.path);
          const transformed = await transformFile(vfsPath, raw);
          vfs.set(vfsPath, transformed);
          done++;
          statusMessage = `Loading files... (${done}/${total})`;
        }),
      );
      console.log('[PreviewView] step 5: all files loaded');

      // 6. Push VFS to Service Worker
      statusMessage = 'Syncing to service worker...';
      const snapshot = vfs.toSnapshot();
      console.log('[PreviewView] step 6: syncing VFS to SW, entries:', Object.keys(snapshot).length);
      await syncVFSToSW(snapshot);
      console.log('[PreviewView] step 6: SW acknowledged VFS ready');

      // 7. Point the iframe at /preview/
      const entryPath = openFile.trim() ? openFile.trim() : 'index.html';
      console.log('[PreviewView] step 7: setting iframe src to /preview/' + entryPath);
      if (iframeEl) {
        iframeEl.src = `/preview/${entryPath}`;
      } else {
        console.warn('[PreviewView] step 7: iframeEl is null!');
      }

      loaded = true;
      statusMessage = '';

      // 8. Start update watcher
      watcher = new RepoWatcher(owner, repoName, ref, (changedPaths) => {
        console.log('[preview] Files updated:', changedPaths);
        reloadIframe();
      });
      if (commitResult) {
        watcher.setBaseCommit(sha, etag);
      }
      watcher.start();
    } catch (err) {
      console.error('[PreviewView] Load error:', err);
      console.error('[PreviewView] Error type:', typeof err, err instanceof Error ? err.stack : '');
      if (err instanceof Error) {
        error = `Failed to load preview: ${err.message}`;
      } else if (err && typeof err === 'object' && 'errors' in err) {
        // esbuild TransformFailure / BuildFailure shape: { errors: [{ text }] }
        const messages = (err as { errors: Array<{ text: string }> }).errors
          .map((e) => e.text)
          .join('; ');
        error = `Failed to load preview: ${messages || JSON.stringify(err)}`;
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
</script>

<div class="preview-view">
  <div class="controls">
    <button class="load-button" onclick={handleLoad} disabled={loading || !repo.trim()}>
      {#if loading}
        Loading...
      {:else if loaded}
        Reload Preview
      {:else}
        Load Preview
      {/if}
    </button>
    {#if statusMessage && loading}
      <p class="status">{statusMessage}</p>
    {/if}
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>

  <div class="preview-container">
    {#if !loaded && !loading}
      <div class="placeholder">
        <p>Enter a GitHub repository and click "Load Preview"</p>
        <p class="help">Example: facebook/react or https://github.com/owner/repo</p>
        <p class="help">Supports vanilla JS, TypeScript, and JSX projects</p>
      </div>
    {:else if loading}
      <div class="placeholder">
        <p>{statusMessage || 'Loading...'}</p>
      </div>
    {/if}
    <!-- svelte-ignore a11y_missing_attribute -->
    <iframe
      bind:this={iframeEl}
      class="preview-iframe"
      style:display={loaded ? 'block' : 'none'}
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      title="Repository Preview"
    ></iframe>
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

  .load-button {
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

  .preview-iframe {
    width: 100%;
    flex: 1;
    border: none;
    min-height: 0;
  }
</style>
