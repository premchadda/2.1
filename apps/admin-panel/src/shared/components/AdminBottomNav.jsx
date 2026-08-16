import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, FileQuestion, Users, Menu } from 'lucide-react'

const navColors = [
  { gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600', barGradient: 'bg-gradient-to-r from-blue-500 to-indigo-600', text: '#6366f1', glow: 'rgba(99, 102, 241, 0.3)' },
  { gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600', barGradient: 'bg-gradient-to-r from-emerald-500 to-teal-600', text: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
  { gradient: 'bg-gradient-to-br from-red-500 to-rose-600', barGradient: 'bg-gradient-to-r from-red-500 to-rose-600', text: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
  { gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', barGradient: 'bg-gradient-to-r from-amber-500 to-orange-600', text: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
  { gradient: 'bg-gradient-to-br from-violet-500 to-purple-600', barGradient: 'bg-gradient-to-r from-violet-500 to-purple-600', text: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.3)' },
]

function AdminBottomNav({ onMenuClick }) {
  const location = useLocation()

  const navItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/admin' },
    { icon: FileText, label: 'Tests', path: '/admin/tests' },
    { icon: FileQuestion, label: 'Questions', path: '/admin/questions' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: Menu, label: 'Menu', path: null, isMenu: true },
  ]

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="pointer-events-auto relative flex items-center justify-around px-1.5 py-1 mx-2 dark:bg-gray-900 rounded-full shadow-lg border border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        {navItems.map(({ icon: Icon, label, path, isMenu }, index) => {
          const active = isMenu ? false : isActive(path)
          const color = navColors[index % navColors.length]

          if (isMenu) {
            return (
              <button
                key="menu"
                onClick={onMenuClick}
                className="relative flex flex-col items-center justify-center py-1 px-1.5 min-w-0 flex-1 max-w-[72px] transition-all duration-300 ease-out"
              >
                <div className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ease-out">
                  <Icon
                    className="w-[18px] h-[18px] transition-all duration-300 relative z-10 text-gray-500 dark:text-gray-400"
                    strokeWidth={2}
                  />
                </div>
                <span className="text-[9px] font-semibold transition-all duration-300 truncate w-full text-center opacity-60 text-gray-500 dark:text-gray-400">
                  {label}
                </span>
              </button>
            )
          }

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
                  <span className={`absolute inset-0 rounded-xl ${color.gradient} opacity-15 dark:opacity-25`} />
                )}

                <Icon
                  className="w-[18px] h-[18px] transition-all duration-300 relative z-10"
                  style={{
                    color: active ? color.text : undefined,
                    filter: active ? `drop-shadow(0 2px 4px ${color.glow})` : 'none',
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                  }}
                  strokeWidth={active ? 2.5 : 2}
                />
              </div>

              <span
                className={`text-[9px] font-semibold transition-all duration-300 truncate w-full text-center ${
                  active
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
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full ${color.barGradient}`} />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default AdminBottomNav
