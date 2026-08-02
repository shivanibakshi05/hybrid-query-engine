import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export default defineConfig({
  // Served from https://<user>.github.io/hybrid-query-engine/ in the hosted demo.
  // Override with BASE_PATH=/ for root deployments (Vercel, Netlify).
  base: process.env.BASE_PATH ?? '/hybrid-query-engine/',
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@hybrid-query-engine/parser': path.resolve(__dirname, '../parser/src/index.ts'),
      '@hybrid-query-engine/router': path.resolve(__dirname, '../router/src/index.ts'),
    },
  },
});
