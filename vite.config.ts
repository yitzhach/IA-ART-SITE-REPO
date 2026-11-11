import {defineConfig} from 'vitest/config';

// @jsquash/webp depends on wasm-feature-detect, which uses `import.source` (not understood by the bundler yet).
// Swap it for a tiny equivalent so the WebP encoder builds as its own lazy chunk.
const wasmFeatureDetectShim = {
  name: 'wasm-feature-detect-shim',
  enforce: 'pre' as const,
  resolveId: (id: string) => (id === 'wasm-feature-detect' ? '\0wfd-shim' : undefined),
  load: (id: string) =>
    id === '\0wfd-shim'
      ? `export const simd = async () => WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
export const threads = async () => false;`
      : undefined,
};

export default defineConfig({
  plugins: [wasmFeatureDetectShim],
  build: {outDir: 'dist', emptyOutDir: true},
  server: {proxy: {'/v1': 'http://localhost:8787', '/assistant': 'http://localhost:8787'}},
  test: {environment: 'node', include: ['tests/**/*.test.ts']},
});
