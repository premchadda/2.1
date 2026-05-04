/**
 * Page Coming Soon Wrapper
 * 
 * Wraps individual pages to show Coming Soon based on config.
 * Use this to wrap any page component.
 * 
 * Usage:
 * <PageComingSoon pageKey="liveTests">
 *   <LiveTests />
 * </PageComingSoon>
 */

import { useState, useEffect } from 'react'
import ComingSoon from './ComingSoon'
import { isPageComingSoon, getComingSoonConfig } from '../../config/comingSoonConfig'
// FIX CRIT-10: Remove localStorage checks - use shared config only
import apiClient from '../../api/adminApi'

export default function PageComingSoon({ pageKey, children, fallback }) {
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [config, setConfig] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showRealContent, setShowRealContent] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // FIX CRIT-10: Fetch coming soon config from API instead of localStorage
    const checkStatus = async () => {
      try {
        // Try to fetch from API first
        const response = await apiClient.get('/admin/coming-soon-config')
        if (response.data?.success) {
          const pageConfig = response.data.data.pages?.find(p => p.key === pageKey)
          if (pageConfig) {
            setShowComingSoon(pageConfig.comingSoon)
            setConfig(pageConfig)
          }
        }
      } catch {
        // Fallback to static config (not localStorage)
        setShowComingSoon(isPageComingSoon(pageKey))
        setConfig(getComingSoonConfig(pageKey))
      } finally {
        setLoading(false)
      }
    }

    // Check admin status via API session (not localStorage)
    const checkAdminStatus = async () => {
      try {
        const response = await apiClient.get('/auth/me')
        if (response.data?.success) {
          setIsAdmin(response.data.data?.role === 'admin')
        }
      } catch {
        setIsAdmin(false)
      }
    }

    checkStatus()
    checkAdminStatus()

    // Listen for config changes via custom event (not localStorage)
    const handleConfigChange = () => checkStatus()
    window.addEventListener('comingSoonConfigChanged', handleConfigChange)

    return () => {
      window.removeEventListener('comingSoonConfigChanged', handleConfigChange)
    }
  }, [pageKey])

  // Show loading state while fetching
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  }

  // If not showing Coming Soon or admin override, render children
  if (!showComingSoon || (isAdmin && showRealContent)) {
    return children
  }

  // Show Coming Soon or fallback
  if (fallback) {
    return fallback
  }

  return (
    <ComingSoon
      title={config?.title || 'Coming Soon'}
      message={config?.message || 'We are working hard to bring this content to you.'}
      submessage={config?.submessage || 'Stay tuned for updates!'}
      estimatedTime={config?.estimatedTime}
      showNotificationButton={config?.showNotificationButton !== false}
      backLink={config?.backLink || '/'}
      backText={config?.backText || 'Go Back'}
      icon={config?.icon}
    />
  )
}

/**
 * HOC to wrap a component with Coming Soon functionality
 * 
 * Usage:
 * export default withComingSoon(MyComponent, 'liveTests')
 */
export function withComingSoon(Component, pageKey) {
  return function WrappedComponent(props) {
    return (
      <PageComingSoon pageKey={pageKey}>
        <Component {...props} />
      </PageComingSoon>
    )
  }
}