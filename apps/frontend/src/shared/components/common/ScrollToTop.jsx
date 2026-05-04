import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop Component
 * 
 * Automatically scrolls the window to the top (0, 0) whenever
 * the current route location changes. This fixes the issue where
 * client-side navigation preserves the scroll position of the previous page.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    // Scroll to top of the document immediately on route change
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // 'instant' ensures the user doesn't see a scroll animation
    })
  }, [pathname])

  return null
}

export default ScrollToTop
