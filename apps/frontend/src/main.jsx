import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './shared/providers/AuthContext'
import { ThemeProvider } from './shared/context/ThemeContext.jsx'
import './styles/tokens.css'
import './styles/index.css'

// HIGH-06 FIX: Validate required environment variables at startup
import { validateEnvVars } from './shared/lib/env-validation.js'
validateEnvVars()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

function Main() {
  // Dynamically load ReactQueryDevtools only in development
  const [ReactQueryDevtools, setReactQueryDevtools] = useState(null)

  useEffect(() => {
    if (import.meta.env.DEV) {
      import('@tanstack/react-query-devtools').then(mod => {
        setReactQueryDevtools(() => mod.ReactQueryDevtools)
      })
    }
  }, [])

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <ThemeProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#1f2937',
                    color: '#fff',
                    border: '1px solid #374151'
                  }
                }}
              />
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
        {ReactQueryDevtools && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom-left" buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </React.StrictMode>
  )
}

createRoot(document.getElementById('root')).render(<Main />)
