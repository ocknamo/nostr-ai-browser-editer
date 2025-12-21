<script lang="ts">
  let { npub = '', activeView = 'chat' as 'chat' | 'preview', onViewChange }: {
    npub?: string;
    activeView?: 'chat' | 'preview';
    onViewChange: (view: 'chat' | 'preview') => void;
  } = $props();
  
  let menuOpen = $state(false);
  
  let shortNpub = $derived(npub ? npub.slice(0, 12) + '...' : 'Loading...');
  
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
    
    <h1>NABE</h1>
    
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
      <div class="menu-item">
        <p class="label-text">Your npub:</p>
        <div class="npub-display">
          <code>{shortNpub}</code>
          <button onclick={copyNpub} title="Copy full npub">
            Copy
          </button>
        </div>
        <p class="help-text">
          Register this npub in .github/authorized_npub of your target repository
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
    padding: 1rem;
  }
  
  h1 {
    font-size: 1.25rem;
    margin: 0;
    font-weight: 700;
  }
  
  .menu-btn {
    background: transparent;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .view-toggle {
    display: flex;
    gap: 0.5rem;
  }
  
  .view-toggle button {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
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
    padding: 1rem;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  
  .menu-item {
    margin-bottom: 1rem;
  }
  
  .menu-item .label-text {
    display: block;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
    opacity: 0.9;
    margin-top: 0;
  }
  
  .npub-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255,255,255,0.1);
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-family: monospace;
    font-size: 0.875rem;
  }
  
  .npub-display code {
    flex: 1;
  }
  
  .npub-display button {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.75rem;
  }
  
  .npub-display button:hover {
    background: rgba(255,255,255,0.3);
  }
  
  .help-text {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    opacity: 0.8;
    line-height: 1.4;
  }
</style>
