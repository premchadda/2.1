import { Link, useLocation } from 'react-router-dom'
import { Home, BookOpen, Radio, BookMarked, User, LayoutDashboard, Shield, LogIn } from 'lucide-react'
import { useAuth } from '../../providers/AuthContext'

const navColors = [
  { bg: 'from-blue-500 to-indigo-600', text: '#6366f1', light: 'bg-indigo-50 dark:bg-indigo-900/30', glow: 'rgba(99, 102, 241, 0.3)' },
  { bg: 'from-emerald-500 to-teal-600', text: '#10b981', light: 'bg-emerald-50 dark:bg-emerald-900/30', glow: 'rgba(16, 185, 129, 0.3)' },
  { bg: 'from-red-500 to-rose-600', text: '#ef4444', light: 'bg-red-50 dark:bg-red-900/30', glow: 'rgba(239, 68, 68, 0.3)' },
  { bg: 'from-amber-500 to-orange-600', text: '#f59e0b', light: 'bg-amber-50 dark:bg-amber-900/30', glow: 'rgba(245, 158, 11, 0.3)' },
  { bg: 'from-violet-500 to-purple-600', text: '#8b5cf6', light: 'bg-violet-50 dark:bg-violet-900/30', glow: 'rgba(139, 92, 246, 0.3)' },
]

function BottomNav() {
  const location = useLocation()
  const { user } = useAuth()

  const getNavItems = () => {
    if (!user) {
      return [
        { icon: Home, label: 'Home', path: '/' },
        { icon: BookOpen, label: 'Tests', path: '/test-series' },
        { icon: Radio, label: 'Live', path: '/live-tests', hasLiveDot: true },
        { icon: BookMarked, label: 'Study', path: '/study' },
        { icon: LogIn, label: 'Login', path: '/login' },
      ]
    } else if (user.role === 'admin') {
      return [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: BookOpen, label: 'Tests', path: '/test-series' },
        { icon: Shield, label: 'Admin', path: '/admin', isAdmin: true },
        { icon: BookMarked, label: 'Study', path: '/study' },
        { icon: User, label: 'Profile', path: '/profile' },
      ]
    } else {
      return [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: BookOpen, label: 'Tests', path: '/test-series' },
        { icon: Radio, label: 'Live', path: '/live-tests', hasLiveDot: true },
        { icon: BookMarked, label: 'Study', path: '/study' },
        { icon: User, label: 'Profile', path: '/profile' },
      ]
    }
  }

  const navItems = getNavItems()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="pointer-events-auto relative flex items-center justify-around px-1.5 py-1 mx-2 dark:bg-gray-900 rounded-full shadow-lg border border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        {navItems.map(({ icon: Icon, label, path, hasLiveDot, isAdmin }, index) => {
          const active = isActive(path)
          const color = navColors[index % navColors.length]
          return (
            <Link
              key={path}
              to={path}
              className="relative flex flex-col items-center justify-center py-1 px-1.5 min-w-0 flex-1 max-w-[72px] transition-all duration-300 ease-out"
            >
              {active && (
                <span className="absolute inset-0 mx-auto w-10 h-8 bg-gradient-to-b from-white/60 to-transparent dark:from-gray-800/60 rounded-xl -z-0" />
              )}

              <div className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ease-out">
                {active && (
                  <span className={`absolute inset-0 rounded-xl bg-gradient-to-br ${color.bg} opacity-15 dark:opacity-25`} />
                )}

                {hasLiveDot && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"
                    style={{ animation: 'livePulse 1.5s ease-in-out infinite', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}
                  />
                )}

                {path === '/profile' && user?.avatar ? (
                  <div
                    className={`w-6 h-6 rounded-full overflow-hidden transition-all duration-300 ${active
                        ? 'ring-2 ring-offset-1 ring-violet-500 dark:ring-offset-gray-900 scale-110'
                        : 'ring-1 ring-gray-200 dark:ring-gray-700'
                      }`}
                  >
                    <img
                      src={user.avatar.startsWith('data:') ? user.avatar : user.avatar}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'block'
                      }}
                    />
                    <Icon className="hidden w-full h-full text-gray-500" />
                  </div>
                ) : path === '/login' ? (
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${active
                        ? `bg-gradient-to-br ${color.bg} text-white shadow-md scale-110`
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <Icon
                    className="w-[18px] h-[18px] transition-all duration-300 relative z-10"
                    style={{
                      color: active ? color.text : undefined,
                      filter: active ? `drop-shadow(0 2px 4px ${color.glow})` : 'none',
                      transform: active ? 'scale(1.1)' : 'scale(1)',
                    }}
                    strokeWidth={active ? 2.5 : 2}
                  />
                )}
              </div>

              <span
                className={`text-[9px] font-semibold transition-all duration-300 truncate w-full text-center ${active
                    ? 'opacity-100'
                    : 'opacity-60 text-gray-500 dark:text-gray-400'
                  }`}
                style={{
                  color: active ? color.text : undefined,
                }}
              >
                {label}
              </span>

              {active && (
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-gradient-to-r ${color.bg}`} />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav