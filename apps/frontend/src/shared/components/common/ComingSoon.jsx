import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { 
  Clock, ArrowLeft, Sparkles, Bell,
  Radio, Target, Video, Newspaper, MessageCircle,
  Users, Award, Gift, BarChart, BookOpen, Zap,
  Trophy, Star, Flame, CheckCircle, XCircle, Loader2
} from 'lucide-react'
import { useAuth } from '../../providers/AuthContext.jsx'
import { apiClient } from '../../lib/api.js'

// Icon mapping for string-based icon selection
const ICON_MAP = {
  Clock, Radio, Target, Video, Newspaper, MessageCircle,
  Users, Award, Gift, BarChart, BookOpen, Zap,
  Trophy, Star, Flame, CheckCircle, XCircle, Sparkles
}

/**
 * ComingSoon Component (HIGH-01: Notify Me Integration)
 * 
 * Displays a "Coming Soon" page with optional notification signup.
 * Users can subscribe to be notified when content becomes available.
 * 
 * @param {string} title - Page title
 * @param {string} message - Main description
 * @param {string} submessage - Additional context
 * @param {boolean} showNotificationButton - Show "Notify Me" button
 * @param {string} notificationTopic - Topic identifier for notifications (e.g., 'feature:live-tests')
 * @param {string} backLink - URL for the back button
 * @param {string} backText - Text for the back button
 * @param {string} estimatedTime - When content will be available
 * @param {React.Component} icon - Custom icon component
 */
function ComingSoon({
  title = 'Coming Soon',
  message = 'We are working hard to bring this content to you.',
  submessage = 'Stay tuned for updates!',
  showNotificationButton = false,
  notificationTopic = null,
  backLink = '/',
  backText = 'Go Back',
  estimatedTime = null,
  icon: IconProp = null
}) {
  const { isAuthenticated, user } = useAuth()
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  
  // Resolve icon - could be component or string
  const CustomIcon = typeof IconProp === 'string' ? ICON_MAP[IconProp] : IconProp
  
  /**
   * Handle notification subscription
   * Registers user interest in the coming soon feature
   */
  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to receive notifications')
      return
    }
    
    if (!notificationTopic) {
      toast.error('Notification topic not configured')
      return
    }
    
    setSubscribing(true)
    
    try {
      await apiClient.post('/api/notifications/subscribe', {
        topic: notificationTopic,
        type: 'coming_soon',
        userId: user?.id
      })
      
      setSubscribed(true)
      toast.success('You will be notified when this feature launches!')
    } catch (error) {
      console.error('Subscription failed:', error)
      // If user is already subscribed, that's still a success
      if (error.response?.status === 409 || error.response?.status === 400) {
        setSubscribed(true)
        toast.success('You are already subscribed to updates!')
      } else {
        toast.error('Failed to subscribe. Please try again.')
      }
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
            {CustomIcon ? (
              <CustomIcon className="w-16 h-16 text-indigo-600" />
            ) : (
              <Clock className="w-16 h-16 text-indigo-600" />
            )}
          </div>
          {/* Sparkles */}
          <div className="absolute top-0 right-1/4 animate-pulse">
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="absolute bottom-4 left-1/4 animate-pulse delay-150">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {title}
        </h1>

        {/* Message */}
        <p className="text-lg text-gray-600 mb-2">
          {message}
        </p>
        
        {submessage && (
          <p className="text-gray-500 mb-6">
            {submessage}
          </p>
        )}

        {/* Estimated Time */}
        {estimatedTime && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium mb-8">
            <Clock className="w-4 h-4" />
            Expected: {estimatedTime}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            to={backLink}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            {backText}
          </Link>

          {showNotificationButton && (
            subscribed ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 text-green-700 rounded-full font-medium">
                <CheckCircle className="w-5 h-5" />
                You'll be notified when this launches!
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="block w-full mt-4 text-gray-600 hover:text-indigo-600 font-medium transition-colors disabled:opacity-50"
              >
                {subscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 inline mr-2" />
                    Notify me when available
                  </>
                )}
              </button>
            )
          )}
        </div>

        {/* Additional Help */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Looking for something else?{' '}
            <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Browse all content
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ComingSoon
