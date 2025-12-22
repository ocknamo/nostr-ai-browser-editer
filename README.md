# NABE - Nostr AI Browser Editor

A browser-based AI development tool that sends instructions via Nostr and automatically applies changes through GitHub Actions.

## Overview

NABE enables iterative frontend development by:
1. Sending AI instructions from a browser app via Nostr
2. GitHub Actions polls for new instructions
3. Aider (AI CLI tool) applies the changes
4. PRs are automatically created

## Project Structure

```
nostr-ai-browser-editer/
  browser-app/         # Svelte frontend app
  .github/
    template/          # GitHub Actions templates for target repos
  docs/
    design.md          # Full system design document
```

## Quick Start

### 1. Run the Browser App

```bash
cd browser-app
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### 2. Get Your npub

1. Click the menu icon in the header
2. Copy your npub (e.g., `npub1abc...xyz`)

### 3. Setup Your Target Repository

Copy the GitHub Actions workflow to your target repository:

```bash
# In your target repository
mkdir -p .github/workflows
cp path/to/nostr-ai-browser-editer/.github/template/apply-instructions.yml .github/workflows/
```

Register your npub:

1. Go to your repository on GitHub
2. Navigate to Settings -> Secrets and variables -> Actions -> Variables
3. Create a new variable named `AUTHORIZED_NPUB`
4. Set the value to your npub (e.g., `npub1abc123xyz...`)

### 4. Configure GitHub Secrets

In your target repository, go to Settings -> Secrets and variables -> Actions:

- `ANTHROPIC_API_KEY`: Your Claude API key for Aider

### 5. Start Developing

1. Enter your repository name (e.g., `owner/repo`) in the browser app
2. Enter your branch name (e.g., `main` or `feature/new-feature`)
3. Type your AI instruction
4. Click "Send via Nostr"
5. GitHub Actions will poll and apply the changes (within 2 minutes)

## Nostr Event Types

| Kind | Description | Direction |
|------|-------------|-----------|
| 30101 | AI instruction | Browser -> Actions |
| 30102 | AI question | Actions -> Browser |
| 30103 | Question answer | Browser -> Actions |
| 30104 | Completion notification | Actions -> Browser |

## Development

### Browser App Tech Stack

- Svelte + TypeScript
- Vite
- rx-nostr (Nostr client)
- nostr-tools (Nostr utilities)
- StackBlitz SDK (preview embedding)

### Relay

Development uses `wss://yabu.me` as the default relay.

## License

MIT
