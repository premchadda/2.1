/**
 * Maintenance Mode Component
 * 
 * This component wraps the entire app and shows maintenance page
 * when maintenance mode is enabled.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wrench, Clock, RefreshCw, Home, Mail } from 'lucide-react'
import { isSiteInMaintenance, getMaintenanceConfig } from '../../config/comingSoonConfig'

export default function MaintenanceMode({ children }) {
  const [isMaintenance, setIsMaintenance] = useState(false)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    // Check maintenance mode
    const checkMaintenance = () => {
      // Check localStorage for admin overrides
      const localConfig = localStorage.getItem('maintenanceConfig')
      if (localConfig) {
        try {
          const parsed = JSON.parse(localConfig)
          setIsMaintenance(parsed.maintenanceMode || false)
          setConfig(parsed)
          return
        } catch (e) {
          console.error('Failed to parse maintenance config:', e)
        }
      }
      
      // Use default config
      setIsMaintenance(isSiteInMaintenance())
      setConfig(getMaintenanceConfig())
    }

    checkMaintenance()

    // Listen for config changes
    const handleStorageChange = () => {
      checkMaintenance()
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('maintenanceConfigChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('maintenanceConfigChanged', handleStorageChange)
    }
  }, [])

  // Check if user is admin (to bypass maintenance)
  const userStr = localStorage.getItem('trstprep_user')
  let isAdmin = false
  try {
    const user = userStr ? JSON.parse(userStr) : null
    isAdmin = user?.role === 'admin'
  } catch (e) {
    // ignore
  }

  // If not in maintenance mode or user is admin, render children
  if (!isMaintenance || (config?.allowAdminAccess && isAdmin)) {
    return children
  }

  // Show maintenance page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center animate-pulse">
            <Wrench className="w-16 h-16 text-purple-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          {/* Floating particles */}
          <div className="absolute top-0 right-1/4 w-3 h-3 bg-purple-500 rounded-full animate-ping" />
          <div className="absolute bottom-4 left-1/4 w-2 h-2 bg-pink-500 rounded-full animate-ping delay-150" />
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          We'll Be Back Soon!
        </h1>

        {/* Message */}
        <p className="text-lg text-purple-200 mb-2">
          {config?.message || "We're performing scheduled maintenance to improve your experience."}
        </p>

        {/* Estimated Time */}
        {config?.estimatedDowntime && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full text-sm font-medium mb-8">
            <Clock className="w-4 h-4" />
            Estimated downtime: {config.estimatedDowntime}
          </div>
        )}

        {/* End Time */}
        {config?.endTime && (
          <p className="text-purple-300 text-sm mb-8">
            Expected to be back by: {new Date(config.endTime).toLocaleString()}
          </p>
        )}

        {/* Progress Bar Animation */}
        <div className="w-full max-w-xs mx-auto mb-8">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"
              style={{ 
                animation: 'progress 2s ease-in-out infinite',
                width: '60%'
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh Page
          </button>
          
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>

        {/* Contact Info */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-purple-300 text-sm mb-4">
            Need urgent help? Contact us:
          </p>
          <a
            href="mailto:support@trstprep.com"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Mail className="w-4 h-4" />
            support@trstprep.com
          </a>
        </div>

        {/* Admin Link */}
        {config?.allowAdminAccess && (
          <div className="mt-8">
            <Link
              to="/admin"
              className="text-xs text-purple-500 hover:text-purple-400"
            >
              Admin Access
            </Link>
          </div>
        )}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes progress {
          0%, 100% { width: 30%; }
          50% { width: 70%; }
        }
      `}</style>
    </div>
  )
}