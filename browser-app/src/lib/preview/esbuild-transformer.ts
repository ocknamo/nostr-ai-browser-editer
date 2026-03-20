/**
 * Browser-side TypeScript / JSX transformer powered by esbuild-wasm.
 * Provides file-level transpilation without bundling - import statements are preserved.
 * Call initializeEsbuild() once before using transformFile().
 */
import * as esbuild from 'esbuild-wasm';

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
      initPromise = null; // allow retry on failure
      throw err;
    });

  return initPromise;
}

/** Map from file extension to esbuild loader type. */
const LOADER_MAP: Record<string, esbuild.Loader> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
};

/**
 * Transform a single source file using esbuild.
 * TypeScript and JSX files are compiled to ESM JavaScript.
 * Files with no applicable loader (HTML, CSS, JSON) are returned unchanged.
 */
export async function transformFile(path: string, code: string): Promise<string> {
  const ext = getExtension(path);
  const loader = LOADER_MAP[ext];

  if (!loader) {
    // Not a transformable file type - return as-is
    return code;
  }

  if (!initialized) {
    throw new Error('esbuild-wasm is not initialized. Call initializeEsbuild() first.');
  }

  const result = await esbuild.transform(code, {
    loader,
    format: 'esm',
    target: 'es2022',
    sourcemap: false,
    // Do not bundle - keep import statements as-is for Service Worker to resolve
    // via esm.sh CDN rewriting
  });

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`[esbuild] ${path}: ${warning.text}`);
    }
  }

  return result.code;
}

/** Extract the lowercase file extension including the leading dot, or empty string. */
function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return '';
  return path.slice(lastDot).toLowerCase();
}
