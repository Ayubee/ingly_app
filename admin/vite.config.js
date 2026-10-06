import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'node:module';
const loadConfigTools = createRequire(path.resolve(process.cwd(), 'package.json'));
const environmentTools = loadConfigTools('./scripts/environment-config.cjs');

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), environmentTools.environmentPlugin(environmentTools.adminConfig(loadEnv(mode, process.cwd(), ''), mode))],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        preview: path.resolve(__dirname, 'preview.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
}));
