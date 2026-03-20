import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoWatcher } from './repo-watcher';

// Mock the github-api module
vi.mock('./github-api', () => ({
  fetchLatestCommit: vi.fn(),
  fetchChangedFiles: vi.fn(),
  fetchRawFile: vi.fn(),
}));

import {
  fetchChangedFiles,
  fetchLatestCommit,
  fetchRawFile,
} from './github-api';

/** Create a minimal VM mock. */
function makeVm() {
  return { applyFsDiff: vi.fn().mockResolvedValue(undefined) };
}

describe('RepoWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs a warning and returns when start() is called before setVm()', () => {
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setBaseCommit('sha1', '"etag1"');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    watcher.start();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('setVm'),
    );
  });

  it('logs a warning and returns when start() is called before setBaseCommit()', () => {
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setVm(makeVm() as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    watcher.start();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('setBaseCommit'),
    );
  });

  it('does not call applyFsDiff when fetchLatestCommit returns null (304)', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue(null);

    await watcher.checkNow();

    expect(vm.applyFsDiff).not.toHaveBeenCalled();
  });

  it('does not call applyFsDiff when SHA is unchanged', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue({
      sha: 'sha1',
      etag: '"etag2"',
    });

    await watcher.checkNow();

    expect(vm.applyFsDiff).not.toHaveBeenCalled();
  });

  it('calls applyFsDiff when SHA changes', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue({
      sha: 'sha2',
      etag: '"etag2"',
    });
    vi.mocked(fetchChangedFiles).mockResolvedValue({
      changedFiles: ['src/index.ts'],
      removedFiles: [],
    });
    vi.mocked(fetchRawFile).mockResolvedValue('const x = 2;');

    await watcher.checkNow();

    expect(vm.applyFsDiff).toHaveBeenCalledWith({
      create: { 'src/index.ts': 'const x = 2;' },
      destroy: [],
    });
  });

  it('applies removed files to the destroy list', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue({
      sha: 'sha2',
      etag: '"etag2"',
    });
    vi.mocked(fetchChangedFiles).mockResolvedValue({
      changedFiles: [],
      removedFiles: ['src/old.ts'],
    });

    await watcher.checkNow();

    expect(vm.applyFsDiff).toHaveBeenCalledWith({
      create: {},
      destroy: ['src/old.ts'],
    });
  });

  it('filters files to projectRoot prefix and strips the prefix', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', 'packages/app');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue({
      sha: 'sha2',
      etag: '"etag2"',
    });
    vi.mocked(fetchChangedFiles).mockResolvedValue({
      changedFiles: [
        'packages/app/src/main.ts',
        'packages/other/index.ts', // outside projectRoot
      ],
      removedFiles: ['packages/app/src/old.ts'],
    });
    vi.mocked(fetchRawFile).mockResolvedValue('new content');

    await watcher.checkNow();

    expect(vm.applyFsDiff).toHaveBeenCalledWith({
      create: { 'src/main.ts': 'new content' },
      destroy: ['src/old.ts'],
    });
  });

  it('does not call applyFsDiff when no files are in projectRoot', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', 'packages/app');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue({
      sha: 'sha2',
      etag: '"etag2"',
    });
    vi.mocked(fetchChangedFiles).mockResolvedValue({
      changedFiles: ['packages/other/index.ts'],
      removedFiles: [],
    });

    await watcher.checkNow();

    expect(vm.applyFsDiff).not.toHaveBeenCalled();
  });

  it('updates baseSha after a successful diff', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue({
      sha: 'sha2',
      etag: '"etag2"',
    });
    vi.mocked(fetchChangedFiles).mockResolvedValue({
      changedFiles: ['src/a.ts'],
      removedFiles: [],
    });
    vi.mocked(fetchRawFile).mockResolvedValue('content');

    await watcher.checkNow();

    // Second poll: fetchChangedFiles should be called with sha2 as base
    vi.mocked(fetchLatestCommit).mockResolvedValue({
      sha: 'sha3',
      etag: '"etag3"',
    });
    vi.mocked(fetchChangedFiles).mockResolvedValue({
      changedFiles: ['src/b.ts'],
      removedFiles: [],
    });
    vi.mocked(fetchRawFile).mockResolvedValue('content2');

    await watcher.checkNow();

    expect(fetchChangedFiles).toHaveBeenLastCalledWith(
      'owner',
      'repo',
      'sha2',
      'sha3',
    );
  });

  it('stop() prevents further polling', async () => {
    const vm = makeVm();
    const watcher = new RepoWatcher('owner', 'repo', 'main', '');
    watcher.setVm(vm as never);
    watcher.setBaseCommit('sha1', '"etag1"');

    vi.mocked(fetchLatestCommit).mockResolvedValue(null);

    watcher.start();
    watcher.stop();

    // Advance past polling interval
    await vi.advanceTimersByTimeAsync(120_000);

    // fetchLatestCommit should not have been called (timer was cancelled)
    expect(fetchLatestCommit).not.toHaveBeenCalled();
  });
});
