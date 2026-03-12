<script lang="ts">
  import Header from './lib/components/Header.svelte';
  import PreviewView from './lib/components/PreviewView.svelte';
  import { loadCurrentSettings, saveCurrentSettings } from './lib/settings-store';

  const initial = loadCurrentSettings();
  let repo = $state(initial.repo);
  let branch = $state(initial.branch || 'main');
  let openFile = $state(initial.openFile);
  let projectRoot = $state(initial.projectRoot);

  /** Auto-save settings whenever any value changes. */
  $effect(() => {
    saveCurrentSettings({ repo, branch, openFile, projectRoot });
  });
</script>

<div class="app">
  <Header bind:repo bind:branch bind:openFile bind:projectRoot />

  <main>
    <PreviewView bind:repo bind:branch bind:openFile bind:projectRoot />
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  main {
    flex: 1;
    overflow: hidden;
  }
</style>
