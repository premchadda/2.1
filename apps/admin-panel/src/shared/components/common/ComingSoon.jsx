import { Link, useNavigate } from 'react-router-dom'
import { 
  Clock, ArrowLeft, Sparkles, Bell,
  Radio, Target, Video, Newspaper, MessageCircle,
  Users, Award, Gift, BarChart, BookOpen, Zap,
  Trophy, Star, Flame, CheckCircle, XCircle
} from 'lucide-react'

// Icon mapping for string-based icon selection
const ICON_MAP = {
  Clock, Radio, Target, Video, Newspaper, MessageCircle,
  Users, Award, Gift, BarChart, BookOpen, Zap,
  Trophy, Star, Flame, CheckCircle, XCircle, Sparkles
}

function ComingSoon({ 
  title = 'Coming Soon',
  message = 'We are working hard to bring this content to you.',
  submessage = 'Stay tuned for updates!',
  showNotificationButton = false,
  backLink = '/',
  backText = 'Go Back',
  estimatedTime = null,
  icon: IconProp = null
}) {
  const navigate = useNavigate()
  
  // Resolve icon - could be component or string
  const CustomIcon = typeof IconProp === 'string' ? ICON_MAP[IconProp] : IconProp

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
            <button
              onClick={() => {
                // Could trigger a notification signup modal
                alert('You will be notified when this content is available!')
              }}
              className="block w-full mt-4 text-gray-600 hover:text-indigo-600 font-medium transition-colors"
            >
              <Bell className="w-4 h-4 inline mr-2" />
              Notify me when available
            </button>
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
