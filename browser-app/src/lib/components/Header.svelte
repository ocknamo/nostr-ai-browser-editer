<script lang="ts">
  import {
    loadProjectProfiles,
    saveProjectProfile,
    deleteProjectProfile,
    type ProjectProfile,
  } from '../settings-store';
  import { parseGitHubRepo } from '../github-utils';

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
  let saveDialogOpen = $state(false);
  let saveName = $state('');
  let selectedProfileId = $state('');
  let profiles = $state<ProjectProfile[]>(loadProjectProfiles());
  let dialogEl = $state<HTMLDialogElement | null>(null);

  let normalizedRepo = $derived(parseGitHubRepo(repo));
  let shortRepo = $derived(normalizedRepo ? (normalizedRepo.length > 18 ? normalizedRepo.slice(0, 18) + '…' : normalizedRepo) : '');

  /** Build a default save name from the current repo and branch values. */
  function buildDefaultName(): string {
    const r = normalizedRepo || repo;
    const b = branch || 'main';
    return r ? `${r}:${b}` : b;
  }

  /** Open the save dialog and populate the name field with a default value. */
  function openSaveDialog() {
    saveName = buildDefaultName();
    saveDialogOpen = true;
    // showModal() must run after the dialog is rendered.
    setTimeout(() => dialogEl?.showModal(), 0);
  }

  /** Close the save dialog. */
  function closeSaveDialog() {
    dialogEl?.close();
    saveDialogOpen = false;
  }

  /** Save the current settings as a new project profile. */
  function handleSave() {
    if (!saveName.trim()) return;
    saveProjectProfile({
      name: saveName.trim(),
      repo,
      branch,
      openFile,
      projectRoot,
    });
    profiles = loadProjectProfiles();
    closeSaveDialog();
  }

  /** Load the selected profile's settings into the active fields. */
  function handleLoad() {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return;
    repo = profile.repo;
    branch = profile.branch;
    openFile = profile.openFile;
    projectRoot = profile.projectRoot;
  }

  /** Delete the selected profile. */
  function handleDelete() {
    if (!selectedProfileId) return;
    deleteProjectProfile(selectedProfileId);
    profiles = loadProjectProfiles();
    selectedProfileId = '';
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
  </div>

  {#if menuOpen}
    <div class="menu">
      <div class="menu-section">
        <div class="section-header">
          <p class="section-title">Repository Settings</p>
          <button class="save-btn" onclick={openSaveDialog}>現在の設定を保存</button>
        </div>
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

      <div class="menu-section projects-section">
        <p class="section-title">Projects</p>
        {#if profiles.length === 0}
          <p class="no-profiles">保存済みプロジェクトはありません</p>
        {:else}
          <div class="projects-row">
            <select bind:value={selectedProfileId} class="profile-select">
              <option value="">-- プロジェクトを選択 --</option>
              {#each profiles as profile (profile.id)}
                <option value={profile.id}>{profile.name}</option>
              {/each}
            </select>
            <button
              class="action-btn"
              onclick={handleLoad}
              disabled={!selectedProfileId}
            >読込</button>
            <button
              class="action-btn danger"
              onclick={handleDelete}
              disabled={!selectedProfileId}
            >削除</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</header>

{#if saveDialogOpen}
  <dialog bind:this={dialogEl} onclose={closeSaveDialog}>
    <p class="dialog-title">設定を保存</p>
    <div class="form-group">
      <label for="save-name">名前</label>
      <input
        id="save-name"
        type="text"
        bind:value={saveName}
        placeholder="プロジェクト名"
      />
    </div>
    <div class="dialog-actions">
      <button class="dialog-btn cancel" onclick={closeSaveDialog}>キャンセル</button>
      <button class="dialog-btn confirm" onclick={handleSave} disabled={!saveName.trim()}>保存</button>
    </div>
  </dialog>
{/if}

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

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .section-title {
    font-size: 0.75rem;
    margin: 0;
    opacity: 0.9;
    font-weight: 500;
  }

  .save-btn {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    font-size: 0.65rem;
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .save-btn:hover {
    background: rgba(255,255,255,0.25);
  }

  .form-row {
    display: flex;
    gap: 0.5rem;
  }

  .form-group {
    flex: 1;
    margin-bottom: 0.5rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
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

  .projects-section {
    border-top: 1px solid rgba(255,255,255,0.15);
    padding-top: 0.6rem;
  }

  .projects-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.4rem;
    min-width: 0;
  }

  .profile-select {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    background: rgba(255,255,255,0.9);
    cursor: pointer;
  }

  .action-btn {
    flex-shrink: 0;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    font-size: 0.7rem;
    padding: 0.3rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .action-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.25);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-btn.danger:hover:not(:disabled) {
    background: rgba(239,68,68,0.5);
  }

  .no-profiles {
    font-size: 0.7rem;
    opacity: 0.6;
    margin: 0.3rem 0 0;
  }

  /* Dialog */
  dialog {
    background: #1e40af;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 1.25rem;
    width: 300px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }

  dialog::backdrop {
    background: rgba(0,0,0,0.4);
  }

  .dialog-title {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0 0 1rem;
  }

  dialog .form-group input {
    background: rgba(255,255,255,0.9);
  }

  dialog .form-group label {
    opacity: 0.85;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .dialog-btn {
    font-size: 0.75rem;
    padding: 0.4rem 0.75rem;
    border-radius: 0.25rem;
    cursor: pointer;
    border: none;
  }

  .dialog-btn.cancel {
    background: rgba(255,255,255,0.15);
    color: white;
  }

  .dialog-btn.cancel:hover {
    background: rgba(255,255,255,0.25);
  }

  .dialog-btn.confirm {
    background: white;
    color: #1e40af;
    font-weight: 600;
  }

  .dialog-btn.confirm:hover:not(:disabled) {
    background: #e0e7ff;
  }

  .dialog-btn.confirm:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
