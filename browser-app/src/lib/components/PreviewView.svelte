<script lang="ts">
  import sdk from '@stackblitz/sdk';
  
  let { repo = $bindable(''), branch = $bindable(''), openFile = $bindable(''), projectRoot = $bindable('') }: {
    repo?: string;
    branch?: string;
    openFile?: string;
    projectRoot?: string;
  } = $props();
  
  let loading = $state(false);
  let error = $state('');
  let errorDetail = $state('');
  let loaded = $state(false);

  // Reset loaded state when repo or branch changes so the stale preview is cleared
  $effect(() => {
    // Referencing repo and branch registers them as reactive dependencies
    if (repo !== undefined && branch !== undefined) {
      loaded = false;
      error = '';
      errorDetail = '';
    }
  });
  
  // Parse GitHub URL to owner/repo format
  function parseGitHubRepo(input: string): string {
    // If it's already in owner/repo format, return as-is
    if (/^[^/]+\/[^/]+$/.test(input.trim())) {
      return input.trim();
    }
    
    // Try to parse GitHub URL
    try {
      const url = new URL(input);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter(p => p);
        if (parts.length >= 2) {
          return `${parts[0]}/${parts[1]}`;
        }
      }
    } catch {
      // Not a valid URL, return as-is
    }
    
    return input.trim();
  }
  
  async function handleLoad() {
    if (!repo.trim()) {
      error = 'Please enter a repository';
      return;
    }
    
    loading = true;
    error = '';
    errorDetail = '';
    
    try {
      // Clear existing preview and get container height
      const container = document.getElementById('preview-container');
      if (container) {
        container.innerHTML = '';
      }
      
      // Normalize repo format and build path with optional branch and project root.
      // StackBlitz supports subdirectory embedding via owner/repo/tree/branch/subdir format.
      const normalizedRepo = parseGitHubRepo(repo);
      // Encode the branch name so slashes (e.g. "claude/fix-foo") become %2F,
      // preventing StackBlitz from misinterpreting path segments as branch vs subdirectory.
      const branchSegment = branch ? `/tree/${encodeURIComponent(branch)}` : '';
      const rootSegment = projectRoot.trim() ? `/${projectRoot.trim()}` : '';
      const repoPath = `${normalizedRepo}${branchSegment}${rootSegment}`;

      // Get container height for full-height iframe
      const containerHeight = container?.parentElement?.clientHeight || 600;

      await sdk.embedGithubProject(
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
          crossOriginIsolated: true
        }
      );
      loaded = true;
    } catch (err) {
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
      console.error('StackBlitz error:', err);
    } finally {
      loading = false;
    }
  }
</script>

<div class="preview-view">
  <div class="controls">
    <button class="load-button" onclick={handleLoad} disabled={loading || !repo.trim()}>
      {#if loading}
        ⏳ Loading...
      {:else if loaded}
        Reload Preview
      {:else}
        ▶ Load Preview
      {/if}
    </button>
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
        <p>⏳ Loading StackBlitz preview...</p>
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
