import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX CRIT-08: Use environment variable for backend URL instead of hardcoded localhost
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:5001'

  return {
    clearScreen: false,
    plugins: [react()],
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
