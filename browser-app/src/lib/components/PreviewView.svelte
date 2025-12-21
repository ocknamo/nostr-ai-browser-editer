<script lang="ts">
  import sdk from '@stackblitz/sdk';
  
  let { repo = $bindable(''), branch = $bindable('') }: {
    repo?: string;
    branch?: string;
  } = $props();
  
  let loading = $state(false);
  let error = $state('');
  let loaded = $state(false);
  
  async function handleLoad() {
    if (!repo.trim()) {
      error = 'Please enter a repository';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      // Clear existing preview
      const container = document.getElementById('preview-container');
      if (container) {
        container.innerHTML = '';
      }
      
      await sdk.embedGithubProject(
        'preview-container',
        repo,
        {
          forceEmbedLayout: true,
          view: 'preview',
          height: '100%',
          openFile: 'src/App.svelte',
          theme: 'light',
          ...(branch && { startScript: `git checkout ${branch}` })
        }
      );
      loaded = true;
    } catch (err) {
      error = `Failed to load preview: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('StackBlitz error:', err);
    } finally {
      loading = false;
    }
  }
  
  async function handleReload() {
    await handleLoad();
  }
</script>

<div class="preview-view">
  <div class="controls">
    <div class="input-row">
      <div class="input-group">
        <label for="preview-repo">Repository</label>
        <input 
          id="preview-repo"
          type="text"
          bind:value={repo}
          placeholder="owner/repo"
        />
      </div>
      
      <div class="input-group branch">
        <label for="preview-branch">Branch</label>
        <input 
          id="preview-branch"
          type="text"
          bind:value={branch}
          placeholder="main"
        />
      </div>
    </div>
    
    <div class="button-group">
      <button onclick={handleLoad} disabled={loading || !repo.trim()}>
        {#if loading}
          Loading...
        {:else}
          Load Preview
        {/if}
      </button>
      <button onclick={handleReload} disabled={loading || !loaded}>
        Reload
      </button>
    </div>
    
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
  
  <div class="preview-container">
    {#if !loaded && !loading}
      <div class="placeholder">
        <p>Enter a GitHub repository and click "Load Preview"</p>
        <p class="help">Example: facebook/react</p>
      </div>
    {/if}
    <div id="preview-container" class:hidden={!loaded && !loading}></div>
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
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .input-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .input-group {
    flex: 1;
  }
  
  .input-group.branch {
    flex: 0.5;
  }
  
  .input-group label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    margin-bottom: 0.25rem;
  }
  
  .input-group input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    box-sizing: border-box;
  }
  
  .input-group input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
  
  .button-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  
  button {
    padding: 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  button:hover:not(:disabled) {
    background: #2563eb;
  }
  
  button:disabled {
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
  
  .preview-container {
    flex: 1;
    overflow: hidden;
    position: relative;
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
    height: 100%;
  }
  
  .hidden {
    display: none;
  }
</style>
