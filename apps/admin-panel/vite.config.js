import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function suppressProxyErrors() {
  return {
    name: 'suppress-proxy-errors',
    configureServer(server) {
      const originalLog = console.error
      console.error = (...args) => {
        const msg = args.join(' ')
        if (msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) return
        originalLog.apply(console, args)
      }
      const origWarn = console.warn
      console.warn = (...args) => {
        const msg = args.join(' ')
        if (msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) return
        origWarn.apply(console, args)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:5001'

  return {
    plugins: [suppressProxyErrors(), react()],
    optimizeDeps: {
      include: ['@trstprep/shared-config', '@trstprep/shared-hooks']
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@features': path.resolve(__dirname, './src/features'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@components': path.resolve(__dirname, './src/shared/components'),
        '@api': path.resolve(__dirname, './src/shared/api'),
      }
    },
    server: {
      port: 3002,
      strictPort: false,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
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
          secure: false,
          configure: (proxy) => {
            proxy.on('error', () => {})
            proxy.on('proxyReqWs', () => {})
          }
        },
        '/assets': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
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
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if (err.code === 'ECONNREFUSED') return
              console.error('[proxy error]', err)
            })
          }
        }
      }
    },
     build: {
       outDir: 'dist',
       sourcemap: false,
       // Drop console statements in production to reduce bundle size and avoid info leakage
       esbuildOptions: mode === 'production' ? { dropConsole: true } : undefined,
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom', 'react-router-dom'],
             charts: ['recharts'],
             utils: ['axios', 'react-hot-toast']
           }
         }
       }
     }
  }
})
