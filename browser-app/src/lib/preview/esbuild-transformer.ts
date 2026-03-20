/**
 * Browser-side project bundler powered by esbuild-wasm.
 * Bundles a project from the virtual filesystem into a single ESM JavaScript output.
 * Bare npm imports are rewritten to esm.sh CDN URLs so no node_modules are needed.
 */
import * as esbuild from 'esbuild-wasm';
import type { VirtualFS } from '../vfs/virtual-fs';

/**
 * URL to the esbuild WebAssembly binary.
 * Using the CDN-hosted version to avoid bundling 7MB into the app.
 */
const ESBUILD_WASM_URL = 'https://unpkg.com/esbuild-wasm@0.27.4/esbuild.wasm';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the esbuild-wasm runtime.
 * Safe to call multiple times - initialization happens only once.
 */
export async function initializeEsbuild(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = esbuild
    .initialize({ wasmURL: ESBUILD_WASM_URL })
    .then(() => {
      initialized = true;
    })
    .catch((err) => {
      initPromise = null;
      throw err;
    });

  return initPromise;
}

/** JavaScript and CSS outputs from a bundle operation. */
export interface BundleResult {
  js: string;
  /** CSS extracted from JS imports (e.g. `import './App.css'`), or null if none. */
  css: string | null;
}

/**
 * Bundle a project from the VFS starting from the given entry file.
 * All relative imports are resolved from the VFS.
 * All bare npm specifiers (e.g. 'react') are marked external and rewritten to
 * 'https://esm.sh/{specifier}' so the browser fetches them from CDN at runtime.
 */
export async function bundleFromVFS(
  vfsInstance: VirtualFS,
  entryPath: string,
): Promise<BundleResult> {
  if (!initialized) {
    throw new Error('esbuild-wasm is not initialized. Call initializeEsbuild() first.');
  }

  const result = await esbuild.build({
    // 'vfs:' prefix routes the entry point through our custom plugin.
    entryPoints: [`vfs:${entryPath}`],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    // Suppress warnings about unused CSS (common with React component imports)
    logLevel: 'error',
    plugins: [createVFSPlugin(vfsInstance)],
  });

  let js = '';
  let css: string | null = null;

  for (const file of result.outputFiles) {
    if (file.path.endsWith('.css')) {
      css = file.text;
    } else {
      js = file.text;
    }
  }

  return { js, css };
}

/**
 * Create an esbuild plugin that serves files from the virtual filesystem
 * and routes bare npm specifiers to esm.sh.
 */
function createVFSPlugin(vfsInstance: VirtualFS): esbuild.Plugin {
  return {
    name: 'vfs',
    setup(build) {
      // Handle 'vfs:path' entry points
      build.onResolve({ filter: /^vfs:/ }, (args) => ({
        path: args.path.slice(4),
        namespace: 'vfs',
      }));

      // Relative imports from within VFS files
      build.onResolve({ filter: /^\./, namespace: 'vfs' }, (args) => ({
        path: resolveVFSPath(args.resolveDir, args.path),
        namespace: 'vfs',
      }));

      // External HTTP(S) URLs - pass through
      build.onResolve({ filter: /^https?:\/\// }, (args) => ({
        path: args.path,
        external: true,
      }));

      // Bare npm specifiers - redirect to esm.sh CDN
      build.onResolve({ filter: /^[^./]/ }, (args) => ({
        path: `https://esm.sh/${args.path}`,
        external: true,
      }));

      // Load files from VFS (with automatic extension resolution)
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
        const result = loadFromVFS(vfsInstance, args.path);
        if (result) return result;
        return { errors: [{ text: `File not found in repository: ${args.path}` }] };
      });
    },
  };
}

/**
 * Look up a path in the VFS with automatic extension resolution.
 * Returns an esbuild OnLoadResult or null if the file is not found.
 */
function loadFromVFS(
  vfsInstance: VirtualFS,
  path: string,
): esbuild.OnLoadResult | null {
  // Candidates in resolution order
  const candidates = [
    path,
    path + '.tsx',
    path + '.ts',
    path + '.jsx',
    path + '.js',
    path + '/index.tsx',
    path + '/index.ts',
    path + '/index.js',
  ];

  for (const candidate of candidates) {
    const content = vfsInstance.get(candidate);
    if (content !== undefined) {
      return {
        contents: content,
        loader: getLoader(candidate),
        // resolveDir tells esbuild where to resolve relative imports within this file
        resolveDir: getDirname(candidate),
      };
    }
  }

  return null;
}

/** Map file extensions to esbuild loader types. */
const LOADER_MAP: Partial<Record<string, esbuild.Loader>> = {
  ts: 'ts',
  tsx: 'tsx',
  jsx: 'jsx',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  css: 'css',
  json: 'json',
  txt: 'text',
};

/** Return the esbuild loader for the given file path. */
function getLoader(path: string): esbuild.Loader {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LOADER_MAP[ext] ?? 'text';
}

/** Resolve a relative path against a base directory using URL semantics. */
function resolveVFSPath(dir: string, rel: string): string {
  // Use URL resolution to handle '..' and '.' correctly
  const base = `http://vfs/${dir ? dir + '/' : ''}x`;
  return decodeURIComponent(new URL(rel, base).pathname.slice(1));
}

/** Return the directory portion of a file path. */
function getDirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}
