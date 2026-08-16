/**
 * Coming Soon Manager - Admin Panel
 * 
 * Allows admins to:
 * 1. Toggle Coming Soon status for any page
 * 2. Enable/disable site-wide maintenance mode
 * 3. Customize Coming Soon messages and estimated times
 * 4. Configure maintenance mode settings
 */

import { useState, useEffect } from 'react'
import {
  Clock, Save, RefreshCw,
  AlertTriangle, CheckCircle, Eye, EyeOff,
  Wrench, Calendar, MessageSquare, Zap
} from 'lucide-react'
import apiClient from '../../../shared/api/adminApi'

// FIX CRIT-10: Use proper apiClient (httpOnly cookie auth) instead of localStorage-based api
const api = apiClient
import { toast } from 'react-hot-toast'

// Import the coming soon config
import {
  SITE_CONFIG,
  getAllPagesStatus
} from '../../../shared/config/comingSoonConfig'

export default function ComingSoonManager() {
  const [siteConfig, setSiteConfig] = useState({ ...SITE_CONFIG })
  const [pages, setPages] = useState(() => getAllPagesStatus())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Page categories for organization
  const pageCategories = {
    tests: ['liveTests', 'practiceQuestions'],
    study: ['videos', 'currentAffairs'],
    community: ['doubtForum', 'studyGroups'],
    dashboard: ['achievements', 'referAndEarn'],
    admin: ['adminAnalytics', 'curriculumBuilder']
  }

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    setLoading(true)
    try {
      // FIX CRIT-10: Remove localStorage fallback - show error if API unavailable
      const response = await apiClient.get('/admin/coming-soon-config')
      if (response.data?.success) {
        const data = response.data.data || {}
        if (data.siteConfig && Object.keys(data.siteConfig).length > 0) {
          setSiteConfig(prev => ({ ...prev, ...data.siteConfig }))
        }
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          setPages(data.pages)
        }
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error) {
      console.error('Failed to load config:', error)
      toast.error('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleSiteConfigChange = (key, value) => {
    setSiteConfig(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handlePageToggle = (pageKey, field, value) => {
    setPages(prev => prev.map(page => 
      page.key === pageKey 
        ? { ...page, [field]: value }
        : page
    ))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // FIX CRIT-10: Remove localStorage fallback - require API for persistence
      const response = await apiClient.put('/admin/coming-soon-config', {
        siteConfig,
        pages
      })
      
      if (response.data?.success) {
        toast.success('Configuration saved successfully!')
        setHasChanges(false)
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const getCategoryLabel = (category) => {
    const labels = {
      tests: 'Test Pages',
      study: 'Study Pages',
      community: 'Community Pages',
      dashboard: 'Dashboard Features',
      admin: 'Admin Features'
    }
    return labels[category] || category
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Coming Soon & Maintenance Manager
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Control which pages show "Coming Soon" and manage maintenance mode
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={loadConfiguration}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
              hasChanges && !saving
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Site-Wide Maintenance Mode */}
      <div className={`rounded-xl border-2 p-6 mb-8 ${
        siteConfig.maintenanceMode 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200' 
          : 'bg-green-50 dark:bg-green-900/20 border-green-200'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${
              siteConfig.maintenanceMode ? 'bg-red-100' : 'bg-green-100 dark:bg-green-900/20'
            }`}>
              {siteConfig.maintenanceMode ? (
                <Wrench className="w-6 h-6 text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Site-Wide Maintenance Mode
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                {siteConfig.maintenanceMode 
                  ? 'Site is currently in maintenance mode. Users see maintenance page.'
                  : 'Site is live and accessible to all users.'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {siteConfig.allowAdminAccess && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                Admin access enabled
              </span>
            )}
            <button
              onClick={() => handleSiteConfigChange('maintenanceMode', !siteConfig.maintenanceMode)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                siteConfig.maintenanceMode ? 'bg-red-600' : 'bg-green-600'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                  siteConfig.maintenanceMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Maintenance Settings (shown when maintenance is enabled) */}
        {siteConfig.maintenanceMode && (
          <div className="mt-6 pt-6 border-t border-red-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Maintenance Message
                </label>
                <textarea
                  value={siteConfig.maintenanceMessage}
                  onChange={(e) => handleSiteConfigChange('maintenanceMessage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Estimated End Time
                </label>
                <input
                  type="datetime-local"
                  value={siteConfig.maintenanceEndTime || ''}
                  onChange={(e) => handleSiteConfigChange('maintenanceEndTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Estimated Downtime
                </label>
                <input
                  type="text"
                  value={siteConfig.estimatedDowntime}
                  onChange={(e) => handleSiteConfigChange('estimatedDowntime', e.target.value)}
                  placeholder="e.g., 30 minutes"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="allowAdminAccess"
                checked={siteConfig.allowAdminAccess}
                onChange={(e) => handleSiteConfigChange('allowAdminAccess', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
              />
              <label htmlFor="allowAdminAccess" className="text-sm text-gray-700 dark:text-gray-300">
                Allow admin access during maintenance
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Page-Specific Coming Soon Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Page-Specific Coming Soon Settings
        </h2>
        
        {Object.entries(pageCategories).map(([category, pageKeys]) => (
          <div key={category} className="mb-8 last:mb-0">
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" />
              {getCategoryLabel(category)}
            </h3>
            
            <div className="space-y-3">
              {pageKeys.map(pageKey => {
                const page = pages.find(p => p.key === pageKey)
                if (!page) return null
                
                return (
                  <div 
                    key={pageKey}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      page.comingSoon 
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' 
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        page.comingSoon ? 'bg-amber-100' : 'bg-green-100 dark:bg-green-900/20'
                      }`}>
                        {page.comingSoon ? (
                          <EyeOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{page.title || pageKey}</p>
                        {page.comingSoon && page.estimatedTime && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{page.estimatedTime}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium ${
                        page.comingSoon ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {page.comingSoon ? 'Coming Soon' : 'Live'}
                      </span>
                      <button
                        onClick={() => handlePageToggle(pageKey, 'comingSoon', !page.comingSoon)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          page.comingSoon ? 'bg-amber-500' : 'bg-green-50 dark:bg-green-900/20'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                            page.comingSoon ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">How it works:</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li><strong>Maintenance Mode:</strong> Shows maintenance page for all users (except admins if allowed)</li>
              <li><strong>Coming Soon:</strong> Individual pages show "Coming Soon" instead of content</li>
              <li><strong>Real-time:</strong> Changes take effect immediately after saving</li>
              <li><strong>Config files:</strong> Settings stored in <code>/shared/config/comingSoonConfig.js</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}