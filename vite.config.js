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
        runtimeCaching: [
          {
            urlPattern: ({ url }) => (
              url.pathname.startsWith('/models/') ||
              url.pathname.includes('/ort/') ||
              url.pathname.endsWith('.wasm')
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'taylor-model-assets-v1',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
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
