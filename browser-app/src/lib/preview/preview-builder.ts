/**
 * Builds a self-contained HTML document from the virtual filesystem and a bundle result.
 * The output can be used directly as an iframe srcdoc value.
 */
import type { BundleResult } from './esbuild-transformer';
import type { VirtualFS } from '../vfs/virtual-fs';

/**
 * Locate the JavaScript entry point within the VFS.
 * Checks in order: explicit openFile, <script src> in index.html, common entry paths.
 * Throws if no entry point is found.
 */
export function findEntryPoint(vfsInstance: VirtualFS, explicitFile: string): string {
  if (explicitFile && vfsInstance.get(explicitFile) !== undefined) return explicitFile;

  const html = vfsInstance.get('index.html');
  if (html) {
    const match = html.match(/<script\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (match) {
      const src = match[1].replace(/^\.\//, '');
      if (vfsInstance.get(src) !== undefined) return src;
    }
  }

  const candidates = [
    'src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js',
    'src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js',
    'main.tsx', 'main.ts', 'main.jsx', 'main.js',
    'index.tsx', 'index.ts', 'index.jsx', 'index.js',
  ];
  for (const c of candidates) {
    if (vfsInstance.get(c) !== undefined) return c;
  }

  throw new Error(
    'Could not find a JavaScript entry point. Set "Open File" to the main script path.',
  );
}

/**
 * Build a self-contained HTML document by injecting bundled JS and inlining CSS.
 * - <link rel="stylesheet"> tags are replaced with inline <style> blocks.
 * - CSS extracted from JS imports (via esbuild) is injected into <head>.
 * - External <script src="..."> tags are removed and replaced with the inline bundle.
 * The returned string is suitable for use as iframe.srcdoc.
 */
export function buildPreviewDocument(vfsInstance: VirtualFS, bundle: BundleResult): string {
  let html = vfsInstance.get('index.html') ?? '<!DOCTYPE html><html><body></body></html>';

  // Inline <link rel="stylesheet"> references
  html = html.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    (_match, href) => {
      const content = vfsInstance.get(href.replace(/^\.\//, ''));
      return content ? openStyle() + content + closeStyle() : _match;
    },
  );

  // Inject CSS extracted from JS imports (e.g. `import './App.css'`)
  if (bundle.css) {
    const styleBlock = openStyle() + bundle.css + closeStyle();
    html = html.includes('</head>')
      ? html.replace('</head>', styleBlock + '</head>')
      : styleBlock + html;
  }

  // Remove all <script src="..."> tags (replaced by the inline bundle below)
  html = html.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi, '');

  // Inject the bundle as an ES module.
  // openScript / closeScript helpers avoid embedding literal tag strings here.
  const bundleTag = openScript() + bundle.js + closeScript();
  html = html.includes('</body>')
    ? html.replace('</body>', bundleTag + '</body>')
    : html + bundleTag;

  return html;
}

// Helpers that return HTML tag strings without writing the literal angle-bracket
// sequences in this source file, preventing any parser from treating them as real tags.

/** Returns `<style>` */
function openStyle(): string {
  return ['<', 'style', '>'].join('');
}

/** Returns `</style>` */
function closeStyle(): string {
  return ['</', 'style', '>'].join('');
}

/** Returns `<script type="module">` */
function openScript(): string {
  return ['<', 'script type="module"', '>'].join('');
}

/** Returns `</script>` */
function closeScript(): string {
  return ['</', 'script', '>'].join('');
}
