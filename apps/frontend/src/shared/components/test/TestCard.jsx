import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  Radio, Crown, Lock, Clock, FileText, Users, 
  ChevronRight, Play, Calendar, Construction
} from 'lucide-react'
import { checkFeatureAccess } from '../../utils/pass-helpers'
import { getQuestionsByTestId } from '../../lib/dataService'

// Badge configuration for test cards
const badgeConfig = {
  'LIVE TEST': { bg: 'bg-red-500', color: 'text-white', icon: Radio },
  'FREE': { bg: 'bg-green-500', color: 'text-white', icon: null },
  'MUST ATTEMPT': { bg: 'bg-gradient-to-r from-indigo-500 to-blue-500', color: 'text-white', icon: null },
  'PRO': { bg: 'bg-gradient-to-r from-amber-400 to-orange-400', color: 'text-white', icon: Crown },
  'SCHEDULED': { bg: 'bg-blue-500', color: 'text-white', icon: Clock },
  'NEW': { bg: 'bg-purple-500', color: 'text-white', icon: null },
  'COMING SOON': { bg: 'bg-amber-100', color: 'text-amber-700', icon: Clock },
  'UPDATING': { bg: 'bg-amber-100', color: 'text-amber-700', icon: Clock },
}

// CTA button configuration
const ctaConfig = {
  register: { label: 'Register', bg: 'bg-green-500', hover: 'hover:bg-green-600', color: 'text-white', border: '' },
  start: { label: 'Start Now', bg: 'bg-sky-500', hover: 'hover:bg-sky-600', color: 'text-white', border: '' },
  unlock: { label: '🔒 Unlock', bg: 'bg-white', hover: 'hover:bg-gray-50', color: 'text-blue-500', border: 'border-2 border-blue-500' },
  join: { label: '🔴 Join Now', bg: 'bg-red-500', hover: 'hover:bg-red-600', color: 'text-white', border: '' },
  result: { label: 'Result', bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', color: 'text-white', border: '' },
  reattempt: { label: 'Reattempt', bg: 'bg-white', hover: 'hover:bg-gray-50', color: 'text-sky-600', border: 'border border-sky-200' },
  coming_soon: { label: 'Coming Soon', bg: 'bg-gray-200', hover: 'hover:bg-gray-200', color: 'text-gray-500', border: 'border border-gray-300' },
}

// Language flag emoji mapping
const getLanguageFlag = (lang) => {
  const flags = {
    'english': '🇺🇸',
    'hindi': '🇮🇳',
    'marathi': '🇮🇳',
    'tamil': '🇮🇳',
    'telugu': '🇮🇳',
    'bengali': '🇮🇳',
    'gujarati': '🇮🇳',
    'kannada': '🇮🇳',
    'malayalam': '🇮🇳',
    'punjabi': '🇮🇳',
    'urdu': '🇵🇰',
    'spanish': '🇪🇸',
    'french': '🇫🇷',
    'german': '🇩🇪',
    'default': '🌐'
  }
  return flags[lang?.toLowerCase()] || flags.default
}

// Format scheduled date range
const formatDateRange = (startDate, endDate) => {
  if (!startDate) return null
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : null
  
  const formatSingle = (date) => {
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const hours = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${day} ${month}, ${hours}`
  }
  
  if (end) {
    return `${formatSingle(start)} – ${formatSingle(end)}`
  }
  return formatSingle(start)
}

// Check if test should still be "Coming Soon" based on auto-release date
const isStillComingSoon = (test) => {
  const isComingSoon = test.isComingSoon || test.is_coming_soon
  if (!isComingSoon) return false
  const releaseDate = test.comingSoonDate || test.coming_soon_date
  if (!releaseDate) return true // No auto-release date, stays as Coming Soon
  return new Date(releaseDate) > new Date() // Still coming soon if date hasn't passed
}

// Determine test status and badges
const getTestBadges = (test) => {
  const badges = []
  const isLive = test.tags?.includes('Live') || test.type === 'live' || test.isLive
  const isUpcoming = test.scheduledAt && new Date(test.scheduledAt) > new Date()
  const isFree = test.type === 'Free' || !test.isPro
  
  if (isLive) badges.push('LIVE TEST')
  if (isUpcoming && !isLive) badges.push('SCHEDULED')
  if (isFree) badges.push('FREE')
  if (test.isMustAttempt || test.tags?.includes('Must Attempt')) badges.push('MUST ATTEMPT')
  if (test.isNew || test.tags?.includes('New')) badges.push('NEW')
  if (isStillComingSoon(test)) badges.push('COMING SOON')
  if (!isFree && !isLive) badges.push('PRO')
  
  return badges
}

// Determine CTA type
const getTestCtaType = (test, hasAccess, isLive, isUpcoming) => {
  if (isStillComingSoon(test)) return 'coming_soon'
  if (!hasAccess) return 'unlock'
  if (isLive) return 'join'
  if (isUpcoming) return 'register'
  return 'start'
}

// Get border color based on test status
const getCardBorderClass = (isLive, isUpcoming, isFree, isLocked, isHovered) => {
  if (isLive) return isHovered ? 'border-2 border-red-400' : 'border-2 border-red-300'
  if (isUpcoming) return isHovered ? 'border-2 border-blue-400' : 'border-2 border-blue-300'
  if (isFree) return isHovered ? 'border-2 border-green-400' : 'border-2 border-green-300'
  if (isLocked) return isHovered ? 'border-2 border-amber-400' : 'border-2 border-amber-300'
  return isHovered ? 'border-2 border-indigo-400' : 'border-2 border-gray-300'
}

/**
 * Unified TestCard Component
 * 
 * Used across: TestDetails, TagPage, Dashboard, Admin Panel, Landing Page
 * 
 * @param {Object} test - Test data object
 * @param {string} seriesId - Series ID for navigation
 * @param {Object} user - Current user object
 * @param {boolean} showSeriesTitle - Show series title tag
 * @param {string} variant - 'default' | 'compact' | 'detailed'
 */
function TestCard({ test, seriesId, user, showSeriesTitle = false, variant = 'default' }) {
  const [isHovered, setIsHovered] = useState(false)
  const [actualQuestions, setActualQuestions] = useState(null)
  const [questionsLoading, setQuestionsLoading] = useState(true)
  
  // Test status
  const isLive = test.tags?.includes('Live') || test.type === 'live' || test.isLive
  const isUpcoming = test.scheduledAt && new Date(test.scheduledAt) > new Date()
  const isFree = test.type === 'Free' || !test.isPro
  
  // Use pass system helpers to check access based on test type
  const isChapter = test.type === 'Chapter' || test.subCategory?.includes('Chapter');
  const isSectional = test.tags?.some(tag => tag.toLowerCase().includes('sectional')) || test.subCategory?.includes('Sectional');
  const isPYQ = test.type === 'PYQ' || test.tags?.includes('PYQ') || test.subCategory?.includes('PYQ');
  
  const featureKey = isLive ? 'live_tests' : 
                    isSectional ? 'sectional_tests' :
                    isChapter ? 'chapter_tests' : 
                    isPYQ ? 'pyq_papers' : 'mock_tests';
                    
  const passAccess = checkFeatureAccess(featureKey, user?.passType || 'free');
  const hasAccess = isFree || !!passAccess;
  const isLocked = !hasAccess;
  
  // Fetch actual question count from database
  useEffect(() => {
    let cancelled = false
    const fetchQuestions = async () => {
      setQuestionsLoading(true)
      try {
        const testDbId = test._id || test.id
        if (testDbId) {
          const questions = await getQuestionsByTestId(testDbId)
          if (!cancelled) {
            const qCount = Array.isArray(questions) ? questions.length : 0
            setActualQuestions(qCount)
          }
        } else {
          if (!cancelled) setActualQuestions(0)
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to fetch questions for test card:', test.title, err)
          setActualQuestions(0)
        }
      } finally {
        if (!cancelled) setQuestionsLoading(false)
      }
    }
    fetchQuestions()
    return () => { cancelled = true }
  }, [test._id, test.id, test.title])

  // Determine if test has no questions
  const noQuestions = actualQuestions !== null && actualQuestions === 0
  const displayQuestions = questionsLoading ? null : (actualQuestions !== null ? actualQuestions : (test.totalQuestions || test.questions || 0))
  
  // Add UPDATING badge if no questions
  const badges = getTestBadges(test, isLive, isUpcoming, isFree)
  if (noQuestions && !isStillComingSoon(test)) {
    badges.push('UPDATING')
  }
  
  // Get CTA config
  const ctaType = noQuestions ? 'coming_soon' : getTestCtaType(test, hasAccess, isLive, isUpcoming)
  const cta = ctaConfig[ctaType]
  
  // Languages
  const languages = test.languages || test.language || ['English']
  const languageList = Array.isArray(languages) ? languages : [languages]
  const extraLangCount = test.extraLanguagesCount || (languageList.length > 3 ? languageList.length - 3 : 0)
  const displayLanguages = languageList.slice(0, 2)
  const langText = extraLangCount > 0 
    ? `${displayLanguages.join(', ')} +${extraLangCount}`
    : languageList.join(', ')
  
  // Date range
  const dateRange = formatDateRange(test.scheduledAt || test.dateStart, test.dateEnd || test.scheduledEnd)
  
  // Test metadata
  const marks = test.totalMarks || test.marks || 200
  const duration = test.duration || 60
  const bannerUrl = test.bannerUrl || test.bannerImageUrl || test.banner_image_url || null
  
  // Build URL - prefer slug for cleaner URLs, fallback to id
  const testIdentifier = test.slug || test._id || test.id
  const seriesIdentifier = seriesId // seriesId should already be slug from parent
  const testUrl = seriesIdentifier 
    ? `/test/${seriesIdentifier}/${testIdentifier}`
    : `/test/${test.seriesSlug || test.seriesId}/${testIdentifier}`

  // Check if test was attempted
  const isAttempted = useMemo(() => {
    if (!user?.attemptedTestIds || !Array.isArray(user.attemptedTestIds)) return false;
    
    // Check against multiple possible ID formats for robustness
    const targetIds = [
      String(test._id || ''),
      String(test.id || ''),
      String(test.slug || ''),
      String(test.public_id || ''),
      String(testIdentifier || '')
    ].filter(Boolean).map(id => id.toLowerCase());

    return user.attemptedTestIds.some(id => 
      targetIds.includes(String(id).toLowerCase())
    );
  }, [user?.attemptedTestIds, test._id, test.id, test.slug, test.public_id, testIdentifier]);

  // Border class based on status
  const borderClass = getCardBorderClass(isLive, isUpcoming, isFree, isLocked, isHovered)
  // Instructions URL - always go to instructions page first
  const instructionsUrl = `${testUrl}/instructions`

  return (
    <div 
      className={`bg-white rounded-xl transition-all duration-200 overflow-hidden ${
        isHovered ? 'shadow-lg' : 'shadow-sm'
      } ${borderClass} ${isLocked ? 'opacity-85' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {bannerUrl && (
        <div className="h-28 md:h-32 w-full overflow-hidden bg-gray-100 border-b border-gray-100">
          <img
            src={bannerUrl}
            alt={test.title || 'Test banner'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="px-3.5 py-2.5">
        {/* Badges and Series Title Row */}
        {(badges.length > 0 || (showSeriesTitle && test.seriesTitle)) && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {badges.map((badge) => {
              const config = badgeConfig[badge] || { bg: 'bg-gray-200', color: 'text-gray-700', icon: null }
              const IconComponent = config.icon
              return (
                <span 
                  key={badge}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap ${config.bg} ${config.color}`}
                >
                  {IconComponent && <IconComponent className="w-3 h-3" />}
                  {badge}
                </span>
              )
            })}
            
            {/* Series Title */}
            {showSeriesTitle && test.seriesTitle && (
              <span className="text-xs text-gray-500 font-medium truncate flex-1 min-w-[120px]">
                {test.seriesTitle}
              </span>
            )}
          </div>
        )}

        {/* Title + CTA Row */}
        <div className="flex justify-between items-start gap-2.5">
          <h3 className="text-sm md:text-base font-bold text-gray-900 leading-snug line-clamp-2 flex-1">
            {test.title}
          </h3>
          
          {isAttempted ? (
            <div className="flex gap-1 items-end">
              <Link
                to={`/test-result/${seriesIdentifier || test.seriesSlug || test.seriesId}/${testIdentifier}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-150 ${
                  isHovered ? 'brightness-95' : 'brightness-100'
                } ${ctaConfig.result.bg} ${ctaConfig.result.hover} ${ctaConfig.result.color} ${ctaConfig.result.border}`}
              >
                {ctaConfig.result.label}
              </Link>
              <Link
                to={hasAccess ? instructionsUrl : '/pass'}
                className={`flex-shrink-0 px-2 py-1 rounded text-[10px] md:text-xs font-semibold whitespace-nowrap transition-all duration-150 ${ctaConfig.reattempt.bg} ${ctaConfig.reattempt.hover} ${ctaConfig.reattempt.color} ${ctaConfig.reattempt.border}`}
              >
                {ctaConfig.reattempt.label}
              </Link>
            </div>
          ) : ctaType === 'coming_soon' ? (
            <button
              disabled
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap opacity-70 cursor-not-allowed ${cta.bg} ${cta.color} ${cta.border}`}
            >
              {cta.label}
            </button>
          ) : (
            <Link
              to={hasAccess ? instructionsUrl : '/pass'}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-150 ${
                isHovered ? 'brightness-95' : 'brightness-100'
              } ${cta.bg} ${cta.hover} ${cta.color} ${cta.border}`}
            >
              {cta.label}
            </Link>
          )}
        </div>

        {/* Meta Info Row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="text-sm">❓</span>
            {questionsLoading ? (
              <span className="inline-block w-8 h-3 bg-gray-200 rounded animate-pulse" />
            ) : displayQuestions !== null ? (
              <>
                {displayQuestions} Qs
                {noQuestions && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                    <Construction className="w-3 h-3" />
                    <span className="text-[10px]">Updating</span>
                  </span>
                )}
              </>
            ) : (
              `${test.totalQuestions || test.questions || 0} Qs`
            )}
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1">
            <span className="text-sm">📄</span>
            {marks} Marks
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1">
            <span className="text-sm">🕒</span>
            {duration} Mins
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50/80 border-t border-gray-100 px-3.5 py-2">
        <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-gray-500">
          {/* Left: Languages + Syllabus */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="text-sm">🌐</span>
              {langText}
            </span>
            {test.syllabusUrl && (
              <Link 
                to={`${testUrl}#syllabus`}
                className={`text-blue-500 font-medium transition-all ${isHovered ? 'underline' : ''}`}
              >
                Syllabus
              </Link>
            )}
          </div>
          
          {/* Right: Date Range */}
          {dateRange && (
            <span className="flex items-center gap-1 text-gray-600">
              <span className="text-sm">📅</span>
              {dateRange}
            </span>
          )}
          
          {/* Right: Participants (for live tests) */}
          {test.participants && (
            <span className="flex items-center gap-1 text-gray-600">
              <Users className="w-3 h-3" />
              {(test.participants / 1000).toFixed(1)}k joined
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TestCard
