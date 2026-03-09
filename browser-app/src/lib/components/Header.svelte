<script lang="ts">
  let {
    repo = $bindable(''),
    branch = $bindable(''),
    openFile = $bindable(''),
    projectRoot = $bindable(''),
  }: {
    repo?: string;
    branch?: string;
    openFile?: string;
    projectRoot?: string;
  } = $props();

  let menuOpen = $state(false);

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
        <div class="form-group">
          <label for="menu-project-root">Project Root (optional)</label>
          <input
            id="menu-project-root"
            type="text"
            bind:value={projectRoot}
            placeholder="yakitofu-app"
          />
        </div>
        <div class="form-group">
          <label for="menu-open-file">Open File (optional)</label>
          <input
            id="menu-open-file"
            type="text"
            bind:value={openFile}
            placeholder="src/App.svelte"
          />
        </div>
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
</style>
