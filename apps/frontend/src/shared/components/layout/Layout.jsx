import { useLocation, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import LeftSidebar from './LeftSidebar'
import BottomNav from './BottomNav'
import { useAuth } from '../../providers/AuthContext'
import PageTransition from '../animations/PageTransition.jsx'

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [navMode, setNavMode] = useState('top')
  const location = useLocation()
  const { user } = useAuth()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const savedNavMode = localStorage.getItem('trstprep_navMode')
    if (savedNavMode) setNavMode(savedNavMode)
  }, [])

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

  const isLeftNavMode = navMode === 'left' && !isMobile && !!user

  return (
    <div className={`min-h-screen bg-gray-50 ${isLeftNavMode ? 'desktop-left-nav-mode' : ''}`}>
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
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

       <main 
         id="main-content"
         tabIndex={-1}
         className={`
           transition-all duration-300 ease-in-out
           pb-[88px] md:pb-0
           ${isLeftNavMode ? 'lg:ml-[260px]' : ''}
         `}
       >
        <PageTransition className="min-h-screen">
          <Outlet />
        </PageTransition>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav />}
    </div>
  )
}

export default Layout
