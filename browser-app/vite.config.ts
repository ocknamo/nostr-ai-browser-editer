import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    // esbuild-wasm loads its WASM binary dynamically at runtime.
    // Excluding it from Vite's pre-bundling prevents the optimizer from
    // interfering with the dynamic WASM import and causing initialization errors.
    exclude: ['esbuild-wasm'],
  },
})
