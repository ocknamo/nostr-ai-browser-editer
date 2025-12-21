<script lang="ts">
  let { 
    npub = '', 
    activeView = 'chat' as 'chat' | 'preview', 
    repo = $bindable(''),
    branch = $bindable(''),
    onViewChange 
  }: {
    npub?: string;
    activeView?: 'chat' | 'preview';
    repo?: string;
    branch?: string;
    onViewChange: (view: 'chat' | 'preview') => void;
  } = $props();
  
  let menuOpen = $state(false);
  
  let shortNpub = $derived(npub ? npub.slice(0, 12) + '...' : 'Loading...');
  
  // Parse GitHub URL to owner/repo format
  function parseGitHubRepo(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    if (/^[^/]+\/[^/]+$/.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter(p => p);
        if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
      }
    } catch { /* ignore */ }
    return trimmed;
  }
  
  let normalizedRepo = $derived(parseGitHubRepo(repo));
  let shortRepo = $derived(normalizedRepo ? (normalizedRepo.length > 18 ? normalizedRepo.slice(0, 18) + '…' : normalizedRepo) : '');
  
  function copyNpub() {
    navigator.clipboard.writeText(npub);
  }
</script>

<header>
  <div class="header-content">
    <button class="menu-btn" onclick={() => menuOpen = !menuOpen}>
      {#if menuOpen}
        &#x2715;
      {:else}
        &#9776;
      {/if}
    </button>
    
    <div class="center-info">
      <h1>NABE</h1>
      {#if shortRepo || branch}
        <span class="repo-info">
          {shortRepo}{#if shortRepo && branch}:{/if}{branch}
        </span>
      {/if}
    </div>
    
    <div class="view-toggle">
      <button 
        class:active={activeView === 'chat'}
        onclick={() => onViewChange('chat')}
        aria-label="Chat view"
      >
        Chat
      </button>
      <button 
        class:active={activeView === 'preview'}
        onclick={() => onViewChange('preview')}
        aria-label="Preview view"
      >
        Preview
      </button>
    </div>
  </div>
  
  {#if menuOpen}
    <div class="menu">
      <div class="menu-section">
        <p class="section-title">Repository Settings</p>
        <div class="form-row">
          <div class="form-group">
            <label for="menu-repo">Repository</label>
            <input 
              id="menu-repo"
              type="text"
              bind:value={repo}
              placeholder="owner/repo or GitHub URL"
            />
          </div>
          <div class="form-group branch">
            <label for="menu-branch">Branch</label>
            <input 
              id="menu-branch"
              type="text"
              bind:value={branch}
              placeholder="main"
            />
          </div>
        </div>
      </div>
      
      <div class="menu-section">
        <p class="section-title">Your npub</p>
        <div class="npub-display">
          <code>{shortNpub}</code>
          <button onclick={copyNpub} title="Copy full npub">
            Copy
          </button>
        </div>
        <p class="help-text">
          Register this npub in .github/authorized_npub
        </p>
      </div>
    </div>
  {/if}
</header>

<style>
  header {
    background: #3b82f6;
    color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    height: 50px;
    box-sizing: border-box;
  }
  
  .center-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  h1 {
    font-size: 1rem;
    margin: 0;
    font-weight: 700;
  }
  
  .repo-info {
    font-size: 0.7rem;
    opacity: 0.8;
    background: rgba(255,255,255,0.15);
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    font-family: monospace;
  }
  
  .menu-btn {
    background: transparent;
    border: none;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }
  
  .view-toggle {
    display: flex;
    gap: 0.25rem;
  }
  
  .view-toggle button {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .view-toggle button:hover {
    background: rgba(255,255,255,0.2);
  }
  
  .view-toggle button.active {
    background: rgba(255,255,255,0.3);
  }
  
  .menu {
    background: #2563eb;
    padding: 0.75rem;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  
  .menu-section {
    margin-bottom: 0.75rem;
  }
  
  .menu-section:last-child {
    margin-bottom: 0;
  }
  
  .section-title {
    font-size: 0.75rem;
    margin: 0 0 0.5rem 0;
    opacity: 0.9;
    font-weight: 500;
  }
  
  .form-row {
    display: flex;
    gap: 0.5rem;
  }
  
  .form-group {
    flex: 1;
  }
  
  .form-group.branch {
    flex: 0.4;
  }
  
  .form-group label {
    display: block;
    font-size: 0.65rem;
    margin-bottom: 0.25rem;
    opacity: 0.8;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    background: rgba(255,255,255,0.9);
    box-sizing: border-box;
  }
  
  .form-group input:focus {
    outline: none;
    background: white;
  }
  
  .npub-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255,255,255,0.1);
    padding: 0.5rem;
    border-radius: 0.375rem;
    font-family: monospace;
    font-size: 0.75rem;
  }
  
  .npub-display code {
    flex: 1;
  }
  
  .npub-display button {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.65rem;
  }
  
  .npub-display button:hover {
    background: rgba(255,255,255,0.3);
  }
  
  .help-text {
    margin: 0.4rem 0 0 0;
    font-size: 0.65rem;
    opacity: 0.7;
    line-height: 1.3;
  }
</style>
