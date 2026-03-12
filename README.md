# NABE - Nostr AI Browser Editor

A browser-based tool for previewing GitHub repositories via StackBlitz.

## Current Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Remove Nostr/Chat features | ✅ Complete |
| Phase 2 | CD / Public deployment (Cloudflare Pages) | 🚧 Not yet |
| Phase 3 | Fix branch bug in StackBlitz preview | ✅ Complete |
| Phase 4 | Configurable open file setting | ✅ Complete |
| Phase 5 | UX improvements | ✅ Complete |

See [ROADMAP.md](./ROADMAP.md) for details.

## Overview

NABE embeds a StackBlitz preview of any GitHub repository directly in the browser. You can specify a repository, branch, open file, and project root, then view and interact with the live preview. Settings are persisted to localStorage and can be saved as named project profiles.

## Project Structure

```
nostr-ai-browser-editer/
  browser-app/         # Svelte frontend app
    src/
      App.svelte       # Root component with state management
      main.ts          # Entry point
      lib/
        settings-store.ts       # localStorage persistence
        components/
          Header.svelte          # Header with settings menu and project profiles
          PreviewView.svelte     # StackBlitz SDK integration
  docs/
    design.md          # Legacy system design document (deprecated)
```

## Quick Start

```bash
cd browser-app
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Usage

1. Click the menu icon in the header to open the settings panel
2. Enter a GitHub repository (e.g., `owner/repo` or a full GitHub URL)
3. Optionally enter a branch name, open file path, and project root (subdirectory)
4. Click **Load Preview** to embed the repository in StackBlitz

#### Project Profiles

- Click **Save Profile** to save the current settings under a name
- Select a saved profile from the dropdown to restore its settings
- Click the delete button next to a profile to remove it

## Development

### Tech Stack

- Svelte 5 + TypeScript
- Vite
- StackBlitz SDK (preview embedding)

### Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run check    # Type check (svelte-check + tsc)
```

## License

MIT
