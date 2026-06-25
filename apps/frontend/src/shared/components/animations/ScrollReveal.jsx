import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

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

  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
  }

  const hidden = { opacity: 0, ...directionMap[direction] }
  const visible = { opacity: 1, x: 0, y: 0 }

  return (
    <motion.div
      ref={ref}
      initial={hidden}
      animate={isVisible ? visible : hidden}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { ScrollReveal }
export default ScrollReveal
