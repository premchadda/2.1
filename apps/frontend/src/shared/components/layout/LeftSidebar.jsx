import { Link, useLocation } from 'react-router-dom'
import { Home, BookOpen, Radio, FileText, Target, HelpCircle, ClipboardCheck, GraduationCap, Library, Video, BarChart2, Crown, LayoutDashboard, Shield, MessageCircle, Users, Trophy } from 'lucide-react'
import { useAuth } from '../../providers/AuthContext'
import { Logo } from '../index'

function LeftSidebar() {
  const location = useLocation()
  const { user } = useAuth()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const navItemClass = (path) => {
    const active = isActive(path)
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
      active 
        ? 'bg-gradient-to-r from-brand-start/10 to-brand-end/10 text-brand-start font-semibold' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`
  }

  const iconClass = (path, colorClass) => {
    const active = isActive(path)
    return `w-5 h-5 transition-colors ${active ? 'text-brand-start' : colorClass}`
  }

    return (
     <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[260px] bg-white border-r border-gray-200 z-30">
      {/* Header - Same height as top navbar (h-14) */}
      <div className="px-4 h-14 border-b border-gray-100 flex items-center flex-shrink-0">
        <Logo 
          containerSize="w-8 h-8"
          iconSize="w-5 h-5"
          textSize="text-xl"
        />
      </div>

      {/* Menu Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto py-4 pl-3 space-y-1">
        
        {/* Main Navigation */}
        <div className="mb-2">
          <Link to={user ? '/dashboard' : '/'} className={navItemClass(user ? '/dashboard' : '/')}>
            {user ? (
              <LayoutDashboard className={iconClass('/dashboard', 'text-gray-400 group-hover:text-gray-600')} />
            ) : (
              <Home className={iconClass('/', 'text-gray-400 group-hover:text-gray-600')} />
            )}
            <span className="text-sm">{user ? 'Dashboard' : 'Home'}</span>
          </Link>
        </div>

        {/* Section: Learning & Tests */}
        <div className="pt-2">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
            Learning & Tests
          </h3>
          <div className="space-y-0.5">
            <Link to="/test-series" className={navItemClass('/test-series')}>
              <BookOpen className={iconClass('/test-series', 'text-blue-500')} />
              <span className="text-sm">Test Series</span>
            </Link>
            
            <Link to="/live-tests" className={navItemClass('/live-tests')}>
              <Radio className={iconClass('/live-tests', 'text-red-500')} />
              <span className="text-sm">Live Tests</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </Link>
            
            <Link to="/pyps" className={navItemClass('/pyps')}>
              <FileText className={iconClass('/pyps', 'text-green-500')} />
              <span className="text-sm">PYQ Papers</span>
            </Link>
            
            <Link to="/practice" className={navItemClass('/practice')}>
              <Target className={iconClass('/practice', 'text-purple-500')} />
              <span className="text-sm">Practice</span>
            </Link>
            
            <Link to="/quizzes" className={navItemClass('/quizzes')}>
              <HelpCircle className={iconClass('/quizzes', 'text-yellow-500')} />
              <span className="text-sm">Quizzes</span>
            </Link>
            
            <Link to="/attempted-tests" className={navItemClass('/attempted-tests')}>
              <ClipboardCheck className={iconClass('/attempted-tests', 'text-sky-500')} />
              <span className="text-sm">Attempted Tests</span>
            </Link>
          </div>
        </div>

        {/* Section: Resources */}
        <div className="pt-4">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
            Resources
          </h3>
          <div className="space-y-0.5">
            <Link to="/exams" className={navItemClass('/exams')}>
              <GraduationCap className={iconClass('/exams', 'text-indigo-500')} />
              <span className="text-sm">All Exams</span>
            </Link>
            
            <Link to="/study" className={navItemClass('/study')}>
              <Library className={iconClass('/study', 'text-teal-500')} />
              <span className="text-sm">Study Materials</span>
            </Link>
            
            <Link to="/videos" className={navItemClass('/videos')}>
              <Video className={iconClass('/videos', 'text-pink-500')} />
              <span className="text-sm">Videos</span>
            </Link>
            
            <Link to="/analysis" className={navItemClass('/analysis')}>
              <BarChart2 className={iconClass('/analysis', 'text-orange-500')} />
              <span className="text-sm">Analysis</span>
            </Link>
            
            <Link to="/leaderboard" className={navItemClass('/leaderboard')}>
              <Trophy className={iconClass('/leaderboard', 'text-yellow-500')} />
              <span className="text-sm">Leaderboard</span>
            </Link>
            
            <Link to="/doubts" className={navItemClass('/doubts')}>
              <MessageCircle className={iconClass('/doubts', 'text-cyan-500')} />
              <span className="text-sm">Doubts & Q&A</span>
            </Link>
            
            <Link to="/study-groups" className={navItemClass('/study-groups')}>
              <Users className={iconClass('/study-groups', 'text-violet-500')} />
              <span className="text-sm">Study Groups</span>
            </Link>
          </div>
        </div>

        {/* Section: Premium */}
        <div className="pt-4">
          <Link to="/pass" className={`${navItemClass('/pass')} hover:bg-amber-50/50`}>
            <Crown className={iconClass('/pass', 'text-amber-500')} />
            <span className="text-sm text-amber-700">Pass Pro</span>
            <span className="text-[10px] bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-bold">PRO</span>
          </Link>
        </div>

        {/* Admin Link - Only for admins */}
        {user?.role === 'admin' && (
          <div className="pt-4">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
              Administration
            </h3>
            <Link to="/admin" className={navItemClass('/admin')}>
              <Shield className={iconClass('/admin', 'text-indigo-600')} />
              <span className="text-sm">Admin Panel</span>
            </Link>
          </div>
        )}
      </div>

    </aside>
  )
}

export default LeftSidebar
