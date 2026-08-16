import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, BookOpen, 
  Video, Settings, LogOut, Menu, X, FolderTree, ChevronRight,
  Tag, Navigation, Info, Layers, Trash2, Ticket, Bell, Star,
  Search, ChevronDown, BarChart3, Trophy, Clock, HelpCircle,
  Database, Activity, Gift, Brain, Image, UserCheck,
  CreditCard, AlertTriangle, Zap, User, Crown, Moon, Sun, RotateCw
} from 'lucide-react'
import { useAuth } from '../providers/AuthContext'
import { useTheme } from '../context/ThemeContext'
import adminNavConfig, { getFlatNavItems, getBreadcrumbs } from '../config/adminNavConfig'
import { Logo, CommandPalette } from './index.jsx'
import AdminBottomNav from './AdminBottomNav.jsx'

// Main site URL - can be changed via environment variable
const MAIN_SITE_URL = import.meta.env.VITE_MAIN_SITE_URL || import.meta.env.VITE_FRONTEND_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '/')

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()

  const handlePageRefresh = useCallback(() => {
    setIsRefreshing(true)
    setRefreshKey(prev => prev + 1)
    window.dispatchEvent(new CustomEvent('admin:refresh-data', { detail: { timestamp: Date.now() } }))
    setTimeout(() => {
      setIsRefreshing(false)
    }, 600)
  }, [])

  // Cmd+K / Ctrl+K keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(p => !p)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return 'A'
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Check if user has a valid avatar URL (supports data URIs, http URLs, and relative paths)
  const hasValidAvatar = user?.avatar && typeof user.avatar === 'string' && user.avatar !== 'null' && user.avatar !== 'undefined' && user.avatar !== '' && (user.avatar.startsWith('data:') || user.avatar.startsWith('http') || user.avatar.startsWith('/'))

  // Resolve avatar URL - use relative path for Vite proxy
  // The Vite dev server proxies /assets to the backend automatically
  const getAvatarUrl = (avatar) => {
    if (!avatar || typeof avatar !== 'string') return ''
    // Return as-is - Vite proxy handles /assets paths
    return avatar
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setSearchOpen(false)
    setSearchQuery('')
    setIsProfileOpen(false)
  }, [location.pathname])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }
    const handleClickOutside = (e) => {
      if (!e.target.closest('.admin-profile-dropdown')) {
        setIsProfileOpen(false)
      }
      if (!e.target.closest('.admin-search-container')) {
        setSearchOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    document.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  // Auto-expand section containing current path
  useEffect(() => {
    const currentCategory = adminNavConfig.categories.find(cat => 
      cat.items.some(item => isActive(item.path))
    )
    if (currentCategory && !expandedSections[currentCategory.id]) {
      setExpandedSections(prev => ({
        ...prev,
        [currentCategory.id]: true
      }))
    }
  }, [location.pathname])

  const canViewItem = useCallback((item) => {
    const isSuper = user?.role === 'super_admin' || user?.role === 'admin' || user?.isAdmin === true || user?.isSuperAdmin === true || user?.is_super_admin === true
    if (isSuper) return true
    const permissions = Array.isArray(user?.permissions) && user.permissions.length > 0 ? user.permissions : []
    if (permissions.includes('*')) return true
    const segment = item.path.split('/').filter(Boolean)[1] || 'content'
    const resource = ['users', 'enrollments', 'sessions', 'roles-permissions', 'user-activity-log'].includes(segment)
      ? 'users'
      : ['tests', 'test-series', 'questions', 'quizzes', 'sections', 'stages', 'exam-categories', 'exam-info'].includes(segment)
        ? 'tests'
        : ['settings', 'analytics', 'backups', 'recycle-bin', 'system-health', 'coming-soon', 'two-factor', 'navigation'].includes(segment)
          ? 'settings'
          : ['payments', 'subscription-plans', 'plans', 'coupons', 'promotions'].includes(segment)
            ? 'monetization'
            : ['banners', 'faqs', 'notifications', 'email-templates'].includes(segment)
              ? 'communications'
              : ['moderation'].includes(segment)
                ? 'moderation'
                : ['audit', 'audit-trail', 'results'].includes(segment)
                  ? 'audit'
                  : ['analytics', 'deep-analytics', 'leaderboards'].includes(segment)
                    ? 'analytics'
                    : 'content'

    return permissions.some(p => {
      const [permResource, permAction] = p.split(':')
      const resourceMatch = permResource === '*' || permResource === resource ||
        (resource === 'settings' && permResource === 'system') ||
        (resource === 'users' && permResource === 'user') ||
        (resource === 'tests' && (permResource === 'test' || permResource === 'assessment'))
      const actionMatch = !permAction || permAction === '*' || permAction === 'view' || permAction === 'read' || permAction === 'manage'
      return resourceMatch && actionMatch
    })
  }, [user])

  // Filter navigation based on permissions and search
  const filteredNav = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return adminNavConfig.categories.map(category => ({
      ...category,
      items: category.items.filter(item => canViewItem(item) && (
        !query || item.name.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query)
      ))
    })).filter(category => category.items.length > 0)
  }, [searchQuery, canViewItem])

  // Search results for command palette
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return getFlatNavItems().filter(item => canViewItem(item) && (
      item.name.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query)
    )
    ).slice(0, 8)
  }, [searchQuery, canViewItem])

  // FIX 2.14: Use AuthContext.logout() for consistent session cleanup
  // (clears httpOnly cookie via backend, CSRF tokens, session metadata, user state)
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path) => {
    if (path === '/admin' || path === '/admin/') {
      return location.pathname === '/admin' || location.pathname === '/admin/'
    }
    const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path
    const cleanLoc = location.pathname.endsWith('/') && location.pathname.length > 1 ? location.pathname.slice(0, -1) : location.pathname
    return cleanLoc === cleanPath || cleanLoc.startsWith(cleanPath + '/')
  }

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  // Get current page info
  const currentPage = useMemo(() => {
    return getFlatNavItems().find(item => isActive(item.path))
  }, [location.pathname])

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    return getBreadcrumbs(location.pathname)
  }, [location.pathname])

  const renderNavItem = (item, categoryColor) => {
    const active = isActive(item.path)
    
    return (
      <Link
        key={item.id}
        to={item.path}
        className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
            : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
        }`}
        aria-label={item.badge ? `${item.name} (${item.badge})` : item.name}
      >
        <div className="flex items-center gap-3">
          <item.icon className="w-5 h-5 flex-shrink-0" />
          {(sidebarOpen || mobileMenuOpen) && (
            <div>
              <span>{item.name}</span>
              {item.badge && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </div>
          )}
        </div>
        {active && (sidebarOpen || mobileMenuOpen) && (
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        )}
      </Link>
    )
  }

  const renderCategory = (category) => {
    if (category.isTopLevel && category.items.length === 1) {
      return <div key={category.id} className="mb-2">{renderNavItem(category.items[0], category.color)}</div>
    }
    const isExpanded = expandedSections[category.id]
    const hasActiveChild = category.items.some(item => isActive(item.path))
    
    return (
      <div key={category.id} className="mb-2">
        <button
          onClick={() => toggleSection(category.id)}
          className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            hasActiveChild 
              ? 'bg-gray-100 text-indigo-700 dark:bg-gray-800/80 dark:text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-500 dark:hover:bg-gray-800/50 dark:hover:text-gray-300'
          }`}
          style={{ borderLeft: hasActiveChild ? `3px solid ${category.color}` : '3px solid transparent' }}
          aria-label={category.name}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${category.color}20` }}
            >
              <category.icon className="w-4 h-4" style={{ color: category.color }} />
            </div>
            {(sidebarOpen || mobileMenuOpen) && (
              <span className="text-left">{category.name}</span>
            )}
          </div>
          {(sidebarOpen || mobileMenuOpen) && (
            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          )}
        </button>
        
        {(sidebarOpen || mobileMenuOpen) && isExpanded && (
          <div className={`mt-1 ml-4 pl-4 border-l space-y-1 border-gray-200 dark:border-gray-800`}>
            {category.items.map(item => renderNavItem(item, category.color))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex h-screen transition-colors duration-200 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white`}>
      {/* Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className={`
        hidden md:flex flex-col
        ${sidebarOpen ? 'w-72' : 'w-20'} 
        bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800
        transition-all duration-300 border-r
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Logo 
                containerSize="w-auto h-auto"
                iconSize="w-6 h-6"
                textSize="text-lg"
              />
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0">Admin</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800`}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <X className={`w-5 h-5 text-gray-500 dark:text-gray-400`} /> : <Menu className={`w-5 h-5 text-gray-500 dark:text-gray-400`} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent" aria-label="Sidebar navigation">
          {filteredNav.map(category => renderCategory(category))}
        </nav>
      </aside>

      {/* Sidebar - Mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out md:hidden border-r
        bg-white text-gray-900 border-gray-200 dark:bg-gray-900 dark:text-white dark:border-gray-800
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800`}>
          <div className="flex items-center gap-2">
             <Logo 
                containerSize="w-auto h-auto"
                iconSize="w-6 h-6"
                textSize="text-lg"
              />
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0">Admin</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className={`p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800`}
            aria-label="Close menu"
          >
            <X className={`w-5 h-5 text-gray-600 dark:text-white`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Mobile navigation drawer">
          {filteredNav.map(category => renderCategory(category))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Bar */}
        <header className={`h-14 md:h-16 flex-shrink-0 border-b flex items-center justify-between px-4 md:px-6 transition-colors duration-200 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800`}>
          {/* Left Section - Breadcrumbs / Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className={`p-2 rounded-lg md:hidden hover:bg-gray-100 dark:hover:bg-gray-800`}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            
            {/* Page Title & Subtitle */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-base md:text-lg font-black text-gray-900 dark:text-white truncate flex items-center gap-2">
                  {currentPage?.icon && <currentPage.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                  <span>{currentPage?.name || 'Admin Panel'}</span>
                </h1>
                {currentPage?.description && (
                  <span className="hidden sm:inline-block text-xs text-gray-500 dark:text-gray-400 font-medium truncate max-w-md border-l border-gray-200 dark:border-gray-700 pl-2.5">
                    {currentPage.description}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Right Section - Actions & Profile */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* Search Input - Desktop */}
            <div className="hidden md:block relative w-48 lg:w-64 shrink-0 admin-search-container">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (!searchOpen) setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500`}
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Search Results Dropdown */}
              {searchOpen && searchQuery && (
                <div className={`absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-2xl z-50 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800`} role="listbox" aria-label="Search results">
                  {searchResults.length > 0 ? (
                    <div className="p-2">
                      {searchResults.map((item, idx) => (
                        <Link
                          key={idx}
                          to={item.path}
                          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800`}
                        >
                          <div 
                            className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800`}
                          >
                            <item.icon className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium text-gray-900 dark:text-white`}>{item.name}</p>
                            <p className="text-xs text-gray-500 truncate">{item.description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No results found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* View Site Button - Opens main site in new tab */}
            <a
              href={MAIN_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg text-xs md:text-sm font-medium text-white transition-all shadow-lg shadow-indigo-500/25 shrink-0 items-center"
            >
              View Site
            </a>

            {/* Page Refresh Button */}
            <button
              onClick={handlePageRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 cursor-pointer active:scale-95"
              title="Refresh Current Page Data"
              aria-label="Refresh page data"
            >
              <RotateCw className={`w-5 h-5 transition-transform ${isRefreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'hover:rotate-45'}`} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {/* User Profile Dropdown */}
            <div className="relative admin-profile-dropdown shrink-0">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
                aria-label="User profile menu"
                aria-expanded={isProfileOpen}
                aria-haspopup="true"
              >
                {hasValidAvatar ? (
                  <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shadow-sm border bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700`}>
                    <img 
                      src={getAvatarUrl(user.avatar)} 
                      alt={`${user?.name || 'User'} profile`} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Show initials fallback on image error
                        e.target.style.display = 'none'
                        const fallback = e.target.nextElementSibling
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                    <div className="hidden w-full h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-sm text-white" style={{ display: 'none' }}>
                      {getUserInitials()}
                    </div>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-sm">
                    {getUserInitials()}
                  </div>
                )}
                <ChevronDown className={`hidden lg:block w-4 h-4 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''} text-gray-500 dark:text-gray-400`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div className={`absolute right-0 top-full mt-2 w-64 rounded-xl shadow-2xl overflow-hidden z-[100] border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700`}>
                  {/* User Info Header */}
                  <div className={`p-4 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50`}>
                    <div className={`font-semibold truncate text-gray-900 dark:text-white`}>{user?.name || 'Admin User'}</div>
                    <div className={`text-xs truncate mt-1 text-gray-500 dark:text-gray-400`}>{user?.email || 'admin'}</div>
                    {user?.hasProPass && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/30">
                        <Crown className="w-3 h-3" /> PRO Member
                      </span>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className={`py-2 bg-white dark:bg-gray-900`}>
                    <a 
                      href={MAIN_SITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors text-sm text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white`} 
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <LayoutDashboard className={`w-4 h-4 text-gray-400 dark:text-gray-500`} />
                      Main Site
                    </a>
                    <a 
                      href={`${MAIN_SITE_URL}/profile`} 
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors text-sm text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white`} 
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <User className={`w-4 h-4 text-gray-400 dark:text-gray-500`} />
                      My Profile
                    </a>
                    <a 
                      href={`${MAIN_SITE_URL}/analysis`} 
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors text-sm text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white`} 
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <BarChart3 className={`w-4 h-4 text-gray-400 dark:text-gray-500`} />
                      My Analytics
                    </a>
                  </div>

                  {/* Logout */}
                  <div className={`border-t py-1 border-gray-200 dark:border-gray-700`}>
                    <button 
                      onClick={() => { handleLogout(); setIsProfileOpen(false) }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300`}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className={`flex-1 overflow-y-auto pb-16 md:pb-0 bg-gray-50 dark:bg-gray-950`} tabIndex={-1}>
          <Outlet key={refreshKey} context={{ refreshKey, isRefreshing, triggerRefresh: handlePageRefresh }} />
        </main>
      </div>

      <AdminBottomNav onMenuClick={() => setMobileMenuOpen(true)} />

    </div>
  )
}
