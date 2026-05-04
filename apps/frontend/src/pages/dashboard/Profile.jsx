import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { useTheme } from '../../shared/context/ThemeContext'
import { getUserAnalytics, getTestSeries, userAPI, getExams, authAPI } from '../../shared/lib/dataService'
import useProPass from '../../shared/hooks/useProPass'
import ImageCropperModal from '../../shared/components/common/ImageCropperModal'
import { 
  User, Mail, MessageCircle, Phone, Crown, Settings, Bell, Moon, Sun, 
  LogOut, ChevronRight, Shield, CreditCard, HelpCircle,
  Edit2, Camera, Check, LayoutDashboard, SidebarOpen,
  Trophy, Target, Clock, Flame, Award, BookOpen, TrendingUp,
  Calendar, Star, Zap, Activity, ClipboardCheck, Lock,
  Globe, Smartphone, AlertTriangle, Trash2, Plus, ChevronDown,
  MapPin, GraduationCap, AlertCircle, Timer, Sparkles, X, Save,
  BarChart2, Layers, MoreHorizontal, Download, RefreshCw,
  Gift, Users, Share2, Brain, LineChart, PieChart as PieChartIcon, Rocket, FileText
} from 'lucide-react'

// Toggle Switch Component
function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

// Section Label Component
function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{children}</span>
      {right}
    </div>
  )
}

// Cell Component
function Cell({ icon, iconBg, label, sub, right, onClick, danger, last }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div onClick={onClick}
      onPointerDown={() => onClick && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`flex items-center gap-3 px-5 py-4 ${!last ? 'border-b border-gray-100 dark:border-gray-700' : ''} ${onClick ? 'cursor-pointer' : ''} transition-colors ${pressed ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}>
      {icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg || '#F2F2F7' }}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-medium ${danger ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

// Compact Feature Card Component
function CompactFeatureCard({ icon, iconBg, title, description, onClick, comingSoon, badge, color = '#007AFF' }) {
  return (
    <div onClick={!comingSoon ? onClick : undefined}
      className={`relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 transition-all duration-200 ${comingSoon ? 'opacity-75' : 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 cursor-pointer'}`}>
      {comingSoon && (<div className="absolute top-2 right-2"><span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-bold rounded-full shadow-sm">Coming Soon</span></div>)}
      {badge && !comingSoon && (<div className="absolute top-2 right-2"><span className={`px-2 py-0.5 text-white text-[9px] font-bold rounded-full shadow-sm ${badge === 'New' ? 'bg-green-500' : badge === 'Pro' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gray-500'}`}>{badge}</span></div>)}
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{description}</p>
        </div>
        {!comingSoon && (<ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />)}
      </div>
    </div>
  )
}

// Settings Content Component (integrated into Profile)
function SettingsContent({ user, refreshUser, logout, proPass, isDarkMode, toggleDarkMode, navigate, settingsTab, setSettingsTab }) {
  const [saving, setSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [showPasswords, setShowPasswords] = useState(false)
  const [notifications, setNotifications] = useState({ email: true, push: true, sms: false, testReminders: true, promotional: false, weeklyReport: true })
  const [privacy, setPrivacy] = useState({ profileVisibility: 'public', showProgress: true, showOnLeaderboard: true, allowMessages: true })
  const [selectedLanguage, setSelectedLanguage] = useState(() => localStorage.getItem('trstprep_language') || 'en')
  
  const [showSessionsModal, setShowSessionsModal] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  useEffect(() => {
    if (user?.notificationPreferences) setNotifications(prev => ({ ...prev, ...user.notificationPreferences }))
    if (user?.privacy) setPrivacy(prev => ({ ...prev, ...user.privacy }))
  }, [user])

  const persistPreferences = async (updates) => {
    await userAPI.updateProfile(updates)
    await refreshUser()
  }

  const validatePasswordForm = () => {
    const errors = {}
    if (!passwordForm.current) errors.current = 'Current password is required'
    if (!passwordForm.new || passwordForm.new.length < 8) errors.new = 'New password must be at least 8 characters'
    if (passwordForm.new !== passwordForm.confirm) errors.confirm = 'Passwords do not match'
    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePasswordSave = async () => {
    if (!validatePasswordForm()) return
    try {
      setSaving(true)
      await authAPI.changePassword(passwordForm.current, passwordForm.new)
      setPasswordForm({ current: '', new: '', confirm: '' })
      setPasswordErrors({})
      await logout()
      navigate('/login', { state: { from: '/profile', message: 'Password updated. Please sign in again.' } })
    } catch (error) {
      console.error('Failed to update password:', error)
      alert(error.response?.data?.message || 'Failed to update password')
    } finally { setSaving(false) }
  }

  const handleNotificationChange = async (key, value) => {
    const next = { ...notifications, [key]: value }
    setNotifications(next)
    try { await persistPreferences({ notificationPreferences: next }) }
    catch (error) { setNotifications(notifications) }
  }

  const handlePrivacyChange = async (updates) => {
    const next = { ...privacy, ...updates }
    setPrivacy(next)
    try { await persistPreferences({ privacy: next }) }
    catch (error) { setPrivacy(privacy) }
  }

  const handleExportData = async () => {
    try {
      const [p, a, an] = await Promise.all([userAPI.getProfile(), userAPI.getAttempts(), userAPI.getAnalytics()])
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile: p.data?.data, attempts: a.data?.data, analytics: an.data?.data }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `trstprep-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { alert('Failed to export data') }
  }

  const handleDeactivate = async () => {
    if (!confirm('Deactivate your account?')) return
    await userAPI.updateProfile({ isActive: false })
    await logout()
    navigate('/login', { state: { from: '/', message: 'Account deactivated' } })
  }

  const handleDelete = async () => {
    if (!confirm('Delete your account permanently?')) return
    await userAPI.deleteAccount()
    await logout()
    navigate('/login', { state: { from: '/', message: 'Account deleted' } })
  }

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true)
      const res = await userAPI.getSessions()
      setSessions(res.data?.data || [])
    } catch (err) {
      console.error(err)
      alert('Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    try {
      setSessionsLoading(true)
      await userAPI.revokeSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId && s.sessionId !== sessionId))
    } catch (err) {
      console.error(err)
      alert('Failed to revoke session')
    } finally {
      setSessionsLoading(false)
    }
  }

  const settingsTabs = [
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'billing', label: 'Pro Pass', icon: Crown },
    { id: 'appearance', label: 'Appearance', icon: Moon },
  ]

  return (
    <div>

      {/* Security */}
      {settingsTab === 'security' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Update Password</h3>
            <div className="space-y-3">
              <input type={showPasswords ? "text" : "password"} placeholder="Current Password" value={passwordForm.current} onChange={(e) => setPasswordForm(f => ({...f, current: e.target.value}))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input type={showPasswords ? "text" : "password"} placeholder="New Password" value={passwordForm.new} onChange={(e) => setPasswordForm(f => ({...f, new: e.target.value}))}
                  className={`w-full px-4 py-2.5 rounded-xl border ${passwordErrors.new ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white`} />
                <input type={showPasswords ? "text" : "password"} placeholder="Confirm" value={passwordForm.confirm} onChange={(e) => setPasswordForm(f => ({...f, confirm: e.target.value}))}
                  className={`w-full px-4 py-2.5 rounded-xl border ${passwordErrors.confirm ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white`} />
              </div>
              <button onClick={() => setShowPasswords(!showPasswords)} className="text-xs font-bold text-indigo-600 hover:underline">{showPasswords ? 'Hide' : 'Show'} Characters</button>
              <button onClick={handlePasswordSave} disabled={saving} className="w-full py-2.5 bg-gray-900 dark:bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="relative">
              <Cell 
                icon={<Smartphone className="w-4 h-4 text-indigo-500" />} 
                iconBg="#EEF2FF" 
                label="Session Management" 
                sub="View and manage active devices" 
                onClick={() => {
                  setShowSessionsModal(true)
                  fetchSessions()
                }} 
              />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/20 overflow-hidden">
            <div className="px-4 py-2 bg-red-50/50 dark:bg-red-900/10"><span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Danger Zone</span></div>
            <Cell icon={<AlertCircle className="w-4 h-4 text-red-500" />} iconBg="#FEF2F2" label="Deactivate Account" sub="Temporarily disable" onClick={handleDeactivate} />
            <Cell icon={<Trash2 className="w-4 h-4 text-red-600" />} iconBg="#FEF2F2" label="Delete Account" sub="Permanently remove all data" danger last onClick={handleDelete} />
          </div>
        </div>
      )}

      {/* Notifications */}
      {settingsTab === 'notifications' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Channels</SectionLabel>
            <Cell label="Email Notifications" sub="Results, reports, updates" right={<ToggleSwitch checked={notifications.email} onChange={(v) => handleNotificationChange('email', v)} />} />
            <Cell label="Push Notifications" sub="Mobile & desktop alerts" right={<ToggleSwitch checked={notifications.push} onChange={(v) => handleNotificationChange('push', v)} />} />
            <Cell label="SMS Alerts" sub="Critical updates" right={<ToggleSwitch checked={notifications.sms} onChange={(v) => handleNotificationChange('sms', v)} />} last />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Reminders</SectionLabel>
            <Cell label="Daily Study Goal" sub="Remind to study" right={<ToggleSwitch checked={notifications.testReminders} onChange={(v) => handleNotificationChange('testReminders', v)} />} />
            <Cell label="Weekly Report" sub="Performance summary" right={<ToggleSwitch checked={notifications.weeklyReport} onChange={(v) => handleNotificationChange('weeklyReport', v)} />} />
            <Cell label="Promotional" sub="New features & offers" right={<ToggleSwitch checked={notifications.promotional} onChange={(v) => handleNotificationChange('promotional', v)} />} last />
          </div>
        </div>
      )}

      {/* Privacy */}
      {settingsTab === 'privacy' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Account Privacy</SectionLabel>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Profile Visibility</label>
              <select value={privacy.profileVisibility} onChange={(e) => handlePrivacyChange({ profileVisibility: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent text-sm font-medium">
                <option value="public">Public</option>
                <option value="friends">Friends Only</option>
                <option value="private">Private</option>
              </select>
            </div>
            <Cell label="Show Progress" sub="Let others see scores" right={<ToggleSwitch checked={privacy.showProgress} onChange={(v) => handlePrivacyChange({ showProgress: v })} />} />
            <Cell label="Leaderboard" sub="Show name on rank lists" right={<ToggleSwitch checked={privacy.showOnLeaderboard} onChange={(v) => handlePrivacyChange({ showOnLeaderboard: v })} />} />
            <Cell label="Allow Messages" sub="Receive study invites" right={<ToggleSwitch checked={privacy.allowMessages} onChange={(v) => handlePrivacyChange({ allowMessages: v })} />} last />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <SectionLabel>Your Data</SectionLabel>
            <p className="text-xs text-gray-500 mb-3">Download your personal data and test history.</p>
            <button onClick={handleExportData} className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200">
              <Download className="w-4 h-4" /> Export Data (.json)
            </button>
          </div>
        </div>
      )}

      {/* Billing */}
      {settingsTab === 'billing' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
            <div className="flex justify-between items-start mb-6">
              <div><h3 className="text-lg font-black">Trstprep Pro</h3><p className="text-indigo-100 text-xs">{proPass.isActive ? 'Active' : 'Inactive'}</p></div>
              <Crown className="w-7 h-7 text-yellow-400" />
            </div>
            {proPass.isActive ? (
              <p className="text-sm">Renews: {proPass.formattedExpiry || 'N/A'}</p>
            ) : (
              <Link to="/pass" className="inline-block px-5 py-2 bg-white text-indigo-600 rounded-xl text-sm font-bold">Upgrade Now</Link>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <Cell label="Payment Methods" sub="Manage payment options" right={<span className="px-2 py-0.5 bg-gray-500 text-white text-[9px] font-bold rounded-full">Coming Soon</span>} />
            <Cell label="Billing History" sub="View invoices" right={<Link to="/pass" className="text-xs font-bold text-indigo-600 hover:underline">View</Link>} last />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Help</SectionLabel>
            <Cell icon={<HelpCircle className="w-4 h-4 text-blue-500" />} iconBg="#EFF5FF" label="Help Center" onClick={() => window.open('https://help.trstprep.com', '_blank')} />
            <Cell icon={<Shield className="w-4 h-4 text-gray-500" />} iconBg="#F9FAFB" label="Privacy Policy" onClick={() => window.open('/privacy', '_blank')} />
            <Cell icon={<BookOpen className="w-4 h-4 text-gray-500" />} iconBg="#F9FAFB" label="Terms of Service" last onClick={() => window.open('/terms', '_blank')} />
          </div>
        </div>
      )}

      {/* Appearance */}
      {settingsTab === 'appearance' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <SectionLabel>Display</SectionLabel>
          <Cell icon={isDarkMode ? <Moon className="w-4 h-4 text-blue-500" /> : <Sun className="w-4 h-4 text-orange-500" />}
            label="Dark Mode" sub="Toggle theme"
            right={<ToggleSwitch checked={isDarkMode} onChange={toggleDarkMode} />} />
          <SectionLabel>Language</SectionLabel>
          {[
            { code: 'en', name: 'English' },
            { code: 'hi', name: 'हिंदी (Hindi)' },
          ].map(({ code, name }) => (
            <Cell key={code} label={name}
              right={selectedLanguage === code && <Check className="w-4 h-4 text-indigo-600" />}
              onClick={() => { setSelectedLanguage(code); localStorage.setItem('trstprep_language', code) }}
              last={code === 'hi'} />
          ))}
          <p className="px-5 py-2 text-[10px] text-gray-400">More languages coming soon</p>
        </div>
      )}

      {/* Sessions Modal */}
      {showSessionsModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Sessions</h3>
                <p className="text-xs text-gray-500">Devices where you are currently logged in</p>
              </div>
              <button onClick={() => setShowSessionsModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" /></div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No active sessions found.</div>
              ) : (
                sessions.map((session) => (
                  <div key={session.sessionId || session.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                          {session.device === 'mobile' ? <Smartphone className="w-5 h-5" /> : session.device === 'tablet' ? <Globe className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {session.browser && session.browser.toLowerCase() !== 'unknown' ? session.browser : 'Browser'} on {session.os && session.os.toLowerCase() !== 'unknown' ? session.os : 'Unknown OS'}
                            </span>
                            {/* All returned sessions are active */}
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[9px] font-bold uppercase rounded-full tracking-wider">Active</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                            <span>IP: {session.ip}</span>
                            <span>•</span>
                            <span>{session.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-[11px] text-gray-500">
                        <span className="block">Last active: {session.lastActive ? new Date(session.lastActive).toLocaleString() : 'N/A'}</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm('Revoke this session? This will sign you out on that device.')) {
                            handleRevokeSession(session.id || session.sessionId)
                          }
                        }}
                        disabled={sessionsLoading}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function Profile({ initialTab = 'personal' }) {
  const { user, refreshUser, logout } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const proPass = useProPass()
  const fileInputRef = useRef(null)
  const bannerFileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [settingsTab, setSettingsTab] = useState('security')
  const [isEditing, setIsEditing] = useState(false)
  const [navMode, setNavMode] = useState('top')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enrolledExams, setEnrolledExams] = useState([])
  const [enrolledTestSeries, setEnrolledTestSeries] = useState([])
  const [userStats, setUserStats] = useState({ testsAttempted: 0, avgAccuracy: 0, rank: 0, timeSpent: 0, streak: 0, improvement: '' })
  const [notifications, setNotifications] = useState({ email: true, push: true, sms: false, testReminders: true })
  
  const [editForm, setEditForm] = useState({ name: '', phone: '', dateOfBirth: '', location: '', education: '', bio: '' })
  const [editErrors, setEditErrors] = useState({})
  const [editSuccess, setEditSuccess] = useState(false)
  
  const [showPhotoOptionsModal, setShowPhotoOptionsModal] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [privacy, setPrivacy] = useState({ profileVisibility: 'public', showProgress: true, showOnLeaderboard: true, allowMessages: true })
  
  const [personalInfo, setPersonalInfo] = useState({ fullName: '', email: '', phone: '', dateOfBirth: '', location: '', education: '' })
  const [cropperState, setCropperState] = useState({ isOpen: false, src: null, type: null })
  
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [unenrollingId, setUnenrollingId] = useState(null)
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(null)
  const [expandedExam, setExpandedExam] = useState(null)
  const [attemptRows, setAttemptRows] = useState([])
  
  // Location selector state
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationTab, setLocationTab] = useState('state')
  const [selectedState, setSelectedState] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedPincode, setSelectedPincode] = useState('')

  const getSeriesAttemptCount = (series) => {
    if (!user || !series) return 0

    const attemptCountFromRows = [
      series.dbId,
      series._id,
      series.id,
      String(series.dbId),
      String(series._id),
      String(series.id),
      series.slug,
      series.public_id
    ]
      .filter(Boolean)
      .reduce((max, key) => {
        const count = attemptRows
          .filter((attempt) => [attempt.seriesId, attempt.seriesSlug].filter(Boolean).map(String).includes(String(key)))
          .reduce((tests, attempt) => {
            tests.add(String(attempt.testId || attempt.testSlug || attempt.id || ''))
            return tests
          }, new Set()).size
        return Math.max(max, count)
      }, 0)

    const attemptCountFromUser = (
      user.attemptedTests?.[series.dbId] ??
      user.attemptedTests?.[series._id] ??
      user.attemptedTests?.[series.id] ??
      user.attemptedTests?.[String(series.dbId)] ??
      user.attemptedTests?.[String(series._id)] ??
      user.attemptedTests?.[String(series.id)] ??
      user.attemptedTests?.[series.slug] ??
      user.attemptedTests?.[series.public_id] ??
      0
    )

    return Math.max(attemptCountFromRows, attemptCountFromUser)
  }
  
  const statesAndCities = {
    'Maharashtra': [{ city: 'Mumbai', pincode: '400001' }, { city: 'Pune', pincode: '411001' }, { city: 'Nagpur', pincode: '440001' }],
    'Delhi': [{ city: 'New Delhi', pincode: '110001' }, { city: 'South Delhi', pincode: '110017' }, { city: 'North Delhi', pincode: '110007' }],
    'Karnataka': [{ city: 'Bangalore', pincode: '560001' }, { city: 'Mysore', pincode: '570001' }, { city: 'Mangalore', pincode: '575001' }],
    'Tamil Nadu': [{ city: 'Chennai', pincode: '600001' }, { city: 'Madurai', pincode: '625001' }, { city: 'Coimbatore', pincode: '641001' }],
    'Gujarat': [{ city: 'Ahmedabad', pincode: '380001' }, { city: 'Surat', pincode: '395001' }, { city: 'Vadodara', pincode: '390001' }],
    'Rajasthan': [{ city: 'Jaipur', pincode: '302001' }, { city: 'Jodhpur', pincode: '342001' }, { city: 'Udaipur', pincode: '313001' }],
    'Uttar Pradesh': [{ city: 'Lucknow', pincode: '226001' }, { city: 'Kanpur', pincode: '208001' }, { city: 'Varanasi', pincode: '221001' }],
    'West Bengal': [{ city: 'Kolkata', pincode: '700001' }, { city: 'Durgapur', pincode: '713201' }, { city: 'Siliguri', pincode: '734001' }],
  }

  // Calculate profile completion based on filled fields
  const calculateProfileCompletion = () => {
    if (!user) return 0
    const fields = [
      personalInfo.fullName,
      personalInfo.email,
      personalInfo.phone,
      personalInfo.dateOfBirth,
      personalInfo.location,
      personalInfo.education,
      user.avatar,
      user.banner,
      editForm.bio
    ]
    const filled = fields.filter(field => field && String(field).trim() !== '').length
    return Math.round((filled / fields.length) * 100)
  }

  // Tab persistence - save to localStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('trstprep_profileTab')
    if (savedTab && ['personal', 'exams', 'features', 'account', 'privacy', 'notifications', 'subscription', 'layout'].includes(savedTab)) {
      setActiveTab(savedTab)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('trstprep_profileTab', activeTab)
  }, [activeTab])

  useEffect(() => {
    const savedNavMode = localStorage.getItem('trstprep_navMode')
    if (savedNavMode) setNavMode(savedNavMode)
    const savedLanguage = localStorage.getItem('trstprep_language') || 'en'
    setSelectedLanguage(savedLanguage)
  }, [])

  const toggleNavMode = (mode) => { setNavMode(mode); localStorage.setItem('trstprep_navMode', mode); window.location.reload() }

  useEffect(() => {
    if (!user) { navigate('/login', { state: { from: '/profile' } }); return }

    setPersonalInfo({ 
      fullName: user.name || '', 
      email: user.email || '', 
      phone: user.phone || '', 
      dateOfBirth: user.dateOfBirth || '', 
      location: user.location || '', 
      education: user.education || '' 
    })
    setEditForm({ 
      name: user.name || '', 
      phone: user.phone || '', 
      dateOfBirth: user.dateOfBirth || '', 
      location: user.location || '', 
      education: user.education || '', 
      bio: user.bio || '' 
    })
    
    const fetchUserData = async () => {
      try {
        setLoading(true)
        const [analyticsResponse, examsResponse, enrolledSeriesResponse, attemptsResponse] = await Promise.all([
          getUserAnalytics().catch(() => ({})),
          getExams().catch(() => []),
          userAPI.getEnrolledSeries().catch(() => ({ data: { data: [] } })),
          userAPI.getAttempts().catch(() => ({ data: { data: [] } }))
        ])
        
        const data = analyticsResponse || {}
        setAttemptRows(attemptsResponse?.data?.data || [])
        setUserStats({
          testsAttempted: data.totalTests || user?.testsTaken || 0,
          avgAccuracy: data.avgAccuracy || user?.accuracy || 0,
          rank: data.rank || user?.bestRank || 0,
          timeSpent: data.totalHours || user?.hoursSpent || 0,
          streak: data.streak || user?.streak || 0,
          improvement: data.improvement || user?.improvement || ''
        })
        const enrolledSeries = enrolledSeriesResponse?.data?.data || []
        const allExams = examsResponse || []
        
        // Enrich enrolled series with test counts from user.attemptedTests
        const enrichedSeries = enrolledSeries.map(series => {
          const totalTests = series.totalTests || 0
          const attemptedCount = getSeriesAttemptCount(series)
          return { ...series, done: attemptedCount, tests: totalTests, completed: totalTests > 0 && attemptedCount >= totalTests }
        })
        setEnrolledTestSeries(enrichedSeries)
        
        const enrolledExamsMap = new Map()
        enrichedSeries.forEach(series => {
          const subcategory = series.subcategory || series.sub_category_id
          if (subcategory) {
            const matchedExam = allExams.find(exam => (exam.exam_id || exam.examId) === subcategory)
            if (matchedExam) {
              const examKey = matchedExam.id || matchedExam._id
              const existing = enrolledExamsMap.get(examKey)
              if (existing) {
                existing.series.push(series)
                existing.testsDone = (existing.testsDone || 0) + (series.done || 0)
                existing.totalTests = (existing.totalTests || 0) + (series.totalTests || 0)
              } else {
                enrolledExamsMap.set(examKey, { ...matchedExam, subcategory, enrolledSeriesId: series.id || series._id, enrolledSeriesTitle: series.title, testsDone: series.done || 0, totalTests: series.totalTests || 0, series: [series] })
              }
            }
          }
        })
        setEnrolledExams(Array.from(enrolledExamsMap.values()))
      } catch (error) {
        console.error('Failed to fetch user stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUserData()
  }, [user, navigate])

  const handleLogout = () => { if (confirm('Are you sure you want to logout?')) logout() }

  const handlePhotoClick = () => { if (user.avatar) setShowPhotoOptionsModal(true); else fileInputRef.current?.click() }

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang); localStorage.setItem('trstprep_language', lang)
    alert(`Language changed to ${lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'English'}`)
  }

  const handleNotificationToggle = async (key) => {
    const newNotifications = { ...notifications, [key]: !notifications[key] }
    setNotifications(newNotifications)
    try {
      await userAPI.updateProfile({ notificationPreferences: newNotifications })
      await refreshUser()
    }
    catch (error) { console.error('Failed to save notification preferences:', error); setNotifications(notifications) }
  }

  const handlePrivacyChange = async (updates) => {
    const previousPrivacy = privacy
    const nextPrivacy = { ...privacy, ...updates }
    setPrivacy(nextPrivacy)

    try {
      setSaving(true)
      await userAPI.updateProfile({ privacy: nextPrivacy })
      await refreshUser()
    } catch (error) {
      console.error('Failed to save privacy preferences:', error)
      setPrivacy(previousPrivacy)
      alert('Failed to save privacy settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemovePhoto = async () => {
    try {
      setSaving(true)
      const response = await userAPI.updateProfile({ avatar: '' })
      if (response.data?.success) { refreshUser(); setShowPhotoOptionsModal(false) }
    } catch (error) { console.error('Failed to remove photo:', error); alert('Failed to remove photo.') }
    finally { setSaving(false) }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image size should be less than 5MB'); return }
    const reader = new FileReader()
    reader.onloadend = () => {
      setCropperState({ isOpen: true, src: reader.result, type: 'avatar' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowPhotoOptionsModal(false)
    }
    reader.readAsDataURL(file)
  }

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Cover photo must be less than 5MB'); return }
    const reader = new FileReader()
    reader.onloadend = () => {
      setCropperState({ isOpen: true, src: reader.result, type: 'banner' })
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedBase64) => {
    try {
      setSaving(true)
      const field = cropperState.type === 'avatar' ? 'avatar' : 'banner'
      const response = await userAPI.updateProfile({ [field]: croppedBase64 })
      if (response.data?.success) {
        await refreshUser()
      }
    } catch (error) {
      console.error('Failed to update photo:', error)
      alert('Failed to update photo.')
    } finally {
      setSaving(false)
      setCropperState({ isOpen: false, src: null, type: null })
    }
  }

  const handleDeactivateAccount = async () => {
    if (!confirm('Deactivate your account? You can sign in again later to reactivate it.')) return

    try {
      setSaving(true)
      await userAPI.updateProfile({ isActive: false })
      await logout()
      navigate('/login', { state: { from: '/', message: 'Account deactivated' } })
    } catch (error) {
      console.error('Failed to deactivate account:', error)
      alert('Failed to deactivate account.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account? This will start the account deletion flow and sign you out.')) return

    try {
      setSaving(true)
      await userAPI.deleteAccount()
      await logout()
      navigate('/login', { state: { from: '/', message: 'Account deletion requested' } })
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('Failed to delete account.')
    } finally {
      setSaving(false)
    }
  }

  const handleExportData = async () => {
    try {
      const [profileResponse, attemptsResponse, analyticsResponse] = await Promise.all([
        userAPI.getProfile(),
        userAPI.getAttempts(),
        userAPI.getAnalytics(),
      ])

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        profile: profileResponse.data?.data || null,
        attempts: attemptsResponse.data?.data || [],
        analytics: analyticsResponse.data?.data || null,
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `trstprep-account-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export account data:', error)
      alert('Failed to export account data.')
    }
  }

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    if (editErrors[field]) setEditErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validateEditForm = () => {
    const errors = {}
    if (!editForm.name || editForm.name.trim().length < 2) errors.name = 'Name must be at least 2 characters'
    if (editForm.phone && !/^[6-9]\d{9}$/.test(editForm.phone)) errors.phone = 'Please enter a valid Indian phone number'
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveProfile = async () => {
    if (!validateEditForm()) return
    try {
      setSaving(true); setEditSuccess(false)
      const response = await userAPI.updateProfile({
        name: editForm.name.trim(), mobile: editForm.phone?.trim() || '',
        dateOfBirth: editForm.dateOfBirth?.trim() || '', location: editForm.location?.trim() || '', education: editForm.education?.trim() || '', bio: editForm.bio?.trim() || ''
      })
      if (response.data?.success) {
        setPersonalInfo({ fullName: editForm.name, email: user.email, phone: editForm.phone, dateOfBirth: editForm.dateOfBirth, location: editForm.location, education: editForm.education })
        refreshUser()
        setEditSuccess(true)
        setTimeout(() => { setIsEditing(false); setEditSuccess(false) }, 1500)
      }
    } catch (error) { console.error('Failed to update profile:', error); alert('Failed to update profile.') }
    finally { setSaving(false) }
  }

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null)
    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [activeMenuId])

  const handleUnenrollExam = async (exam) => {
    try {
      setUnenrollingId(exam.id || exam._id)
      await userAPI.unenrollFromSeries(exam.enrolledSeriesId || exam.id)
      setEnrolledExams(prev => prev.filter(e => (e.id || e._id) !== (exam.id || exam._id)))
      setShowUnenrollConfirm(null)
      setActiveMenuId(null)
    } catch (error) {
      console.error('Failed to unenroll from exam:', error)
      alert('Failed to unenroll. Please try again.')
    } finally {
      setUnenrollingId(null)
    }
  }

  const handleUnenrollSeries = async (series) => {
    try {
      setUnenrollingId(series.id || series._id)
      await userAPI.unenrollFromSeries(series.id || series._id)
      setEnrolledTestSeries(prev => prev.filter(s => (s.id || s._id) !== (series.id || series._id)))
      setShowUnenrollConfirm(null)
      setActiveMenuId(null)
    } catch (error) {
      console.error('Failed to unenroll from series:', error)
      alert('Failed to unenroll. Please try again.')
    } finally {
      setUnenrollingId(null)
    }
  }

  if (!user) return null

  return (
    <>
      <div className="bg-gray-50 dark:bg-gray-900 pb-4 md:pb-8">
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
        
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        <input ref={bannerFileInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />

        {/* Hero Section */}
        <div className="relative">
        <div className="md:hidden h-52 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500">
            {user.banner && (
              <>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${user.banner})` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40 backdrop-blur-[2px]" />
              </>
            )}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
          <button onClick={() => bannerFileInputRef.current?.click()}
            className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xl rounded-xl text-xs font-bold text-white border border-white/30 transition-all shadow-lg hover:scale-105 active:scale-95">
            <Camera className="w-3.5 h-3.5" /> Edit Cover
          </button>
        </div>
        
        <div className="hidden md:block max-w-5xl mx-auto">
          <div className="h-72 relative overflow-hidden rounded-b-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500">
              {user.banner && (
                <>
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${user.banner})` }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40 backdrop-blur-[2px]" />
                </>
              )}
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
              <div className="absolute top-1/2 left-1/4 w-40 h-40 bg-pink-400/8 rounded-full blur-xl" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
            <button onClick={() => bannerFileInputRef.current?.click()}
              className="absolute top-5 right-5 z-20 flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-xl rounded-xl text-sm font-bold text-white border border-white/30 transition-all shadow-lg hover:scale-105 active:scale-95">
              <Camera className="w-4 h-4" /> Edit Cover Photo
            </button>
          </div>
        </div>
      </div>

        <div className="max-w-5xl mx-auto px-4 -mt-20 md:-mt-28 relative z-30">
          {/* Mobile */}
          <div className="md:hidden">
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl p-5 border border-white/20 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-white/40 to-white/10 shadow-xl">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-800">
                      {user.avatar ? (
                        <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 text-indigo-600 dark:text-indigo-300 text-3xl font-black">
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={handlePhotoClick}
                    className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 text-white rounded-full shadow-lg border-2 border-white/50 hover:scale-110 active:scale-95 transition-transform">
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl font-black text-white tracking-tight truncate">{user.name}</h1>
                    {user.hasProPass && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black rounded-lg shadow-lg flex-shrink-0">
                        <Crown className="w-3 h-3" /> PRO
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-white/70 font-medium mb-3 truncate">{user.email}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {personalInfo.location && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 text-white text-xs font-bold rounded-lg backdrop-blur-sm">
                        <MapPin className="w-3 h-3" /> {personalInfo.location?.split(' -')[0]}
                      </span>
                    )}
                    {userStats.streak > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-lg shadow-md">
                        <Flame className="w-3 h-3" /> {userStats.streak}d
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {personalInfo.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <Phone className="w-3 h-3 text-white/50" />
                        <span>{personalInfo.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 bg-slate-900/60 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-2xl">
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: 'Tests', value: userStats.testsAttempted, suffix: '', icon: '📝', bg: 'bg-blue-500/20' },
                  { label: 'Accuracy', value: userStats.avgAccuracy || 0, suffix: '%', icon: '🎯', bg: 'bg-green-500/20' },
                  { label: 'Rank', value: userStats.rank || '--', suffix: '', icon: '🏆', bg: 'bg-purple-500/20' },
                  { label: 'Hours', value: userStats.timeSpent, suffix: 'h', icon: '⏱️', bg: 'bg-orange-500/20' },
                  { label: 'Streak', value: userStats.streak, suffix: 'd', icon: '🔥', bg: 'bg-red-500/20' },
                ].map(({ label, value, suffix, icon, bg }) => (
                  <div key={label} className={`text-center p-1.5 ${bg} rounded-xl backdrop-blur-sm`}>
                    <div className="text-sm mb-0.5">{icon}</div>
                    <div className="text-[10px] font-black text-white leading-none">{value}{suffix}</div>
                    <div className="text-[6px] font-semibold text-white/60 uppercase tracking-wider mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-white/20 shadow-2xl">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full p-1 bg-gradient-to-br from-white/40 via-white/20 to-white/10 shadow-xl">
                      <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-800">
                        {user.avatar ? (
                          <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 text-indigo-600 dark:text-indigo-300 text-2xl md:text-3xl font-black">
                            {user.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={handlePhotoClick}
                      className="absolute -bottom-1 -right-1 p-1.5 md:p-2 bg-indigo-600 text-white rounded-full shadow-lg border-2 border-white/30 hover:scale-110 active:scale-95 transition-transform">
                      <Camera className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{user.name}</h1>
                      {user.hasProPass && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black rounded-md shadow-lg">
                          <Crown className="w-3 h-3" /> PRO
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-white/70 font-medium mb-2">{user.email}</p>
                    
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {personalInfo.location && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-lg backdrop-blur-sm">
                          <MapPin className="w-3 h-3" /> {personalInfo.location?.split(' -')[0]}
                        </span>
                      )}
                      {userStats.streak > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold rounded-lg">
                          <Flame className="w-3 h-3" /> {userStats.streak}d
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white/70 text-xs font-medium rounded-lg">
                        <Calendar className="w-3 h-3" /> {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Accuracy</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[200px]">
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${userStats.avgAccuracy || 0}%`,
                            background: `linear-gradient(90deg, #34C759, ${userStats.avgAccuracy >= 80 ? '#34C759' : userStats.avgAccuracy >= 60 ? '#FF9500' : '#FF3B30'})`
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white">{userStats.avgAccuracy || 0}%</span>
                    </div>

                  </div>
                </div>
              </div>

              <div className="lg:w-80 xl:w-96 flex-shrink-0 bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white/90 uppercase tracking-wider">Your Progress</h3>
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Tests', value: userStats.testsAttempted, icon: '📝' },
                    { label: 'Accuracy', value: `${userStats.avgAccuracy || 0}%`, icon: '🎯' },
                    { label: 'Rank', value: userStats.rank || '--', icon: '🏆' },
                    { label: 'Hours', value: userStats.timeSpent, icon: '⏱️' },
                    { label: 'Streak', value: `${userStats.streak}d`, icon: '🔥' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="text-center p-2 bg-white/10 rounded-xl">
                      <div className="text-lg mb-0.5">{icon}</div>
                      <div className="text-sm font-black text-white">{value}</div>
                      <div className="text-[8px] font-semibold text-white/60 uppercase tracking-wider">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-6">
        {/* Tab Navigation - Always visible with animation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 p-1.5 overflow-hidden">
          <div className="flex gap-0.5 overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              const el = e.currentTarget;
              el.isDragging = false;
              el.startX = e.pageX;
              el.scrollLeftAtStart = el.scrollLeft;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.cursor = 'grab';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.cursor = 'grab';
            }}
            onMouseMove={(e) => {
              const el = e.currentTarget;
              if (!el.startX && el.startX !== 0) return;
              const x = e.pageX;
              const walk = (x - el.startX) * 1.5;
              if (Math.abs(walk) > 5) {
                el.isDragging = true;
                el.style.cursor = 'grabbing';
                e.preventDefault();
                el.scrollLeft = el.scrollLeftAtStart - walk;
              }
            }}
            onClick={(e) => {
              const el = e.currentTarget;
              if (el.isDragging) {
                e.stopPropagation();
                el.isDragging = false;
              }
            }}>
            {activeTab === 'settings' ? (
              <>
                <button onClick={() => setActiveTab('personal')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  style={{ animation: 'fadeIn 0.2s ease' }}>
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  <span>Back</span>
                </button>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 self-center"></div>
                {[
                  { id: 'security', label: 'Security', icon: Lock },
                  { id: 'notifications', label: 'Notifications', icon: Bell },
                  { id: 'privacy', label: 'Privacy', icon: Shield },
                  { id: 'appearance', label: 'Appearance', icon: Moon },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      settingsTab === tab.id
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    style={{ animation: 'fadeIn 0.2s ease' }}>
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {[
                  { id: 'personal', label: 'Personal', icon: User },
                  { id: 'exams', label: 'Exams', icon: BookOpen },
                  { id: 'features', label: 'Features', icon: Sparkles },
                  { id: 'pro', label: 'Pro Pass', icon: Crown },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    style={{ animation: 'fadeIn 0.2s ease' }}>
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 self-center"></div>
                <button onClick={() => { setActiveTab('settings'); setSettingsTab('security'); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  style={{ animation: 'fadeIn 0.2s ease' }}>
                  <Settings className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </button>
                <div className="md:hidden w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 self-center"></div>
                <button onClick={handleLogout}
                  className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  style={{ animation: 'fadeIn 0.2s ease' }}>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">

          {/* Personal Tab */}
          {activeTab === 'personal' && (
            <div style={{ animation: 'fadeIn 0.35s ease both' }}>
              {!isEditing ? (
                <div className="space-y-5">
                  {personalInfo.bio && (
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-2xl shadow-sm border border-indigo-100/50 dark:border-gray-700">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <span className="text-white text-lg">💬</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">About Me</h3>
                            <p className="text-xs text-gray-500">Your personal bio</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-1">{personalInfo.bio}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Personal Details</h2>
                            <p className="text-xs text-gray-500">Your basic information</p>
                          </div>
                        </div>
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="grid md:grid-cols-2 gap-3">
                        {[
                          { label: 'Full Name', val: personalInfo.fullName || 'Not set', icon: User, color: '#007AFF', bg: 'from-blue-500 to-indigo-600' },
                          { label: 'Email', val: personalInfo.email || 'Not set', icon: Mail, color: '#34C759', bg: 'from-green-500 to-emerald-600' },
                          { label: 'Phone', val: personalInfo.phone || 'Not set', icon: Phone, color: '#FF9500', bg: 'from-orange-500 to-amber-600' },
                          { label: 'Date of Birth', val: personalInfo.dateOfBirth || 'Not set', icon: Calendar, color: '#AF52DE', bg: 'from-purple-500 to-pink-600' },
                          { label: 'Location', val: personalInfo.location?.split(' -')[0] || 'Not set', icon: MapPin, color: '#FF3B30', bg: 'from-red-500 to-rose-600' },
                          { label: 'Education', val: personalInfo.education || 'Not set', icon: GraduationCap, color: '#00C7BE', bg: 'from-teal-500 to-cyan-600' },
                        ].map(({ label, val, icon: Icon, color, bg }) => (
                          <div key={label} className="group relative bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                            <div className="flex items-start gap-3">
                              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${bg} flex items-center justify-center shadow-sm flex-shrink-0`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={val}>{val}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white/90">Profile Completion</span>
                          <span className="text-sm font-bold text-white">{calculateProfileCompletion()}%</span>
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${calculateProfileCompletion()}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Logout Option */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-5">
                    <button
                      onClick={() => { if (window.confirm('Are you sure you want to logout?')) { logout(); navigate('/') } }}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/50">
                        <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-red-600 dark:text-red-400">Logout</div>
                        <div className="text-xs text-gray-400">Sign out of your account</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400" />
                    </button>
                  </div>

                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Profile</h2>
                    {editSuccess && <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><Check className="w-4 h-4" /> Saved!</span>}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                      <input type="text" value={editForm.name} onChange={(e) => handleEditChange('name', e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-xl border ${editErrors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent`} />
                      {editErrors.name && <p className="mt-1 text-xs text-red-500">{editErrors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                      <input type="tel" value={editForm.phone} onChange={(e) => handleEditChange('phone', e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-xl border ${editErrors.phone ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent`} />
                      {editErrors.phone && <p className="mt-1 text-xs text-red-500">{editErrors.phone}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
                      <input type="date" value={editForm.dateOfBirth} onChange={(e) => handleEditChange('dateOfBirth', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                      <button type="button" onClick={() => { setSelectedState(''); setSelectedCity(''); setSelectedPincode(''); setLocationTab('state'); setShowLocationModal(true) }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-left hover:bg-gray-50 dark:hover:bg-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                          {editForm.location || 'Select your location'}
                        </div>
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Education</label>
                      <input type="text" value={editForm.education} onChange={(e) => handleEditChange('education', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                      <textarea value={editForm.bio} onChange={(e) => handleEditChange('bio', e.target.value)} rows={3}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleSaveProfile} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50">
                        {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
                      </button>
                      <button onClick={() => setIsEditing(false)}
                        className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Exams Tab */}
          {activeTab === 'exams' && (
            <div className="space-y-6" style={{ animation: 'fadeIn 0.35s ease both' }}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-visible">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Enrolled Exams</h3>
                  <Link to="/exams" className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Browse
                  </Link>
                </div>
                {enrolledExams.length > 0 ? (
                  <div className="px-3 pb-3 space-y-3 overflow-visible">
                    {enrolledExams.slice(0, 6).map((exam, i) => {
                      const color = ['#007AFF', '#34C759', '#FF9500', '#AF52DE'][i % 4]
                      const examId = exam.id || exam._id || i
                      const isLoading = unenrollingId === examId
                      const examSeries = exam.series || []
                      
                      return (
                        <div key={examId} className="relative group bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-visible">
                          <button 
                            onClick={() => setExpandedExam(expandedExam === examId ? null : examId)}
                            className="flex items-center gap-2 p-2.5 w-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: `${color}18` }}>
                              {exam.icon || '🎯'}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{exam.title || exam.name}</div>
                              <div className="text-[10px] text-gray-500 truncate">{examSeries.length} series • {exam.testsDone || 0}/{exam.totalTests || 0} tests</div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedExam === examId ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {expandedExam === examId && examSeries.length > 0 && (
                            <div className="px-3 pb-3 space-y-2">
                              {examSeries.map(series => {
                                const seriesId = series.id || series._id || series.slug
                                const seriesLoading = unenrollingId === seriesId
                                return (
                                  <div key={seriesId} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg">
                                    <Link to={`/test-series/${series.slug || seriesId}`} className="flex items-center gap-2 flex-1 min-w-0">
                                      <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm flex-shrink-0" style={{ background: `${color}12` }}>
                                        {series.icon || '📝'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-medium text-gray-900 dark:text-white truncate">{series.title}</div>
                                        <div className="text-[9px] text-gray-500 truncate">{series.done || 0}/{series.tests || 0} tests</div>
                                      </div>
                                    </Link>
                                    <div className="relative flex-shrink-0">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === `series-${seriesId}` ? null : `series-${seriesId}`) }}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                      >
                                        <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
                                      </button>
                                      {activeMenuId === `series-${seriesId}` && (
                                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20">
                                          <button
                                            onClick={() => setShowUnenrollConfirm({ type: 'series', item: series })}
                                            disabled={seriesLoading}
                                            className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                          >
                                            {seriesLoading ? <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                            Unenroll
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 px-4">
                    <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">No exams enrolled</p>
                    <Link to="/exams" className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline">Browse Exams →</Link>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Test Series Summary</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { l: 'Series', v: enrolledTestSeries.length, color: '#007AFF' },
                    { l: 'Completed', v: enrolledTestSeries.filter(s => s.completed).length, color: '#34C759' },
                    { l: 'Tests Done', v: enrolledTestSeries.reduce((a, s) => a + (s.done || 0), 0), color: '#AF52DE' },
                    { l: 'Remaining', v: enrolledTestSeries.reduce((a, s) => a + ((s.tests || 0) - (s.done || 0)), 0), color: '#FF9500' },
                  ].map(({ l, v, color }) => (
                    <div key={l} className="rounded-xl p-3 text-center" style={{ background: `${color}0d` }}>
                      <div className="text-lg font-extrabold" style={{ color }}>{v}</div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-visible">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Enrolled Test Series</h3>
                  <Link to="/test-series" className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline">Browse More</Link>
                </div>
                {enrolledTestSeries.length > 0 ? (
                  <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-visible">
                    {enrolledTestSeries.slice(0, 6).map((series, i) => {
                      const color = ['#007AFF', '#34C759', '#FF9500', '#AF52DE'][i % 4]
                      const seriesId = series.id || series._id || i
                      const isLoading = unenrollingId === seriesId
                      return (
                        <div key={seriesId} className="relative group flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <Link to={`/test-series/${series.slug || seriesId}`} className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: `${color}18` }}>
                              {series.icon || '📝'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{series.title}</div>
                              <div className="text-[10px] text-gray-500 truncate">{series.done || 0}/{series.tests || 0} tests</div>
                            </div>
                          </Link>
                          <div className="relative">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === `series-${seriesId}` ? null : `series-${seriesId}`) }}
                              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4 text-gray-400" />
                            </button>
                            {activeMenuId === `series-${seriesId}` && (
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20">
                                <button
                                  onClick={() => setShowUnenrollConfirm({ type: 'series', item: series })}
                                  disabled={isLoading}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                  {isLoading ? <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  Unenroll
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 px-4">
                    <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">No test series enrolled</p>
                    <Link to="/test-series" className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline">Browse Test Series →</Link>
                  </div>
                )}
              </div>

              <Link to="/exams" className="block w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm text-center hover:shadow-lg transition">
                <div className="flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Explore More Exams</div>
              </Link>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="space-y-6" style={{ animation: 'fadeIn 0.35s ease both' }}>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Study Hours', value: userStats.timeSpent, icon: Clock, color: '#007AFF', bg: 'from-blue-400 to-indigo-500' },
                  { label: 'Accuracy', value: `${userStats.avgAccuracy || 0}%`, icon: Target, color: '#34C759', bg: 'from-green-400 to-emerald-500' },
                  { label: 'Rank', value: userStats.rank || '--', icon: Star, color: '#AF52DE', bg: 'from-purple-400 to-pink-500' },
                  { label: 'Streak', value: `${userStats.streak}d`, icon: Flame, color: '#FF9500', bg: 'from-orange-400 to-red-500' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${bg} flex items-center justify-center mb-2`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-lg font-black text-gray-900 dark:text-white">{value}</div>
                    <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>

              <div>
                <SectionLabel>Learning & Study</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactFeatureCard icon={<Trophy className="w-5 h-5 text-yellow-500" />} iconBg="#FEF3C7" title="Achievements & Badges" description="Track your milestones" onClick={() => navigate('/achievements')} badge="New" />
                  <CompactFeatureCard icon={<BarChart2 className="w-5 h-5 text-blue-500" />} iconBg="#DBEAFE" title="Study Analytics" description="Performance insights" onClick={() => navigate('/dashboard/analysis')} />
                  <CompactFeatureCard icon={<Brain className="w-5 h-5 text-purple-500" />} iconBg="#EDE9FE" title="AI Study Planner" description="Personalized schedules" comingSoon />
                  <CompactFeatureCard icon={<Target className="w-5 h-5 text-red-500" />} iconBg="#FEE2E2" title="Weak Area Analysis" description="Focus on weak topics" comingSoon />
                </div>
              </div>

              <div>
                <SectionLabel>Social & Community</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactFeatureCard icon={<Gift className="w-5 h-5 text-green-500" />} iconBg="#D1FAE5" title="Refer & Earn" description="Invite friends" onClick={() => navigate('/refer')} badge="New" />
                  <CompactFeatureCard icon={<Users className="w-5 h-5 text-indigo-500" />} iconBg="#E0E7FF" title="Study Groups" description="Learn together" onClick={() => navigate('/community/study-groups')} />
                  <CompactFeatureCard icon={<MessageCircle className="w-5 h-5 text-cyan-500" />} iconBg="#CFFAFE" title="Doubt Forum" description="Get help from peers" comingSoon />
                  <CompactFeatureCard icon={<Share2 className="w-5 h-5 text-pink-500" />} iconBg="#FCE7F3" title="Leaderboard Sharing" description="Share your rank" comingSoon />
                </div>
              </div>

              <div>
                <SectionLabel>
                  <span>Pro Features</span>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold rounded-full">PRO</span>
                </SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactFeatureCard icon={<Rocket className="w-5 h-5 text-orange-500" />} iconBg="#FFEDD5" title="Priority Support" description="Faster responses" badge="Pro" comingSoon={!user?.hasProPass} />
                  <CompactFeatureCard icon={<LineChart className="w-5 h-5 text-emerald-500" />} iconBg="#D1FAE5" title="Advanced Analytics" description="Deep performance data" badge="Pro" comingSoon={!user?.hasProPass} />
                  <CompactFeatureCard icon={<Download className="w-5 h-5 text-violet-500" />} iconBg="#EDE9FE" title="Offline Access" description="Download tests" badge="Pro" comingSoon />
                  <CompactFeatureCard icon={<PieChartIcon className="w-5 h-5 text-rose-500" />} iconBg="#FFE4E6" title="Custom Test Builder" description="Create your own tests" badge="Pro" comingSoon />
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-xl -translate-x-1/2 translate-y-1/2" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm font-bold">More Features Coming Soon!</span>
                  </div>
                  <p className="text-sm text-white/80 mb-4">We're constantly working on new features.</p>
                  <div className="flex flex-wrap gap-2">
                    {['Mobile App', 'Video Lectures', 'AI Tutor', 'Mock Interviews', 'Doubt Sessions'].map((feature) => (
                      <span key={feature} className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">{feature}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pro Pass Tab */}
          {activeTab === 'pro' && (
            <div className="space-y-4" style={{ animation: 'fadeIn 0.35s ease both' }}>
              {/* Main Pro Pass Status Card - Same as Pass page */}
              <div className={`rounded-2xl border-2 overflow-hidden ${
                proPass.isActive || proPass.isAdmin 
                  ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10' 
                  : proPass.isExpired 
                    ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10'
                    : 'border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-gray-800'
              }`}>
                {/* Header */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        proPass.isActive || proPass.isAdmin 
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                          : proPass.isExpired 
                            ? 'bg-red-400' 
                            : 'bg-gray-300 dark:bg-gray-600'
                      }`}>
                        <Crown className={`w-7 h-7 ${proPass.isActive || proPass.isAdmin ? 'text-white' : 'text-gray-500 dark:text-gray-300'}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {proPass.isAdmin ? 'Admin Access' : proPass.isActive ? 'Pro Pass Active' : proPass.isExpired ? 'Pro Pass Expired' : 'Free Plan'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{user?.name || user?.email}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      proPass.isAdmin 
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
                        : proPass.isActive 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : proPass.isExpired 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {proPass.isAdmin ? (
                        <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />{proPass.statusText}</span>
                      ) : proPass.isActive ? (
                        <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />{proPass.statusText}</span>
                      ) : proPass.isExpired ? (
                        <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Expired</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />Free Plan</span>
                      )}
                    </div>
                  </div>

                  {/* Pass Details Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {(proPass.isActive || proPass.isAdmin) ? (
                      <>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 backdrop-blur-sm">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Valid Until</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{proPass.formattedExpiry || 'N/A'}</p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 backdrop-blur-sm">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Remaining</span>
                          </div>
                          <p className={`text-sm font-bold ${proPass.remainingDays <= 30 ? 'text-red-600' : proPass.remainingDays <= 90 ? 'text-amber-600' : 'text-green-600'}`}>
                            {proPass.isAdmin ? 'Unlimited' : proPass.remainingDays !== null ? `${proPass.remainingDays}d` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 backdrop-blur-sm">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <Award className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Plan</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {proPass.isAdmin ? 'Admin' : proPass.remainingDays > 180 ? 'Yearly' : proPass.remainingDays > 30 ? 'Yearly' : 'Monthly'}
                          </p>
                        </div>
                      </>
                    ) : proPass.isExpired ? (
                      <>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Expired On</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{proPass.formattedExpiry || 'N/A'}</p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Days Ago</span>
                          </div>
                          <p className="text-sm font-bold text-red-600">
                            {proPass.remainingDays !== null ? `${Math.abs(proPass.remainingDays)}d` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <Award className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Was</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">Pro Pass</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Tests</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">Limited</p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Materials</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">Basic</p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase">Analytics</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">Basic</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Status-specific Actions */}
                  {proPass.isActive && !proPass.isAdmin && proPass.isExpiringWithin(30) && (
                    <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Renewal Suggestion</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            Your Pro Pass {proPass.remainingDays <= 7 ? 'is expiring soon' : 'will expire soon'}. Renew now to maintain access.
                          </p>
                          <Link to="/pass" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition">
                            <RefreshCw className="w-4 h-4" /> Renew Pro Pass
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {proPass.isExpired && (
                    <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Pro Pass Expired</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            Your Pro Pass has expired. Renew to unlock all premium features.
                          </p>
                          <Link to="/pass" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition">
                            <Crown className="w-4 h-4" /> Renew Now
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {!proPass.isProUser && !proPass.isExpired && (
                    <div className="bg-gradient-to-r from-purple-50 to-amber-50 dark:from-purple-900/10 dark:to-amber-900/10 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Upgrade to Pro Pass</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            Unlock unlimited tests, detailed solutions, PYP bank, and premium study materials.
                          </p>
                          <Link to="/pass" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition">
                            <Crown className="w-4 h-4" /> Get Pro Pass
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pro Features Unlocked - Show for active users */}
                  {proPass.isActive && !proPass.isExpiringWithin(30) && (
                    <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Pro Features Unlocked
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: Check, text: 'Unlimited Tests' },
                          { icon: Check, text: 'All Live Tests' },
                          { icon: Check, text: 'PYP Bank' },
                          { icon: Check, text: 'Advanced Analytics' },
                        ].map(({ icon: Icon, text }) => (
                          <div key={text} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <Icon className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="text-xs font-medium">{text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pro Benefits */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pro Benefits</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0">
                      <Rocket className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Unlimited Test Access</div>
                      <div className="text-xs text-gray-500">All premium test series</div>
                    </div>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center flex-shrink-0">
                      <LineChart className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Advanced Analytics</div>
                      <div className="text-xs text-gray-500">Deep performance insights</div>
                    </div>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-60">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <Download className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Offline Access</div>
                      <div className="text-xs text-gray-500">Download tests for offline</div>
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold rounded-full flex-shrink-0">Soon</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-60">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <PieChartIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Custom Test Builder</div>
                      <div className="text-xs text-gray-500">Create your own tests</div>
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold rounded-full flex-shrink-0">Soon</span>
                  </div>
                </div>
              </div>

              {/* Billing */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Billing</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Payment Methods</div>
                      <div className="text-xs text-gray-500">Manage payment options</div>
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold rounded-full">Coming Soon</span>
                  </div>
                  <Link to="/pass" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Billing History</div>
                      <div className="text-xs text-gray-500">View invoices</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </div>
              </div>

              {/* Help */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Help</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  <button onClick={() => window.open('https://help.trstprep.com', '_blank')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Help Center</div>
                      <div className="text-xs text-gray-500">Get support</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => window.open('/privacy', '_blank')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Privacy Policy</div>
                      <div className="text-xs text-gray-500">Read policy</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => window.open('/terms', '_blank')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Terms of Service</div>
                      <div className="text-xs text-gray-500">Read terms</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab Content */}
          {activeTab === 'settings' && (
            <div className="space-y-6" style={{ animation: 'fadeIn 0.35s ease both' }}>
              <SettingsContent user={user} refreshUser={refreshUser} logout={logout} proPass={proPass} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} navigate={navigate} settingsTab={settingsTab} setSettingsTab={setSettingsTab} />
            </div>
          )}
        </div>
      </div>

      {/* Photo Options Modal */}
      {showPhotoOptionsModal && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-gray-100 dark:border-gray-700 p-1">
                <img src={user.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
              </div>
              <h3 className="text-center font-bold text-gray-900 dark:text-white mb-6">Profile Picture</h3>
              <div className="space-y-3">
                <button onClick={() => { setShowPhotoOptionsModal(false); fileInputRef.current?.click() }} className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all">
                  <Camera className="w-4 h-4" /> Upload New Photo
                </button>
                <button onClick={handleRemovePhoto} className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all">
                  <Trash2 className="w-4 h-4" /> Remove Photo
                </button>
                <button onClick={() => setShowPhotoOptionsModal(false)} className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Unenroll Confirmation Modal */}
      {showUnenrollConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Unenroll from {showUnenrollConfirm.type}?</h3>
              <p className="text-sm text-gray-500 mt-2">
                {showUnenrollConfirm.type === 'exam' 
                  ? `You will be unenrolled from "${showUnenrollConfirm.item.title || showUnenrollConfirm.item.name}". Your progress will be archived.`
                  : `You will be unenrolled from "${showUnenrollConfirm.item.title}". Your test history will be preserved.`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (showUnenrollConfirm.type === 'exam') handleUnenrollExam(showUnenrollConfirm.item)
                  else handleUnenrollSeries(showUnenrollConfirm.item)
                }}
                disabled={unenrollingId === (showUnenrollConfirm.item.id || showUnenrollConfirm.item._id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {unenrollingId === (showUnenrollConfirm.item.id || showUnenrollConfirm.item._id) ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Unenrolling...</>
                ) : (
                  <><Trash2 className="w-4 h-4" /> Unenroll</>
                )}
              </button>
              <button onClick={() => setShowUnenrollConfirm(null)} disabled={unenrollingId === (showUnenrollConfirm.item.id || showUnenrollConfirm.item._id)}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Location Selector Modal */}
      {showLocationModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowLocationModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Select Location</h3>
              <button onClick={() => setShowLocationModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex border-b border-gray-100 dark:border-gray-700">
              <button onClick={() => { setLocationTab('state'); setSelectedCity('') }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${locationTab === 'state' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-500 hover:text-gray-700'}`}>
                {selectedState || 'Select State'}
              </button>
              <button onClick={() => selectedState && setLocationTab('city')} disabled={!selectedState}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${locationTab === 'city' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : selectedState ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}>
                {selectedCity || 'Select City'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {locationTab === 'state' && Object.keys(statesAndCities).map(state => (
                <button key={state} onClick={() => { setSelectedState(state); setSelectedCity(''); setLocationTab('city') }}
                  className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-all font-medium ${selectedState === state ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                  {state}
                </button>
              ))}
              {locationTab === 'city' && selectedState && statesAndCities[selectedState]?.map(({ city, pincode }) => (
                <button key={city} onClick={() => { setSelectedCity(city); setSelectedPincode(pincode) }}
                  className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-all ${selectedCity === city ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                  <div className="font-medium">{city}</div>
                  <div className={`text-xs ${selectedCity === city ? 'text-indigo-100' : 'text-gray-500'}`}>PIN: {pincode}</div>
                </button>
              ))}
            </div>
            {selectedState && selectedCity && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Selected Location:</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedCity}, {selectedState} - {selectedPincode}</p>
                </div>
                <button onClick={() => { 
                  handleEditChange('location', `${selectedCity}, ${selectedState} - ${selectedPincode}`)
                  setShowLocationModal(false); setSelectedState(''); setSelectedCity(''); setSelectedPincode('')
                }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
                  <Check className="w-4 h-4" /> Select Location
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperState.isOpen}
        imageSrc={cropperState.src}
        onClose={() => setCropperState({ isOpen: false, src: null, type: null })}
        onCropComplete={handleCropComplete}
        aspect={cropperState.type === 'avatar' ? 1 : 3}
        cropShape={cropperState.type === 'avatar' ? 'round' : 'rect'}
        title={cropperState.type === 'avatar' ? 'Adjust Profile Photo' : 'Adjust Cover Photo'}
      />
    </>
  )
}

export default Profile
