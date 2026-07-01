import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX CRIT-08: Use environment variable for backend URL instead of hardcoded localhost
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:5001'

  return {
    clearScreen: false,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Trstprep - Exam Prep Platform',
          short_name: 'Trstprep',
          description: "India's platform for SSC, Railway & Banking exam preparation. Mock tests, practice labs, and study materials.",
          theme_color: '#6366f1',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // Cache static assets (JS/CSS/fonts) for offline repeat visits
          globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
          // Don't cache API calls or backend assets — those need fresh data
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//, /^\/assets\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    optimizeDeps: {
      exclude: ['@trstprep/shared-config', '@trstprep/shared-hooks']
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json']
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if (err.code === 'ECONNREFUSED') return
              console.error('[proxy error]', err)
            })
          }
        },
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if (err.code === 'ECONNREFUSED') return
              console.error('[proxy error]', err)
            })
          }
        },
        '/assets': {
          target: backendUrl,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if (err.code === 'ECONNREFUSED') return
              console.error('[proxy error]', err)
            })
          }
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if (err.code === 'ECONNREFUSED') return
              console.error('[proxy error]', err)
            })
          }
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Drop console statements in production to reduce bundle size and avoid info leakage
      esbuildOptions: mode === 'production' ? { dropConsole: true } : undefined,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'axios', 'react-hot-toast'],
            router: ['react-router-dom'],
            charts: ['chart.js', 'react-chartjs-2'],
            query: ['@tanstack/react-query'],
            ui: ['lucide-react']
          }
        }
      }
    },
  }
})
