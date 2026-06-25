import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../providers/AuthContext'
import { toast } from 'react-hot-toast'
import { clearCache } from '../lib/dataService'

/**
 * useRealtimeSync — Global hook for real-time cache invalidation
 *
 * Listens to WebSocket events broadcast by the backend when admin CRUD
 * operations modify tests, series, or other content, then invalidates
 * the corresponding React Query caches so every page in the app updates
 * automatically without requiring a hard refresh.
 *
 * Mount this ONCE at the App root level. Individual page components
 * do NOT need their own WebSocket listeners for data freshness.
 */
export function useRealtimeSync() {
  const { socket, on } = useAuth()
  const queryClient = useQueryClient()
  const toastCooldownRef = useRef(0)

  useEffect(() => {
    if (!socket) return

    const cleanups = []

    // ── series:updated ──────────────────────────────────────────────
    // Fired when a test series is created, updated, deleted, or bulk-uploaded
    cleanups.push(
      on('series:updated', (data) => {
        if (import.meta.env.DEV) console.log('[RealtimeSync] series:updated received:', data)

        queryClient.invalidateQueries({ queryKey: ['series'] })
        queryClient.invalidateQueries({ queryKey: ['mock-series'] })
        queryClient.invalidateQueries({ queryKey: ['live-tests'] })
        queryClient.invalidateQueries({ queryKey: ['tests'] })
        queryClient.invalidateQueries({ queryKey: ['mock-tests'] })

        // Clear manual dataService cache as well
        clearCache()

        showThrottledToast('📦 Test series updated')
      })
    )

    // ── content:updated ─────────────────────────────────────────────
    // Fired when tests, questions, papers, or other content is modified
    cleanups.push(
      on('content:updated', (data) => {
        if (import.meta.env.DEV) console.log('[RealtimeSync] content:updated received:', data)

        const contentType = data?.type || 'unknown'

        // Always invalidate core queries that most pages depend on
        queryClient.invalidateQueries({ queryKey: ['series'] })
        queryClient.invalidateQueries({ queryKey: ['tests'] })

        if (contentType === 'test') {
          queryClient.invalidateQueries({ queryKey: ['mock-series'] })
          queryClient.invalidateQueries({ queryKey: ['mock-tests'] })
          queryClient.invalidateQueries({ queryKey: ['live-tests'] })
          queryClient.invalidateQueries({ queryKey: ['practice-questions'] })
          queryClient.invalidateQueries({ queryKey: ['previous-year-papers'] })
          queryClient.invalidateQueries({ queryKey: ['exam-categories-pyq'] })
          queryClient.invalidateQueries({ queryKey: ['exam-categories-practice'] })
        }

        if (contentType === 'question') {
          queryClient.invalidateQueries({ queryKey: ['practice-questions'] })
        }

        if (contentType === 'blog') {
          queryClient.invalidateQueries({ queryKey: ['blogs'] })
        }

        if (contentType === 'pyq') {
          queryClient.invalidateQueries({ queryKey: ['previous-year-papers'] })
        }

        // Clear manual dataService cache for all content updates
        clearCache()


        const action = data?.action || 'updated'
        const label = contentType.charAt(0).toUpperCase() + contentType.slice(1)
        showThrottledToast(`🔄 ${label} ${action}`)
      })
    )

    return () => {
      cleanups.forEach((cleanup) => {
        if (typeof cleanup === 'function') cleanup()
      })
    }
  }, [socket, on, queryClient])

  /**
   * Show a toast at most once every 3 seconds to avoid spamming
   * the user during bulk operations.
   */
  function showThrottledToast(message) {
    const now = Date.now()
    if (now - toastCooldownRef.current < 3000) return
    toastCooldownRef.current = now

    toast(message, {
      icon: '⚡',
      duration: 2500,
      style: {
        borderRadius: '12px',
        background: '#1e1b4b',
        color: '#e0e7ff',
        fontSize: '13px',
        fontWeight: 700,
      },
    })
  }
}
