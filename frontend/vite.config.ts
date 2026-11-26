import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API runs on :8090. In Docker the frontend reaches it by service name, so the
// compose file sets API_PROXY=http://backend:8090; locally it defaults to localhost.
const apiTarget = process.env.API_PROXY ?? 'http://localhost:8090';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3030,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // three.js is large and only needed by the 3D view, so it gets its own chunk.
        manualChunks: id => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
});
