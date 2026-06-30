import { useEffect, useRef, useState, useMemo } from 'react'

/**
 * AnimatedHero - A reusable animated hero banner component with page-specific animations
 * 
 * @param {string} pageType - Type of page (home, dashboard, testSeries, testDetails, testInterface, testResult, exams, examDetails, studyMaterial, videos, profile, analysis, pass, login, signup)
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle text
 * @param {ReactNode} children - Additional content to render in the hero
 * @param {string} className - Additional CSS classes
 * @param {boolean} compact - Use compact variant for smaller headers
 */
function AnimatedHero({ 
  pageType = 'default', 
  title, 
  subtitle, 
  children, 
  className = '',
  compact = false,
  overlay = true
}) {
  const canvasRef = useRef(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)

  // Page-specific animation configurations
  const pageConfigs = useMemo(() => ({
    home: {
      gradient: 'from-indigo-600 via-purple-600 to-pink-500',
      pattern: 'gradient-shift',
      particles: { count: 50, type: 'floating-dots', color: 'rgba(255,255,255,0.3)' },
      decorative: ['large-circle', 'small-circle', 'floating-shapes'],
      animation: { type: 'gradient-flow', duration: 15 },
      accentColor: '#fbbf24'
    },
    dashboard: {
      gradient: 'from-violet-600 via-purple-600 to-indigo-600',
      pattern: 'wave-pattern',
      particles: { count: 30, type: 'pulse-dots', color: 'rgba(255,255,255,0.25)' },
      decorative: ['user-avatar-glow', 'progress-ring'],
      animation: { type: 'subtle-wave', duration: 20 },
      accentColor: '#a78bfa'
    },
    testSeries: {
      gradient: 'from-blue-600 via-indigo-600 to-purple-600',
      pattern: 'grid-pattern',
      particles: { count: 40, type: 'rising-squares', color: 'rgba(255,255,255,0.2)' },
      decorative: ['book-stack', 'floating-cards'],
      animation: { type: 'float-up', duration: 25 },
      accentColor: '#60a5fa'
    },
    testDetails: {
      gradient: 'from-slate-700 via-gray-800 to-zinc-900',
      pattern: 'diagonal-lines',
      particles: { count: 25, type: 'scattered-points', color: 'rgba(255,255,255,0.15)' },
      decorative: ['corner-accent', 'sidebar-glow'],
      animation: { type: 'subtle-pulse', duration: 10 },
      accentColor: '#f97316'
    },
    testInterface: {
      gradient: 'from-gray-100 via-white to-gray-50',
      pattern: 'minimal-grid',
      particles: { count: 0, type: 'none', color: 'transparent' },
      decorative: ['timer-pulse'],
      animation: { type: 'none', duration: 0 },
      accentColor: '#3b82f6'
    },
    testResult: {
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      pattern: 'celebration-burst',
      particles: { count: 60, type: 'confetti', color: 'multi' },
      decorative: ['trophy-glow', 'star-burst'],
      animation: { type: 'celebration', duration: 3 },
      accentColor: '#fbbf24'
    },
    exams: {
      gradient: 'from-indigo-700 via-blue-800 to-slate-900',
      pattern: 'exam-pattern',
      particles: { count: 35, type: 'floating-icons', color: 'rgba(255,255,255,0.2)' },
      decorative: ['exam-icons', 'category-badges'],
      animation: { type: 'scroll-right', duration: 30 },
      accentColor: '#6366f1'
    },
    examDetails: {
      gradient: 'from-blue-700 via-indigo-700 to-purple-700',
      pattern: 'info-grid',
      particles: { count: 20, type: 'slow-float', color: 'rgba(255,255,255,0.2)' },
      decorative: ['year-selector', 'stats-cards'],
      animation: { type: 'gradient-shift', duration: 18 },
      accentColor: '#818cf8'
    },
    studyMaterial: {
      gradient: 'from-green-500 via-emerald-500 to-teal-500',
      pattern: 'book-pattern',
      particles: { count: 30, type: 'floating-books', color: 'rgba(255,255,255,0.3)' },
      decorative: ['book-shelf', 'page-flip'],
      animation: { type: 'gentle-wave', duration: 20 },
      accentColor: '#34d399'
    },
    videos: {
      gradient: 'from-red-500 via-rose-500 to-pink-500',
      pattern: 'video-reel',
      particles: { count: 35, type: 'play-buttons', color: 'rgba(255,255,255,0.25)' },
      decorative: ['film-strip', 'play-icon-large'],
      animation: { type: 'film-scroll', duration: 25 },
      accentColor: '#f43f5e'
    },
    profile: {
      gradient: 'from-purple-600 via-violet-600 to-indigo-600',
      pattern: 'profile-pattern',
      particles: { count: 20, type: 'orbiting-dots', color: 'rgba(255,255,255,0.3)' },
      decorative: ['avatar-ring', 'achievement-badges'],
      animation: { type: 'orbit', duration: 30 },
      accentColor: '#c084fc'
    },
    analysis: {
      gradient: 'from-cyan-500 via-blue-500 to-indigo-500',
      pattern: 'chart-pattern',
      particles: { count: 25, type: 'data-points', color: 'rgba(255,255,255,0.25)' },
      decorative: ['chart-bars', 'progress-arcs'],
      animation: { type: 'data-flow', duration: 15 },
      accentColor: '#22d3ee'
    },
    pass: {
      gradient: 'from-amber-500 via-orange-500 to-yellow-500',
      pattern: 'premium-pattern',
      particles: { count: 45, type: 'sparkles', color: 'rgba(255,255,255,0.4)' },
      decorative: ['crown-glow', 'diamond-shapes'],
      animation: { type: 'shimmer', duration: 5 },
      accentColor: '#fbbf24'
    },
    login: {
      gradient: 'from-indigo-600 via-purple-600 to-pink-500',
      pattern: 'auth-pattern',
      particles: { count: 40, type: 'floating-dots', color: 'rgba(255,255,255,0.25)' },
      decorative: ['form-glow', 'social-icons'],
      animation: { type: 'gentle-wave', duration: 20 },
      accentColor: '#818cf8'
    },
    signup: {
      gradient: 'from-violet-600 via-purple-600 to-fuchsia-500',
      pattern: 'auth-pattern',
      particles: { count: 45, type: 'floating-dots', color: 'rgba(255,255,255,0.25)' },
      decorative: ['form-glow', 'welcome-badge'],
      animation: { type: 'gentle-wave', duration: 22 },
      accentColor: '#c084fc'
    },
    liveTests: {
      gradient: 'from-rose-600 via-red-600 to-orange-600',
      pattern: 'zap-pattern',
      particles: { count: 40, type: 'pulse-dots', color: 'rgba(255,255,255,0.3)' },
      decorative: ['timer-pulse', 'arena-glow'],
      animation: { type: 'subtle-pulse', duration: 8 },
      accentColor: '#fbbf24'
    },
    pyqPaper: {
      gradient: 'from-blue-600 via-indigo-600 to-cyan-600',
      pattern: 'document-pattern',
      particles: { count: 30, type: 'floating-dots', color: 'rgba(255,255,255,0.2)' },
      decorative: ['file-icon-glow', 'history-orbit'],
      animation: { type: 'float-up', duration: 25 },
      accentColor: '#60a5fa'
    },
    practice: {
      gradient: 'from-indigo-600 via-violet-600 to-purple-600',
      pattern: 'target-pattern',
      particles: { count: 35, type: 'rising-squares', color: 'rgba(255,255,255,0.25)' },
      decorative: ['target-glow', 'progress-orbit'],
      animation: { type: 'gentle-wave', duration: 20 },
      accentColor: '#818cf8'
    },
    quizzes: {
      gradient: 'from-purple-600 via-fuchsia-600 to-pink-600',
      pattern: 'quiz-pattern',
      particles: { count: 40, type: 'sparkles', color: 'rgba(255,255,255,0.3)' },
      decorative: ['question-glow', 'star-burst'],
      animation: { type: 'celebration', duration: 15 },
      accentColor: '#f472b6'
    },
    default: {
      gradient: 'from-indigo-600 via-purple-600 to-pink-500',
      pattern: 'default-pattern',
      particles: { count: 30, type: 'floating-dots', color: 'rgba(255,255,255,0.2)' },
      decorative: ['simple-circle'],
      animation: { type: 'gradient-flow', duration: 20 },
      accentColor: '#818cf8'
    }
  }), [])

  const config = pageConfigs[pageType] || pageConfigs.default

  // Handle mouse movement for parallax effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setMousePosition({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      })
    }

    const container = containerRef.current
    container?.addEventListener('mousemove', handleMouseMove)
    return () => container?.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Particle animation with canvas
  useEffect(() => {
    if (!canvasRef.current || config.particles.count === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId
    let particles = []

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize particles based on type
    const initParticles = () => {
      particles = []
      for (let i = 0; i < config.particles.count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 4 + 1,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.1,
          hue: config.particles.color === 'multi' ? Math.random() * 360 : null
        })
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach(p => {
        // Update position
        p.x += p.speedX
        p.y += p.speedY

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        
        if (config.particles.color === 'multi') {
          ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.opacity})`
        } else {
          ctx.fillStyle = config.particles.color.replace(')', `, ${p.opacity})`).replace('rgba', 'rgba')
        }
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    initParticles()
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [config])

  // Generate decorative elements based on page type
  const renderDecorativeElements = () => {
    const elements = []

    if (config.decorative.includes('large-circle')) {
      elements.push(
        <div 
          key="large-circle"
          className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 animate-float-slow"
          style={{ animationDuration: '20s' }}
        />
      )
    }

    if (config.decorative.includes('small-circle')) {
      elements.push(
        <div 
          key="small-circle"
          className="absolute bottom-0 left-0 w-48 h-48 md:w-64 md:h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 animate-float-slow"
          style={{ animationDuration: '25s', animationDelay: '5s' }}
        />
      )
    }

    if (config.decorative.includes('floating-shapes')) {
      elements.push(
        <div key="floating-shapes" className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-white/20 rounded animate-float" style={{ animationDuration: '15s' }} />
          <div className="absolute top-1/3 right-1/4 w-6 h-6 bg-white/15 rounded-full animate-float" style={{ animationDuration: '18s', animationDelay: '2s' }} />
          <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-white/25 rounded animate-float" style={{ animationDuration: '12s', animationDelay: '4s' }} />
        </div>
      )
    }

    if (config.decorative.includes('trophy-glow')) {
      elements.push(
        <div 
          key="trophy-glow"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-400/20 rounded-full blur-3xl animate-pulse-slow"
        />
      )
    }

    if (config.decorative.includes('star-burst')) {
      elements.push(
        <div key="star-burst" className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-2 h-2 bg-yellow-300/60 rounded-full animate-twinkle"
              style={{ 
                top: `${Math.random() * 100}%`, 
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.5}s`
              }}
            />
          ))}
        </div>
      )
    }

    if (config.decorative.includes('crown-glow')) {
      elements.push(
        <div 
          key="crown-glow"
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-400/30 rounded-full blur-3xl animate-shimmer"
        />
      )
    }

    if (config.decorative.includes('avatar-ring')) {
      elements.push(
        <div 
          key="avatar-ring"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border-2 border-white/10 rounded-full animate-spin-slow"
          style={{ animationDuration: '30s' }}
        />
      )
    }

    if (config.decorative.includes('file-icon-glow')) {
      elements.push(
        <div
          key="file-icon-glow"
          className="absolute top-3 right-4 md:top-5 md:right-8 w-12 h-14 md:w-16 md:h-20 bg-white/10 rounded-lg flex items-center justify-center animate-pulse-slow"
          style={{ animationDuration: '4s' }}
        >
          <svg className="w-6 h-6 md:w-8 md:h-8 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
      );
    }

    if (config.decorative.includes('history-orbit')) {
      elements.push(
        <div
          key="history-orbit"
          className="absolute -bottom-12 -right-8 md:-bottom-16 md:-right-12 w-36 h-36 md:w-48 md:h-48 border border-white/15 rounded-full animate-spin-slow pointer-events-none"
          style={{ animationDuration: '30s' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/40 rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-300/50 rounded-full" />
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1.5 h-1.5 bg-white/30 rounded-full" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-300/40 rounded-full" />
        </div>
      );
    }

    if (config.decorative.includes('timer-pulse') && !config.decorative.includes('arena-glow')) {
      elements.push(
        <div
          key="timer-pulse"
          className="absolute top-4 right-6 w-20 h-20 bg-white/5 rounded-full blur-2xl animate-pulse-slow"
          style={{ animationDuration: '3s' }}
        />
      );
    }

    if (config.decorative.includes('arena-glow')) {
      elements.push(
        <div
          key="arena-glow"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-400/10 rounded-full blur-3xl animate-pulse-slow"
          style={{ animationDuration: '5s' }}
        />
      );
    }

    if (config.decorative.includes('target-glow')) {
      elements.push(
        <div
          key="target-glow"
          className="absolute top-1/2 right-12 -translate-y-1/2 w-32 h-32 border-2 border-white/10 rounded-full animate-pulse-slow"
        >
          <div className="absolute inset-3 border border-white/10 rounded-full" />
          <div className="absolute inset-6 border border-white/10 rounded-full" />
        </div>
      );
    }

    if (config.decorative.includes('question-glow')) {
      elements.push(
        <div
          key="question-glow"
          className="absolute top-1/3 right-10 w-20 h-20 bg-pink-400/20 rounded-full blur-3xl animate-pulse-slow"
        />
      );
    }

    if (config.decorative.includes('book-stack')) {
      elements.push(
        <div key="book-stack" className="absolute bottom-4 right-6 flex flex-col-reverse gap-1 opacity-20 pointer-events-none">
          <div className="w-16 h-3 bg-white/40 rounded-sm" />
          <div className="w-14 h-3 bg-white/30 rounded-sm ml-2" />
          <div className="w-12 h-3 bg-white/20 rounded-sm ml-1" />
        </div>
      );
    }

    if (config.decorative.includes('floating-cards')) {
      elements.push(
        <div key="floating-cards" className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-12 h-16 bg-white/10 rounded-lg animate-float" style={{ animationDuration: '18s' }} />
          <div className="absolute bottom-1/4 left-1/4 w-10 h-14 bg-white/5 rounded-lg animate-float" style={{ animationDuration: '22s', animationDelay: '3s' }} />
        </div>
      );
    }

    if (config.decorative.includes('exam-icons') || config.decorative.includes('category-badges')) {
      elements.push(
        <div key="exam-icons" className="absolute inset-0 overflow-hidden pointer-events-none opacity-15">
          <div className="absolute top-1/4 right-1/3 text-2xl animate-float" style={{ animationDuration: '15s' }}>📋</div>
          <div className="absolute bottom-1/3 right-1/4 text-xl animate-float" style={{ animationDuration: '20s', animationDelay: '2s' }}>📝</div>
        </div>
      );
    }

    // Default decorative elements for all pages
    elements.push(
      <div 
        key="gradient-overlay"
        className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10 pointer-events-none"
      />
    )

    return elements
  }

  return (
    <section 
      ref={containerRef}
      className={`
        relative overflow-hidden
        ${compact ? 'py-5 md:py-6' : 'pt-4 pb-12 md:pb-10'}
        bg-gradient-to-br ${config.gradient}
        ${className}
      `}
    >
      {/* Animated background pattern */}
      {config.animation.type !== 'none' && (
        <div 
          className={`absolute inset-0 opacity-10 animate-${config.animation.type}`}
          style={{ animationDuration: `${config.animation.duration}s` }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
        </div>
      )}

      {/* Particle canvas */}
      {config.particles.count > 0 && (
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.6 }}
        />
      )}

      {/* Decorative elements */}
      {renderDecorativeElements()}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {title && (
          <h1 
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 animate-slide-up"
            style={{ 
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              animationDelay: '0.1s'
            }}
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <p 
            className="text-white/80 text-lg md:text-xl max-w-2xl animate-slide-up"
            style={{ animationDelay: '0.2s' }}
          >
            {subtitle}
          </p>
        )}
        {children}
      </div>

      {/* Typewriter effect for title (optional) */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10px, -10px) scale(1.02); }
          66% { transform: translate(-5px, 5px) scale(0.98); }
        }
        
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes gradient-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes shimmer {
          0% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
          100% { opacity: 0.3; transform: scale(1); }
        }
        
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
        
        @keyframes spin-slow {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        @keyframes float-up {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-100px) rotate(10deg); opacity: 0; }
        }
        
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 20s ease-in-out infinite; }
        .animate-slide-up { animation: slide-up 0.6s ease-out forwards; opacity: 0; }
        .animate-gradient-flow { 
          background-size: 200% 200%;
          animation: gradient-flow 15s ease infinite;
        }
        .animate-shimmer { animation: shimmer 3s ease-in-out infinite; }
        .animate-twinkle { animation: twinkle 2s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 30s linear infinite; }
        .animate-float-up { animation: float-up 25s linear infinite; }
      `}</style>
    </section>
  )
}

export default AnimatedHero
