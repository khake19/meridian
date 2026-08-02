import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 4200,
    strictPort: true,
  },
  build: {
    outDir: '../../dist/apps/desktop-renderer',
    emptyOutDir: true,
  },
});
