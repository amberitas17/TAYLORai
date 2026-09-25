import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3033',
        changeOrigin: true,
      },
    },
    // Prevent the file watcher from descending into the Python venv / backend folders
    watch: {
      ignored: ['**/Documentation/venv/**', '**/backend/**', '**/backend_faceapi/**'],
    },
  },
  // Without this, Vite's dependency scanner crawls every *.html in the project,
  // including Documentation/venv/Lib/site-packages (torch/matplotlib/ultralytics),
  // which makes the dev server hang on the first request.
  optimizeDeps: {
    entries: ['index.html'],
  },
})
