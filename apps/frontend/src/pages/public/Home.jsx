import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import {
  getTestSeries, getStudyMaterials, getTests,
  examAPI, testsAPI, fetchFromAPI
} from '../../shared/lib/dataService'
import { getSeriesTestStats } from '../../shared/lib/testSeriesStats.js'
import {
  TestSeriesCard, AnimatedHero, SEO,
  ScrollReveal
} from '../../shared/components'
import { getTestStartDate, checkIsLiveExpired } from '../../shared/utils/testClassification'
import {
  ArrowRight, Radio, HelpCircle, BookOpen, Target,
  Star, Users, Calendar,
  Crown, ChevronRight, Play, Clock, Zap, Sparkles, Award
} from 'lucide-react'

function Home() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [testSeries, setTestSeries] = useState([])
  const [tests, setTests] = useState([])
  const [studyMaterials, setStudyMaterials] = useState([])
  const [featuredExams, setFeaturedExams] = useState([])
  const [examCategories, setExamCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [liveTests, setLiveTests] = useState([])
  const [freeQuizzes, setFreeQuizzes] = useState([])
  const [liveTestsLoading, setLiveTestsLoading] = useState(true)
  const [testimonials, setTestimonials] = useState([])
  const [testimonialsLoading, setTestimonialsLoading] = useState(true)
  const [platformStats, setPlatformStats] = useState({
    activeLearners: 0, mockTests: 0, examsCovered: 0, satisfaction: null
  })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isAuthenticated) return
    const controller = new AbortController()
    const fetchData = async () => {
      try {
        const [series, allTests, materials, examsResponse, categoriesResponse, statsResponse] = await Promise.all([
          getTestSeries(), getTests(), getStudyMaterials(),
          examAPI.getExams(), examAPI.getCategories(), examAPI.getPublicStats()
        ])
        setTestSeries(series)
        setTests(allTests)
        setStudyMaterials(materials)
        const exams = examsResponse.data?.data || []
        setFeaturedExams(exams.filter(exam => exam.isActive).slice(0, 6))
        const categories = categoriesResponse.data?.data || []
        setExamCategories(categories)
        if (statsResponse?.data?.data) {
          const s = statsResponse.data.data
          setPlatformStats({
            activeLearners: s.activeLearners || 0,
            mockTests: s.mockTests || 0,
            examsCovered: s.examsCovered || 0,
            satisfaction: s.satisfaction || null
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error('Failed to fetch data:', error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchData()
    return () => controller.abort()
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [navigate, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) return
    const controller = new AbortController()
    const fetchLiveTests = async () => {
      try {
        setLiveTestsLoading(true)
        const [liveRes, quizRes] = await Promise.all([
          testsAPI.getByTag('live-tests'),
          testsAPI.getByTag('quizzes')
        ])
        const rawLive = liveRes.data?.data || liveRes.data || []
        const activeLive = (Array.isArray(rawLive) ? rawLive : []).filter(t => !checkIsLiveExpired(t))
        setLiveTests(activeLive.slice(0, 3))
        setFreeQuizzes((quizRes.data?.data || quizRes.data || []).slice(0, 3))
      } catch (error) {
        if (!controller.signal.aborted) console.error('Failed to fetch live tests:', error)
      } finally {
        if (!controller.signal.aborted) setLiveTestsLoading(false)
      }
    }
    fetchLiveTests()
    return () => controller.abort()
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) return
    const controller = new AbortController()
    const fetchTestimonials = async () => {
      try {
        setTestimonialsLoading(true)
        const response = await fetchFromAPI('/api/testimonials?limit=3')
        const data = response?.data || response || []
        setTestimonials(Array.isArray(data) ? data.slice(0, 3) : [])
      } catch (error) {
        if (!controller.signal.aborted) console.error('Failed to fetch testimonials:', error)
      } finally {
        if (!controller.signal.aborted) setTestimonialsLoading(false)
      }
    }
    fetchTestimonials()
    return () => controller.abort()
  }, [isAuthenticated])

  useEffect(() => {
    let lastUpdate = 0
    const handleMouseMove = (e) => {
      const now = performance.now()
      if (now - lastUpdate > 100) { // throttle to ~10fps
        lastUpdate = now
        setMousePos({ x: e.clientX, y: e.clientY })
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const categoryMap = useMemo(() => {
    const map = {}
    examCategories.forEach(cat => { map[cat.id] = cat.label || cat.name })
    return map
  }, [examCategories])

  const testSeriesWithStats = useMemo(() => {
    return testSeries.map(series => getSeriesTestStats(series, tests))
  }, [testSeries, tests])

  const popularSeries = useMemo(() => {
    return [...testSeriesWithStats].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      const orderDiff = (a.order || 0) - (b.order || 0)
      if (orderDiff !== 0) return orderDiff
      return (b.users || 0) - (a.users || 0)
    }).slice(0, isMobile ? 4 : 8)
  }, [testSeriesWithStats, isMobile])

  const getExamIcon = (categoryId) => {
    const icons = { ssc: '📝', railways: '🚂', banking: '💰', upsc: '🏛️', defence: '🎖️', teaching: '🎓', default: '📋' }
    return icons[categoryId] || icons.default
  }

  const renderSkeletonCards = (count, w = 'w-[270px]', h = 'h-36') => (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${w} ${h} bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse flex-shrink-0`} />
      ))}
    </div>
  )

  return (
    <div className="page-transition fade-in">
      <SEO
        title="Home"
        description="Trstprep - Your trusted platform for test preparation, mock tests, and exam practice."
        keywords="exam preparation, mock test, SSC exam, Railway exam, mock test platform"
        path="/"
        breadcrumbs={[{ name: 'Home', path: '/' }]}
      />

      {/* ─── HERO ─────────────────────────────────────── */}
      <AnimatedHero pageType="home">
        {user ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl md:text-2xl font-bold text-white shadow-lg animate-scale-in">
                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="text-white">
                <h1 className="text-xl md:text-2xl font-bold animate-slide-in-right">
                  Welcome back, {user.name?.split(' ')[0]}! 👋
                </h1>
                <p className="text-purple-100 text-sm md:text-base mt-1 animate-slide-in-right"
                  style={{ animationDelay: '0.1s' }}>
                  Continue your preparation journey
                </p>
              </div>
            </div>
            {user.hasProPass && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400/20 backdrop-blur-sm rounded-full text-amber-100 border border-amber-400/30 animate-shimmer">
                <Crown className="w-4 h-4" />
                <span className="text-xs md:text-sm font-bold">PRO Member</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-6 md:py-10">
              {/* Text content */}
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-full mb-4 md:mb-6 animate-slide-up">
                  <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-300" />
                  <span className="text-xs md:text-sm font-semibold text-white/90">
                    Your All-in-One Test Preparation Platform
                  </span>
                </div>

                <h1
                  className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 md:mb-5 leading-tight animate-slide-up"
                  style={{ animationDelay: '0.1s', textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  Crack Your
                  <span className="relative inline-block">
                    <span className="relative z-10 text-yellow-300 animate-pulse"> Dream Exam</span>
                    <span className="absolute bottom-0.5 md:bottom-1 left-0 w-full h-1.5 md:h-2 bg-yellow-400/30 rounded-full" />
                  </span>
                  <br />
                  <span className="text-white/90">With Confidence 🎯</span>
                </h1>

                <p className="text-sm md:text-lg lg:text-xl text-purple-100 mb-5 md:mb-8 max-w-md md:max-w-lg leading-relaxed animate-slide-up"
                  style={{ animationDelay: '0.2s' }}>
                  500+ mock tests, AI analytics & real-time leaderboards. Trusted by aspirants across India.
                </p>

                <div className="flex flex-wrap gap-3 md:gap-4 mb-6 md:mb-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                  <Link
                    to="/signup"
                    className="group px-6 py-3 md:px-8 md:py-4 bg-white text-brand-start font-bold rounded-xl md:rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 btn-animated inline-flex items-center text-sm md:text-base"
                  >
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2 inline group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/test-series"
                    className="px-6 py-3 md:px-8 md:py-4 bg-white/10 text-white border border-white/30 font-semibold rounded-xl md:rounded-2xl hover:bg-white/20 transition-all duration-300 hover:scale-105 inline-flex items-center text-sm md:text-base backdrop-blur-sm"
                  >
                    <Play className="w-4 h-4 mr-1.5 md:mr-2" />
                    Explore Tests
                  </Link>
                </div>

                {/* Trust indicators - hidden on small mobile */}
                <div className="hidden sm:flex flex-wrap items-center gap-4 md:gap-6 text-xs md:text-sm text-purple-200 animate-slide-up"
                  style={{ animationDelay: '0.35s' }}>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-green-300" />
                    <span>No card required</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-yellow-300" />
                    <span>Detailed solutions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-300" />
                    <span>All-India rankings</span>
                  </div>
                </div>
              </div>

              {/* 3D floating card — desktop only */}
              {!isMobile && (
                <div className="relative hidden lg:block" style={{ perspective: '1200px' }}>
                  <div
                    className="absolute -top-4 right-8 z-30 transition-transform duration-500"
                    style={{
                      transform: `translate3d(${(mousePos.x / window.innerWidth - 0.5) * 16}px, ${(mousePos.y / window.innerHeight - 0.5) * 16}px, 0)`,
                      transition: 'transform 0.4s cubic-bezier(0.23,1,0.32,1)',
                    }}
                  >
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-3 shadow-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">
                          🎯
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm">Daily Target</div>
                          <div className="text-purple-200 text-xs">50 questions</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="absolute bottom-10 -left-6 z-30 transition-transform duration-700"
                    style={{
                      transform: `translate3d(${(mousePos.x / window.innerWidth - 0.5) * 12}px, ${(mousePos.y / window.innerHeight - 0.5) * 12}px, 0)`,
                      transition: 'transform 0.6s cubic-bezier(0.23,1,0.32,1)',
                    }}
                  >
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-3 shadow-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center text-xl shadow-lg">
                          📈
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm">AI Insights</div>
                          <div className="text-purple-200 text-xs">Updated daily</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main 3D card */}
                  <div
                    className="relative z-10 bg-white/8 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 md:p-7 shadow-2xl transition-transform duration-500"
                    style={{
                      transform: `rotateY(${(mousePos.x / window.innerWidth - 0.5) * 8}deg) rotateX(${-(mousePos.y / window.innerHeight - 0.5) * 8}deg)`,
                      boxShadow: '0 40px 100px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        TP
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">Your Study Dashboard</div>
                        <div className="text-purple-300 text-xs font-medium">SSC CGL Tier-1 — Full Mock</div>
                      </div>
                      <div className="ml-auto bg-green-500/20 text-green-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-400/30">
                        Demo preview
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-purple-200 mb-1.5">
                        <span>Question 18 of 25</span>
                        <span className="text-white font-bold">02:14 left</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-start to-brand-end rounded-full"
                          style={{ width: '72%', animation: 'progressShine 2.5s ease-in-out infinite', backgroundSize: '200% 100%' }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {[
                        { emoji: '📐', name: 'Quantitative Aptitude', meta: '8 questions', score: 'Section 1', good: true, bg: 'bg-red-500/10' },
                        { emoji: '📖', name: 'English Language', meta: '7 questions', score: 'Section 2', good: false, bg: 'bg-blue-500/10' },
                        { emoji: '🧠', name: 'General Awareness', meta: '10 questions', score: 'Section 3', good: true, bg: 'bg-emerald-500/10' },
                      ].map((s, i) => (
                        <div key={i} className={`flex items-center gap-2.5 ${s.bg} rounded-xl px-3 py-2 border border-white/5`}>
                          <div className="text-xl">{s.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white/90 text-xs font-semibold truncate">{s.name}</div>
                            <div className="text-purple-300/80 text-[10px]">{s.meta}</div>
                          </div>
                          <div className={`text-xs font-bold ${s.good ? 'text-green-300' : 'text-yellow-300'}`}>
                            {s.score}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Compact hero stats — 2-col on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              {[
                { value: '500+', label: 'Mock Tests' },
                { value: '50+', label: 'Exam Categories' },
                { value: '24×7', label: 'Doubt Support' },
                { value: '100%', label: 'Detailed Solutions' },
              ].map((stat, i) => (
                <div key={i} className="bg-white/8 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 text-center transition-all duration-300 hover:bg-white/12 hover:scale-105">
                  <div className="text-xl md:text-2xl font-extrabold text-white">{stat.value}</div>
                  <div className="text-purple-200/80 text-[10px] md:text-xs font-medium mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AnimatedHero>

      {/* ─── FEATURED EXAMS ────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <ScrollReveal>
          <div className="flex justify-between items-end mb-5 md:mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl md:text-2xl">📚</span>
                <h2 className="text-lg md:text-2xl font-extrabold text-gray-900 dark:text-white">
                  Featured Exams
                </h2>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm hidden sm:block">
                Top exam categories covered by our platform
              </p>
            </div>
            <Link to="/exams" className="text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group">
              View All <ArrowRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </ScrollReveal>

        {loading
          ? renderSkeletonCards(isMobile ? 3 : 4, isMobile ? 'w-[200px]' : 'w-[270px]', isMobile ? 'h-28' : 'h-36')
          : featuredExams.length > 0 ? (
            <ScrollReveal direction="up" threshold={0.05}>
              <div className="relative overflow-hidden rounded-xl md:rounded-2xl">
                <div className="flex gap-3 md:gap-5 animate-marquee-left hover:[animation-play-state:paused]">
                  {[...featuredExams, ...featuredExams].map((exam, index) => (
                    <Link
                      key={`${exam._id || exam.id}-${index}`}
                      to={`/exam/${exam.examId || exam.id}`}
                      className="w-[230px] md:w-[270px] flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 hover:shadow-hover-card hover:border-brand-start dark:hover:border-indigo-500 transition-all cursor-pointer group"
                    >
                      <div className="text-3xl md:text-4xl mb-2 md:mb-3 group-hover:scale-110 transition-transform">{getExamIcon(exam.categoryId)}</div>
                      <div className="mb-1 md:mb-2">
                        <span className="text-[10px] md:text-xs font-bold text-brand-start dark:text-indigo-400 uppercase tracking-widest">
                          {categoryMap[exam.categoryId] || exam.categoryId}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-gray-900 dark:text-white text-sm md:text-lg group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors truncate">
                        {exam.title}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-0.5 md:mt-1 line-clamp-1">
                        {exam.fullName}
                      </p>
                      <div className="mt-2 md:mt-4 flex items-center gap-1.5 md:gap-2 text-brand-start dark:text-indigo-400 text-[10px] md:text-xs font-bold group-hover:gap-2.5 md:group-hover:gap-3 transition-all">
                        Explore <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ) : (
            <div className="text-center py-8 md:py-12 bg-gray-50 dark:bg-gray-800 rounded-xl md:rounded-2xl">
              <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2 md:mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No featured exams available</p>
            </div>
          )}
      </section>

      {/* ─── HOW IT WORKS ───────────────────────────────── */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-800" id="how">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-10 md:mb-14">
              <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4">
                <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" /> How it works
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 md:mb-4">
                Start winning in <span className="text-gradient">3 simple steps</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-lg mx-auto">
                No setup needed. Jump right in.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 relative">
            <div className="hidden md:block absolute top-14 md:top-16 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-brand-start/30 via-brand-end/30 to-brand-start/30" />

            {[
              { num: '01', icon: '🎯', title: 'Choose Exam', desc: 'Pick SSC, Railways, Banking, UPSC — we auto-load the right prep plan.' },
              { num: '02', icon: '📝', title: 'Practice Smart', desc: 'Full-length & sectional mocks with instant results & solutions.' },
              { num: '03', icon: '🏆', title: 'Crush It', desc: 'Follow AI plans, revisit weak topics, track daily progress.' },
            ].map((step, i) => (
              <ScrollReveal key={i} direction="up" delay={i * 0.12} threshold={0.15}>
                <div className="relative bg-gray-50 dark:bg-gray-700/40 rounded-2xl md:rounded-3xl p-6 md:p-8 text-center border border-gray-100 dark:border-gray-600 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 md:hover:-translate-y-2 group">
                  <div
                    className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-xl md:rounded-2xl bg-gradient-to-br from-brand-start to-brand-end flex items-center justify-center shadow-lg group-hover:shadow-glow group-hover:scale-110 transition-all duration-300 text-white font-extrabold text-xl md:text-2xl"
                    style={{ transform: 'rotateX(5deg) rotateY(-5deg)' }}
                  >
                    {step.num}
                  </div>
                  <div className="text-3xl md:text-4xl mb-3 md:mb-4">{step.icon}</div>
                  <h3 className="text-base md:text-lg font-extrabold text-gray-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PLATFORM STATS ─────────────────────────────── */}
      {platformStats.mockTests > 0 && (
        <section className="py-12 md:py-20 relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0f0a1e 0%, #1a1040 50%, #0f0a1e 100%)' }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-brand-start/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-brand-end/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <ScrollReveal>
              <div className="text-center mb-10 md:mb-14">
                <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-3 md:mb-4">
                  Numbers that speak for us
                </h2>
                <p className="text-purple-200/70 text-xs md:text-base">
                  Join millions of aspirants preparing with Trstprep
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              {[
                platformStats.activeLearners
                  ? { value: platformStats.activeLearners, suffix: platformStats.activeLearners >= 1000 ? 'K+' : '+', label: 'Active Learners', icon: Users }
                  : null,
                { value: platformStats.mockTests, suffix: '+', label: 'Mock Tests', icon: Target },
                { value: platformStats.examsCovered, suffix: '+', label: 'Exam Categories', icon: BookOpen },
                platformStats.satisfaction
                  ? { value: platformStats.satisfaction, suffix: '%', label: 'Satisfaction', icon: Award }
                  : null,
              ].filter(Boolean).map((stat, i) => (
                <ScrollReveal key={i} direction="up" delay={i * 0.1} threshold={0.1}>
                  <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-8 text-center transition-all duration-300 hover:bg-white/8 hover:scale-105">
                    <stat.icon className="w-5 h-5 md:w-6 md:h-6 mx-auto text-brand-light mb-2 md:mb-3" />
                    <div className="text-2xl md:text-5xl font-black text-white mb-0.5 md:mb-1">
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : 0}
                      <span className="text-lg md:text-3xl">{stat.suffix}</span>
                    </div>
                    <div className="text-purple-200/70 text-[10px] md:text-sm font-semibold">{stat.label}</div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── FEATURES ───────────────────────────────────── */}
      <section className="py-12 md:py-24 bg-white dark:bg-gray-800" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-10 md:mb-14">
              <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4">
                <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" /> Why Trstprep
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 md:mb-4">
                Built for every <span className="text-gradient">serious aspirant</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
                AI-powered analytics. Thousands of curated questions. Designed to get you to the top.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[
              { icon: '🤖', title: 'AI-Powered Analytics', desc: 'Deep insights into weak areas, time-per-question, and personalised improvement plans.' },
              { icon: '📝', title: '500+ Mock Tests', desc: 'Section-wise & full-length tests based on the latest pattern, updated by subject experts.' },
              { icon: '🏔️', title: 'All-India Leaderboard', desc: 'Compete with aspirants across India every week. Climb the ranks and see where you stand.' },
              { icon: '🔔', title: 'Live Tests & Quizzes', desc: 'Real exam environment scheduled live tests. Instant results, detailed solutions.' },
              { icon: '📚', title: 'Curated Study Material', desc: 'Notes, PYQs, videos and flashcards in one place. Nothing to download.' },
              { icon: '💬', title: 'Doubt Resolution', desc: 'Get explanations from expert faculty and peers within minutes, 24×7.' },
            ].map((feature, i) => (
              <ScrollReveal key={i} direction="up" delay={i * 0.06} threshold={0.1}>
                <div className="group relative bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-600 rounded-2xl md:rounded-3xl p-5 md:p-7 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-start/0 to-brand-end/0 group-hover:from-brand-start/5 group-hover:to-brand-end/3 transition-all duration-500" />
                  <div className="absolute top-3 right-5 text-5xl md:text-7xl font-black text-brand-start/[0.04] leading-none select-none pointer-events-none">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="relative z-10">
                    <div className="w-11 h-11 md:w-14 md:h-14 bg-gradient-to-br from-brand-start to-brand-end rounded-lg md:rounded-xl flex items-center justify-center text-xl md:text-2xl mb-3 md:mb-5 shadow-lg group-hover:shadow-glow group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-sm md:text-lg font-extrabold text-gray-900 dark:text-white mb-1.5 md:mb-3 group-hover:text-brand-start dark:group-hover:text-indigo-300 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── EXAM CATEGORIES (from real categories) ─────── */}
      {examCategories.length > 0 && (
        <section className="py-12 md:py-24" style={{ background: 'linear-gradient(180deg, #f8faff, #fdf4ff)' }} id="exams">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-10 md:mb-14">
                <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4">
                  📚 Exam Categories
                </div>
                <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 md:mb-4">
                  Browse <span className="text-gradient">all categories</span>
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              {examCategories.slice(0, 8).map((cat, i) => (
                <ScrollReveal key={cat.id || i} direction="up" delay={i * 0.08} threshold={0.1}>
                  <Link
                    to={`/exams?category=${cat.id}`}
                    className="block bg-white dark:bg-gray-700/50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-600 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 md:hover:-translate-y-2 group"
                  >
                    <div className="text-2xl md:text-3xl mb-2 md:mb-3">{getExamIcon(cat.id)}</div>
                    <h4 className="font-extrabold text-gray-900 dark:text-white text-sm md:text-base group-hover:text-brand-start dark:group-hover:text-indigo-300 transition-colors">
                      {cat.label || cat.name}
                    </h4>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── LIVE TESTS & QUIZZES ───────────────────────── */}
      {(liveTests.length > 0 || freeQuizzes.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <ScrollReveal>
            <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-6">
              <div className="relative">
                <span className="text-xl md:text-2xl">🔴</span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-extrabold text-gray-900 dark:text-white">Live Tests & Quizzes</h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm hidden sm:block">Real-time tests happening now</p>
              </div>
              <Link to="/live-tests" className="ml-auto text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group">
                View All <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Live Tests */}
            {liveTests.length > 0 && (
              <ScrollReveal direction="left">
                <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 shadow-soft">
                  <div className="flex items-center gap-2 mb-3 md:mb-5">
                    <Radio className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                    <h3 className="font-extrabold text-gray-800 dark:text-white text-sm md:text-base">Live Tests</h3>
                    <span className="text-[10px] md:text-xs text-gray-400">({liveTests.length})</span>
                  </div>
                  <div className="space-y-2.5 md:space-y-3">
                    {liveTestsLoading
                      ? [1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse p-3 md:p-4 rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800">
                          <div className="h-3 md:h-4 bg-red-200 dark:bg-red-800 rounded w-3/4 mb-1.5 md:mb-2" />
                          <div className="h-2.5 md:h-3 bg-red-100 dark:bg-red-900 rounded w-1/2" />
                        </div>
                      ))
                      : liveTests.map(test => (
                        <Link
                          key={test.id}
                          to={user ? `/test/${test.series?.slug || test.series?._id || test.series?.id || 'series'}/${test.id}` : '/login'}
                          className="block p-3 md:p-4 rounded-xl border transition-all duration-300 hover:shadow-md cursor-pointer group bg-gradient-to-br from-red-50/80 to-orange-50/80 dark:from-red-900/10 dark:to-orange-900/10 border-red-100 dark:border-red-800/50"
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="px-2 py-0.5 text-[9px] md:text-[10px] font-bold rounded-full text-white bg-red-500 animate-pulse">
                              🔴 LIVE
                            </span>
                            <span className="text-[10px] md:text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                              <Users className="w-3 h-3" />
                              {(test.participants || 0) > 1000 ? ((test.participants || 0) / 1000).toFixed(1) + 'k' : test.participants || 0}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-800 dark:text-white text-xs md:text-sm mb-1.5 line-clamp-1 group-hover:text-brand-start transition-colors">
                            {test.title}
                          </h3>
                          <div className="flex flex-col gap-1 text-[10px] md:text-[11px] text-gray-600 dark:text-gray-400 mb-2">
                            <div className="flex items-center gap-2 font-semibold">
                              <Clock className="w-3 h-3 text-red-500" /> {test.duration || test.timeLimit || 60} mins
                            </div>
                            <div className="flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded text-[9px] border border-amber-200 dark:border-amber-800/60">
                              <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="truncate">Available: {getTestStartDate(test) ? `${new Date(getTestStartDate(test)).toLocaleDateString('en-GB')}` : 'Available Now'}</span>
                            </div>
                          </div>
                          <button className="w-full py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl transition-all hover:shadow-lg">
                            {user ? '▶ Start Now' : '🔒 Login to Start'}
                          </button>
                        </Link>
                      ))
                    }
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* Free Quizzes */}
            {freeQuizzes.length > 0 && (
              <ScrollReveal direction="right">
                <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 shadow-soft">
                  <div className="flex items-center gap-2 mb-3 md:mb-5">
                    <HelpCircle className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                    <h3 className="font-extrabold text-gray-800 dark:text-white text-sm md:text-base">Free Quizzes</h3>
                    <span className="text-[10px] md:text-xs text-gray-400">({freeQuizzes.length})</span>
                  </div>
                  <div className="space-y-2.5 md:space-y-3">
                    {liveTestsLoading
                      ? [1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse p-3 md:p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800">
                          <div className="h-3 md:h-4 bg-blue-200 dark:bg-blue-800 rounded w-3/4 mb-1.5 md:mb-2" />
                          <div className="h-2.5 md:h-3 bg-blue-100 dark:bg-blue-900 rounded w-1/2" />
                        </div>
                      ))
                      : freeQuizzes.map(quiz => (
                        <Link
                          key={quiz.id}
                          to={user ? `/test/${quiz.series?.slug || quiz.series?._id || quiz.series?.id || 'series'}/${quiz.id}` : '/login'}
                          className="block p-3 md:p-4 rounded-xl border transition-all duration-300 hover:shadow-md cursor-pointer group bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-100 dark:border-blue-800/50"
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="px-2 py-0.5 text-[9px] md:text-[10px] font-bold rounded-full text-white bg-blue-500">
                              ⚡ QUIZ
                            </span>
                            <span className="text-[10px] md:text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                              <Users className="w-3 h-3" />
                              {(quiz.participants || 0) > 1000 ? ((quiz.participants || 0) / 1000).toFixed(1) + 'k' : quiz.participants || 0}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-800 dark:text-white text-xs md:text-sm mb-1.5 line-clamp-1 group-hover:text-brand-start transition-colors">
                            {quiz.title}
                          </h3>
                          <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-gray-600 dark:text-gray-400 mb-2">
                            <Clock className="w-3 h-3" /> {quiz.duration || quiz.timeLimit || 15} mins
                            <span>• {quiz.totalQuestions || 10} Qs</span>
                          </div>
                          <button className="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl transition-all hover:shadow-lg">
                            {user ? '▶ Start Now' : '🔒 Login to Start'}
                          </button>
                        </Link>
                      ))
                    }
                  </div>
                </div>
              </ScrollReveal>
            )}
          </div>
        </section>
      )}

      {/* ─── POPULAR TEST SERIES ────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <ScrollReveal>
          <div className="flex justify-between items-end mb-5 md:mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl md:text-2xl">🔥</span>
                <h2 className="text-lg md:text-2xl font-extrabold text-gray-900 dark:text-white">
                  Popular Test Series
                </h2>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm hidden sm:block">
                Top-rated series chosen by students
              </p>
            </div>
            <Link to="/test-series" className="text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group">
              View All <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </ScrollReveal>

        {loading
          ? (
            <div className="flex gap-4 md:gap-6 pb-4 overflow-hidden">
              {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
                <div key={i} className="w-56 md:w-64 h-64 md:h-72 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse flex-shrink-0" />
              ))}
            </div>
          )
          : (
            <ScrollReveal direction="up">
              <div
                className="flex gap-4 md:gap-6 pb-4 overflow-x-scroll scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {popularSeries.map((series, index) => (
                  <div key={series._id || `s-${index}`} className="transform transition-transform duration-300 hover:scale-[1.02]">
                    <TestSeriesCard
                      series={series}
                      user={user}
                      onEnroll={() => {}}
                    />
                  </div>
                ))}
              </div>
            </ScrollReveal>
          )}
      </section>

      {/* ─── STUDY MATERIALS ────────────────────────────── */}
      {studyMaterials.length > 0 && (
        <section className="py-10 md:py-20 bg-white dark:bg-gray-800 border-t border-gray-50 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="flex justify-between items-end mb-5 md:mb-6">
                <div>
                  <h2 className="text-lg md:text-2xl font-extrabold text-gray-900 dark:text-white mb-0.5 md:mb-1">
                    Study Materials
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm hidden sm:block">
                    Comprehensive resources for your prep
                  </p>
                </div>
                <Link to="/study" className="text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group">
                  View All <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="up">
              <div
                className="flex gap-4 md:gap-6 pb-4 overflow-x-scroll scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {studyMaterials.slice(0, isMobile ? 3 : 6).map((subject, index) => (
                  <Link
                    key={subject._id || `sub-${index}`}
                    to={`/study/${subject.slug || subject._id}`}
                    className="flex-shrink-0 w-64 md:w-72 bg-white dark:bg-gray-700/60 border border-gray-100 dark:border-gray-600 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-sm hover:shadow-hover-card hover:border-purple-200 dark:hover:border-purple-500 transition-all duration-300 group"
                  >
                    <div className="flex items-center space-x-3 md:space-x-4 mb-4 md:mb-6">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl ${subject.bg || 'bg-brand-light dark:bg-brand-start/20'} flex items-center justify-center ${subject.color || 'text-brand-start dark:text-indigo-300'} group-hover:rotate-3 transition-transform duration-300 shadow-sm`}>
                        <BookOpen className="w-5 h-5 md:w-7 md:h-7" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-gray-800 dark:text-white text-sm md:text-base">{subject.title}</h3>
                        <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                          {subject.topics || 0} Topics • {subject.videos || 0} Videos
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2 md:space-y-3 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                      <li className="flex justify-between border-b border-gray-50 dark:border-gray-600 pb-2">
                        <span className="flex items-center gap-1.5">
                          <Play className="w-3 h-3 text-brand-start dark:text-indigo-300" />
                          Videos
                        </span>
                        <span className="bg-brand-50 dark:bg-indigo-900/30 px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold text-brand-start dark:text-indigo-300">
                          {subject.videos || 0}
                        </span>
                      </li>
                      <li className="flex justify-between border-b border-gray-50 dark:border-gray-600 pb-2">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3 h-3 text-brand-start dark:text-indigo-300" />
                          PDF Notes
                        </span>
                        <span className="bg-brand-50 dark:bg-indigo-900/30 px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold text-brand-start dark:text-indigo-300">
                          {subject.pdf || 0}
                        </span>
                      </li>
                    </ul>
                    <div className="mt-3 md:mt-5 pt-3 border-t border-gray-50 dark:border-gray-600">
                      <span className="text-brand-start dark:text-indigo-300 text-xs md:text-sm font-bold group-hover:underline">
                        View Details →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* ─── TESTIMONIALS (from real API) ───────────────── */}
      {!testimonialsLoading && testimonials.length > 0 && (
        <section className="py-12 md:py-24" style={{ background: 'linear-gradient(180deg, #f8faff, #fdf4ff)' }} id="reviews">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-10 md:mb-14">
                <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4">
                  💬 Testimonials
                </div>
                <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 md:mb-4">
                  Loved by <span className="text-gradient">students</span>
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {testimonials.slice(0, 3).map((review, i) => {
                const initials = (review.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                const gradients = [
                  'from-brand-start to-brand-end',
                  'from-pink-500 to-brand-end',
                  'from-emerald-400 to-brand-start',
                ]
                const gradient = gradients[i % gradients.length]
                return (
                  <ScrollReveal key={review._id || i} direction="up" delay={i * 0.12} threshold={0.1}>
                    <div className="bg-white dark:bg-gray-700/50 rounded-2xl md:rounded-3xl p-5 md:p-7 border border-gray-100 dark:border-gray-600 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 md:hover:-translate-y-2">
                      <div className="flex gap-0.5 text-amber-400 mb-3 md:mb-4">
                        {[...Array(Math.min(review.rating || 5, 5))].map((_, j) => (
                          <svg key={j} className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" viewBox="0 0 20 20">
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                        ))}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm leading-relaxed mb-4 md:mb-6">
                        "{review.text || review.message || review.content || review.review || ''}"
                      </p>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-extrabold text-white text-sm md:text-lg shadow-lg`}>
                          {initials}
                        </div>
                        <div>
                          <div className="font-extrabold text-gray-900 dark:text-white text-xs md:text-sm">{review.name || 'Student'}</div>
                          <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                            {[review.exam, review.examType, review.role, review.category].filter(Boolean).join(' • ') || 'Trstprep Student'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── FOOTER CTA (logged-out only) ──────────────── */}
      {!user && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <ScrollReveal>
            <div
              className="relative overflow-hidden rounded-2xl md:rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)',
                backgroundSize: '300% 300%',
                animation: 'gradBg 8s ease infinite',
                boxShadow: '0 30px 80px rgba(99,102,241,0.3)',
              }}
            >
              <div className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent)',
                }} />
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-start/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-end/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

              <div className="relative z-10 px-6 py-10 md:px-16 md:py-14 text-center">
                <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-3 md:mb-5">
                  Not sure where to start?
                </h2>
                <p className="text-purple-200/70 text-sm md:text-base mb-6 md:mb-8 max-w-lg mx-auto">
                  Take our free diagnostic test to evaluate your current level and get a personalised study plan.
                </p>
                <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                  <Link
                    to="/signup"
                    className="group px-8 py-3 md:px-10 md:py-4 bg-white text-brand-start font-extrabold rounded-xl md:rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 inline-flex items-center text-sm md:text-base"
                  >
                    🚀 Start Free Trial
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/test-series"
                    className="px-8 py-3 md:px-10 md:py-4 bg-white/10 text-white border border-white/25 font-semibold rounded-xl md:rounded-2xl hover:bg-white/15 transition-all duration-300 inline-flex items-center text-sm md:text-base backdrop-blur-sm"
                  >
                    View Test Series
                  </Link>
                </div>
                <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-6 md:mt-8 text-xs md:text-sm text-purple-200/60">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-green-400/20 flex items-center justify-center text-green-300 text-[8px] md:text-[10px]">✓</div>
                    Free Analysis
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-green-400/20 flex items-center justify-center text-green-300 text-[8px] md:text-[10px]">✓</div>
                    All India Rank
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-green-400/20 flex items-center justify-center text-green-300 text-[8px] md:text-[10px]">✓</div>
                    No Card Required
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* ─── FOOTER ─────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-base md:text-xl">⚡</span>
              <span className="text-white font-extrabold text-sm md:text-base">Trstprep</span>
            </div>
            <p>© {new Date().getFullYear()} Trstprep. All rights reserved.</p>
            <p className="flex items-center gap-1">
              Made with <span className="text-red-500">❤️</span> for Indian aspirants
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
