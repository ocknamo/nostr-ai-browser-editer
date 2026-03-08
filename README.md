# NABE - Nostr AI Browser Editor

> **Note: This project is under active development. Some features described in the roadmap are not yet implemented.**

A browser-based tool for previewing GitHub repositories via StackBlitz.

## Current Status

NABE is transitioning from a Nostr/AI coding workflow to a **StackBlitz preview-focused tool**. The table below shows the current implementation status:

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Remove Nostr/Chat features | ✅ Complete |
| Phase 2 | CD / Public deployment (Cloudflare Pages) | 🚧 Not yet |
| Phase 3 | Fix branch bug in StackBlitz preview | 🚧 Not yet |
| Phase 4 | Configurable open file setting | 🚧 Not yet |
| Phase 5 | UX improvements | 🚧 Not yet |

See [ROADMAP.md](./ROADMAP.md) for details.

## Overview

NABE embeds a StackBlitz preview of any GitHub repository directly in the browser. You can specify a repository and branch, then view and interact with the live preview.

## Project Structure

```
nostr-ai-browser-editer/
  browser-app/         # Svelte frontend app
  .github/
    template/          # GitHub Actions templates (legacy)
  docs/
    design.md          # Full system design document
```

## Quick Start

```bash
cd browser-app
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Usage

1. Click the menu icon in the header
2. Enter a GitHub repository (e.g., `owner/repo` or a GitHub URL)
3. Enter a branch name (e.g., `main`)
4. The StackBlitz preview will load

> **Known issue (Phase 3):** Branch specification is not yet working correctly. The preview always loads the default branch regardless of the branch input.

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
