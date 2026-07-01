import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTests, getTestSeries, getQuestionsByTestId } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { toast } from 'react-hot-toast'
import { 
  Clock, AlertCircle, CheckCircle, BookOpen, Eye,
  ChevronRight, ChevronDown, ArrowRight, FileText, BarChart3, Timer, AlertTriangle, Info,
  Shield, Monitor, Award, Zap, Construction
} from 'lucide-react'
import { checkFeatureAccess } from '../../shared/utils/pass-helpers'

function TestInstructions() {
  const { seriesId, testId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [test, setTest] = useState(null)
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [agreedToRules, setAgreedToRules] = useState(false)
  const [showFullInstructions, setShowFullInstructions] = useState(false)
  const [systemCheck, setSystemCheck] = useState({
    browser: true,
    connection: true,
    javascript: true
  })
  const [actualQuestionCount, setActualQuestionCount] = useState(null)
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [noQuestions, setNoQuestions] = useState(false)
  const [showSyllabus, setShowSyllabus] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [startDateCountdown, setStartDateCountdown] = useState(null)
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('trstprep_language') || 'EN'
    } catch {
      return 'EN'
    }
  })

  // Check if user came back from test interface with no questions
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('noQuestions') === 'true') {
      setNoQuestions(true)
    }
  }, [location.search])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch test details
        const tests = await getTests()
        const currentTest = tests.find(t => 
          t._id === testId || t.id === testId || t.slug === testId
        )
        
        if (currentTest) {
          setTest(currentTest)
          
          // Fetch series details
          const allSeries = await getTestSeries()
          const currentSeries = allSeries.find(s => 
            s._id === seriesId || s.id === seriesId || s.slug === seriesId
          )
          setSeries(currentSeries)

          // Fetch actual questions to get real count
          setQuestionsLoading(true)
          const testDbId = currentTest._id || currentTest.id
          if (testDbId) {
            try {
              const questions = await getQuestionsByTestId(testDbId)
              const qCount = Array.isArray(questions) ? questions.length : 0
              setActualQuestionCount(qCount)
              if (qCount === 0) {
                setNoQuestions(true)
              }
            } catch (err) {
              setActualQuestionCount(0)
              setNoQuestions(true)
            }
          } else {
            setActualQuestionCount(0)
            setNoQuestions(true)
          }
          setQuestionsLoading(false)
        }
      } catch (error) {
        // test fetch failed silently
      } finally {
        setLoading(false)
      }
    }
    
    if (testId && seriesId) {
      fetchData()
    }
  }, [testId, seriesId])

  // Check access once test is loaded
  useEffect(() => {
    if (test && user && user.role !== 'admin') {
      const isLive = test.tags?.includes('Live') || test.type === 'live' || test.isLive
      const isFree = test.type === 'Free' || !test.isPro
      
      const featureKey = isLive ? 'live_tests' : 
                        test.type === 'Chapter' ? 'chapter_tests' : 
                        test.type === 'PYQ' ? 'pyq_papers' : 'mock_tests';
                        
      const access = checkFeatureAccess(featureKey, user.passType || 'free')
      
      if (!isFree && !access) {
        navigate('/pass')
      }
    }
  }, [test, user, navigate])

  // System check
  useEffect(() => {
    const checkSystem = () => {
      setSystemCheck({
        browser: !(/MSIE|Trident/.test(window.navigator.userAgent)),
        connection: navigator.onLine,
        javascript: true
      })
    }
    checkSystem()
    window.addEventListener('online', () => setSystemCheck(prev => ({ ...prev, connection: true })))
    window.addEventListener('offline', () => setSystemCheck(prev => ({ ...prev, connection: false })))
    return () => {
      window.removeEventListener('online', () => {})
      window.removeEventListener('offline', () => {})
    }
  }, [])

  const handleStartTest = () => {
    if (agreedToRules && !noQuestions) {
      setCountdown(3)
    } else if (!noQuestions) {
      toast.error('Please agree to the rules first')
    }
  }

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      toast.success('Test starting... get ready!')
      navigate(`/test/${seriesId}/${testId}`)
      return
    }
    const id = setInterval(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [countdown, navigate, seriesId, testId])

  const cancelCountdown = useCallback(() => {
    setCountdown(null)
  }, [])

  useEffect(() => {
    if (!test?.startDate) {
      setStartDateCountdown(null)
      return
    }
    const startTime = new Date(test.startDate).getTime()
    if (isNaN(startTime)) {
      setStartDateCountdown(null)
      return
    }
    const updateCountdown = () => {
      const now = Date.now()
      const diff = startTime - now
      if (diff <= 0) {
        setStartDateCountdown({ hours: 0, minutes: 0, seconds: 0, expired: true })
        return
      }
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setStartDateCountdown({ hours, minutes, seconds, expired: false })
    }
    updateCountdown()
    const id = setInterval(updateCountdown, 1000)
    return () => clearInterval(id)
  }, [test?.startDate])

  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    try {
      localStorage.setItem('trstprep_language', lang)
    } catch (err) {
      // language save failed silently
    }
  }

  const testType = useMemo(() => {
    if (!test) return 'Mock Test'
    const tags = Array.isArray(test.tags) ? test.tags.map((t) => String(t).toLowerCase()) : []
    if (test.isLive) return 'Live Test'
    if (tags.includes('quiz')) return 'Quiz'
    if (tags.includes('pyq') || tags.includes('pyp')) return 'Previous Year Paper'
    if (test.isPractice) return 'Practice'
    return 'Mock Test'
  }, [test])

  const testTypeStyles = {
    'Live Test': 'bg-red-100 text-red-700',
    Quiz: 'bg-purple-100 text-purple-700',
    'Previous Year Paper': 'bg-blue-100 text-blue-700',
    Practice: 'bg-green-100 text-green-700',
    'Mock Test': 'bg-tcs-primary/10 text-tcs-primary',
  }

  const handleGoBack = useCallback(() => {
    navigate(`/test-series/${seriesId}`)
  }, [navigate, seriesId])

  const generalInstructions = [
    {
      icon: Clock,
      title: 'Time Limit',
      description: `${test?.duration || 60} minutes`,
      detail: 'The timer will start as soon as you begin. Ensure you manage your time effectively across all sections.'
    },
    {
      icon: BookOpen,
      title: 'Questions',
      description: `${questionsLoading ? '...' : (actualQuestionCount !== null ? actualQuestionCount : (test?.totalQuestions || 100))} questions`,
      detail: 'Each question carries equal marks. Read each question carefully before selecting your answer.'
    },
    {
      icon: BarChart3,
      title: 'Marking Scheme',
      description: `+${(test?.marksPerQuestion || (test?.totalMarks && test?.totalQuestions ? (test.totalMarks / test.totalQuestions) : 2))} correct, -${(test?.negativeMarking ?? 0.25)} incorrect`,
      detail: 'Negative marking applies for wrong answers. No marks deducted for unattempted questions.'
    },
    {
      icon: Eye,
      title: 'Navigation',
      description: 'Freedom to navigate',
      detail: 'Move between questions using the sidebar or next/previous buttons. Flag questions for review.'
    },
    {
      icon: Timer,
      title: 'Auto Submit',
      description: 'Automatic submission',
      detail: 'The test will be automatically submitted when time expires. Save your answers regularly.'
    },
    {
      icon: Shield,
      title: 'Security',
      description: 'Proctored environment',
      detail: 'Tab switching is monitored. Multiple violations may result in test cancellation.'
    }
  ]

  const rules = [
    'This is a timed test. Once started, the timer cannot be paused.',
    'You can attempt the test only once unless reattempt is allowed.',
    'Switching tabs or applications during the test is monitored.',
    'Ensure you have a stable internet connection before starting.',
    'Use of calculators, mobile phones, or any external help is prohibited.',
    'Your results will be available immediately after submission.',
    'Do not refresh or close the browser window during the test.',
    'Contact support immediately if you face any technical issues.'
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tcs-surface">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 border-4 border-tcs-primary/20 border-tcs-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-tcs-text-secondary font-medium">Loading test instructions...</p>
        </div>
      </div>
    )
  }

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tcs-surface">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-tcs-error/10 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-tcs-error" />
          </div>
          <h2 className="text-2xl font-bold text-tcs-text-primary mb-2">Test Not Found</h2>
          <p className="text-tcs-text-secondary mb-6">The test you're looking for doesn't exist or has been removed.</p>
          <Link 
            to="/test-series"
            className="inline-flex items-center gap-2 px-6 py-3 bg-tcs-primary text-white font-semibold rounded-lg hover:bg-tcs-primary-dark transition-colors"
          >
            Browse Test Series
          </Link>
        </div>
      </div>
    )
  }

  const isAllSystemsReady = Object.values(systemCheck).every(Boolean)
  const isQuestionsReady = !noQuestions && actualQuestionCount > 0
  const displayQuestionCount = questionsLoading ? '...' : (actualQuestionCount !== null ? actualQuestionCount : test.totalQuestions)

  return (
    <div className="min-h-screen bg-tcs-surface">
      {/* TCS Style Header Bar */}
      <header className="bg-white border-b border-tcs-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left: Breadcrumbs */}
            <div className="flex-1 min-w-0">
              <Breadcrumb 
                items={[
                  { label: 'Test Series', path: '/test-series' },
                  { label: series?.title || 'Series', path: `/test-series/${seriesId}` },
                  { label: 'Instructions' }
                ]}
              />
            </div>
            
            {/* Right: Test Status */}
            <div className="flex items-center gap-3 ml-4">
              {noQuestions ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-tcs-warning/10 text-tcs-warning text-xs font-medium rounded-full">
                  <Construction className="w-3 h-3" />
                  Questions Being Updated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-tcs-success/10 text-tcs-success text-xs font-medium rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-tcs-success animate-pulse"></span>
                  Ready
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Window */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-tcs border border-tcs-border overflow-hidden">
          {/* Window Title Bar - TCS Style */}
          <div className="bg-gradient-to-r from-tcs-primary to-tcs-primary-dark px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-white">{test.title}</h1>
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${testTypeStyles[testType] || testTypeStyles['Mock Test']}`}>
                    {testType}
                  </span>
                </div>
                <p className="text-tcs-text-secondary text-sm opacity-90">{series?.title || 'Test Series'}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="bg-tcs-surface border-b border-tcs-border px-5 py-3">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-tcs-primary" />
                <span className="text-tcs-text-secondary">Duration:</span>
                <span className="font-semibold text-tcs-text-primary">{test.duration} min</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-tcs-primary" />
                <span className="text-tcs-text-secondary">Questions:</span>
                <span className="font-semibold text-tcs-text-primary">
                  {questionsLoading ? (
                    <span className="inline-block w-6 h-4 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    displayQuestionCount
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-tcs-primary" />
                <span className="text-tcs-text-secondary">Marks:</span>
                <span className="font-semibold text-tcs-text-primary">{test.totalMarks || test.totalQuestions}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-tcs-primary" />
                <span className="text-tcs-text-secondary">Difficulty:</span>
                <span className="font-semibold text-tcs-text-primary">{test.difficulty ? test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1) : 'Medium'}</span>
              </div>
              {test.isPro && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                  PRO
                </span>
              )}
              {startDateCountdown && !startDateCountdown.expired && (
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="w-4 h-4 text-red-500 animate-pulse" />
                  <span className="text-tcs-text-secondary">Starts in:</span>
                  <span className="font-mono font-bold text-tcs-text-primary">
                    {String(startDateCountdown.hours).padStart(2, '0')}:{String(startDateCountdown.minutes).padStart(2, '0')}:{String(startDateCountdown.seconds).padStart(2, '0')}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-tcs-text-secondary text-sm">Language:</span>
                {Array.isArray(test.languages) && test.languages.length > 1 ? (
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="px-2 py-1 text-xs font-semibold rounded-lg border border-tcs-border bg-white text-tcs-text-primary focus:outline-none focus:ring-2 focus:ring-tcs-primary"
                  >
                    {test.languages.map((lang) => (
                      <option key={typeof lang === 'string' ? lang : lang.code || lang.value} value={typeof lang === 'string' ? lang : lang.code || lang.value}>
                        {typeof lang === 'string' ? lang : lang.label || lang.name || lang.code || lang.value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="inline-flex rounded-lg border border-tcs-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleLanguageChange('EN')}
                      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                        language === 'EN' || language === 'en'
                          ? 'bg-tcs-primary text-white'
                          : 'bg-white text-tcs-text-secondary hover:bg-tcs-surface'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLanguageChange('HI')}
                      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                        language === 'HI' || language === 'hi'
                          ? 'bg-tcs-primary text-white'
                          : 'bg-white text-tcs-text-secondary hover:bg-tcs-surface'
                      }`}
                    >
                      HI
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section Breakdown */}
          {Array.isArray(test.sections) && test.sections.length > 0 && (
            <div className="bg-white border-b border-tcs-border px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-tcs-primary" />
                <h2 className="text-sm font-semibold text-tcs-text-primary">Section Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tcs-border">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-tcs-text-secondary uppercase tracking-wider">Section Name</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-tcs-text-secondary uppercase tracking-wider">Questions</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-tcs-text-secondary uppercase tracking-wider">Marks</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-tcs-text-secondary uppercase tracking-wider">Time Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {test.sections.map((section, index) => (
                      <tr key={index} className="border-b border-tcs-border last:border-b-0 hover:bg-tcs-surface/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-tcs-text-primary">
                          {section.name || `Section ${index + 1}`}
                        </td>
                        <td className="py-2.5 px-3 text-center text-tcs-text-secondary">
                          {section.questionCount ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-center text-tcs-text-secondary">
                          {section.totalMarks ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-center text-tcs-text-secondary">
                          {section.timeLimit != null ? `${section.timeLimit} min` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Questions Not Available Warning Banner */}
          {noQuestions && (
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <Construction className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-800 text-sm">Questions Are Being Updated</h3>
                  <p className="text-amber-700 text-sm mt-1">
                    This test doesn't have any questions yet. Our team is currently preparing the questions for this test. 
                    Please check back later or try another test from this series.
                  </p>
                  <button 
                    onClick={handleGoBack}
                    className="mt-2 inline-flex items-center gap-1 text-amber-700 font-medium text-sm hover:underline"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back to Test Series
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 p-5 border-r border-tcs-border">
              {/* Instructions Section */}
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-tcs-primary" />
                  <h2 className="text-base font-semibold text-tcs-text-primary">Test Instructions</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generalInstructions.map((instruction, index) => (
                    <div 
                      key={index}
                      className="p-3 rounded-lg bg-tcs-surface border border-tcs-border hover:border-tcs-primary/30 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-tcs-border flex items-center justify-center group-hover:border-tcs-primary transition-colors">
                          <instruction.icon className="w-4 h-4 text-tcs-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-tcs-text-primary text-sm mb-0.5">
                            {instruction.title}
                          </h3>
                          <p className="text-xs text-tcs-text-secondary">
                            {instruction.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detailed Instructions Toggle */}
                <button
                  onClick={() => setShowFullInstructions(!showFullInstructions)}
                  className="mt-4 flex items-center gap-1 text-tcs-primary text-sm font-medium hover:underline"
                >
                  {showFullInstructions ? 'Hide' : 'View'} Detailed Instructions
                  <ChevronRight className={`w-4 h-4 transition-transform ${showFullInstructions ? 'rotate-90' : ''}`} />
                </button>

                {showFullInstructions && (
                  <div className="mt-3 p-4 rounded-lg bg-tcs-info/10 border border-tcs-info/20">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-tcs-text-secondary">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-tcs-success mt-0.5 flex-shrink-0" />
                        Read each question carefully before answering
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-tcs-success mt-0.5 flex-shrink-0" />
                        You can change your answer before submission
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-tcs-success mt-0.5 flex-shrink-0" />
                        Use question palette for quick navigation
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-tcs-success mt-0.5 flex-shrink-0" />
                        Mark questions for review if unsure
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-tcs-success mt-0.5 flex-shrink-0" />
                        On-screen calculator available for calculations
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-tcs-success mt-0.5 flex-shrink-0" />
                        Section-wise timing may be displayed
                      </li>
                    </ul>
                  </div>
                )}
              </section>

              {/* Rules Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-tcs-warning" />
                  <h2 className="text-base font-semibold text-tcs-text-primary">Important Rules & Guidelines</h2>
                </div>
                
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-4">
                  <ul className="space-y-2">
                    {rules.map((rule, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-sm text-tcs-text-secondary">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center mt-0.5">
                          {index + 1}
                        </span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 p-5">
              {/* System Check */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-4 h-4 text-tcs-text-secondary" />
                  <h3 className="text-sm font-semibold text-tcs-text-primary">System Check</h3>
                </div>
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    systemCheck.browser 
                      ? 'bg-tcs-success/5 border-tcs-success/20' 
                      : 'bg-tcs-error/5 border-tcs-error/20'
                  }`}>
                    <span className="text-xs text-tcs-text-secondary">Browser Compatibility</span>
                    {systemCheck.browser ? (
                      <CheckCircle className="w-4 h-4 text-tcs-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-tcs-error" />
                    )}
                  </div>
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    systemCheck.connection 
                      ? 'bg-tcs-success/5 border-tcs-success/20' 
                      : 'bg-tcs-error/5 border-tcs-error/20'
                  }`}>
                    <span className="text-xs text-tcs-text-secondary">Internet Connection</span>
                    {systemCheck.connection ? (
                      <CheckCircle className="w-4 h-4 text-tcs-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-tcs-error" />
                    )}
                  </div>
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    systemCheck.javascript 
                      ? 'bg-tcs-success/5 border-tcs-success/20' 
                      : 'bg-tcs-error/5 border-tcs-error/20'
                  }`}>
                    <span className="text-xs text-tcs-text-secondary">JavaScript Enabled</span>
                    {systemCheck.javascript ? (
                      <CheckCircle className="w-4 h-4 text-tcs-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-tcs-error" />
                    )}
                  </div>
                </div>
              </div>

              {noQuestions ? (
                /* Questions Not Available - Disable Start Button */
                <>
                  <div className="mb-4 p-4 rounded-lg bg-tcs-warning/5 border border-tcs-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Construction className="w-5 h-5 text-tcs-warning" />
                      <span className="text-sm font-semibold text-tcs-warning">Coming Soon</span>
                    </div>
                    <p className="text-xs text-tcs-text-secondary">
                      Questions for this test are being prepared. It will be available shortly.
                    </p>
                  </div>

                  <button
                    disabled
                    className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 bg-gray-200 text-gray-400 cursor-not-allowed"
                  >
                    Coming Soon
                    <Construction className="w-4 h-4" />
                  </button>
                </>
              ) : (
                /* Normal Start Flow */
                <>
                  {/* Agreement */}
                  <div className="mb-5">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-tcs-border bg-tcs-surface cursor-pointer hover:border-tcs-primary/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={agreedToRules}
                        onChange={(e) => setAgreedToRules(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-tcs-primary rounded border-tcs-border focus:ring-tcs-primary"
                      />
                      <span className="text-sm text-tcs-text-secondary">
                        I have read and agree to all the instructions, rules, and guidelines mentioned above.
                      </span>
                    </label>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={handleStartTest}
                    disabled={!agreedToRules || !isAllSystemsReady}
                    className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      agreedToRules && isAllSystemsReady
                        ? 'bg-tcs-primary text-white hover:bg-tcs-primary-dark shadow-tcs hover:shadow-tcs-lg'
                        : 'bg-tcs-border text-tcs-text-muted cursor-not-allowed'
                    }`}
                  >
                    {user?.attemptedTestIds?.includes(String(test.id || test._id)) ? 'Reattempt Test' : 'Start Test'}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {!agreedToRules && (
                    <p className="text-xs text-center text-tcs-warning mt-2 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Please agree to the rules to continue
                    </p>
                  )}
                </>
              )}

              {/* Info Card */}
              <div className="mt-4 p-3 rounded-lg bg-tcs-info/5 border border-tcs-info/20">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-tcs-info mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-tcs-text-secondary">
                    Once you click "Start Test", the timer will begin immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-tcs-text-muted">
            Need help? <Link to="/contact" className="text-tcs-primary hover:underline">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default TestInstructions