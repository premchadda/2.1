import { useState, useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, FileText, BookOpen, 
  Video, Users, Settings, LogOut, Menu, X, FolderTree, ChevronRight,
  Tag, Navigation, Info, Layers, Trash2, Ticket, Bell, Star,
  Search, ChevronDown, BarChart3, Trophy, Clock, HelpCircle,
  Database, Activity, Gift, Brain, Image, FileQuestion, UserCheck,
  CreditCard, AlertTriangle, Zap, User, Crown, Moon, Sun
} from 'lucide-react'
import { useAuth } from '../providers/AuthContext'
import { useTheme } from '../context/ThemeContext'
import adminNavConfig, { getFlatNavItems, getBreadcrumbs } from '../config/adminNavConfig'
import { Logo } from './index.jsx'
import { API_BASE_URL } from '../lib/apiBase.js'

// Main site URL - can be changed via environment variable
const MAIN_SITE_URL = import.meta.env.VITE_MAIN_SITE_URL || 'http://localhost:3000'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()

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

  // Filter navigation based on search
  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return adminNavConfig.categories
    
    const query = searchQuery.toLowerCase()
    return adminNavConfig.categories.map(category => ({
      ...category,
      items: category.items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      )
    })).filter(category => category.items.length > 0)
  }, [searchQuery])

  // Search results for command palette
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return getFlatNavItems().filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    ).slice(0, 8)
  }, [searchQuery])

  // FIX CRIT-09: Remove localStorage clearing - auth uses httpOnly cookies
  // Backend clears cookies on logout via /auth/logout endpoint
  const handleLogout = async () => {
    try {
      // Call backend logout endpoint to clear httpOnly cookies
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include', // Send cookies with request
      })
    } catch (err) {
      // Even if logout request fails, still redirect to login
      console.error('Logout error:', err)
    } finally {
      // Clear only sessionStorage metadata (not tokens - those are httpOnly)
      sessionStorage.removeItem('trstprep_session')
      sessionStorage.removeItem('trstprep_user')
      window.dispatchEvent(new Event('unauthorized'))
      navigate('/login')
    }
  }

  const isActive = (path) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
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
            : isDarkMode
              ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'
        }`}
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
              ? isDarkMode ? 'bg-gray-800/80 text-white' : 'bg-gray-100 text-indigo-700'
              : isDarkMode ? 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
          }`}
          style={{ borderLeft: hasActiveChild ? `3px solid ${category.color}` : '3px solid transparent' }}
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
          <div className={`mt-1 ml-4 pl-4 border-l space-y-1 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            {category.items.map(item => renderNavItem(item, category.color))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex h-screen transition-colors duration-200 ${isDarkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
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
        ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}
        transition-all duration-300 border-r
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center justify-between px-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
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
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          >
            {sidebarOpen ? <X className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} /> : <Menu className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {filteredNav.map(category => renderCategory(category))}
        </nav>
      </aside>

      {/* Sidebar - Mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out md:hidden border-r
        ${isDarkMode ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-gray-900 border-gray-200'}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center justify-between px-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
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
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {filteredNav.map(category => renderCategory(category))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Bar */}
        <header className={`h-14 md:h-16 flex-shrink-0 border-b flex items-center justify-between px-4 md:px-6 transition-colors duration-200 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          {/* Left Section - Breadcrumbs / Page Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className={`p-2 rounded-lg md:hidden ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            
            {/* Breadcrumbs */}
            <div className="hidden md:flex items-center gap-2 text-sm flex-shrink-0">
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {idx > 0 && <ChevronRight className="w-4 h-4 text-gray-600" />}
                  {crumb.path ? (
                    <Link to={crumb.path} className="text-gray-400 hover:text-white transition-colors">
                      {crumb.name}
                    </Link>
                  ) : (
                    <span className="text-gray-600">{crumb.name}</span>
                  )}
                </div>
              ))}
            </div>
            
            {/* Current Page Title - Mobile */}
            <h2 className={`text-lg font-semibold md:hidden ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {currentPage?.name || 'Admin Panel'}
            </h2>
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
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400'}`}
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
                <div className={`absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-2xl z-50 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                  {searchResults.length > 0 ? (
                    <div className="p-2">
                      {searchResults.map((item, idx) => (
                        <Link
                          key={idx}
                          to={item.path}
                          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                        >
                          <div 
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
                          >
                            <item.icon className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
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

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {/* User Profile Dropdown */}
            <div className="relative admin-profile-dropdown shrink-0">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
              >
                {hasValidAvatar ? (
                  <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
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
                <ChevronDown className={`hidden lg:block w-4 h-4 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div className={`absolute right-0 top-full mt-2 w-64 rounded-xl shadow-2xl overflow-hidden z-[100] border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                  {/* User Info Header */}
                  <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className={`font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user?.name || 'Admin User'}</div>
                    <div className={`text-xs truncate mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email || 'admin@trstprep.com'}</div>
                    {user?.hasProPass && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/30">
                        <Crown className="w-3 h-3" /> PRO Member
                      </span>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className={`py-2 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
                    <a 
                      href={MAIN_SITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600'}`} 
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <LayoutDashboard className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      Main Site
                    </a>
                    <a 
                      href={`${MAIN_SITE_URL}/profile`} 
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600'}`} 
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <User className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      My Profile
                    </a>
                    <a 
                      href={`${MAIN_SITE_URL}/analysis`} 
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600'}`} 
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <BarChart3 className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      My Analytics
                    </a>
                  </div>

                  {/* Logout */}
                  <div className={`border-t py-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <button 
                      onClick={() => { handleLogout(); setIsProfileOpen(false) }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors text-sm ${isDarkMode ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
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
        <main className={`flex-1 overflow-y-auto pb-16 md:pb-0 ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 border-t z-50 px-2 py-2 flex justify-between items-center safe-area-bottom ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <Link 
          to="/admin" 
          className={`flex flex-col items-center gap-1 min-w-[3.5rem] p-2 rounded-lg transition-colors ${
            isActive('/admin') && location.pathname === '/admin'
              ? 'bg-indigo-600/20 text-indigo-500' 
              : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        
        <Link 
          to="/admin/tests" 
          className={`flex flex-col items-center gap-1 min-w-[3.5rem] p-2 rounded-lg transition-colors ${
            isActive('/admin/tests') 
              ? 'bg-indigo-600/20 text-indigo-500' 
              : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-medium">Tests</span>
        </Link>

        <Link 
          to="/admin/questions" 
          className={`flex flex-col items-center gap-1 min-w-[3.5rem] p-2 rounded-lg transition-colors ${
            isActive('/admin/questions') 
              ? 'bg-indigo-600/20 text-indigo-500' 
              : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <FileQuestion className="w-5 h-5" />
          <span className="text-[10px] font-medium">Questions</span>
        </Link>

        <Link 
          to="/admin/users" 
          className={`flex flex-col items-center gap-1 min-w-[3.5rem] p-2 rounded-lg transition-colors ${
            isActive('/admin/users') 
              ? 'bg-indigo-600/20 text-indigo-500' 
              : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">Users</span>
        </Link>

        <button 
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-col items-center gap-1 min-w-[3.5rem] p-2 rounded-lg transition-colors ${
            mobileMenuOpen 
              ? 'bg-indigo-600/20 text-indigo-500' 
              : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>

    </div>
  )
}