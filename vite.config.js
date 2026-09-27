import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const target = process.env.VITE_API_TARGET || 'http://127.0.0.1:3001';
export default defineConfig({
  plugins: [react()],
  build: { assetsInlineLimit: 0 },
  server: {
    port: 5173,
    strictPort: true,
    // The SDK and canonical login route must see the browser's public origin.
    proxy: Object.fromEntries(
      ['/api', '/login', '/signup', '/logout', '/callback'].map((path) => [
        path,
        { target, changeOrigin: false },
      ]),
    ),
  },
});
