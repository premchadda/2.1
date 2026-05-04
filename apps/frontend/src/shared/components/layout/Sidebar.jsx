import { Link, useLocation } from 'react-router-dom'
import { X, Home, BookOpen, Radio, FileText, Target, HelpCircle, ClipboardCheck, GraduationCap, Library, Video, BarChart2, Crown, LogOut, Settings, Trophy, MessageCircle, Users } from 'lucide-react'
import { useAuth } from '../../providers/AuthContext'
import { Logo } from '../index'

function Sidebar({ isOpen, onClose }) {
  const location = useLocation()
  const { user, logout } = useAuth()

  const handleNavClick = () => {
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div 
        onClick={onClose}
        className={`mobile-overlay fixed inset-0 bg-black/40 z-40 transition-opacity ${isOpen ? 'open' : ''}`}
        style={{ opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden' }}
      />

      {/* Drawer */}
      <div 
        className={`mobile-drawer fixed top-0 right-0 h-full w-60 max-w-[85vw] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'open' : ''}`}
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <Logo 
            iconSize="w-4 h-4" 
            containerSize="w-7 h-7" 
            textSize="text-base" 
            onClick={handleNavClick} 
          />
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Content (Scrollable) */}
        <div className="p-3 space-y-3 flex-1 overflow-y-auto">

          {/* Home/Dashboard Link */}
          <div>
            <Link 
              to={user ? '/dashboard' : '/'}
              onClick={handleNavClick}
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              <Home className="w-4 h-4 text-brand-start" />
              <span className="text-sm font-medium">{user ? 'Dashboard' : 'Home'}</span>
            </Link>
          </div>

          {/* Learning & Tests */}
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
              Learning & Tests
            </h3>
            <div className="space-y-0.5">
              <Link to="/test-series" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Test Series</span>
              </Link>
              <Link to="/live-tests" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <Radio className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Live Tests</span>
              </Link>
              <Link to="/pyps" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <FileText className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">PYQ Papers</span>
              </Link>
              <Link to="/practice" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Practice</span>
              </Link>
              <Link to="/quizzes" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <HelpCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Quizzes</span>
              </Link>
              <Link to="/attempted-tests" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <ClipboardCheck className="w-4 h-4 text-sky-500" />
                <span className="text-sm font-medium">Attempted Tests</span>
              </Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
              Resources
            </h3>
            <div className="space-y-0.5">
              <Link to="/exams" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <GraduationCap className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium">All Exams</span>
              </Link>
              <Link to="/study" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <Library className="w-4 h-4 text-teal-500" />
                <span className="text-sm font-medium">Study Materials</span>
              </Link>
              <Link to="/videos" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <Video className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-medium">Videos</span>
              </Link>
              <Link to="/analysis" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <BarChart2 className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium">Analysis</span>
              </Link>
              <Link to="/leaderboard" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Leaderboard</span>
              </Link>
              <Link to="/doubts" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <MessageCircle className="w-4 h-4 text-cyan-500" />
                <span className="text-sm font-medium">Doubts & Q&A</span>
              </Link>
              <Link to="/study-groups" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                <Users className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium">Study Groups</span>
              </Link>
            </div>
          </div>

          {/* Premium */}
          <div>
            <Link to="/pass" onClick={handleNavClick} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-amber-50 text-gray-700">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600">Pass Pro</span>
              <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">PRO</span>
            </Link>
          </div>

        </div>

        {/* Auth Section (Sticky at Bottom) */}
        <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
          {user ? (
            <div className="flex gap-2">
              <Link 
                to="/profile" 
                onClick={handleNavClick}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm font-medium transition"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <button 
                onClick={() => { logout(); handleNavClick() }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 text-sm font-medium transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link 
                to="/signup" 
                onClick={handleNavClick}
                className="block w-full py-2.5 text-center bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-lg hover:shadow-glow transition"
              >
                Create Account
              </Link>
              <Link 
                to="/login" 
                onClick={handleNavClick}
                className="block w-full py-2.5 text-center bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Sidebar
