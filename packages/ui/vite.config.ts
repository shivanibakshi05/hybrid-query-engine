import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@hybrid-query-engine/parser': path.resolve(__dirname, '../parser/src/index.ts'),
      '@hybrid-query-engine/router': path.resolve(__dirname, '../router/src/index.ts'),
    },
  },
});
