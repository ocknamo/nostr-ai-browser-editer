# Roadmap: StackBlitz Preview 機能の完成

現在の方針: Nostr/AIコーディング機能は一旦廃止し、StackBlitzプレビュー機能に集中する。

---

## 現状調査

### 要件1: リポジトリ＋ブランチでプレビュー表示

**半実装（バグあり）**

`PreviewView.svelte` の `embedGithubProject` 呼び出しに `branch` が渡されていない。
StackBlitz SDK はブランチ指定を `owner/repo/tree/branch` 形式で受け取るが、現在は `owner/repo` のみ渡している。

```ts
// 現状（バグ）
const normalizedRepo = parseGitHubRepo(repo); // → "owner/repo" のみ
await sdk.embedGithubProject('preview-container', normalizedRepo, { ... });

// 修正後
const repoPath = branch ? `${normalizedRepo}/tree/${branch}` : normalizedRepo;
await sdk.embedGithubProject('preview-container', repoPath, { ... });
```

### 要件2: アプリケーションルートの指定

**未実装**

`openFile` が `'src/App.svelte'` にハードコードされており、リポジトリごとに変更できない。

### 要件3: ブランチ最新状態への更新

**半実装**

「Reload Preview」ボタンは存在するが、要件1のバグ（branch未渡し）により最新取得が機能しない。
バグ修正後は `handleLoad()` 再呼び出しで動く想定。

### Nostr/AIコーディング機能

**廃止対象（未対応）**

`App.svelte` に Nostr 初期化・メッセージ管理・チャットロジックが残存。
`Header.svelte` にも npub 表示が含まれる。

---

## フェーズ別ロードマップ

### Phase 1: Nostr・Chat機能の除去

| 対象 | 作業内容 |
|------|---------|
| `App.svelte` | NostrClient import/初期化、messages/npub/currentRequestId state、handleSendInstruction/handleAnswer、ChatView を削除。activeView を `'preview'` 固定に変更 |
| `Header.svelte` | npub表示・コピーボタン・ヘルプテキストを削除。Chat/Preview ビュー切り替えタブを削除 |
| `ChatView.svelte` | ファイルごと削除 |
| `Message.svelte` | ファイルごと削除 |
| `nostr-client.ts` | ファイルごと削除 |
| `package.json` | `rx-nostr`, `rx-nostr-crypto`, `nostr-tools`, `uuid` を削除 |

### Phase 2: ブランチ対応の修正（バグ修正）

| 対象 | 作業内容 |
|------|---------|
| `PreviewView.svelte` | `embedGithubProject` に渡す文字列を `owner/repo/tree/branch` 形式に修正 |
| `Header.svelte` | ブランチ入力欄は残す |

### Phase 3: アプリケーションルート設定の追加

| 対象 | 作業内容 |
|------|---------|
| `App.svelte` | `openFile` state を追加、PreviewView に渡す |
| `Header.svelte` | メニューに「Open File」入力欄を追加（例: `src/main.ts`、空欄で省略） |
| `PreviewView.svelte` | `openFile` を props で受け取り SDK に渡す。空欄の場合は省略 |

### Phase 4: UX改善

| 対象 | 作業内容 |
|------|---------|
| `PreviewView.svelte` | リポジトリ/ブランチ変更時に `loaded` を自動リセット（古いプレビューが残る問題の防止） |
| `Header.svelte` | 設定変更後に再ロードが必要な旨の視覚的フィードバック（任意） |

### Phase 5: CD（継続的デプロイ）と公開

**候補ホスティング: Cloudflare Pages（推奨）**

#### 5-1. ビルド設定の整備

| 対象 | 作業内容 |
|------|---------|
| `package.json` | `build` スクリプトが `vite build` になっていることを確認 |
| `vite.config.ts` | `base` パスを本番URL向けに調整（必要な場合） |

#### 5-2. Cloudflare Pages セットアップ

| 対象 | 作業内容 |
|------|---------|
| Cloudflare Dashboard | GitHub リポジトリを連携し Pages プロジェクトを作成 |
| ビルド設定 | Build command: `npm run build` / Output directory: `dist` |
| 環境変数 | 必要な環境変数を Cloudflare Pages の Settings → Environment Variables に設定 |

#### 5-3. GitHub Actions による CD パイプライン（任意）

Cloudflare Pages の Git 連携（自動ビルド）で十分な場合は省略可。
追加制御が必要な場合は `.github/workflows/deploy.yml` を作成。

```yaml
# .github/workflows/deploy.yml（例）
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy dist --project-name=<project-name>
```

#### 5-4. プレビューデプロイ

| 機能 | 説明 |
|------|------|
| PR プレビュー | Cloudflare Pages は PR ごとに自動でプレビューURLを発行（追加設定不要） |
| 本番デプロイ | `main` ブランチへのマージで自動デプロイ |

---

## 実装優先順位

```
Phase 1（Nostr除去）→ Phase 2（ブランチバグ修正）→ Phase 3（openFile設定）→ Phase 4（UX改善）→ Phase 5（CD・公開）
```

Phase 1・2 は既存コードの修正・削除のみでリスクが低い。
Phase 3 が今回の主要な新機能追加。
Phase 5 は Phase 1〜4 が完了し動作確認できた段階で実施する。
