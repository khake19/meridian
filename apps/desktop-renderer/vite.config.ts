import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4200,
  },
  build: {
    outDir: '../../dist/apps/desktop-renderer',
    emptyOutDir: true,
  },
});
