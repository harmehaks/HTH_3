import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const target = process.env.VITE_API_TARGET || 'http://127.0.0.1:3001';
export default defineConfig({
  plugins: [react()],
  build: { assetsInlineLimit: 0 },
  server: {
    port: 5173,
    proxy: { '/api': target, '/login': target, '/logout': target, '/callback': target },
  },
});
