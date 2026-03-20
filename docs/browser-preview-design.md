# Browser Preview System Design

## Overview

A fully client-side GitHub repository preview system that replaces the StackBlitz SDK dependency.
Allows previewing public GitHub repositories in a browser without any server infrastructure.

## Architecture

```
App (Svelte)
  ├── github/
  │   ├── github-api.ts        GitHub REST API client (Tree + raw content + Commit + Compare)
  │   └── repo-watcher.ts      Commit polling with ETag for incremental updates
  ├── vfs/
  │   └── virtual-fs.ts        In-memory virtual filesystem (Map<path, content>)
  ├── preview/
  │   ├── esbuild-transformer.ts  esbuild-wasm based TypeScript/JSX transpiler
  │   └── sw-manager.ts           Service Worker lifecycle and VFS synchronization
  └── components/
      └── PreviewView.svelte   iframe management, load/reload, status display

public/
  └── preview-sw.js            Service Worker: intercepts /preview/* requests
```

## Data Flow

### Initial Load

```
handleLoad()
  1. Register Service Worker (preview-sw.js at scope /)
  2. Initialize esbuild-wasm
  3. Fetch file tree via GitHub Tree API (1 request)
  4. Fetch each file via raw.githubusercontent.com (N requests, CORS-enabled)
  5. Transform TS/TSX/JSX files with esbuild.transform()
  6. Store all files in VirtualFS
  7. Sync VirtualFS to Service Worker via BroadcastChannel
  8. Set iframe.src = /preview/index.html
  9. Service Worker intercepts /preview/* requests and serves from VirtualFS
```

### Update Detection

```
RepoWatcher (every 60 seconds)
  1. GET /repos/{owner}/{repo}/commits/{branch} with If-None-Match: {etag}
  2. If 304 Not Modified: skip
  3. If SHA changed:
     a. GET /repos/{owner}/{repo}/compare/{base}...{head} (1 request)
     b. For each changed file: fetch from raw.githubusercontent.com
     c. Transform changed TS/TSX/JSX files with esbuild
     d. Update VirtualFS (set/delete)
     e. Notify Service Worker via BroadcastChannel
     f. iframe.contentWindow.location.reload()
```

## Components

### GitHub API (`github-api.ts`)

Uses two endpoints:
- `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
  - Returns full file tree in one request
  - Supports ETag for caching
- `GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
  - Returns raw file content (CORS enabled, no rate limiting)
- `GET https://api.github.com/repos/{owner}/{repo}/commits/{branch}`
  - Used for change detection with ETag
- `GET https://api.github.com/repos/{owner}/{repo}/compare/{base}...{head}`
  - Returns list of changed/added/removed files

Rate limit note: raw.githubusercontent.com does not count against the 60 req/hour GitHub API limit.
Only Tree API, Commit API, and Compare API count toward the limit.

### Virtual Filesystem (`virtual-fs.ts`)

In-memory storage for repository files:

```typescript
class VirtualFS {
  private files: Map<string, string>;  // path -> content (post-transform)
  set(path: string, content: string): void
  get(path: string): string | undefined
  delete(path: string): void
  keys(): string[]
  clear(): void
  toSnapshot(): Record<string, string>  // for SW sync
}
```

### esbuild Transformer (`esbuild-transformer.ts`)

Browser-side TypeScript/JSX transpilation:

```typescript
// Initialize once, reuse for all transforms
await initializeEsbuild();  // loads esbuild.wasm via CDN

// Transform individual files
async function transformFile(path: string, code: string): Promise<string>
// Detects loader from extension: .ts/.tsx/.jsx -> transpile; .js/.html/.css -> passthrough
```

Loaders by extension:
- `.ts` → `ts`
- `.tsx` → `tsx`
- `.jsx` → `jsx`
- `.js`, `.mjs` → `js`
- `.html`, `.css`, `.json` → passthrough (no transform)

### Service Worker (`public/preview-sw.js`)

Intercepts all fetch events for `/preview/*` paths:

1. Look up the requested path in the in-memory VFS (received from main thread via BroadcastChannel)
2. Return the file content with appropriate MIME type
3. For JavaScript responses: rewrite bare imports to esm.sh CDN URLs

Import rewriting (applied by SW to all JS responses):
```javascript
// Before: import React from 'react'
// After:  import React from 'https://esm.sh/react'

// Before: import { useState } from 'react'
// After:  import { useState } from 'https://esm.sh/react'

// Relative imports are left unchanged:
// import './utils.js' -> unchanged
// import '../components/Button.js' -> unchanged
```

### SW Manager (`sw-manager.ts`)

Handles Service Worker registration and VFS synchronization:

```typescript
async function registerPreviewSW(): Promise<ServiceWorkerRegistration>
function syncVFSToSW(snapshot: Record<string, string>): void  // full sync
function updateSWFiles(updated: Record<string, string>, deleted: string[]): void  // incremental
```

Communication via `BroadcastChannel('preview-vfs')`:
- Main thread → SW: `{ type: 'vfs-init', files: Record<string, string> }`
- Main thread → SW: `{ type: 'vfs-update', updated: Record<string, string>, deleted: string[] }`

### Repo Watcher (`repo-watcher.ts`)

Polls for repository changes:

```typescript
class RepoWatcher {
  constructor(
    owner: string,
    repo: string,
    branch: string,
    onUpdate: (changedPaths: string[]) => Promise<void>
  )
  start(): void   // begin polling (60s interval)
  stop(): void    // clear interval, reset state
  updateRef(owner: string, repo: string, branch: string): void
}
```

### PreviewView.svelte (updated)

Replaces StackBlitz SDK with new system:
- `handleLoad()`: initialize all subsystems, fetch repo, render in iframe
- `handleReload()`: re-fetch and re-render (full reload)
- Auto-watch: start RepoWatcher after load, stop on unmount
- Progress display: "Fetching file tree...", "Transforming files...", "Loading preview..."

## PoC Scope

Supported:
- Vanilla HTML / CSS / JavaScript projects
- TypeScript projects (compiled to JS via esbuild-wasm)
- React/JSX projects (compiled + npm deps via esm.sh)
- Public GitHub repositories only

Not supported in PoC:
- `.svelte` files (requires Svelte compiler, not esbuild-wasm)
- `.vue` files (requires Vue compiler)
- Complex build pipelines (webpack config, rollup plugins, etc.)
- Private repositories

## Performance Targets

- Initial load: < 10 seconds (esbuild-wasm ~7MB, cached after first visit)
- Update reflection: < 2 seconds
- API requests per hour: stays within 60 req/hour limit via ETag

## File Exclusions

Files not loaded into VirtualFS:
- `.git/**`
- `node_modules/**`
- Binary files (images, fonts, wasm, etc.)

## Security

- All code execution is sandboxed within the browser iframe
- No server-side execution
- No private repository access (no auth tokens stored)
- Service Worker scope limited to `/preview/` path prefix
