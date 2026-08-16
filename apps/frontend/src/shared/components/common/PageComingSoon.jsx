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
import { useAuth } from '../../providers/AuthContext'

export default function PageComingSoon({ pageKey, children, fallback }) {
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    // Check if page should show Coming Soon
    const checkStatus = () => {
      // Check localStorage for local overrides
      const localPages = localStorage.getItem('comingSoonPages')
      if (localPages) {
        try {
          const pages = JSON.parse(localPages)
          const pageConfig = pages.find(p => p.key === pageKey)
          if (pageConfig) {
            setShowComingSoon(pageConfig.comingSoon)
            setConfig(pageConfig)
            return
          }
        } catch (e) {
          console.error('Failed to parse coming soon config:', e)
        }
      }
      
      // Use default config
      setShowComingSoon(isPageComingSoon(pageKey))
      setConfig(getComingSoonConfig(pageKey))
    }

    checkStatus()

    // Listen for config changes
    const handleStorageChange = () => {
      checkStatus()
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('comingSoonConfigChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('comingSoonConfigChanged', handleStorageChange)
    }
  }, [pageKey])

  // Check if user is admin via AuthContext (replaces dead localStorage check
  // that read `trstprep_user` — a key the modern auth flow never writes).
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Admin override: Check if admin wants to see real content
  const adminOverride = localStorage.getItem(`override_${pageKey}`)
  const showRealContent = adminOverride === 'true'

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
