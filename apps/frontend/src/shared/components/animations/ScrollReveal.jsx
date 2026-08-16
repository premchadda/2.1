import { useEffect, useRef, useState } from 'react'

// Replaces framer-motion with a lightweight CSS transition so the (large)
// animation library is no longer pulled into the main frontend bundle.
function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.5,
  distance = 30,
  once = true,
  threshold = 0.1,
  className = '',
}) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, threshold])

  const offsetMap = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
  }

  const style = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'none' : offsetMap[direction],
    transition: `opacity ${duration}s ease-out ${delay}s, transform ${duration}s ease-out ${delay}s`,
    willChange: 'opacity, transform',
  }

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  )
}

export { ScrollReveal }
export default ScrollReveal
