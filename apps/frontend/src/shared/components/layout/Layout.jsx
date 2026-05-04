import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import LeftSidebar from './LeftSidebar'
import BottomNav from './BottomNav'
import { useAuth } from '../../providers/AuthContext'

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [navMode, setNavMode] = useState('top') // 'top' or 'left'
  const [isTransitioning, setIsTransitioning] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load nav mode preference
  useEffect(() => {
    const savedNavMode = localStorage.getItem('trstprep_navMode')
    if (savedNavMode) {
      setNavMode(savedNavMode)
    }
  }, [])

  // Ensure sidebar is closed on route change and mount
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const closeSidebar = () => setSidebarOpen(false)

  const toggleNavMode = () => {
    const newMode = navMode === 'top' ? 'left' : 'top'
    setNavMode(newMode)
    localStorage.setItem('trstprep_navMode', newMode)
  }

  // Left nav mode is only available for authenticated desktop users
  const isLeftNavMode = navMode === 'left' && !isMobile && !!user

  // Handle page transition on route change
  useEffect(() => {
    setIsTransitioning(true)
    const timer = setTimeout(() => setIsTransitioning(false), 300)
    return () => clearTimeout(timer)
  }, [location.pathname])

  return (
    <div className={`min-h-screen bg-gray-50 ${isLeftNavMode ? 'desktop-left-nav-mode' : ''}`}>
      {/* Top Navbar */}
      <Navbar 
        onMenuClick={toggleSidebar} 
        isLeftNavMode={isLeftNavMode}
        onNavModeToggle={toggleNavMode}
      />

      {/* Desktop Left Sidebar */}
      {isLeftNavMode && <LeftSidebar />}

      {/* Mobile Overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile Sidebar (Right Side) */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isMobile={isMobile}
        isLeftNavMode={false}
      />

       {/* Main Content */}
       <main 
         className={`
           transition-all duration-300 ease-in-out
           pb-[88px] md:pb-0
           ${isLeftNavMode ? 'lg:ml-[260px]' : ''}
         `}
       >
        <div 
          className={`
            min-h-screen
            ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
            transition-all duration-300 ease-out
          `}
        >
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav />}
    </div>
  )
}

export default Layout
