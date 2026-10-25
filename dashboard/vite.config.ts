import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Live mode: the dashboard calls the Firebreak API on the same origin.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
