import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Search, Bell, Moon, Sun, ChevronDown, User, LogOut, Settings, Crown, BarChart2, LayoutTemplate, PanelLeft } from 'lucide-react'
import { useAuth } from '../../providers/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/dataService'
import { Logo } from '../index'

function Navbar({ onMenuClick, isLeftNavMode, onNavModeToggle }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  
  const searchInputRef = useRef(null)
  const notifRef = useRef(null)
  const searchTimerRef = useRef(null)

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.profile-dropdown')) {
        setIsProfileOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Handle Escape key for search overlay
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
        setSearchQuery('')
        setSearchResults([])
      }
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  // Auto-focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isSearchOpen])

  // Load notifications from API - use user ID to prevent refetch on object reference changes
  const userId = useMemo(() => user?.id, [user])
  
  useEffect(() => {
    if (userId) {
      const fetchNotifications = async () => {
        try {
          const response = await getNotifications({ limit: 10 })
          const notificationsData = response.data?.data || []
          setNotifications(notificationsData)
          setUnreadCount(notificationsData.filter(n => !n.read).length)
        } catch (error) {
          console.error('Failed to fetch notifications:', error)
          setNotifications([])
          setUnreadCount(0)
        }
      }
      fetchNotifications()
    }
  }, [userId])

  // Debounced search function
  const performSearch = useCallback((query) => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    
    // Local quick search through common routes/pages
    const allSearchableItems = [
      { title: 'Home', path: '/', category: 'Pages', icon: '🏠' },
      { title: 'Exams', path: '/exams', category: 'Pages', icon: '🎓' },
      { title: 'Test Series', path: '/test-series', category: 'Pages', icon: '📝' },
      { title: 'Study Materials', path: '/study', category: 'Pages', icon: '📚' },
      { title: 'Dashboard', path: '/dashboard', category: 'Pages', icon: '📊' },
      { title: 'Live Tests', path: '/live-tests', category: 'Tests', icon: '🔴' },
      { title: 'Practice Tests', path: '/practice', category: 'Tests', icon: '🎯' },
      { title: 'PYQ Papers', path: '/pyps', category: 'Tests', icon: '📄' },
      { title: 'Quizzes', path: '/quizzes', category: 'Tests', icon: '❓' },
      { title: 'Video Lectures', path: '/videos', category: 'Resources', icon: '🎥' },
      { title: 'Analysis & Reports', path: '/analysis', category: 'Pages', icon: '📈' },
      { title: 'Attempted Tests', path: '/attempted-tests', category: 'Pages', icon: '✅' },
      { title: 'Pro Pass', path: '/pass', category: 'Pages', icon: '👑' },
      { title: 'My Profile', path: '/profile', category: 'Account', icon: '👤' },
      { title: 'SSC CGL', path: '/exams', category: 'Exams', icon: '📝' },
      { title: 'SSC CHSL', path: '/exams', category: 'Exams', icon: '📝' },
      { title: 'SSC MTS', path: '/exams', category: 'Exams', icon: '📝' },
      { title: 'Railway NTPC', path: '/exams', category: 'Exams', icon: '🚂' },
      { title: 'Railway Group D', path: '/exams', category: 'Exams', icon: '🚂' },
      { title: 'Banking', path: '/exams', category: 'Exams', icon: '💰' },
      { title: 'General Knowledge', path: '/study', category: 'Subjects', icon: '📖' },
      { title: 'Quantitative Aptitude', path: '/study', category: 'Subjects', icon: '🔢' },
      { title: 'English Language', path: '/study', category: 'Subjects', icon: '🔤' },
      { title: 'Reasoning', path: '/study', category: 'Subjects', icon: '🧠' },
    ]
    
    const lowerQuery = query.toLowerCase()
    const results = allSearchableItems.filter(item => 
      item.title.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery)
    ).slice(0, 8)

    setTimeout(() => {
      setSearchResults(results)
      setIsSearching(false)
    }, 200)
  }, [])

  // Handle search input change with debounce
  const handleSearchChange = (e) => {
    const query = e.target.value
    setSearchQuery(query)
    
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    
    searchTimerRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)
  }

  // Handle search result click
  const handleSearchResultClick = (path) => {
    setIsSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    navigate(path)
  }

  // Mark notification as read
  const markAsRead = async (id) => {
    try {
      await markNotificationRead(id)
      setNotifications(prev => 
        prev.map(n => n.id === id || n._id === id ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  // Navigation links - show Dashboard instead of Home for logged-in users
  const navLinks = user 
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Exams', path: '/exams' },
        { label: 'Test Series', path: '/test-series' },
        { label: 'Study Materials', path: '/study' },
      ]
    : [
        { label: 'Home', path: '/' },
        { label: 'Exams', path: '/exams' },
        { label: 'Test Series', path: '/test-series' },
        { label: 'Study Materials', path: '/study' },
      ]

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Get notification icon color based on type
  const getNotifColor = (type) => {
    switch(type) {
      case 'test': return 'bg-blue-100 text-blue-600'
      case 'result': return 'bg-green-100 text-green-600'
      case 'promo': return 'bg-amber-100 text-amber-600'
      case 'report': return 'bg-purple-100 text-purple-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getNotifIcon = (type) => {
    switch(type) {
      case 'test': return '📝'
      case 'result': return '📊'
      case 'promo': return '🎉'
      case 'report': return '📈'
      default: return '🔔'
    }
  }

  return (
    <nav id="navbar" className={`bg-white/95 backdrop-blur-md shadow-soft sticky top-0 z-50 border-b border-white/50 transition-all duration-300 dark:bg-gray-900/95 dark:border-gray-700/50 ${isLeftNavMode ? 'lg:ml-[260px]' : ''}`}>
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          
          {/* Logo - Hidden when left sidebar mode is active on desktop */}
          {!isLeftNavMode && (
            <Logo />
          )}

          {/* Mobile Search Bar - Visible on mobile/tablet in Top Nav mode */}
          {!isLeftNavMode && (
            <div className="flex-1 max-w-xs mx-4 lg:hidden">
              <div 
                onClick={() => setIsSearchOpen(true)}
                className="relative flex items-center h-9 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="ml-2 text-xs font-medium truncate">Search...</span>
              </div>
            </div>
          )}

          {/* Big Search Bar - Only when left sidebar mode is active */}
          {isLeftNavMode && (
            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search for tests, exams, study materials..."
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-start/20 focus:border-brand-start transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                  onClick={() => setIsSearchOpen(true)}
                  readOnly
                />
                <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-white border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500">
                  ⌘K
                </kbd>
              </div>
            </div>
          )}

          {/* Desktop Navigation Links */}
          {!isLeftNavMode && (
            <div className="hidden lg:flex items-center space-x-6 flex-1 justify-center">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link font-medium transition whitespace-nowrap px-2 py-1 ${
                    isActive(link.path) 
                      ? 'text-brand-start' 
                      : 'text-slate-600 hover:text-brand-start dark:text-gray-300 dark:hover:text-brand-start'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right Icons */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* Navigation Mode Toggle - Desktop only */}
            {user && (
              <button
                onClick={onNavModeToggle}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-brand-start hover:bg-gray-100 rounded-lg transition dark:text-gray-300 dark:hover:bg-gray-800"
                title={isLeftNavMode ? "Switch to top navigation" : "Switch to left sidebar"}
              >
                {isLeftNavMode ? (
                  <>
                    <LayoutTemplate className="h-4 w-4" />
                    <span>Top Nav</span>
                  </>
                ) : (
                  <>
                    <PanelLeft className="h-4 w-4" />
                    <span>Sidebar</span>
                  </>
                )}
              </button>
            )}

            {/* Search Button - Hidden in left sidebar mode since big search bar is visible */}
            {!isLeftNavMode && (
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:block p-2 text-brand-start hover:bg-purple-50 dark:hover:bg-gray-800 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md"
                title="Search (Ctrl+K)"
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            {/* Dark Mode Toggle - Always visible when logged in with sidebar, otherwise sm+ */}
            <button 
              onClick={toggleDarkMode}
              className={`${(isLeftNavMode && user) ? 'block' : 'hidden sm:block'} p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md dark:text-gray-300 dark:hover:bg-gray-800`}
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Desktop Auth - Visible when logged in with sidebar on all screens, otherwise md+ */}
            <div className={`${(isLeftNavMode && user) ? 'flex' : 'hidden md:flex'} items-center space-x-3`}>
              {user ? (
                <>
                  {/* Notifications */}
                  <div className="relative" ref={notifRef}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsNotifOpen(!isNotifOpen) }}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md relative dark:text-gray-300 dark:hover:bg-gray-800"
                      title="Notifications"
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notification Dropdown */}
                    {isNotifOpen && (
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 dark:bg-gray-800 dark:border-gray-700">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                          <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                          {unreadCount > 0 && (
                            <button 
                              onClick={markAllAsRead}
                              className="text-xs font-medium text-brand-start hover:underline"
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>

                        {/* Notification List */}
                        <div className="max-h-80 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map((notif) => (
                              <div 
                                key={notif.id || notif._id}
                                onClick={() => markAsRead(notif.id || notif._id)}
                                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50 last:border-0 dark:hover:bg-gray-700/50 dark:border-gray-700/50 ${
                                  !notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${getNotifColor(notif.type)}`}>
                                  {getNotifIcon(notif.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-medium truncate ${!notif.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                      {notif.title}
                                    </p>
                                    {!notif.read && (
                                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 dark:text-gray-400">{notif.message}</p>
                                  <p className="text-[10px] text-gray-400 mt-1 dark:text-gray-500">{notif.time}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center">
                              <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">No notifications yet</p>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700">
                            <button className="w-full px-4 py-2.5 text-sm font-medium text-brand-start hover:bg-gray-50 transition dark:hover:bg-gray-700">
                              View all notifications
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Profile Dropdown */}
                  <div className={`profile-dropdown relative ${isProfileOpen ? 'open' : ''}`}>
                    <button 
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 hover:scale-105 dark:hover:bg-gray-800"
                    >
                      {user?.avatar ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shadow-md flex items-center justify-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          <img 
                            src={user.avatar.startsWith('data:') ? user.avatar : user.avatar} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-full items-center justify-center bg-gradient-to-br from-brand-start to-brand-end text-white font-bold text-sm">
                            {user.name?.charAt(0) || 'U'}
                          </div>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-start to-brand-end flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {user.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    <div className={`profile-dropdown-menu ${isProfileOpen ? '' : 'hidden'}`}>
                      {/* User Info */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="font-semibold text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.hasProPass && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700 text-xs font-bold rounded-full">
                            <Crown className="w-3 h-3" /> PRO Member
                          </span>
                        )}
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        {/* Admin Panel - Only for admins */}
                        {user.role === 'admin' && (
                          <>
                            <Link to="/admin" className="profile-dropdown-item bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold" onClick={() => setIsProfileOpen(false)}>
                              <Settings className="w-4 h-4" />
                              Admin Panel
                            </Link>
                            <div className="profile-dropdown-divider"></div>
                          </>
                        )}
                        
                        <Link to="/profile" className="profile-dropdown-item" onClick={() => setIsProfileOpen(false)}>
                          <User className="w-4 h-4" />
                          My Profile
                        </Link>
                        <Link to="/analysis" className="profile-dropdown-item" onClick={() => setIsProfileOpen(false)}>
                          <BarChart2 className="w-4 h-4" />
                          My Analytics
                        </Link>
                        <Link to="/settings" className="profile-dropdown-item" onClick={() => setIsProfileOpen(false)}>
                          <Settings className="w-4 h-4" />
                          Settings
                        </Link>
                      </div>

                      <div className="profile-dropdown-divider"></div>

                      <div className="py-2">
                        <button 
                          onClick={() => { logout(); setIsProfileOpen(false) }}
                          className="profile-dropdown-item danger w-full text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Combined Login/Sign Up button for tablet space efficiency */}
                  <Link 
                    to="/login"
                    state={{ backgroundLocation: location }}
                    className="px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-lg hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5 btn-animated"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Toggle Button */}
            <button 
              onClick={onMenuClick}
              className="md:hidden p-2 text-slate-600 hover:text-brand-start hover:bg-purple-50 rounded-lg transition"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]) } }}
        >
          <div className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden dark:bg-gray-800">
            {/* Search Input */}
            <div className="p-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
              <Search className="w-6 h-6 text-gray-400 flex-shrink-0" />
              <input 
                ref={searchInputRef}
                type="text" 
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search tests, topics, exams..."
                className="flex-1 text-lg outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
                autoFocus
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                  className="p-1 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <button 
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]) }}
                className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="max-h-80 overflow-y-auto">
                {isSearching ? (
                  <div className="p-6 text-center">
                    <div className="w-6 h-6 border-2 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Searching...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    {/* Group results by category */}
                    {Object.entries(
                      searchResults.reduce((groups, item) => {
                        const group = item.category
                        if (!groups[group]) groups[group] = []
                        groups[group].push(item)
                        return groups
                      }, {})
                    ).map(([category, items]) => (
                      <div key={category}>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
                          {category}
                        </div>
                        {items.map((result, i) => (
                          <button
                            key={`${result.path}-${i}`}
                            onClick={() => handleSearchResultClick(result.path)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition dark:hover:bg-gray-700/50"
                          >
                            <span className="text-lg">{result.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate dark:text-white">{result.title}</p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" />
                          </button>
                        ))}
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="p-6 text-center">
                    <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No results found for "<strong>{searchQuery}</strong>"</p>
                    <p className="text-xs text-gray-400 mt-1">Try searching for test names, subjects, or exams</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Links (shown when no query) */}
            {!searchQuery && (
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Links</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { title: 'Test Series', path: '/test-series', icon: '📝' },
                    { title: 'Live Tests', path: '/live-tests', icon: '🔴' },
                    { title: 'PYQ Papers', path: '/pyps', icon: '📄' },
                    { title: 'Study Materials', path: '/study', icon: '📚' },
                  ].map((link) => (
                    <button
                      key={link.path}
                      onClick={() => handleSearchResultClick(link.path)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <span>{link.icon}</span>
                      <span className="font-medium">{link.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono dark:bg-gray-600">↵</kbd> to select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono dark:bg-gray-600">ESC</kbd> to close
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono dark:bg-gray-600">⌘K</kbd> to search
              </span>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar