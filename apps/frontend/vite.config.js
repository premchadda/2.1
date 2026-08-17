import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TRANSIENT_PROXY_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ECONNABORTED',
])

const isTransientProxyError = (err) => {
  if (!err) return false
  if (TRANSIENT_PROXY_ERROR_CODES.has(err.code)) return true
  const message = String(err.message || err)
  return [...TRANSIENT_PROXY_ERROR_CODES].some((code) => message.includes(code))
}

const isTransientProxyLog = (args) => {
  const message = args.map((arg) => {
    if (arg instanceof Error) return `${arg.code || ''} ${arg.message || ''}`
    if (arg && typeof arg === 'object') return `${arg.code || ''} ${arg.message || ''}`
    return String(arg)
  }).join(' ')

  return (
    (message.includes('http proxy error') || message.includes('ws proxy error') || message.includes('[proxy error]')) &&
    [...TRANSIENT_PROXY_ERROR_CODES].some((code) => message.includes(code))
  )
}

const writeProxyFallbackResponse = (res) => {
  if (!res || typeof res.writeHead !== 'function' || res.headersSent || res.writableEnded) {
    return false
  }

  res.writeHead(503, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify({
    success: false,
    message: 'Backend temporarily unavailable. Retrying shortly.',
  }))
  return true
}

const configureResilientProxy = (proxy) => {
  proxy.on('error', (err, _req, res) => {
    if (isTransientProxyError(err)) {
      if (!writeProxyFallbackResponse(res) && res && typeof res.destroy === 'function') {
        res.destroy()
      }
      return
    }

    console.error('[proxy error]', err)
  })
}

function suppressProxyErrors() {
  return {
    name: 'suppress-proxy-errors',
    configureServer(_server) {
      if (console.__trstprepProxyErrorsSuppressed) return
      console.__trstprepProxyErrorsSuppressed = true

      const originalLog = console.error
      console.error = (...args) => {
        if (isTransientProxyLog(args)) return
        originalLog.apply(console, args)
      }
      const origWarn = console.warn
      console.warn = (...args) => {
        if (isTransientProxyLog(args)) return
        origWarn.apply(console, args)
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:5001'

  return {
    clearScreen: false,
    esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : undefined,
    plugins: [
      suppressProxyErrors(),
      react(),
      ...(mode === 'analyze' ? [visualizer({ open: true, filename: 'stats.html', gzipSize: true })] : []),
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
              purpose: 'any',
            },
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-192-maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
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
            {
              urlPattern: /\/api\/test-series$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-test-series',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: /\/api\/exam-categories$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-exam-categories',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: /\/api\/subscription-plans$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-subscription-plans',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
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
      include: ['@trstprep/shared-config', '@trstprep/shared-hooks', 'react', 'react-dom', 'react-router-dom']
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom', 'react-router'],
      extensions: ['.js', '.jsx', '.json']
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          configure: configureResilientProxy,
          selfHandleResponse: false,
        },
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
          configure: configureResilientProxy,
        },
        '/assets': {
          target: backendUrl,
          changeOrigin: true,
          configure: configureResilientProxy,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          configure: configureResilientProxy,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'axios', 'react-hot-toast'],
            router: ['react-router-dom'],
            charts: ['chart.js', 'react-chartjs-2'],
            recharts: ['recharts'],
            katex: ['katex'],
            query: ['@tanstack/react-query'],
            ui: ['lucide-react']
          }
        }
      },
    },
  }
})
