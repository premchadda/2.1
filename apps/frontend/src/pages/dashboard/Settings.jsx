import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { useTheme } from '../../shared/context/ThemeContext'
import useProPass from '../../shared/hooks/useProPass'
import { authAPI, userAPI } from '../../shared/lib/dataService'
import { 
  User, Lock, Bell, CreditCard, Shield, Save, ChevronRight,
  Moon, Sun, Mail, Phone, MapPin, Calendar, Camera, Eye, EyeOff,
  Check, AlertCircle, RefreshCw, Trash2, Download, Crown,
  Smartphone, Globe, Info, LogOut, ExternalLink, HelpCircle,
  Settings as SettingsIcon, Target, BookOpen, GraduationCap, X, Edit2
} from 'lucide-react'

// Reusing some component patterns from Profile for consistency
function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button 
      onClick={() => !disabled && onChange(!checked)} 
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="px-1 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
        {children}
      </span>
    </div>
  )
}

function SettingsCell({ icon, iconBg, label, sub, right, onClick, danger, last }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div 
      onClick={onClick}
      onPointerDown={() => onClick && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`flex items-center gap-3 px-4 py-4 ${!last ? 'border-b border-gray-100 dark:border-gray-700/50' : ''} ${onClick ? 'cursor-pointer' : ''} transition-colors ${pressed ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}
    >
      {icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg || '#F2F2F7' }}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-medium ${danger ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{label}</div>
        {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{sub}</div>}
      </div>
      {right}
      {onClick && !right && <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
    </div>
  )
}

function InputField({ label, value, onChange, type = "text", placeholder, error, disabled }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{label}</label>}
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border ${error ? 'border-red-500' : 'border-transparent'} text-gray-900 dark:text-white text-sm outline-none focus:bg-white dark:focus:bg-gray-800 border-gray-100 dark:border-gray-700 transition-all focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500`}
      />
      {error && <p className="text-[10px] text-red-500 font-medium ml-1">{error}</p>}
    </div>
  )
}

// Danger Zone component for account deactivation/deletion
function DangerZoneSection() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleDeactivate = async () => {
    try {
      await userAPI.updateProfile({ isActive: false })
      await logout()
      navigate('/login', { state: { from: '/', message: 'Account deactivated' } })
    } catch (err) {
      console.error('Deactivation failed:', err)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await userAPI.deleteAccount()
      await logout()
      navigate('/login', { state: { from: '/', message: 'Account deleted' } })
    } catch (err) {
      console.error('Account deletion failed:', err)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-red-100 dark:border-red-900/20">
      <div className="px-1 py-3 bg-red-50/50 dark:bg-red-900/10">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-red-500 ml-4">Danger Zone</span>
      </div>
      
      {/* Deactivation Confirmation Modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Deactivate Account?</h3>
            <p className="text-sm text-gray-500 mb-4">This will temporarily disable your profile. You can reactivate by logging in again.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeactivateConfirm(false)} className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-xl font-medium">Cancel</button>
              <button onClick={handleDeactivate} className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Account Permanently?</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone. All your data, progress, and subscriptions will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-xl font-medium">Cancel</button>
              <button onClick={handleDeleteAccount} className="flex-1 py-2 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      <SettingsCell 
        icon={<AlertCircle className="w-4 h-4 text-red-500" />} 
        iconBg="#FEF2F2" 
        label="Deactivate Account" 
        sub="Temporarily disable your profile" 
        onClick={() => setShowDeactivateConfirm(true)} 
      />
      <SettingsCell 
        icon={<Trash2 className="w-4 h-4 text-red-600" />} 
        iconBg="#FEF2F2" 
        label="Permanently Delete Account" 
        danger 
        last 
        onClick={() => setShowDeleteConfirm(true)} 
      />
    </div>
  )
}

// Billing section content with real data - FIXED: Use React Router links where possible
function BillingSectionContent({ user, proPass }) {
  return (
    <>
      <SettingsCell 
        label="Plan Type" 
        sub={proPass.isActive ? "Pro Pass Active" : "Free Plan"} 
      />
      <SettingsCell 
        label="Payment Method" 
        sub={user?.paymentMethod || "Managed securely during checkout"} 
        right={<Link to="/pass" className="text-xs font-bold text-indigo-600 hover:underline">Manage</Link>} 
      />
      <SettingsCell 
        label="Billing History" 
        sub={proPass.formattedStartDate ? `Membership active since ${proPass.formattedStartDate}` : "No billing history available"} 
        right={<Link to="/pass" className="text-xs font-bold text-indigo-600 hover:underline">View</Link>} 
        last 
      />
      
      <div className="border-t border-gray-100 dark:border-gray-700 mt-4 pt-4">
        <SectionLabel>Help & Support</SectionLabel>
        <SettingsCell label="Help Center" icon={<HelpCircle className="w-4 h-4 text-blue-500" />} iconBg="#EFF5FF" right={<ExternalLink className="w-4 h-4 text-gray-400" />} onClick={() => window.open('https://help.trstprep.com', '_blank')} />
        <SettingsCell label="Privacy Policy" icon={<Shield className="w-4 h-4 text-gray-500" />} iconBg="#F9FAFB" right={<ExternalLink className="w-4 h-4 text-gray-400" />} onClick={() => window.open('/privacy', '_blank')} />
        <SettingsCell label="Terms of Service" icon={<BookOpen className="w-4 h-4 text-gray-500" />} iconBg="#F9FAFB" right={<ExternalLink className="w-4 h-4 text-gray-400" />} last onClick={() => window.open('/terms', '_blank')} />
      </div>
    </>
  )
}

export default function Settings() {
  const { user, refreshUser, logout } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const proPass = useProPass()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'success' | 'error' | null
  const [selectedLanguage, setSelectedLanguage] = useState(() => localStorage.getItem('trstprep_language') || 'en')

  // Profile Data state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    education: user?.education || '',
    bio: user?.bio || '',
    dob: user?.dateOfBirth || ''
  })

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [showPasswords, setShowPasswords] = useState(false)

  // Notification state
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    testReminders: true,
    promotional: false,
    weeklyReport: true
  })

  // Privacy state
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public',
    showProgress: true,
    showOnLeaderboard: true,
    allowMessages: true
  })

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/settings' } })
    } else {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        location: user.location || '',
        education: user.education || '',
        bio: user.bio || '',
        dob: user.dateOfBirth || ''
      })
      if (user.notificationPreferences) {
        setNotifications(prev => ({ ...prev, ...user.notificationPreferences }))
      }
      if (user.privacy) {
        setPrivacy(prev => ({ ...prev, ...user.privacy }))
      }
    }
  }, [user, navigate])

  const persistPreferences = async (updates) => {
    await userAPI.updateProfile(updates)
    await refreshUser()
    setSaveStatus('success')
    setTimeout(() => setSaveStatus(null), 2000)
  }

  const validatePasswordForm = () => {
    const errors = {}
    if (!passwordForm.current) errors.current = 'Current password is required'
    if (!passwordForm.new || passwordForm.new.length < 8) errors.new = 'New password must be at least 8 characters'
    if (passwordForm.new !== passwordForm.confirm) errors.confirm = 'Passwords do not match'
    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleProfileSave = async () => {
    try {
      setSaving(true)
      const response = await userAPI.updateProfile({
        name: profileForm.name,
        mobile: profileForm.phone,
        dateOfBirth: profileForm.dob,
        education: profileForm.education,
        bio: profileForm.bio,
        location: profileForm.location
      })
      if (response.data?.success) {
        await refreshUser()
        setSaveStatus('success')
        setTimeout(() => setSaveStatus(null), 3000)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSave = async () => {
    if (!validatePasswordForm()) return
    
    try {
      setSaving(true)
      await authAPI.changePassword(passwordForm.current, passwordForm.new)
      setPasswordForm({ current: '', new: '', confirm: '' })
      setPasswordErrors({})
      await logout()
      navigate('/login', { state: { from: '/settings', message: 'Password updated. Please sign in again.' } })
    } catch (error) {
      console.error('Failed to update password:', error)
      alert(error.response?.data?.message || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  const handleNotificationChange = async (key, value) => {
    const previousNotifications = notifications
    const nextNotifications = { ...notifications, [key]: value }
    setNotifications(nextNotifications)

    try {
      await persistPreferences({ notificationPreferences: nextNotifications })
    } catch (error) {
      console.error('Failed to save notifications:', error)
      setNotifications(previousNotifications)
      setSaveStatus('error')
    }
  }

  const handlePrivacyChange = async (updates) => {
    const previousPrivacy = privacy
    const nextPrivacy = { ...privacy, ...updates }
    setPrivacy(nextPrivacy)

    try {
      await persistPreferences({ privacy: nextPrivacy })
    } catch (error) {
      console.error('Failed to save privacy settings:', error)
      setPrivacy(previousPrivacy)
      setSaveStatus('error')
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
      alert('Failed to export account data')
    }
  }

  const navItems = [
    { id: 'profile', label: 'Personal Info', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'billing', label: 'Pro Pass', icon: Crown },
    { id: 'appearance', label: 'Appearance', icon: Moon },
  ]

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // FIX: Add 5MB file size validation (matching Profile.jsx)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = async () => {
      try {
        setSaving(true)
        const response = await userAPI.updateProfile({ avatar: reader.result })
        if (response.data?.success) await refreshUser()
      } catch (error) {
        console.error('Failed to update avatar:', error)
        alert('Failed to update photo.')
      } finally {
        setSaving(false)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-800/80">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              <ChevronRight className="w-6 h-6 rotate-180 text-gray-500" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <span className="text-xs font-bold text-green-500 flex items-center gap-1 animate-fadeIn">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
            {activeTab === 'profile' && (
              <button 
                onClick={handleProfileSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-6">
        {/* Tab Navigation - Horizontal Row */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 p-1.5">
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
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === item.id 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 max-w-2xl">
          <div className="animate-fadeIn">
            {/* Profile Content - Read Only with Edit Link */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Avatar Card - Read Only */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl overflow-hidden mb-4">
                        <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                          {user?.avatar ? (
                            <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
                          ) : (
                            <span className="text-4xl font-black text-indigo-500">{user?.name?.[0]?.toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">{user?.name}</h2>
                    <p className="text-sm text-gray-500 font-medium">{user?.email}</p>
                    <Link to="/profile" className="mt-3 flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
                      <Edit2 className="w-4 h-4" /> Edit Profile on Profile Page
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Personal Info - Read Only */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionLabel>Personal Information</SectionLabel>
                  <div className="space-y-4 mt-2">
                    {[
                      { label: 'Phone', value: profileForm.phone || 'Not set' },
                      { label: 'Date of Birth', value: profileForm.dob ? new Date(profileForm.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set' },
                      { label: 'Location', value: profileForm.location || 'Not set' },
                      { label: 'Education', value: profileForm.education || 'Not set' },
                      { label: 'Bio', value: profileForm.bio || 'Not set' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%] truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/profile" className="mt-4 block text-center px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    Edit Personal Information
                  </Link>
                </div>
              </div>
            )}

            {/* Security Content */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <SectionLabel>Update Password</SectionLabel>
                  <div className="space-y-4 mt-2">
                    <InputField 
                      label="Current Password" 
                      type={showPasswords ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={passwordForm.current} 
                      onChange={(v) => setPasswordForm(f => ({...f, current: v}))} 
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField 
                        label="New Password" 
                        type={showPasswords ? "text" : "password"} 
                        placeholder="••••••••" 
                        value={passwordForm.new} 
                        onChange={(v) => setPasswordForm(f => ({...f, new: v}))} 
                        error={passwordErrors.new}
                      />
                      <InputField 
                        label="Confirm New Password" 
                        type={showPasswords ? "text" : "password"} 
                        placeholder="••••••••" 
                        value={passwordForm.confirm} 
                        onChange={(v) => setPasswordForm(f => ({...f, confirm: v}))} 
                        error={passwordErrors.confirm}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowPasswords(!showPasswords)} className="text-xs font-bold text-indigo-600 hover:underline">
                        {showPasswords ? 'Hide Characters' : 'Show Characters'}
                      </button>
                    </div>
                    <button 
                      onClick={handlePasswordSave}
                      disabled={saving || !passwordForm.new}
                      className="w-full py-3 bg-gray-900 dark:bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                    >
                      {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Update Password'}
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <div className="absolute top-3 right-4 z-10">
                      <span className="px-2 py-0.5 bg-gray-500 text-white text-[10px] font-bold rounded-full">Coming Soon</span>
                    </div>
                    <SectionLabel>Connected Devices</SectionLabel>
                    <SettingsCell 
                      icon={<Smartphone className="w-4 h-4 text-gray-400" />} 
                      iconBg="#F3F4F6" 
                      label="Session Management" 
                      sub="View and manage your active sessions (Coming soon)" 
                      last
                    />
                  </div>
                </div>

                <DangerZoneSection />
              </div>
            )}

            {/* Notifications Content */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionLabel>Notification Channels</SectionLabel>
                  <SettingsCell 
                    icon={<Mail className="w-4 h-4 text-blue-500" />} 
                    iconBg="#EFF6FF" 
                    label="Email Notifications" 
                    sub="Results, reports, and updates" 
                    right={<ToggleSwitch checked={notifications.email} onChange={(v) => handleNotificationChange('email', v)} />} 
                  />
                  <SettingsCell 
                    icon={<Bell className="w-4 h-4 text-indigo-500" />} 
                    iconBg="#EEF2FF" 
                    label="Push Notifications" 
                    sub="Mobile and desktop alerts" 
                    right={<ToggleSwitch checked={notifications.push} onChange={(v) => handleNotificationChange('push', v)} />} 
                  />
                  <SettingsCell 
                    icon={<Phone className="w-4 h-4 text-green-500" />} 
                    iconBg="#F0FDF4" 
                    label="SMS Alerts" 
                    sub="Critical account updates via SMS" 
                    right={<ToggleSwitch checked={notifications.sms} onChange={(v) => handleNotificationChange('sms', v)} />} 
                    last 
                  />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionLabel>Learning Reminders</SectionLabel>
                  <SettingsCell 
                    icon={<Target className="w-4 h-4 text-orange-500" />} 
                    iconBg="#FFF7ED" 
                    label="Daily Study Goal" 
                    sub="Remind me to study daily" 
                    right={<ToggleSwitch checked={notifications.testReminders} onChange={(v) => handleNotificationChange('testReminders', v)} />} 
                  />
                  <SettingsCell 
                    icon={<RefreshCw className="w-4 h-4 text-purple-500" />} 
                    iconBg="#FAF5FF" 
                    label="Weekly Progress Report" 
                    sub="Summary of your performance" 
                    right={<ToggleSwitch checked={notifications.weeklyReport} onChange={(v) => handleNotificationChange('weeklyReport', v)} />} 
                  />
                  <SettingsCell 
                    icon={<Mail className="w-4 h-4 text-pink-500" />} 
                    iconBg="#FDF2F8" 
                    label="Promotional Emails" 
                    sub="Updates about new features and offers" 
                    right={<ToggleSwitch checked={notifications.promotional} onChange={(v) => handleNotificationChange('promotional', v)} />} 
                    last 
                  />
                </div>
              </div>
            )}

            {/* Privacy Content */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionLabel>Account Privacy</SectionLabel>
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 block">Profile Visibility</label>
                    <select 
                      value={privacy.profileVisibility}
                      onChange={(e) => handlePrivacyChange({ profileVisibility: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-700 border-transparent text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="public">Public - Everyone can see</option>
                      <option value="friends">Friends - Only friends can see</option>
                      <option value="private">Private - Only you can see</option>
                    </select>
                  </div>
                  <SettingsCell 
                    label="Show Progress" 
                    sub="Let others see your test scores" 
                    right={<ToggleSwitch checked={privacy.showProgress} onChange={(v) => handlePrivacyChange({ showProgress: v })} />} 
                  />
                  <SettingsCell 
                    label="Leaderboard Visibility" 
                    sub="Show my name on rank lists" 
                    right={<ToggleSwitch checked={privacy.showOnLeaderboard} onChange={(v) => handlePrivacyChange({ showOnLeaderboard: v })} />} 
                  />
                  <SettingsCell 
                    label="Allow Messages" 
                    sub="Others can send you study group invites" 
                    right={<ToggleSwitch checked={privacy.allowMessages} onChange={(v) => handlePrivacyChange({ allowMessages: v })} />} 
                    last 
                  />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <SectionLabel>Your Data</SectionLabel>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 ml-1">Download a copy of your personal data and test history.</p>
                  <button onClick={handleExportData} className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 transition-all">
                    <Download className="w-4 h-4" /> Export All Data (.json)
                  </button>
                </div>
              </div>
            )}

            {/* Billing / Pro Content */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/30">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight mb-1">Trstprep Pro</h3>
                      <p className="text-indigo-100 text-sm font-medium">Power up your preparation</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30">
                      <Crown className="w-7 h-7 text-yellow-300" />
                    </div>
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-black tracking-widest text-indigo-200 mb-1">Status</div>
                      <div className="text-lg font-bold flex items-center gap-2">
                        {proPass.isActive ? 'Active' : 'Inactive'}
                        {proPass.isActive && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                      </div>
                    </div>
                    {proPass.isActive ? (
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-black tracking-widest text-indigo-200 mb-1">Renews On</div>
                        <div className="text-lg font-bold">{proPass.formattedExpiry || 'Not active'}</div>
                      </div>
                    ) : (
                      <Link to="/pass" className="px-6 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-transform">
                        Upgrade Now
                      </Link>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionLabel>Subscription Details</SectionLabel>
                  <BillingSectionContent user={user} proPass={proPass} />
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionLabel>Display</SectionLabel>
                  <div className="space-y-4 mt-2">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        {isDarkMode ? <Moon className="w-5 h-5 text-blue-500" /> : <Sun className="w-5 h-5 text-orange-500" />}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Toggle dark/light theme</p>
                        </div>
                      </div>
                      <ToggleSwitch checked={isDarkMode} onChange={toggleDarkMode} />
                    </div>
                  </div>
                  <SectionLabel>Language</SectionLabel>
                  <div className="space-y-2 mt-2">
                    {[
                      { code: 'en', name: 'English', native: 'English' },
                      { code: 'hi', name: 'Hindi', native: 'हिंदी' },
                    ].map(({ code, name, native }) => (
                      <button key={code}
                        onClick={() => { localStorage.setItem('trstprep_language', code); setSelectedLanguage(code); }}
                        className={`w-full flex items-center justify-between py-3 px-4 rounded-xl transition-colors ${selectedLanguage === code ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
                          <p className="text-xs text-gray-500">{native}</p>
                        </div>
                        {selectedLanguage === code && <Check className="w-5 h-5 text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-400 text-center">More languages coming soon</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* App Version Info */}
      <div className="max-w-5xl mx-auto px-4 mt-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 dark:text-gray-600">Trstprep v2.1.0 · Build 2024.03.25</p>
      </div>
    </div>
  )
}