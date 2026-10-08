import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'manifest.json',
        'icons/icon-192.svg',
        'icons/icon-512.svg'
      ],
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => (
              url.pathname === '/api/indoor-map/cit/published' ||
              url.pathname.startsWith('/indoor-map-assets/') ||
              url.pathname.startsWith('/indoor-evidence/') ||
              url.pathname.startsWith('/models/') ||
              url.pathname.includes('/ort/') ||
              url.pathname.endsWith('.wasm') ||
              /\.(json|bin|onnx|tflite|glb|gltf)$/i.test(url.pathname)
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'taylor-published-map-and-evidence-assets-v2',
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
