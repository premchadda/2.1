import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTests, getTestSeries, getTestById, getTestsBySeriesId } from '../../shared/lib/dataService';
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { toast } from 'react-hot-toast'
import {
  Clock,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Eye,
  ChevronDown,
  ArrowRight,
  FileText,
  BarChart3,
  Timer,
  Shield,
  Monitor,
  Award,
  Zap,
  Construction,
  Globe,
  Crown,
} from 'lucide-react';
import { checkFeatureAccess } from '../../shared/utils/pass-helpers'
import { checkIsLive } from '../../shared/utils/testClassification'
import { getTestEntitlement } from '../../shared/utils/entitlement'

function TestInstructions() {
  const routeParams = useParams()
  const testId = routeParams.testId
  const seriesId = routeParams.seriesSlug || routeParams.seriesId
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [test, setTest] = useState(null)
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [agreedToRules, setAgreedToRules] = useState(false)
  const [_showFullInstructions, _setShowFullInstructions] = useState(false)
  const [systemCheck, setSystemCheck] = useState({
    browser: true,
    connection: true,
    javascript: true
  })

  const [language, setLanguage] = useState(() => localStorage.getItem('test_language') || 'EN')
  const [showRules, setShowRules] = useState(false)
  const [actualQuestionCount, setActualQuestionCount] = useState(0)
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [noQuestions, setNoQuestions] = useState(false)

  const isHindi = language === 'HI' || language === 'hi'

  const getSectionNameInLanguage = (name) => {
    if (!isHindi || !name) return name;
    let n = name;
    n = n.replace(/General Intelligence & Reasoning|General Intelligence|Reasoning/gi, 'सामान्य बुद्धिमत्ता और तर्कशक्ति');
    n = n.replace(/General Awareness|General Knowledge|GK/gi, 'सामान्य जागरूकता');
    n = n.replace(/Quantitative Aptitude|Mathematics|Quant/gi, 'मात्रात्मक योग्यता');
    n = n.replace(/English Comprehension|English Language|English/gi, 'अंग्रेजी समझ');
    return n;
  };

  const getTranslatedTestType = (type) => {
    if (!isHindi) return type;
    const lower = (type || '').toLowerCase();
    if (lower.includes('full')) return 'पूर्ण मॉक परीक्षा';
    if (lower.includes('chapter')) return 'अध्याय परीक्षा';
    if (lower.includes('sectional')) return 'अनुभागीय परीक्षा';
    if (lower.includes('subject')) return 'विषय परीक्षा';
    if (lower.includes('previous')) return 'गत वर्ष प्रश्नपत्र';
    return type || 'मॉक टेस्ट';
  };

  const [_showSyllabus, _setShowSyllabus] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [_startDateCountdown, setStartDateCountdown] = useState(null)

  // Compute attempt number from URL query parameter or test data
  const attemptNo = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const urlAttemptNo = params.get('attemptNo')
    if (urlAttemptNo && !isNaN(Number(urlAttemptNo))) {
      return Number(urlAttemptNo)
    }
    if (test?.userAttemptCount !== undefined && test?.userAttemptCount !== null) {
      return Number(test.userAttemptCount) + 1
    }
    return 1
  }, [location.search, test])

  const displayQuestionCount = questionsLoading ? '...' : (actualQuestionCount !== null ? actualQuestionCount : test?.totalQuestions)

  const hasSectionalTiming = Boolean(test?.hasSectionalTiming || test?.has_sectional_timing || test?.sectionalTiming || test?.enableSectionalTiming)

  const effectiveSections = useMemo(() => {
    if (Array.isArray(test?.sections) && test.sections.length > 0) {
      return test.sections.map(s => {
        const qCount = s.questionCount ?? s.question_count ?? Math.round((test.totalQuestions || 100) / test.sections.length)
        const tMarks = s.totalMarks ?? s.total_marks ?? (qCount ? qCount * (test.marksPerQuestion || 2) : Math.round((test.totalMarks || 200) / test.sections.length))
        const tLimit = (hasSectionalTiming || s.timeLimit !== null || s.time_limit !== null)
          ? (s.timeLimit ?? s.time_limit ?? Math.round((test.duration || 60) / test.sections.length))
          : null
        return {
          name: s.name || s.section_name || 'General Section',
          questionCount: qCount,
          totalMarks: tMarks,
          timeLimit: tLimit
        }
      })
    }

    const sectionNames = Array.isArray(test?.testSections) 
      ? test.testSections 
      : (typeof test?.testSections === 'string' && test.testSections.trim() ? test.testSections.split(',').map(s => s.trim()).filter(Boolean) : null)

    const totalQs = Number(displayQuestionCount !== '...' ? displayQuestionCount : (test?.totalQuestions || 100))
    const totalM = Number(test?.totalMarks || (totalQs * (test?.marksPerQuestion || 2)))

    // Fallback: If 100 Qs or standard full mock test, use 4 default sections (Reasoning, GK, Math, English)
    const names = (sectionNames && sectionNames.length > 0)
      ? sectionNames
      : (totalQs === 100
          ? ['General Intelligence & Reasoning', 'General Awareness', 'Quantitative Aptitude', 'English Comprehension']
          : null)

    if (!names || names.length === 0) {
      return [{
        name: 'Full Test',
        questionCount: totalQs || 0,
        totalMarks: totalM || 0,
        timeLimit: hasSectionalTiming ? Number(test?.duration || 0) : null
      }]
    }

    const qPerSec = Math.floor(totalQs / names.length)
    const mPerSec = Math.floor(totalM / names.length)

    return names.map((name, i) => ({
      name,
      questionCount: i === names.length - 1 ? totalQs - qPerSec * (names.length - 1) : qPerSec,
      totalMarks: i === names.length - 1 ? totalM - mPerSec * (names.length - 1) : mPerSec,
      timeLimit: hasSectionalTiming ? Math.round((test?.duration || 60) / names.length) : null
    }))
  }, [test, displayQuestionCount, hasSectionalTiming])

  // Check if user came back from test interface with no questions
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('noQuestions') === 'true') {
      setNoQuestions(true)
    }
  }, [location.search])

  useEffect(() => {
    const controller = new AbortController()
    const fetchData = async () => {
      try {
        setLoading(true)
        
        let currentTest = null
        try {
          currentTest = await getTestById(testId)
        } catch {
          // getTestById failed, try next strategy
        }

        if (!currentTest && seriesId) {
          try {
            const seriesTests = await getTestsBySeriesId(seriesId)
            currentTest = seriesTests.find(t => 
              t._id === testId || t.id === testId || t.slug === testId ||
              String(t._id || t.id) === testId || String(t.public_id || '') === testId || String(t.public_id_uuid || '') === testId
            )
          } catch {
            // series tests fetch failed
          }
        }

        if (!currentTest) {
          const tests = await getTests()
          if (controller.signal.aborted) return
          currentTest = tests.find(t => 
            t._id === testId || t.id === testId || t.slug === testId ||
            String(t._id || t.id) === testId || String(t.public_id || '') === testId || String(t.public_id_uuid || '') === testId
          )
        }

        if (currentTest) {
          setTest(currentTest)
          
          // Fetch series details
          try {
            const allSeries = await getTestSeries()
            if (!controller.signal.aborted) {
              const currentSeries = allSeries.find(s => 
                s._id === seriesId || s.id === seriesId || s.slug === seriesId ||
                String(s.subcategory || s.category || '').toLowerCase() === String(seriesId).toLowerCase() ||
                String(s.public_id || '') === seriesId
              )
              setSeries(currentSeries || null)
            }
          } catch (e) {
            console.error('Failed to fetch series:', e)
          }

          // Use question count from test metadata
          const qCount = Number(currentTest.totalQuestions ?? currentTest.questions ?? currentTest.total_questions ?? currentTest.expectedQuestions ?? 0)
          setActualQuestionCount(qCount)
          setQuestionsLoading(false)
          if (qCount === 0 && currentTest.isComingSoon) {
            setNoQuestions(true)
          }
        }
      } catch (error) {
        console.error('Test instructions fetch error:', error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    
    if (testId) {
      fetchData()
    }
    return () => controller.abort()
  }, [testId, seriesId])

  // Pro & Free access resolution
  const entitlement = useMemo(() => {
    return getTestEntitlement({ test, user, series })
  }, [test, user, series])

  const isTestPro = entitlement.accessType === 'PRO'
  const isUserPro = entitlement.isUserPro
  const isLocked = entitlement.requiresPro

  // System check
  useEffect(() => {
    const handleOnline = () => setSystemCheck(prev => ({ ...prev, connection: true }))
    const handleOffline = () => setSystemCheck(prev => ({ ...prev, connection: false }))
    const checkSystem = () => {
      setSystemCheck({
        browser: !(/MSIE|Trident/.test(window.navigator.userAgent)),
        connection: navigator.onLine,
        javascript: true
      })
    }
    checkSystem()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleStartTest = () => {
    if (isLocked) {
      toast.error(isHindi ? 'इस टेस्ट के लिए प्रो पास आवश्यक है' : 'Pro Pass required for this test')
      navigate('/pass')
      return
    }
    if (agreedToRules && !noQuestions) {
      setCountdown(3)
    } else if (!noQuestions) {
      toast.error(isHindi ? 'कृपया पहले नियमों से सहमत हों' : 'Please agree to the rules first')
    }
  }

  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
      return () => clearTimeout(timer)
    }

    if (countdown === 0) {
      setCountdown(null)
      const slug = series?.slug || routeParams.seriesSlug || (seriesId && seriesId !== 'undefined' ? seriesId : 'test')
      const targetTestId = test?.public_id_uuid || test?.public_id || test?.id || test?._id || testId
      const searchParams = new URLSearchParams(location.search)
      const currentAttemptNo = searchParams.get('attemptNo') || attemptNo || 1
      const targetUrl = `/${slug}/tests/${targetTestId}?attemptNo=${currentAttemptNo}`
      navigate(targetUrl, { replace: true })
    }
  }, [countdown, navigate, series, routeParams.seriesSlug, seriesId, test, testId, location.search, attemptNo, isHindi])

    const _cancelCountdown = useCallback(() => {
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
    document.documentElement.lang = lang === 'hi' || lang === 'HI' ? 'hi' : 'en'
    try {
      localStorage.setItem('test_language', lang)
      localStorage.setItem('trstprep_language', lang)
    } catch {
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

  const _testTypeStyles = {
    'Live Test': 'bg-red-100 text-red-700',
    Quiz: 'bg-purple-100 text-purple-700',
    'Previous Year Paper': 'bg-blue-100 text-blue-700',
    Practice: 'bg-green-100 text-green-700',
    'Mock Test': 'bg-tcs-primary/10 text-tcs-primary',
  }

  const _handleGoBack = useCallback(() => {
    navigate(`/test-series/${seriesId}`)
  }, [navigate, seriesId])

  const _generalInstructions = [
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

  const rulesEN = [
    'You can pause and resume the test, but the timer will continue counting down during pauses.',
    'You can attempt the test only once unless reattempt is allowed.',
    'Switching tabs or applications during the test is monitored.',
    'Ensure you have a stable internet connection before starting.',
    'Use of calculators, mobile phones, or any external help is prohibited.',
    'Your results will be available immediately after submission.',
    'Do not refresh or close the browser window during the test.',
    'Contact support immediately if you face any technical issues.'
  ]

  const rulesHI = [
    'आप परीक्षण को रोक और फिर से शुरू कर सकते हैं, लेकिन विराम के दौरान भी टाइमर चलता रहेगा।',
    'आप परीक्षण को केवल एक बार दे सकते हैं जब तक कि पुन: प्रयास (Reattempt) की अनुमति न हो।',
    'परीक्षण के दौरान टैब या एप्लिकेशन स्विच करने पर निगरानी की जाती है।',
    'परीक्षण शुरू करने से पहले सुनिश्चित करें कि आपके पास एक स्थिर इंटरनेट कनेक्शन है।',
    'कैलकुलेटर, मोबाइल फोन या किसी बाहरी सहायता का उपयोग सख्त मना है।',
    'सबमिशन के तुरंत बाद आपके परिणाम उपलब्ध होंगे।',
    'परीक्षण के दौरान ब्राउज़र विंडो को रिफ्रेश या बंद न करें।',
    'यदि आप किसी तकनीकी समस्या का सामना करते हैं तो तुरंत सहायता से संपर्क करें।'
  ]

  const rules = isHindi ? rulesHI : rulesEN

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-transparent">
        <div className="flex flex-col items-center justify-center p-8 max-w-md w-full animate-fade-in text-center space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-600 animate-spin"></div>
            <div className="absolute w-8 h-8 rounded-full bg-indigo-500/20 animate-ping"></div>
            <div className="absolute w-3.5 h-3.5 rounded-full bg-indigo-600"></div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-wide">
              {isHindi ? 'परीक्षण निर्देश लोड हो रहे हैं...' : 'Loading Test Instructions...'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {isHindi ? 'नियम, अवधि और परीक्षा निर्देश तैयार किए जा रहे हैं' : 'Preparing test rules, duration & exam instructions'}
            </p>
          </div>
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
          <h2 className="text-2xl font-bold text-tcs-text-primary mb-2">
            {isHindi ? 'परीक्षण नहीं मिला' : 'Test Not Found'}
          </h2>
          <p className="text-tcs-text-secondary mb-6">
            {isHindi ? 'आप जिस परीक्षण की तलाश कर रहे हैं वह मौजूद नहीं है या हटा दिया गया है।' : "The test you're looking for doesn't exist or has been removed."}
          </p>
          <Link 
            to="/test-series"
            className="inline-flex items-center gap-2 px-6 py-3 bg-tcs-primary text-white font-semibold rounded-lg hover:bg-tcs-primary-dark transition-colors"
          >
            {isHindi ? 'परीक्षण श्रृंखला देखें' : 'Browse Test Series'}
          </Link>
        </div>
      </div>
    )
  }

  const isAllSystemsReady = Object.values(systemCheck).every(Boolean)
  const _isQuestionsReady = !noQuestions && actualQuestionCount > 0

  return (
    <div className="min-h-screen flex flex-col bg-tcs-surface pb-16 lg:pb-3 overscroll-none overscroll-y-none touch-pan-y">
      {/* Top Header Bar - Non Sticky on Desktop */}
      <header className="bg-white border-b border-tcs-border shrink-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 sm:h-14 gap-2">
            {/* Left: Breadcrumbs & Mobile Test Name */}
            <div className="flex-1 min-w-0">
              <div className="hidden sm:block">
                <Breadcrumb 
                  items={[
                    { label: isHindi ? 'परीक्षण श्रृंखला' : 'Test Series', path: '/test-series' },
                    { label: series?.title || (isHindi ? 'श्रृंखला' : 'Series'), path: `/test-series/${seriesId}` },
                    { label: isHindi ? 'निर्देश' : 'Instructions' }
                  ]}
                />
              </div>
              <div className="sm:hidden font-bold text-tcs-text-primary text-sm truncate">
                {test.title}
              </div>
            </div>
            
            {/* Right: Language Switcher, Test Status & Attempt Number */}
            <div className="flex items-center gap-2.5 sm:ml-4 shrink-0">
              <div className="inline-flex items-center p-0.5 rounded-full border border-indigo-200/80 dark:border-indigo-800/60 bg-slate-100 dark:bg-slate-800 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('EN')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer ${
                    !isHindi
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm scale-[1.02]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Globe className={`w-3 h-3 ${!isHindi ? 'text-indigo-200' : 'text-slate-400'}`} />
                  <span>English</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('HI')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer ${
                    isHindi
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm scale-[1.02]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Globe className={`w-3 h-3 ${isHindi ? 'text-indigo-200' : 'text-slate-400'}`} />
                  <span>हिंदी</span>
                </button>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-full shadow-xs">
                <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {isHindi ? `प्रयास #${attemptNo}` : `Attempt #${attemptNo}`}
              </span>
              {noQuestions ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-tcs-warning/10 text-tcs-warning text-xs font-medium rounded-full">
                  <Construction className="w-3 h-3" />
                  {isHindi ? 'अद्यतन जारी' : 'Updating'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-tcs-success/10 text-tcs-success text-xs font-medium rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-tcs-success animate-pulse"></span>
                  {isHindi ? 'तैयार' : 'Ready'}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Full Vertical Stretch */}
      <div className="flex-1 flex flex-col w-full px-3 py-3 sm:px-5 lg:px-6">
        <div className="flex-1 flex flex-col w-full bg-white rounded-xl shadow-tcs border border-tcs-border overflow-hidden">
          {/* Window Title Bar - TCS High Contrast Style */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-3.5 border-b border-indigo-900/50 shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-inner">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h1 className="text-lg sm:text-xl font-black text-white tracking-tight drop-shadow-xs">{test.title}</h1>
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/40">
                    🎯 {getTranslatedTestType(testType)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                    🏆 {isHindi ? `प्रयास #${attemptNo}` : `Attempt #${attemptNo}`}
                  </span>
                </div>
                <p className="text-indigo-200/80 text-xs font-medium flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  {series?.title || (isHindi ? 'परीक्षण श्रृंखला' : 'Test Series')}
                </p>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3">
            {/* Left Main Column: Full Exam Pattern & Rules */}
            <div className="lg:col-span-2 p-4 sm:p-5 border-r border-tcs-border flex flex-col justify-between space-y-4">
              
              {/* Exam Pattern & Dynamic Section Breakdown Card */}
              <section className="bg-white rounded-xl border border-tcs-border overflow-hidden shadow-2xs">
                <div className="bg-gradient-to-r from-indigo-50 to-slate-50 px-4 py-2.5 border-b border-tcs-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm sm:text-base font-bold text-tcs-text-primary">
                      {isHindi ? 'परीक्षा पैटर्न और योजना' : 'Exam Pattern & Scheme'}
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {effectiveSections.length} {isHindi ? 'अनुभाग' : 'Sections'}
                    </span>
                  </div>
                  {hasSectionalTiming ? (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-emerald-600" /> {isHindi ? 'अनुभाग टाइमर: सक्षम' : 'Sectional Timer: Enabled'}
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-amber-600" /> {isHindi ? `अनुभाग टाइमर: निष्क्रिय (साझा ${test?.duration || 60} मिनट टाइमर)` : `Sectional Timer: Disabled (Shared ${test?.duration || 60} Min Timer)`}
                    </span>
                  )}
                </div>

                {/* Exam Key Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-tcs-surface/40 border-b border-tcs-border text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-tcs-border flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-tcs-text-secondary text-[10px] uppercase font-semibold">{isHindi ? 'अवधि' : 'Duration'}</div>
                      <div className="font-bold text-tcs-text-primary text-xs sm:text-sm">{test.duration || 60} {isHindi ? 'मिनट' : 'Mins'}</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-tcs-border flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-tcs-text-secondary text-[10px] uppercase font-semibold">{isHindi ? 'प्रश्न' : 'Questions'}</div>
                      <div className="font-bold text-tcs-text-primary text-xs sm:text-sm">{displayQuestionCount} {isHindi ? 'प्रश्न' : 'Qs'}</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-tcs-border flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-tcs-text-secondary text-[10px] uppercase font-semibold">{isHindi ? 'कुल अंक' : 'Total Marks'}</div>
                      <div className="font-bold text-tcs-text-primary text-xs sm:text-sm">{test.totalMarks || (displayQuestionCount !== '...' ? Number(displayQuestionCount) * 2 : 200)} {isHindi ? 'अंक' : 'Marks'}</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-tcs-border flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-tcs-text-secondary text-[10px] uppercase font-semibold">{isHindi ? 'अंकन' : 'Marking'}</div>
                      <div className="font-bold text-emerald-600 text-xs sm:text-sm">+{test.marksPerQuestion || 2} / -{test.negativeMarking || 0.25}</div>
                    </div>
                  </div>
                </div>

                {/* Section Breakdown Table */}
                <div className="p-3">
                  <h3 className="text-xs font-bold text-tcs-text-secondary uppercase tracking-wider mb-2">
                    {isHindi ? 'अनुभाग-वार विवरण' : 'Section-wise Details'}
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-tcs-border">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-tcs-surface border-b border-tcs-border text-tcs-text-secondary font-semibold uppercase text-xs">
                          <th className="py-2 px-3">{isHindi ? '# अनुभाग का नाम' : '# Section Name'}</th>
                          <th className="py-2 px-3 text-center">{isHindi ? 'प्रश्न' : 'Questions'}</th>
                          <th className="py-2 px-3 text-center">{isHindi ? 'अंक' : 'Marks'}</th>
                          <th className="py-2 px-3 text-center">{isHindi ? 'समय सीमा' : 'Section Time Limit'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-tcs-border">
                        {effectiveSections.map((sec, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-2 px-3 font-semibold text-tcs-text-primary flex items-center gap-2 text-xs sm:text-sm">
                              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              {getSectionNameInLanguage(sec.name)}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-medium text-tcs-text-primary text-xs sm:text-sm">
                              {sec.questionCount} {isHindi ? 'प्रश्न' : 'Qs'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-medium text-tcs-text-primary text-xs sm:text-sm">
                              {sec.totalMarks} {isHindi ? 'अंक' : 'Marks'}
                            </td>
                            <td className="py-2 px-3 text-center font-medium text-xs">
                              {sec.timeLimit ? (
                                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{sec.timeLimit} {isHindi ? 'मिनट' : 'Mins'}</span>
                              ) : (
                                <span className="text-gray-500 italic text-xs">
                                  {isHindi ? `कोई अनुभाग सीमा नहीं (साझा ${test?.duration || 60} मिनट)` : `No Sectional Limit (Shared ${test?.duration || 60} Mins)`}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Expandable Rules Section - Shows 2 rules by default */}
              <section className="bg-amber-50/50 rounded-xl border border-amber-200/80 overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-amber-100/60 border-b border-amber-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-700" />
                    <h2 className="text-xs sm:text-sm font-bold text-amber-900">
                      {isHindi ? 'महत्वपूर्ण नियम और दिशानिर्देश' : 'Important Rules & Guidelines'} ({rules.length} {isHindi ? 'नियम' : 'Rules'})
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-amber-800 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
                    {showRules 
                      ? (isHindi ? 'सभी दिखा रहे हैं' : 'Showing All') 
                      : (isHindi ? '2 पूर्वावलोकन' : '2 Previewed')
                    }
                  </span>
                </div>
                
                <div className="p-3 space-y-2.5">
                  <ul className="space-y-2">
                    {(showRules ? rules : rules.slice(0, 2)).map((rule, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-xs sm:text-sm text-amber-900/90 leading-relaxed">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {index + 1}
                        </span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>

                  {rules.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setShowRules(!showRules)}
                      className="w-full py-1.5 px-3 text-xs font-bold text-amber-900 bg-amber-200/50 hover:bg-amber-200 border border-amber-300/70 rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>
                        {showRules 
                          ? (isHindi ? 'कम दिखाएं' : 'Show Less') 
                          : (isHindi ? `+ ${rules.length - 2} और नियम दिखाएं` : `+ Show ${rules.length - 2} More Rules`)
                        }
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showRules ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </section>

            </div>

            {/* Right Sidebar Column: Desktop Actions & Readiness */}
            <div className="lg:col-span-1 p-4 sm:p-5 border-l border-tcs-border bg-tcs-surface/30 flex flex-col justify-between space-y-3">
              
              {/* Exam Readiness Card (Top) */}
              <div className="bg-white p-3.5 rounded-xl border border-tcs-border shadow-2xs">
                <div className="flex items-center gap-2 mb-2.5">
                  <Monitor className="w-4 h-4 text-tcs-primary" />
                  <h3 className="text-xs sm:text-sm font-bold text-tcs-text-primary uppercase tracking-wider">
                    {isHindi ? 'सिस्टम स्थिति जांच' : 'Exam System Check'}
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                    <span>{isHindi ? 'ब्राउज़र अनुकूलता' : 'Browser Compatibility'}</span>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                    <span>{isHindi ? 'इंटरनेट कनेक्शन' : 'Internet Connection'}</span>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                    <span>{isHindi ? 'जावास्क्रिप्ट समर्थन' : 'JavaScript Support'}</span>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </div>

              {/* Security & Monitoring Alert (Middle) */}
              <div className="bg-white p-3.5 rounded-xl border border-tcs-border shadow-2xs text-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs sm:text-sm">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>{isHindi ? 'प्रॉक्टर्ड परीक्षा नियम' : 'Proctored Test Rules'}</span>
                </div>
                <p className="text-tcs-text-secondary leading-relaxed text-xs">
                  {isHindi 
                    ? 'टैब बदलना, स्क्रीन छोटा करना या बाहरी ऐप खोलना सख्त वर्जित है।' 
                    : 'Tab switching, browser minimization, or opening external applications is strictly monitored.'
                  }
                </p>
                <div className="pt-2 border-t border-gray-100 text-xs text-tcs-text-muted">
                  {isHindi ? 'सहायता चाहिए? ' : 'Need assistance? '}
                  <Link to="/contact" className="text-tcs-primary hover:underline font-semibold">
                    {isHindi ? 'तकनीकी सहायता से संपर्क करें' : 'Contact Technical Support'}
                  </Link>
                </div>
              </div>

              {/* Desktop Start Action Card (Bottom of Sidebar / Hidden on Mobile) */}
              <div className="hidden lg:block bg-white p-4 rounded-xl border border-indigo-200 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-tcs-text-primary uppercase tracking-wider">
                    {isLocked ? (isHindi ? 'प्रो पास आवश्यक' : 'Pro Pass Required') : (isHindi ? 'परीक्षण शुरू करें' : 'Start Assessment')}
                  </h4>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {isHindi ? `प्रयास #${attemptNo}` : `Attempt #${attemptNo}`}
                  </span>
                </div>

                {isLocked && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800">
                    <Crown className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-medium">
                      {isHindi ? 'यह टेस्ट प्रो पास के अंतर्गत आता है।' : 'This test requires an active Pro Pass.'}
                    </p>
                  </div>
                )}

                {!isLocked && (
                  <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg bg-tcs-surface border border-tcs-border hover:border-tcs-primary/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={agreedToRules}
                      onChange={(e) => setAgreedToRules(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-tcs-primary rounded border-tcs-border focus:ring-tcs-primary cursor-pointer shrink-0"
                    />
                    <span className="text-xs sm:text-sm font-medium text-tcs-text-primary select-none leading-normal">
                      {isHindi 
                        ? 'मैंने सभी निर्देश, नियम और दिशानिर्देश पढ़ लिए हैं और उनसे सहमत हूँ।' 
                        : 'I have read and agree to all instructions, rules & guidelines.'
                      }
                    </span>
                  </label>
                )}

                {isLocked ? (
                  <button
                    onClick={() => navigate('/pass')}
                    className="w-full py-3 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg cursor-pointer"
                  >
                    <Crown className="w-4 h-4" />
                    {isHindi ? 'प्रो पास प्राप्त करें' : 'Get Pro Pass to Start'}
                  </button>
                ) : noQuestions ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-gray-200 text-gray-400 cursor-not-allowed"
                  >
                    {isHindi ? 'अद्यतन जारी' : 'Questions Being Updated'}
                    <Construction className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartTest}
                    disabled={!agreedToRules || !isAllSystemsReady}
                    className={`w-full py-3 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                      agreedToRules && isAllSystemsReady
                        ? 'bg-tcs-primary text-white hover:bg-tcs-primary-dark shadow-tcs hover:shadow-tcs-lg active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {user?.attemptedTestIds?.includes(String(test.id || test._id)) 
                      ? (isHindi ? 'पुन: प्रयास करें' : 'Reattempt Test') 
                      : (isHindi ? 'परीक्षण शुरू करें' : 'Start Test')
                    }
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar (Visible ONLY on Mobile & Hidden on Desktop) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-tcs-border p-3 shadow-tcs">
        <div className="w-full flex items-center justify-between gap-2">
          {!isLocked && (
            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
              <input
                type="checkbox"
                checked={agreedToRules}
                onChange={(e) => setAgreedToRules(e.target.checked)}
                className="w-4 h-4 text-tcs-primary rounded border-tcs-border focus:ring-tcs-primary cursor-pointer shrink-0"
              />
              <span className="text-[11px] font-medium text-tcs-text-primary select-none truncate">
                {isHindi ? 'मैं सभी नियमों से सहमत हूँ।' : 'I agree to all rules & instructions.'}
              </span>
            </label>
          )}
          
          <div className={isLocked ? 'w-full' : 'shrink-0'}>
            {isLocked ? (
              <button
                onClick={() => navigate('/pass')}
                className="w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                {isHindi ? 'प्रो पास प्राप्त करें' : 'Get Pro Pass to Start'}
              </button>
            ) : noQuestions ? (
              <button
                disabled
                className="px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 bg-gray-200 text-gray-400 cursor-not-allowed"
              >
                {isHindi ? 'अद्यतन' : 'Updating'}
                <Construction className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleStartTest}
                disabled={!agreedToRules || !isAllSystemsReady}
                className={`px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                  agreedToRules && isAllSystemsReady
                    ? 'bg-tcs-primary text-white hover:bg-tcs-primary-dark shadow-tcs active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {user?.attemptedTestIds?.includes(String(test.id || test._id)) 
                  ? (isHindi ? 'पुन: प्रयास' : 'Reattempt') 
                  : (isHindi ? 'शुरू करें' : 'Start Test')
                }
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
          <div className="text-center space-y-4 max-w-sm px-6">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <span className="absolute text-5xl font-black text-white font-mono animate-scale-in">
                {countdown}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isHindi ? 'परीक्षण शुरू हो रहा है...' : 'Test Starting...'}
            </h2>
            <p className="text-sm text-indigo-200">
              {isHindi ? 'कृपया तैयार हो जाइए। शुभकामनाएँ!' : 'Get ready! Good luck with your test.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestInstructions