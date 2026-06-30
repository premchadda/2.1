import { usePublicSettings } from '../../hooks/usePublicSettings'
import ComingSoon from './ComingSoon'
import { Clock, Bell, Sparkles, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/dataService.js'
import { useAuth } from '../../providers/AuthContext'
import { toast } from 'react-hot-toast'

/**
 * FeatureGate — wraps a page or section and shows "Coming Soon" if the
 * corresponding flag is enabled in admin settings.
 *
 * Two modes:
 *
 * 1. Page-level (default) — replaces the entire page:
 *    <FeatureGate pageKey="liveTests">
 *      <LiveTests />
 *    </FeatureGate>
 *
 * 2. Section-level — renders a compact inline placeholder within the page:
 *    <FeatureGate sectionKey="analysis:difficulty" type="section">
 *      <DifficultyBreakdown />
 *    </FeatureGate>
 */
export default function FeatureGate({
  pageKey,
  sectionKey,
  children,
  fallbackBackLink = '/',
  fallbackBackText = 'Go Back',
  variant = 'card',
  minHeight = '200px',
}) {
  const { isComingSoon, getComingSoonConfig, isLoading } = usePublicSettings()

  const key = sectionKey || pageKey

  // While settings are loading, show a brief skeleton so we don't flash
  // the real content before the coming-soon check completes.
  if (isLoading) {
    if (sectionKey) {
      return (
        <div className="flex items-center justify-center" style={{ minHeight }}>
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      )
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-start animate-spin" />
      </div>
    )
  }

  if (!isComingSoon(key)) {
    return children
  }

  const config = getComingSoonConfig(key) || {}

  // Page-level: full Coming Soon page
  if (!sectionKey) {
    return (
      <ComingSoon
        title={config.title || 'Coming Soon'}
        message={config.message || 'We are working hard to bring this content to you.'}
        estimatedTime={config.estimatedTime || null}
        showNotificationButton={true}
        notificationTopic={`feature:${key}`}
        backLink={fallbackBackLink}
        backText={fallbackBackText}
      />
    )
  }

  // Section-level: inline placeholder
  return (
    <SectionComingSoon
      config={config}
      sectionKey={key}
      variant={variant}
      minHeight={minHeight}
    />
  )
}

/**
 * Compact inline Coming Soon placeholder for sections within a page.
 */
function SectionComingSoon({ config, sectionKey, variant = 'card', minHeight = '200px' }) {
  const { isAuthenticated, user } = useAuth()
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to receive notifications')
      return
    }
    setSubscribing(true)
    try {
      await api.post('/api/notifications/subscribe', {
        topic: `feature:${sectionKey}`,
        type: 'coming_soon',
        userId: user?.id,
      })
      setSubscribed(true)
      toast.success('You will be notified when this is available!')
    } catch (error) {
      if (error.response?.status === 409 || error.response?.status === 400) {
        setSubscribed(true)
        toast.success('You are already subscribed!')
      } else {
        toast.error('Failed to subscribe. Please try again.')
      }
    } finally {
      setSubscribing(false)
    }
  }

  if (variant === 'banner') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl">
        <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 flex-1">
          {config.message || 'This section is coming soon.'}
        </span>
        {config.estimatedTime && (
          <span className="text-[10px] text-indigo-400 font-bold flex-shrink-0">{config.estimatedTime}</span>
        )}
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-center" style={{ minHeight }}>
        <Clock className="w-5 h-5 text-gray-300" />
        <div>
          <p className="text-sm font-medium text-gray-400">{config.title || 'Coming Soon'}</p>
          {config.estimatedTime && (
            <p className="text-[10px] text-gray-300 mt-0.5">{config.estimatedTime}</p>
          )}
        </div>
      </div>
    )
  }

  // 'card' variant
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6 py-8 bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-gray-800 dark:to-indigo-900/10 rounded-2xl border border-dashed border-indigo-100 dark:border-indigo-800"
      style={{ minHeight }}
    >
      <div className="relative mb-4">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center">
          <Clock className="w-7 h-7 text-indigo-500" />
        </div>
        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />
      </div>

      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
        {config.title || 'Coming Soon'}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-3">
        {config.message || 'We are working on this section.'}
      </p>

      {config.estimatedTime && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold mb-4">
          <Clock className="w-3 h-3" />
          {config.estimatedTime}
        </div>
      )}

      {subscribed ? (
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
          <Bell className="w-3.5 h-3.5" />
          You'll be notified when this launches!
        </div>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition disabled:opacity-50"
        >
          {subscribing ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subscribing...</>
          ) : (
            <><Bell className="w-3.5 h-3.5" /> Notify me</>
          )}
        </button>
      )}
    </div>
  )
}