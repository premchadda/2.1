import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

// Replaces framer-motion with a CSS transition so the (large) animation
// library is no longer pulled into the main frontend bundle.
//
// NOTE: This component intentionally does NOT remount its children on every
// location change. An earlier version set `key={location.pathname}`, which
// forced a full DOM rebuild (and a visible blank/fatal-flash) whenever the
// route changed while the surrounding layout was already animating — most
// noticeably on the login -> dashboard transition when the sidebar appears.
// Keeping a stable element lets React reconcile normally and avoids that
// double-motion/flash. We only animate the translateY entrance.
function PageTransition({ children, className = '' }) {
  const location = useLocation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(false)
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [location.pathname])

  const style = {
    opacity: 1,
    transform: mounted ? 'translateY(0)' : 'translateY(8px)',
    transition: 'transform 0.2s ease-out',
  }

  // Stable wrapper (no key) so route changes during layout shifts (e.g. the
  // sidebar margin push on login) don't force a destructive remount.
  return (
    <div style={style} className={className}>
      {children}
    </div>
  )
}

export { PageTransition }
export default PageTransition
