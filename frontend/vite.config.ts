import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Anything starting with /api or /uploads is forwarded to the Express
    // backend, so the frontend can just call "/api/..." with no base URL and
    // there are no CORS problems during development.
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
