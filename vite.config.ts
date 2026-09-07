import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'docs',
  },
});
