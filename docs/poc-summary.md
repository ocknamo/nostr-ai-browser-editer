# PoC Summary: GitHub Repository Browser Preview

## Overview

This document summarizes the proof-of-concept for a browser-based application that
embeds a live preview of any public GitHub repository using the StackBlitz WebContainer
SDK, with automatic incremental updates when new commits are pushed.

**PoC Goal**: Verify that a purely client-side app can:
1. Embed a full dev server (npm install + Vite) for any GitHub repo inside an iframe
2. Apply incremental file diffs from new commits to the running environment without a reload
3. Persist user settings across sessions with no backend

**Result**: All three goals confirmed. The app runs with zero backend infrastructure.

---

## Technology Stack

| Role | Package | Version |
|------|---------|---------|
| Framework | Svelte | 5 (Runes API) |
| Language | TypeScript | ~5.9 |
| Build tool | Vite | ^7 |
| Preview SDK | @stackblitz/sdk | ^1.11 |

---

## Architecture

```
Browser
  App.svelte                 -- root state (repo, branch, openFile, projectRoot)
    Header.svelte            -- settings inputs + project profiles
    PreviewView.svelte       -- StackBlitz embed + update polling
      github-api.ts          -- GitHub REST API client
      repo-watcher.ts        -- 60s polling + vm.applyFsDiff
  settings-store.ts          -- localStorage persistence
```

No backend. All GitHub API calls are unauthenticated public REST.

---

## Key Implementation Details

### 1. Embedding a GitHub Repo (PreviewView.svelte)

`sdk.embedGithubProject(containerEl, path, options)` boots a full WebContainer
(Linux VM in the browser) that runs npm install and the project's dev server.

**Path format**:
```
owner/repo/tree/branch
owner/repo/tree/branch/subdir    (when projectRoot is set)
```

**Critical**: branch name slashes must NOT be percent-encoded.
`feature/foo` stays as `feature/foo`. StackBlitz uses `/` as its own path separator
(same as github.com URLs). Encoding it with `%2F` causes a "Invalid Element" error.

**SDK options used**:
```typescript
{
  view: 'preview',          // show only the running app, not the editor
  hideExplorer: true,
  hideNavigation: true,
  forceEmbedLayout: true,
  crossOriginIsolated: true, // improves stability
  openFile: 'path',         // optional: file to highlight in editor
}
```

**Container management**: call `containerEl.innerHTML = ''` before re-embedding to
remove the old iframe. The container `<div>` must always be in the DOM (never
conditionally rendered) or the SDK cannot measure it.

**Global iframe style** (CSS global selector required because the iframe is injected by the SDK):
```css
.stackblitz-container :global(iframe) {
  width: 100%;
  height: 100%;
  border: none;
}
```

### 2. Incremental Diff Updates (repo-watcher.ts)

After a successful embed the app stores the base commit SHA and starts a 60-second
polling loop.

**Poll sequence**:
1. `GET /repos/{owner}/{repo}/commits/{branch}` with `If-None-Match: <etag>`
   - Returns 304 if no change (zero cost)
   - Returns new SHA + fresh ETag on change
2. If SHA changed: `GET /repos/{owner}/{repo}/compare/{base}...{head}`
   - Separates files into `changedFiles` (added/modified) and `removedFiles`
   - Filters to `projectRoot` prefix; strips prefix before passing to VM
3. Fetch changed file content from `raw.githubusercontent.com` in parallel (no auth, no rate limit)
4. `vm.applyFsDiff({ create: { path: content }, destroy: [path] })`
   - Vite HMR inside the WebContainer picks up changes without a full reload

**Rate limit**: unauthenticated GitHub API = 60 req/hour. At 60s intervals, a single
repo uses at most 1 req/minute = 60/hr, exactly at the limit. For 304 responses this
does not consume the quota.

**ETag base commit**: call `watcher.setBaseCommit(sha, etag)` after embed and before
`watcher.start()` to seed the initial SHA. Without this the first poll always performs
a redundant compare.

**checkNow()**: added for manual triggering from the UI. Runs `poll()` immediately
without resetting the scheduled timer.

### 3. GitHub API (github-api.ts)

Four functions:

| Function | Endpoint | Notes |
|----------|----------|-------|
| `fetchLatestCommit` | `GET /repos/.../commits/{branch}` | ETag support, returns null on 304 |
| `fetchChangedFiles` | `GET /repos/.../compare/{base}...{head}` | Splits removed vs changed |
| `fetchRawFile` | `raw.githubusercontent.com` | CORS-ok, no rate limit |
| `fetchRepoTree` | `GET /repos/.../git/trees/{sha}?recursive=1` | Used only for full VFS (not in current flow) |

Binary file detection: check extension against a hardcoded set (.png, .woff, .wasm, etc.).
Excluded paths: `.git/`, `node_modules/`.

Branch names are `encodeURIComponent`-encoded when used inside API URL path segments
(unlike the StackBlitz path where they must not be encoded).

### 4. Settings Persistence (settings-store.ts)

Two localStorage keys:

| Key | Value | When written |
|-----|-------|-------------|
| `nostr-ai-browser-editer:current-settings` | `CurrentSettings` JSON | Every `$effect` change in App |
| `nostr-ai-browser-editer:project-profiles` | `ProjectProfile[]` JSON | On explicit save/delete |

All reads/writes are wrapped in try/catch and silently ignore errors (private browsing
quota limits). Reads return defaults (`{ repo:'', branch:'', openFile:'', projectRoot:'' }`)
on any failure.

Profile IDs are `String(Date.now())`.

### 5. State Management (Svelte 5 Runes)

App.svelte holds the four root values as `$state`. A single `$effect` auto-saves:
```typescript
$effect(() => {
  saveCurrentSettings({ repo, branch, openFile, projectRoot });
});
```

Components receive props via `$props()` with `$bindable()`. Header writes back via
two-way binding; PreviewView reads only.

PreviewView resets itself when repo/branch changes:
```typescript
$effect(() => {
  if (repo !== undefined && branch !== undefined) {
    loaded = false;
    error = '';
    stopWatcher();
    vm = null;
  }
});
```

---

## What Was Tried and Discarded

### Custom browser preview (esbuild-wasm + Service Worker)

An earlier branch replaced the StackBlitz SDK with a self-contained pipeline:
1. Fetch all repo files into an in-memory VFS
2. Transform TypeScript/JSX with esbuild-wasm (running inside a Web Worker)
3. A Service Worker intercepts `fetch` for `/preview/*` and serves from VFS
4. Bare imports rewritten to `esm.sh` CDN URLs

**Why it was reverted**:
- esbuild-wasm initialization is flaky (WASM fetch timing, `SharedArrayBuffer` requirements)
- Service Worker registration/activation lifecycle caused race conditions with the iframe
- Cannot replicate `npm install` behavior; framework-specific server-side features break
- Debugging overhead was high and not the PoC focus

**Conclusion**: StackBlitz SDK handles all of this more reliably. The custom approach
would only be worth revisiting if the requirement is to work with private repos or
without the StackBlitz service.

---

## Known Limitations

| Limitation | Detail |
|-----------|--------|
| Public repos only | GitHub API and StackBlitz both require no auth for this flow |
| Rate limit | 60 unauthenticated req/hr; only one repo/branch can be watched at a time |
| StackBlitz dependency | Live preview depends on external stackblitz.com service |
| No tests | Vitest is configured but no specs are written yet |
| `window.__previewVm` | Debug global left in; must be removed before release |
| Polling only | No webhook/SSE; up to 60s delay before changes appear |

---

## Rebuild Guide

To rebuild this application from scratch:

1. Scaffold: `npm create vite@latest browser-app -- --template svelte-ts`

2. Install: `npm install @stackblitz/sdk`

3. Create these files (in order of dependency):

   ```
   src/lib/settings-store.ts      -- localStorage helpers (no imports from the project)
   src/lib/github/github-api.ts   -- GitHub REST client (no imports from the project)
   src/lib/github/repo-watcher.ts -- depends on github-api.ts + @stackblitz/sdk VM type
   src/lib/components/Header.svelte     -- depends on settings-store.ts
   src/lib/components/PreviewView.svelte -- depends on github-api.ts + repo-watcher.ts
   src/App.svelte                 -- root, depends on Header + PreviewView + settings-store
   ```

4. Key decisions to reproduce correctly:
   - Do NOT encode branch name slashes in the StackBlitz path
   - DO encode branch name when calling the GitHub API (`encodeURIComponent`)
   - Keep the StackBlitz container `<div>` always in the DOM
   - Call `containerEl.innerHTML = ''` before each embed
   - Call `watcher.setBaseCommit(sha, etag)` before `watcher.start()`
   - Wrap all localStorage calls in try/catch

5. `vite.config.ts` must exclude esbuild-wasm from pre-bundling:
   ```typescript
   optimizeDeps: { exclude: ['esbuild-wasm'] }
   ```

---

## Next Steps

- Phase 2: Deploy to Cloudflare Pages (no config needed; static single-page app)
- FW-1: Nostr login to persist project profiles on a relay
- FW-2: AI instruction workflow (original product vision)
- Tests: Write Vitest specs for `github-api.ts` and `repo-watcher.ts`
- Remove `window.__previewVm` debug global before release
