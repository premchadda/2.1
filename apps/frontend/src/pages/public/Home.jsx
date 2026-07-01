import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTestSeries, getStudyMaterials, getTests, examAPI, testsAPI } from '../../shared/lib/dataService'
import { TestSeriesCard, AnimatedHero } from '../../shared/components'
import { useTestCategories } from '../../shared/hooks/useTestCategories'
import { 
  Search, ArrowRight, Radio, HelpCircle, BookOpen, Target, 
  BarChart2, Video, ClipboardCheck, Library, Star, Users,
  Crown, ChevronRight, Play, Clock, Zap
} from 'lucide-react'

function Home() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { getCategoryEmoji } = useTestCategories()
  const [testSeries, setTestSeries] = useState([])
  const [tests, setTests] = useState([])
  const [studyMaterials, setStudyMaterials] = useState([])
  const [featuredExams, setFeaturedExams] = useState([])
  const [examCategories, setExamCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [liveTests, setLiveTests] = useState([])
  const [freeQuizzes, setFreeQuizzes] = useState([])
  const [liveTestsLoading, setLiveTestsLoading] = useState(true)
  const [platformStats, setPlatformStats] = useState({ activeLearners: 0, mockTests: 0, examsCovered: 0, satisfaction: null })

  // Fetch data from API — skip for authenticated users (they get redirected to /dashboard)
  useEffect(() => {
    if (isAuthenticated) return
    const fetchData = async () => {
      try {
        const [series, allTests, materials, examsResponse, categoriesResponse, statsResponse] = await Promise.all([
          getTestSeries(),
          getTests(),
          getStudyMaterials(),
          examAPI.getExams(),
          examAPI.getCategories(),
          examAPI.getPublicStats()
        ])
        setTestSeries(series)
        setTests(allTests)
        setStudyMaterials(materials)
        // Get first 4 active exams as featured
        const exams = examsResponse.data?.data || []
        setFeaturedExams(exams.filter(exam => exam.isActive).slice(0, 4))
        // Get exam categories
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
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isAuthenticated])

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, isAuthenticated])

  // Fetch live tests and free quizzes — skip for authenticated users (redirected to /dashboard)
  useEffect(() => {
    if (isAuthenticated) return
    const fetchLiveTests = async () => {
      try {
        setLiveTestsLoading(true)
        const liveTestsResponse = await testsAPI.getByTag('live-tests')
        const liveTestsData = liveTestsResponse.data?.data || liveTestsResponse.data || []
        
        const freeQuizzesResponse = await testsAPI.getByTag('quizzes')
        const freeQuizzesData = freeQuizzesResponse.data?.data || freeQuizzesResponse.data || []
        
        setLiveTests(liveTestsData.slice(0, 3))
        setFreeQuizzes(freeQuizzesData.slice(0, 3))
      } catch (error) {
        console.error('Failed to fetch live tests:', error)
      } finally {
        setLiveTestsLoading(false)
      }
    }
    fetchLiveTests()
  }, [isAuthenticated])

  // Create category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = {}
    examCategories.forEach(cat => {
      map[cat.id] = cat.label || cat.name
    })
    return map
  }, [examCategories])

  // Get enrolled series for logged-in users
  const enrolledSeries = useMemo(() => {
    if (!user) return []
    return testSeries.filter(s => user.enrolledSeries?.includes(s._id || s.id))
  }, [user, testSeries])

  // Get new/recent series for recommendations (logged-in users)
  const newSeriesForYou = useMemo(() => {
    if (!user) return []
    // Filter out enrolled series and return newest ones
    return testSeries
      .filter(s => !user.enrolledSeries?.includes(s._id || s.id))
      .slice(0, 4)
  }, [user, testSeries])

  // Get popular series (sorted by admin order, respecting pinning)
  const popularSeries = useMemo(() => {
    return [...testSeries].sort((a, b) => {
      // Pinned items always first
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      // For all items (pinned and non-pinned), sort by admin order first
      const orderDiff = (a.order || 0) - (b.order || 0);
      if (orderDiff !== 0) return orderDiff;
      // If same order, sort by popularity as secondary
      return (b.users || 0) - (a.users || 0);
    }).slice(0, 8)
  }, [testSeries])

  // Group series by category for browse section
  const seriesByCategory = useMemo(() => {
    const grouped = {}
    testSeries.forEach(series => {
      if (!grouped[series.category]) {
        grouped[series.category] = []
      }
      grouped[series.category].push(series)
    })
    return grouped
  }, [testSeries])

  // Quick Access Items
  const quickAccessItems = [
    { icon: Radio, color: 'text-red-500', bg: 'bg-red-50', title: 'Live Tests', desc: 'Real-time', route: '/live-tests' },
    { icon: HelpCircle, color: 'text-blue-500', bg: 'bg-blue-50', title: 'Quizzes', desc: 'Practice', route: '/quizzes' },
    { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-50', title: 'PYQ', desc: 'Past Papers', route: '/pyps' },
    { icon: Target, color: 'text-purple-500', bg: 'bg-purple-50', title: 'Practice', desc: 'Skills', route: '/practice' },
    { icon: BarChart2, color: 'text-orange-500', bg: 'bg-orange-50', title: 'Analysis', desc: 'Reports', route: '/analysis' },
    { icon: Video, color: 'text-pink-500', bg: 'bg-pink-50', title: 'Videos', desc: 'Lectures', route: '/videos' },
    { icon: ClipboardCheck, color: 'text-sky-500', bg: 'bg-sky-50', title: 'Attempted', desc: 'History', route: '/attempted-tests' },
    { icon: Library, color: 'text-teal-500', bg: 'bg-teal-50', title: 'Materials', desc: 'Study', route: '/study' },
  ]

  // Helper function to get exam icon based on category
  const getExamIcon = (categoryId) => {
    const icons = {
      'ssc': '📝',
      'railways': '🚂',
      'banking': '💰',
      'upsc': '🏛️',
      'defence': '🎖️',
      'teaching': '🎓',
      'default': '📋'
    }
    return icons[categoryId] || icons.default
  }

  return (
    <div className="page-transition fade-in">
      {/* Hero Section with Animated Background */}
      <AnimatedHero pageType="home">
        {user ? (
          // Logged-in user hero
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold text-white shadow-lg animate-scale-in">
                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="text-white">
                <h1 className="text-3xl md:text-3xl font-bold animate-slide-in-right">Welcome back, {user.name?.split(' ')[0]}! 👋</h1>
                <p className="text-purple-100 text-sm md:text-base mt-1 animate-slide-in-right" style={{ animationDelay: '0.1s' }}>Continue your preparation journey</p>
              </div>
            </div>
            {user.hasProPass && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-400/20 backdrop-blur-sm rounded-full text-amber-100 border border-amber-400/30 animate-shimmer">
                <Crown className="w-4 h-4" />
                <span className="text-sm font-bold">PRO Member</span>
              </div>
            )}
          </div>
        ) : (
          // Non-logged-in hero with typewriter effect
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 animate-slide-up">
              Crack Your <span className="text-yellow-300 animate-pulse">Dream Exam</span> 🎯
            </h1>
            <p className="text-purple-100 text-lg md:text-xl mb-4 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
              India's #1 Test Series Platform for SSC, Railways & Banking
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Link 
                to="/signup" 
                className="px-3 py-1 bg-white text-brand-start font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 btn-animated group"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2 inline group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                to="/test-series" 
                className="px-3 py-1 bg-white/10 text-white border border-white/30 font-semibold rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                Explore Tests
              </Link>
            </div>
          </div>
        )}
      </AnimatedHero>

      {/* Quick Access */}
      <section className="max-w-7xl mb-6 mx-auto px-4 sm:px-6 lg:px-8 -mt-9 relative z-20">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-4 md:p-6 animate-slide-in-up">
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Quick Access</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {quickAccessItems.map((item, index) => (
              <Link 
                key={item.title} 
                to={item.route}
                className="bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 p-2 md:p-3 text-center cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 mx-auto ${item.bg} dark:bg-opacity-20 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className={`${item.color} w-4 h-4 md:w-5 md:h-5`} />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-[10px] md:text-xs truncate">{item.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-[8px] md:text-[10px] hidden md:block">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Exams - Auto Scrolling Marquee */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-6 animate-slide-in-right">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Featured Exams</h2>
          </div>
          <Link to="/exams" className="text-brand-start dark:text-indigo-400 font-semibold hover:underline flex items-center text-sm">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-[280px] h-32 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse flex-shrink-0" />
            ))}
          </div>
        ) : featuredExams.length > 0 ? (
          <div className="relative overflow-hidden">
            <div className="flex gap-4 animate-marquee-left">
              {/* Double the items for seamless loop */}
              {[...featuredExams, ...featuredExams].map((exam, index) => (
                <Link 
                  key={`${exam._id || exam.id}-${index}`}
                  to={`/exam/${exam.examId || exam.id}`}
                  className="w-[280px] flex-shrink-0 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-hover-card hover:border-brand-start dark:hover:border-indigo-500 transition-all cursor-pointer group"
                >
                  <div className="text-3xl mb-3">{getExamIcon(exam.categoryId)}</div>
                  <div className="mb-2">
                    <span className="text-xs font-semibold text-brand-start dark:text-indigo-400 uppercase tracking-wide">
                      {categoryMap[exam.categoryId] || exam.categoryId}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors truncate">{exam.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 line-clamp-1">{exam.fullName}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-gray-500 dark:text-gray-400">No featured exams available</p>
          </div>
        )}

        <style>{`
          @keyframes marquee-left {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          .animate-marquee-left {
            animation: marquee-left 30s linear infinite;
          }
          .animate-marquee-left:hover {
            animation-play-state: paused;
          }
        `}</style>
      </section>
      
      {/* Platform Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full translate-y-1/2 -translate-x-1/2 group-hover:scale-125 transition-transform duration-700" />
          
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-indigo-300" />
                <span className="text-3xl md:text-4xl font-extrabold text-white">{platformStats.activeLearners}</span>
              </div>
              <p className="text-indigo-200 text-sm font-medium">Active Learners</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="w-5 h-5 text-purple-300" />
                <span className="text-3xl md:text-4xl font-extrabold text-white">{platformStats.mockTests}</span>
              </div>
              <p className="text-purple-200 text-sm font-medium">Mock Tests</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-indigo-300" />
                <span className="text-3xl md:text-4xl font-extrabold text-white">{platformStats.examsCovered}</span>
              </div>
              <p className="text-indigo-200 text-sm font-medium">Exams Covered</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <span className="text-3xl md:text-4xl font-extrabold text-white">{platformStats.satisfaction}%</span>
              </div>
              <p className="text-purple-200 text-sm font-medium">Student Satisfaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Tests & Free Quizzes - Show for ALL users */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-2xl">🔴</span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Live Tests & Quizzes</h2>
          </div>
          <Link to="/live-tests" className="text-brand-start dark:text-indigo-400 font-semibold hover:underline flex items-center text-sm">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Live Tests Column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Live Tests</h3>
              <span className="text-xs text-gray-400">({liveTests.length})</span>
            </div>
            <div className="space-y-3">
              {liveTestsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse p-4 rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800">
                      <div className="h-4 bg-red-200 dark:bg-red-800 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-red-100 dark:bg-red-900 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : liveTests.length > 0 ? liveTests.map(test => (
                <Link 
                  key={test.id}
                  to={user ? `/test/${test.series?.slug || test.series?._id || test.series?.id || 'series'}/${test.id}` : '/login'}
                  className="block p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white bg-red-500">
                      🔴 LIVE
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {(test.participants || 0) > 1000 ? ((test.participants || 0) / 1000).toFixed(1) + 'k' : test.participants || 0}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{test.title}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {test.duration || test.timeLimit || 60} mins</span>
                  </div>
                  <button className="w-full py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition">
                    {user ? 'Start Now' : 'Login to Start'}
                  </button>
                </Link>
              )) : (
                <div className="text-center py-8 bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-dashed border-red-200 dark:border-red-800">
                  <Radio className="w-10 h-10 text-red-300 dark:text-red-700 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No Live Tests Right Now</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">New live tests are scheduled regularly.</p>
                </div>
              )}
            </div>
          </div>

          {/* Free Quizzes Column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Free Quizzes</h3>
              <span className="text-xs text-gray-400">({freeQuizzes.length})</span>
            </div>
            <div className="space-y-3">
              {liveTestsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800">
                      <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-blue-100 dark:bg-blue-900 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : freeQuizzes.length > 0 ? freeQuizzes.map(quiz => (
                <Link 
                  key={quiz.id}
                  to={user ? `/test/${quiz.series?.slug || quiz.series?._id || quiz.series?.id || 'series'}/${quiz.id}` : '/login'}
                  className="block p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white bg-blue-500">
                      ⚡ QUIZ
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {(quiz.participants || 0) > 1000 ? ((quiz.participants || 0) / 1000).toFixed(1) + 'k' : quiz.participants || 0}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{quiz.title}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {quiz.duration || quiz.timeLimit || 15} mins</span>
                    <span>• {quiz.totalQuestions || quiz.totalQuestions || 10} Qs</span>
                  </div>
                  <button className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition">
                    {user ? 'Start Now' : 'Login to Start'}
                  </button>
                </Link>
              )) : (
                <div className="text-center py-8 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-dashed border-blue-200 dark:border-blue-800">
                  <HelpCircle className="w-10 h-10 text-blue-300 dark:text-blue-700 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No Quizzes Available</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Check back soon for new quizzes!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Popular Test Series - FOR ALL USERS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Popular Test Series</h2>
          </div>
          <Link to="/test-series" className="text-brand-start dark:text-indigo-400 font-semibold hover:underline flex items-center text-sm">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-6 pb-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-64 h-72 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse flex-shrink-0" />
            ))}
          </div>
        ) : (
          <div 
            className="flex gap-6 pb-4 overflow-x-scroll scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {popularSeries.map((series, index) => (
              <TestSeriesCard 
                key={series._id || `series-${index}`} 
                series={series} 
                user={user}
                onEnroll={(series) => {
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Study Materials */}
      <section className="bg-white dark:bg-gray-800 py-12 border-t border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">Popular Study Materials</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Comprehensive resources to boost your preparation</p>
            </div>
            <Link to="/study" className="text-brand-start dark:text-indigo-400 font-semibold hover:underline flex items-center text-sm">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          {loading ? (
            <div className="flex gap-6 pb-4">
              {[1,2,3].map(i => (
                <div key={i} className="w-72 h-64 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : (
          <div 
            className="flex gap-6 pb-4 overflow-x-scroll scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {studyMaterials.map((subject, index) => (
              <Link 
                key={subject._id || `subject-${index}`}
                  to={`/study/${subject.slug || subject._id}`}
                  className="flex-shrink-0 w-72 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl p-6 shadow-sm hover:shadow-hover-card hover:border-purple-200 dark:hover:border-purple-500 transition-all group"
                >
                  <div className="flex items-center space-x-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl ${subject.bg || 'bg-blue-50'} dark:bg-opacity-20 flex items-center justify-center ${subject.color || 'text-blue-600'} font-bold text-xl group-hover:rotate-3 transition-transform`}>
                      <BookOpen className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white text-lg">{subject.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{subject.topics || 0} Topics • {subject.videos || 0} Videos</p>
                    </div>
                  </div>
                  <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex justify-between border-b border-gray-50 dark:border-gray-600 pb-2">
                      <span><Play className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />Videos</span>
                      <span className="bg-gray-100 dark:bg-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300">{subject.videos || 0}</span>
                    </li>
                    <li className="flex justify-between border-b border-gray-50 dark:border-gray-600 pb-2">
                      <span><BookOpen className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />PDF</span>
                      <span className="bg-gray-100 dark:bg-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300">{subject.pdf || 0}</span>
                    </li>
                  </ul>
                  <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-600">
                    <span className="text-brand-start dark:text-indigo-400 text-sm font-bold group-hover:underline">View Details →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer CTA - Only show when user is not logged in */}
      {!user && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl">
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-brand-start rounded-full opacity-20 blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-brand-end rounded-full opacity-20 blur-3xl" />
            
            <div className="relative z-10 px-8 py-12 md:px-16 md:flex md:items-center md:justify-between">
              <div className="md:w-2/3 mb-8 md:mb-0">
                <h2 className="text-2xl md:text-3xl font-bold mb-4">Not sure where to start?</h2>
                <p className="text-gray-300 text-lg mb-6">Take our free diagnostic test to evaluate your current preparation level.</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                  <div className="flex items-center">
                    <span className="w-4 h-4 rounded-full bg-green-400 mr-2" /> Free Analysis
                  </div>
                  <div className="flex items-center">
                    <span className="w-4 h-4 rounded-full bg-green-400 mr-2" /> All India Rank
                  </div>
                </div>
              </div>
              <div>
                <Link 
                  to="/test-series"
                  className="group px-8 py-4 bg-white text-gray-900 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 inline-flex items-center"
                >
                  Take Free Mock
                  <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Trstprep. All rights reserved.</p>
            <p className="flex items-center mt-2 md:mt-0">Made with ❤️ for aspirants</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home