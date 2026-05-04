import { useState, useMemo, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../shared/providers/AuthContext.jsx'
import { AnimatedHero, Breadcrumb } from '../../shared/components'
import api from '../../shared/lib/api'
import {
  Search, ArrowRight, Loader2, Sparkles, TrendingUp,
  Users, BookOpen, Zap, Target, Star, Bell, ChevronRight, Flame,
  XCircle
} from 'lucide-react'
import SearchBox from '../../shared/components/common/SearchBox'

// ── Category visual config ───────────────────────────────────────
const CATEGORY_CONFIG = {
  ssc:      { label: 'SSC',      icon: '📋', color: 'from-orange-500 to-red-500',    bg: 'bg-orange-500',   shadow: 'shadow-orange-100',  description: 'CGL, CHSL, MTS, CPO and more' },
  railways: { label: 'Railway',  icon: '🚂', color: 'from-green-500 to-teal-600',    bg: 'bg-green-600',    shadow: 'shadow-green-100',   description: 'NTPC, Group D, ALP and more' },
  banking:  { label: 'Banking',  icon: '🏦', color: 'from-blue-500 to-blue-700',     bg: 'bg-blue-600',     shadow: 'shadow-blue-100',    description: 'PO, Clerk, SO, RRB and more' },
  upsc:     { label: 'UPSC',     icon: '🎖️', color: 'from-purple-600 to-indigo-700', bg: 'bg-purple-700',   shadow: 'shadow-purple-100',  description: 'CSE, CDS, NDA and more' },
  teaching: { label: 'Teaching', icon: '🎓', color: 'from-amber-500 to-orange-500',  bg: 'bg-amber-500',    shadow: 'shadow-amber-100',   description: 'CTET, UTET and State TET' },
  defence:  { label: 'Defence',  icon: '⚔️', color: 'from-slate-600 to-gray-800',   bg: 'bg-slate-700',    shadow: 'shadow-slate-100',   description: 'NDA, AFCAT, CDS and more' },
  state:    { label: 'State',    icon: '🏛️', color: 'from-rose-500 to-pink-600',    bg: 'bg-rose-500',     shadow: 'shadow-rose-100',    description: 'State PSC, Police, Teaching' },
  other:    { label: 'Other',    icon: '📚', color: 'from-violet-500 to-fuchsia-600',bg: 'bg-violet-600',   shadow: 'shadow-violet-100',  description: 'NEET, CLAT, CMAT and more' },
}

const DIFFICULTY_COLORS = {
  Easy:        'bg-emerald-50 text-emerald-600 border-emerald-100',
  Medium:      'bg-amber-50 text-amber-600 border-amber-100',
  Hard:        'bg-red-50 text-red-500 border-red-100',
  'Very Hard': 'bg-purple-50 text-purple-600 border-purple-100',
}

const BADGE_COLORS = {
  HOT:   'bg-red-500',
  NEW:   'bg-emerald-500',
  ELITE: 'bg-purple-600',
}

function getCatKey(cat) {
  if (typeof cat === 'string') return cat.toLowerCase()
  const idStr = (cat.slug || cat.categoryId || (typeof (cat.id || cat._id) === 'string' ? (cat.id || cat._id) : null) || '').toLowerCase()
  if (idStr && CATEGORY_CONFIG[idStr]) return idStr
  const name = (cat.name || cat.title || cat.label || '').toLowerCase()
  const nameMatch = Object.keys(CATEGORY_CONFIG).find(k =>
    name.includes(k) || k.includes(name)
  )
  if (nameMatch) return nameMatch
  return idStr || name || 'other'
}

function getCatConfig(catOrId, index = 0) {
  const key = getCatKey(catOrId)
  if (CATEGORY_CONFIG[key]) return { ...CATEGORY_CONFIG[key] }
  const GRADIENTS = [
    'from-blue-500 to-indigo-600', 'from-emerald-400 to-teal-500',
    'from-purple-500 to-pink-500', 'from-orange-400 to-red-500',
    'from-cyan-400 to-blue-500', 'from-rose-400 to-red-500',
  ]
  const ICONS = ['📚', '🎯', '✨', '🚀', '💡', '🏆']
  const label = typeof catOrId === 'object'
    ? (catOrId.name || catOrId.title || catOrId.label || key)
    : key
  return {
    label,
    icon: ICONS[index % ICONS.length],
    color: GRADIENTS[index % GRADIENTS.length],
    bg: 'bg-indigo-500',
    shadow: 'shadow-indigo-100',
    description: `Explore ${label} exams`,
  }
}

// ── Exam Card — horizontal list style ────────────────────────────
function ExamCard({ exam, catConfig }) {
  const config = catConfig || getCatConfig(exam.category || exam.categoryId || '')
  const badge = exam.badge
  const difficulty = exam.difficulty || 'Medium'
  const diffColor = DIFFICULTY_COLORS[difficulty] || 'bg-gray-100 text-gray-500 border-gray-100'

  const abbrev = (exam.title || exam.name || 'EX')
    .split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()

  return (
    <Link
      to={`/exam/${exam.examId}`}
      className="group flex items-center gap-2 md:gap-3.5 bg-white border border-gray-100 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 hover:border-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Avatar */}
      <div className={`w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
        <span className="text-white font-black text-[10px] md:text-xs tracking-tight">{abbrev}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-snug group-hover:text-indigo-600 transition-colors line-clamp-1">
            {exam.title || exam.name}
          </h3>
          {badge && (
            <span className={`${BADGE_COLORS[badge] || 'bg-gray-400'} text-white text-[8px] md:text-[9px] font-extrabold px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-[10px] md:text-[11px] text-gray-400 mt-0.5 line-clamp-1">
          {exam.fullName || config.label}
        </p>
        <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-1.5">
          {exam.freeTests > 0 && (
            <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-600 text-[9px] md:text-[10px] font-bold px-1 md:px-1.5 py-0.5 rounded">
              ✓ {exam.freeTests} Free
            </span>
          )}
          {exam.vacancies && (
            <span className="bg-blue-50 text-blue-500 text-[9px] md:text-[10px] font-medium px-1 md:px-1.5 py-0.5 rounded">
              {exam.vacancies} seats
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  )
}

// ── Trending card — compact chip ──────────────────────────────────
function TrendingCard({ exam, catConfig, rank }) {
  const config = catConfig || getCatConfig(exam.category || exam.categoryId || '')
  const abbrev = (exam.title || exam.name || 'EX')
    .split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()

  return (
    <Link
      to={`/exam/${exam.examId}`}
      className="group flex-shrink-0 w-36 md:w-44 bg-white border border-gray-100 rounded-xl md:rounded-2xl overflow-hidden hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Gradient top bar */}
      <div className={`h-1 bg-gradient-to-r ${config.color}`} />
      <div className="p-2.5 md:p-3.5">
        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-2.5">
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow`}>
            <span className="text-white font-black text-[9px] md:text-[11px]">{abbrev}</span>
          </div>
          <span className="text-[9px] md:text-[10px] font-black text-gray-300">#{rank}</span>
        </div>
        <p className="font-bold text-gray-900 text-[11px] md:text-sm line-clamp-2 leading-tight md:leading-snug group-hover:text-indigo-600 transition-colors mb-2">
          {exam.title || exam.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[9px] md:text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
            {exam.freeTests ? `${exam.freeTests} Free` : 'Ready'}
          </span>
          <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}

// ── Category card — glassmorphism style ───────────────────────────
function CategoryCard({ category, count, config, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-gray-100 p-5 text-left hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      {/* Blurred gradient blobs */}
      <div className={`absolute -right-6 -bottom-6 w-28 h-28 bg-gradient-to-br ${config.color} opacity-[0.10] rounded-full blur-2xl group-hover:opacity-[0.20] group-hover:scale-110 transition-all duration-500`} />
      <div className={`absolute -left-4 -top-4 w-16 h-16 bg-gradient-to-br ${config.color} opacity-[0.06] rounded-full blur-xl group-hover:opacity-10 transition-all duration-500`} />
      {/* Top accent */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${config.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 text-xl`}>
            {config.icon}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900 leading-none">{count}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">Exams</p>
          </div>
        </div>

        <h3 className="font-extrabold text-gray-900 text-base leading-tight group-hover:text-indigo-700 transition-colors">
          {config.label}
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{config.description}</p>

        <div className="mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200">
          <span className="text-xs font-extrabold text-indigo-600">Browse all</span>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
        </div>
      </div>
    </button>
  )
}

// ── Main Exams Page ───────────────────────────────────────────────
function Exams() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(categoryId || 'all')
  const [activeCategoryModal, setActiveCategoryModal] = useState(null)

  const { data: examCategories = [], isLoading } = useQuery({
    queryKey: ['exam-categories'],
    queryFn: async () => {
      const response = await api.get('/api/exam-categories')
      return response.data.data.filter(cat => cat.id !== 'all') || []
    },
    staleTime: 1000 * 60 * 30,
  })

  const getCatId = useCallback((cat, idx) =>
    cat.slug || cat.categoryId || String(cat.id || cat._id || idx)
  , [])

  const allExams = useMemo(() =>
    examCategories.flatMap((cat, idx) => {
      const catId = getCatId(cat, idx)
      return (cat.exams || []).map(exam => ({
        ...exam,
        category: catId,
        categoryTitle: getCatConfig(cat, idx).label,
      }))
    })
  , [examCategories, getCatId])

  const categoryPills = useMemo(() => {
    const pills = [{ id: 'all', label: 'All', icon: '🌐' }]
    examCategories.forEach((cat, idx) => {
      const id = getCatId(cat, idx)
      const cfg = getCatConfig(cat, idx)
      pills.push({ id, label: cfg.label, icon: cfg.icon })
    })
    return pills
  }, [examCategories, getCatId])

  const categoryCounts = useMemo(() => {
    const counts = {}
    examCategories.forEach((cat, idx) => {
      const id = getCatId(cat, idx)
      counts[id] = (cat.exams || []).length
    })
    return counts
  }, [examCategories, getCatId])

  const filteredExams = useMemo(() => {
    return allExams.filter(exam => {
      const matchCat = selectedCategory === 'all' || exam.category === selectedCategory
      const matchSearch = !searchQuery
        || (exam.title || '').toLowerCase().includes(searchQuery.toLowerCase())
        || (exam.fullName || '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchSearch
    })
  }, [allExams, selectedCategory, searchQuery])

  const trendingExams = useMemo(() =>
    allExams
      .filter(e => e.badge === 'HOT' || e.badge === 'ELITE')
      .slice(0, 5)
      .concat(allExams.slice(0, 5))
      .filter((e, i, arr) => arr.findIndex(x => x.examId === e.examId) === i)
      .slice(0, 6)
  , [allExams])

  const freeMockExams = useMemo(() =>
    allExams.filter(e => (e.freeTests || 0) >= 10).slice(0, 4)
  , [allExams])

  const handleCategoryClick = useCallback((catId) => {
    setSelectedCategory(catId)
    setSearchQuery('')
  }, [])

  const siteStats = useMemo(() => {
    const examsCount = allExams.length
    // Fallback to a calculated average per exam if totalTests/testsCount is missing
    const testsCount = allExams.reduce((sum, e) => sum + (e.totalTests || e.testsCount || 15), 0)
    const freeTestsCount = allExams.reduce((sum, e) => sum + (e.freeTests || 0), 0)
    
    // Format thousands
    const formatK = (num) => num >= 1000 ? `${(num/1000).toFixed(1)}K+` : num
    
    return {
      exams: examsCount > 0 ? examsCount : '0',
      tests: testsCount > 0 ? formatK(testsCount) : '0',
      aspirants: '50L+', // Global platform metric
      free: freeTestsCount > 0 ? freeTestsCount : '0'
    }
  }, [allExams])

  if (isLoading && examCategories.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-gray-500 font-semibold text-sm">Loading exams...</p>
      </div>
    )
  }

  const isFiltered = selectedCategory !== 'all' || searchQuery

  return (
    <div className="min-h-screen bg-[#f6f7fb]">

      {/* ── BREADCRUMB ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <Breadcrumb
            items={[{ label: 'Home', path: '/' }, { label: 'Explore Exams' }]}
          />
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <AnimatedHero
        pageType="exams"
        compact={true}
        title="Explore Govt. Exams"
        subtitle={`Mock tests, PYQs & preparation material for ${siteStats.exams} state & central exams.`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 md:gap-4 w-full">
          {/* Left: Search Bar */}
            <SearchBox 
              placeholder="Search for your exam..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              containerClass="w-full md:max-w-sm lg:max-w-md"
              inputClass="bg-white/10 backdrop-blur-sm border border-white/20 text-white group-focus-within:bg-white group-focus-within:text-gray-900 placeholder-indigo-100/40 group-focus-within:placeholder-gray-400"
              iconColorClass="text-indigo-200 group-focus-within:text-indigo-600"
            />

          {/* Right: Stat Chips */}
          <div className="flex flex-wrap gap-2 md:gap-3 md:justify-end">
            {[
              { label: 'Exams', value: siteStats.exams, icon: <Target className="w-3 h-3 md:w-3.5 md:h-3.5 text-indigo-300" /> },
              { label: 'Tests', value: siteStats.tests, icon: <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 text-yellow-300" /> },
              { label: 'Aspirants', value: siteStats.aspirants, icon: <Users className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-300" /> },
              { label: 'Free Tests', value: siteStats.free, icon: <Star className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300" /> }
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-1.5 md:gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg md:rounded-xl px-2.5 md:px-4 py-1.5 md:py-2 hover:bg-white/10 transition-colors cursor-default">
                {stat.icon}
                <div className="flex flex-col">
                  <span className="text-[10px] md:text-xs font-black text-white leading-tight">{stat.value}</span>
                  <span className="text-[8px] md:text-[10px] font-bold text-indigo-100 uppercase tracking-tighter">{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-12">
        
        {/* ── TRENDING EXAMS (Top standalone section) ── */}
        {!searchQuery && trendingExams.length > 0 && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-red-500" />
                  </span>
                  Trending This Week
                </h2>
                <p className="text-sm text-gray-500 mt-1 ml-10">Top picks by thousands of students daily</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {trendingExams.map((exam, idx) => (
                <TrendingCard
                  key={exam.examId}
                  exam={exam}
                  rank={idx + 1}
                  catConfig={getCatConfig(exam.category || exam.categoryId || '')}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── TOP CATEGORIES GRID (Pop-up Trigger) ── */}
        {!searchQuery && examCategories.length > 0 && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </span>
                  Quick Category Explore
                </h2>
                <p className="text-sm text-gray-500 mt-1 ml-10">Select a stream to see top exams and details</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {examCategories.map((cat, index) => {
                const catId = getCatId(cat, index)
                const cfg = getCatConfig(cat, index)
                const count = categoryCounts[catId] || 0
                if (count === 0) return null

                return (
                  <button
                    key={catId}
                    onClick={() => setActiveCategoryModal({ id: catId, ...cfg })}
                    className="group flex flex-col items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center text-xl shadow-md group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                      {cfg.icon}
                    </div>
                    <div className="text-center">
                      <p className="font-black text-gray-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors uppercase">{cfg.label}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-tighter">{count} Exams</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── EXPLORE BY CATEGORY SECTION (Two Columns) ── */}
        <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col lg:flex-row">
            
            {/* Left Column: Category Sidebar */}
            <div className="lg:w-56 flex-shrink-0 lg:border-r lg:border-gray-100 lg:pr-10">
              <div className="mb-5">
                <h2 className="text-base font-black text-gray-900 mb-1.5">Explore by Categories</h2>
                <div className="h-0.5 w-8 bg-indigo-500 rounded-full" />
              </div>

              <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-3 lg:pb-0 scrollbar-hide">
                {categoryPills.map(pill => (
                  <button
                    key={pill.id}
                    onClick={() => handleCategoryClick(pill.id)}
                    className={`flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-lg md:rounded-xl text-xs font-bold transition-all duration-300 group relative ${
                      selectedCategory === pill.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 lg:-mr-[41px] z-10'
                        : 'bg-transparent text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm md:text-base transform group-hover:scale-110 transition-transform duration-300">{pill.icon}</span>
                    <span className="whitespace-nowrap flex-1 text-left">{pill.label}</span>
                    <ArrowRight className={`w-3 h-3 transition-opacity ${selectedCategory === pill.id ? 'opacity-100' : 'opacity-0'} hidden md:block`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Dynamic Exam Cards */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    {filteredExams.length} Exams Found
                  </p>
                </div>
              </div>

              {/* Cards Grid with key-based re-animation */}
              <div 
                key={selectedCategory} 
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-5 animate-slide-in-up"
                style={{ animationDuration: '0.4s' }}
              >
                {filteredExams.length > 0 ? (
                  filteredExams.map(exam => (
                    <ExamCard
                      key={exam.examId}
                      exam={exam}
                      catConfig={getCatConfig(exam.category || exam.categoryId || '')}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                    <p className="text-4xl mb-4">🔎</p>
                    <p className="font-bold text-gray-500">No exams found in this category.</p>
                    <button 
                      onClick={() => handleCategoryClick('all')}
                      className="mt-4 text-indigo-600 font-bold hover:underline"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Free Mock Banner (Standalone) */}
        {!searchQuery && (
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl md:rounded-[2.5rem] p-6 md:p-12 text-white">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/10 blur-[100px]" />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="flex-1 text-center md:text-left">
                <span className="inline-block px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2 md:mb-4">
                  Free Forever
                </span>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black mb-2 md:mb-4 leading-tight">Practice mocks without spending a single rupee.</h2>
                <p className="text-indigo-200/70 text-xs md:text-sm max-w-xl mb-5 md:mb-8">Get access to 10K+ verified questions under the most realistic test interface in the industry.</p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <Link to="/test-series" className="px-5 md:px-8 py-2 md:py-3.5 bg-white text-indigo-950 text-xs md:text-sm font-black rounded-xl md:rounded-2xl hover:bg-indigo-50 transition-all shadow-xl shadow-black/20">
                    Get Started Now
                  </Link>
                  <Link to="/study" className="px-5 md:px-8 py-2 md:py-3.5 bg-white/10 border border-white/20 text-white text-xs md:text-sm font-black rounded-xl md:rounded-2xl hover:bg-white/20 transition-all">
                    Explore Materials
                  </Link>
                </div>
              </div>
              <div className="w-20 h-20 md:w-40 lg:w-56 md:h-40 lg:h-56 bg-indigo-500/20 rounded-full flex items-center justify-center p-4 md:p-8 backdrop-blur-2xl border border-white/10 shadow-2xl animate-pulse">
                <div className="text-3xl md:text-6xl lg:text-7xl">🎁</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12 flex flex-col gap-12">

        {/* ── DAILY PRACTICE ── */}
        {!searchQuery && (
          <section>
            <h2 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-orange-500" />
              </span>
              Daily Practice
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['🧠', 'Daily Quiz', '10 Qs • 5 min', 'from-blue-500 to-indigo-600', '/quiz'],
                ['📰', 'Current Affairs', 'March 2025', 'from-orange-500 to-red-500', '/current-affairs'],
                ['🔥', 'Streak Challenge', 'Keep it going!', 'from-pink-500 to-rose-600', '/challenge'],
                ['🏆', 'Live Test', 'Today 7 PM', 'from-purple-600 to-violet-700', '/test-series'],
              ].map(([ic, t, s, g, path]) => (
                <Link
                  key={t}
                  to={path}
                  className={`relative overflow-hidden bg-gradient-to-br ${g} text-white rounded-2xl p-4 hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-sm`}
                >
                  <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full" />
                  <p className="text-2xl mb-2 relative z-10">{ic}</p>
                  <p className="font-extrabold text-xs relative z-10">{t}</p>
                  <p className="text-white/60 text-[10px] mt-0.5 relative z-10">{s}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── WHY TRSTPREP ─────────────────────────────────────────── */}
        {!searchQuery && (
          <section>
            <h2 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-500" />
              </span>
              Why TrstPrep?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['🎯', 'Topic-Centric Learning', 'Study by topic with linked notes, videos & quizzes'],
                ['🔗', 'Smart Weak Area Engine', 'AI identifies your gaps after every test'],
                ['📅', 'Deep PYQ Archive', 'Chapter-wise PYQs going back 10 years'],
                ['📱', 'Mobile First', 'Full prep experience on any screen size'],
              ].map(([ic, t, d]) => (
                <div key={t} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <p className="text-2xl mb-2">{ic}</p>
                  <p className="font-extrabold text-gray-800 text-xs mb-1">{t}</p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
        {!user && !searchQuery && (
          <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-7 text-white text-center">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <p className="text-xl font-extrabold mb-1">Can't find your exam?</p>
              <p className="text-indigo-200 text-sm mb-5">We add new exams every week. Sign up and request yours.</p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-white text-indigo-700 font-extrabold px-6 py-2.5 rounded-xl text-sm hover:bg-indigo-50 transition"
              >
                Sign Up & Request <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      <div id="main-explorer" />

      {/* ── CATEGORY DETAIL MODAL (Pop-out) ── */}
      {activeCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" 
            onClick={() => setActiveCategoryModal(null)}
          />
          <div 
            className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`h-32 md:h-40 bg-gradient-to-br ${activeCategoryModal.color} relative overflow-hidden flex-shrink-0`}>
              <div className="absolute top-4 right-4 z-50">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveCategoryModal(null);
                  }}
                  className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all duration-200"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-black/20 to-transparent">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-3xl">
                    {activeCategoryModal.icon}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white">{activeCategoryModal.label} Exams</h2>
                    <p className="text-white/80 text-sm font-medium">{activeCategoryModal.description || `Prepare for top ${activeCategoryModal.label} competitive exams.`}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Content - Exam List */}
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Available Exams ({categoryCounts[activeCategoryModal.id]})</h3>
                <span className="w-12 h-1 bg-gray-100 rounded-full" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allExams
                  .filter(e => e.category === activeCategoryModal.id)
                  .map(exam => (
                    <ExamCard 
                      key={exam.examId} 
                      exam={{...exam, category: activeCategoryModal.id}} 
                      catConfig={activeCategoryModal} 
                    />
                  ))
                }
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
              <p className="text-xs text-gray-500 font-medium italic">Click on an exam to view test series & materials</p>
              <button 
                onClick={() => {
                  handleCategoryClick(activeCategoryModal.id)
                  setActiveCategoryModal(null)
                  const el = document.getElementById('main-explorer')
                  if(el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
              >
                Go to Full Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Exams
