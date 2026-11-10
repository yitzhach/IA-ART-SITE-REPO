import {defineConfig} from 'vitest/config';

export default defineConfig({
  build: {outDir: 'dist', emptyOutDir: true},
  server: {proxy: {'/v1': 'http://localhost:8787', '/assistant': 'http://localhost:8787'}},
  test: {environment: 'node', include: ['tests/**/*.test.ts']},
});
