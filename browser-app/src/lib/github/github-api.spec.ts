import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchChangedFiles,
  fetchLatestCommit,
  fetchRawFile,
  fetchRepoTree,
} from './github-api';

describe('fetchLatestCommit', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns sha and etag on 200', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ sha: 'abc123' }), {
        status: 200,
        headers: { ETag: '"etag-value"' },
      }),
    );

    const result = await fetchLatestCommit('owner', 'repo', 'main');
    expect(result).toEqual({ sha: 'abc123', etag: '"etag-value"' });
  });

  it('returns null on 304', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 304 }));

    const result = await fetchLatestCommit('owner', 'repo', 'main', '"etag"');
    expect(result).toBeNull();
  });

  it('sends If-None-Match header when etag is provided', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 304 }));

    await fetchLatestCommit('owner', 'repo', 'main', '"my-etag"');

    const [, options] = mockFetch.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['If-None-Match']).toBe('"my-etag"');
  });

  it('does not send If-None-Match when etag is absent', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ sha: 'abc' }), {
        status: 200,
        headers: {},
      }),
    );

    await fetchLatestCommit('owner', 'repo', 'main');

    const [, options] = mockFetch.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['If-None-Match']).toBeUndefined();
  });

  it('encodes branch name with slashes in URL', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ sha: 'abc' }), {
        status: 200,
        headers: {},
      }),
    );

    await fetchLatestCommit('owner', 'repo', 'claude/fix-foo');

    const [url] = mockFetch.mock.calls[0];
    expect(url as string).toContain('claude%2Ffix-foo');
  });

  it('throws on non-200/304 response', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(fetchLatestCommit('owner', 'repo', 'main')).rejects.toThrow(
      '404',
    );
  });
});

describe('fetchChangedFiles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('separates added/modified files from removed files', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          files: [
            { filename: 'src/index.ts', status: 'modified' },
            { filename: 'src/new.ts', status: 'added' },
            { filename: 'src/old.ts', status: 'removed' },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchChangedFiles('owner', 'repo', 'base', 'head');
    expect(result.changedFiles).toEqual(['src/index.ts', 'src/new.ts']);
    expect(result.removedFiles).toEqual(['src/old.ts']);
  });

  it('excludes binary files', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          files: [
            { filename: 'src/index.ts', status: 'modified' },
            { filename: 'public/logo.png', status: 'modified' },
            { filename: 'fonts/icon.woff2', status: 'added' },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchChangedFiles('owner', 'repo', 'base', 'head');
    expect(result.changedFiles).toEqual(['src/index.ts']);
  });

  it('excludes node_modules paths', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          files: [
            { filename: 'src/index.ts', status: 'modified' },
            { filename: 'node_modules/pkg/index.js', status: 'modified' },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchChangedFiles('owner', 'repo', 'base', 'head');
    expect(result.changedFiles).toEqual(['src/index.ts']);
  });

  it('excludes .git paths', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          files: [
            { filename: 'src/app.ts', status: 'added' },
            { filename: '.git/config', status: 'modified' },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchChangedFiles('owner', 'repo', 'base', 'head');
    expect(result.changedFiles).toEqual(['src/app.ts']);
  });

  it('returns empty arrays when files list is empty', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [] }), { status: 200 }),
    );

    const result = await fetchChangedFiles('owner', 'repo', 'base', 'head');
    expect(result.changedFiles).toEqual([]);
    expect(result.removedFiles).toEqual([]);
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(
      fetchChangedFiles('owner', 'repo', 'base', 'head'),
    ).rejects.toThrow('500');
  });
});

describe('fetchRawFile', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns file text content', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response('const x = 1;', { status: 200 }),
    );

    const result = await fetchRawFile('owner', 'repo', 'src/index.ts', 'main');
    expect(result).toBe('const x = 1;');
  });

  it('fetches from raw.githubusercontent.com', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response('content', { status: 200 }));

    await fetchRawFile('owner', 'repo', 'src/index.ts', 'main');

    const [url] = mockFetch.mock.calls[0];
    expect(url as string).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(
      fetchRawFile('owner', 'repo', 'src/missing.ts', 'main'),
    ).rejects.toThrow('404');
  });
});

describe('fetchRepoTree', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns only blob entries', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tree: [
            { path: 'src', type: 'tree' },
            { path: 'src/index.ts', type: 'blob' },
            { path: 'README.md', type: 'blob' },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchRepoTree('owner', 'repo', 'sha123');
    expect(result).toEqual([
      { path: 'src/index.ts', type: 'blob' },
      { path: 'README.md', type: 'blob' },
    ]);
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(fetchRepoTree('owner', 'repo', 'sha123')).rejects.toThrow(
      '404',
    );
  });
});
