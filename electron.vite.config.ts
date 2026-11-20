import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const shared = { '@shared': resolve(import.meta.dirname, 'src/shared') };

export default defineConfig({
  main: {
    resolve: { alias: shared },
    build: { rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/main/index.ts') } } },
  },
  preload: {
    resolve: { alias: shared },
    build: {
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    resolve: { alias: { ...shared, '@renderer': resolve(import.meta.dirname, 'src/renderer') } },
    plugins: [react()],
    build: { rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/renderer/index.html') } } },
  },
});
