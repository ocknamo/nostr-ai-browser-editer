/**
 * Service Worker: virtual file server for GitHub repository preview.
 * Intercepts fetch requests to /preview/* and serves files from the in-memory VFS.
 * Also rewrites bare npm imports to esm.sh CDN URLs for JavaScript responses.
 */

/** In-memory virtual filesystem: path -> content */
const vfsFiles = new Map();

/** BroadcastChannel for receiving VFS updates from the main thread. */
const channel = new BroadcastChannel('preview-vfs');

channel.addEventListener('message', (event) => {
  const { type, files, updated, deleted } = event.data;

  if (type === 'vfs-init') {
    // Full filesystem sync - replace all existing files
    vfsFiles.clear();
    for (const [path, content] of Object.entries(files)) {
      vfsFiles.set(path, content);
    }
  } else if (type === 'vfs-update') {
    // Incremental update - apply changed and deleted files
    if (updated) {
      for (const [path, content] of Object.entries(updated)) {
        vfsFiles.set(path, content);
      }
    }
    if (deleted) {
      for (const path of deleted) {
        vfsFiles.delete(path);
      }
    }
  }
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept requests to /preview/
  if (!url.pathname.startsWith('/preview/')) return;

  event.respondWith(handlePreviewRequest(url.pathname));
});

/**
 * Handle a request for a /preview/* path by looking up the file in the VFS.
 * Rewrites bare imports for JavaScript responses.
 */
async function handlePreviewRequest(pathname) {
  // Strip the /preview/ prefix to get the VFS path
  let vfsPath = pathname.replace(/^\/preview\//, '');

  // Default to index.html for directory-style requests
  if (!vfsPath || vfsPath.endsWith('/')) {
    vfsPath = vfsPath + 'index.html';
  }

  // Try exact match first, then index.html fallback
  let content = vfsFiles.get(vfsPath);
  if (content === undefined && !vfsPath.includes('.')) {
    content = vfsFiles.get(vfsPath + '/index.html') ?? vfsFiles.get(vfsPath + '.html');
  }

  if (content === undefined) {
    return new Response(`Not found: ${vfsPath}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const mimeType = getMimeType(vfsPath);

  // Rewrite bare imports in JavaScript files to esm.sh CDN URLs
  let body = content;
  if (isJavaScript(vfsPath)) {
    body = rewriteBareImports(body);
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Rewrite bare module specifiers in ES module import/export statements to esm.sh CDN URLs.
 * Relative imports (starting with . or /) are left unchanged.
 *
 * Examples:
 *   import React from 'react'           -> import React from 'https://esm.sh/react'
 *   import { useState } from 'react'    -> import { useState } from 'https://esm.sh/react'
 *   export { foo } from 'some-package'  -> export { foo } from 'https://esm.sh/some-package'
 *   import './local.js'                 -> unchanged
 */
function rewriteBareImports(code) {
  // Match import/export ... from 'specifier' or import('specifier')
  return code.replace(
    /((?:import|export)\s[^'"]*from\s+['"])([^'"]+)(['"])/g,
    (match, prefix, specifier, suffix) => {
      if (isBareSpecifier(specifier)) {
        return prefix + 'https://esm.sh/' + specifier + suffix;
      }
      return match;
    },
  ).replace(
    // Also rewrite dynamic import()
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
    (match, quote, specifier) => {
      if (isBareSpecifier(specifier)) {
        return `import(${quote}https://esm.sh/${specifier}${quote})`;
      }
      return match;
    },
  );
}

/**
 * Return true if the specifier is a bare npm package name (not a relative or absolute path).
 * Examples: 'react', '@scope/pkg', 'lodash/fp'
 */
function isBareSpecifier(specifier) {
  return !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('http');
}

/** Return true if the path is a JavaScript or TypeScript file (post-transform). */
function isJavaScript(path) {
  return /\.(js|mjs|cjs|jsx|ts|tsx)$/.test(path);
}

/** Map file extensions to MIME types for correct browser interpretation. */
function getMimeType(path) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const types = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    cjs: 'application/javascript; charset=utf-8',
    jsx: 'application/javascript; charset=utf-8',
    ts: 'application/javascript; charset=utf-8',
    tsx: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    xml: 'application/xml',
    wasm: 'application/wasm',
  };
  return types[ext] ?? 'application/octet-stream';
}
