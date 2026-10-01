import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: { outDir: '../../dist/client', emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api/': 'http://localhost:3000' },
    // Let the dev server answer through an ngrok tunnel (`ngrok http 5173`); a leading dot allows subdomains.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'],
  },
});
