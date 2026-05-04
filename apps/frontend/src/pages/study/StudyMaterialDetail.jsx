import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getStudyMaterialById } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import VideoPlayer from '../../shared/components/common/VideoPlayer'
import PDFViewer from '../../shared/components/common/PDFViewer'
import ContentReader from '../../shared/components/common/ContentReader'
import { getChapterPath, getChapterIdentifier } from './studyMaterialUtils'
import { 
  Play, FileText, ChevronDown, ChevronRight, Lock, CheckCircle,
  Clock, BookOpen, Video, Download, BarChartBig, Brain, Globe, Package
} from 'lucide-react'

function formatVideoDuration(v) {
  const raw = v?.duration ?? v?.videoDuration
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw === 'number') {
    if (raw <= 0) return null
    return `${raw} min`
  }
  const s = String(raw).trim()
  if (!s || s === '0') return null
  return s
}

function formatPdfPages(p) {
  const n = p?.pages ?? p?.pageCount
  if (n === undefined || n === null || n === '') return null
  if (typeof n === 'number' && n <= 0) return null
  const num = Number(n)
  if (!Number.isNaN(num) && num === 1) return '1 page'
  if (!Number.isNaN(num)) return `${num} pages`
  return String(n)
}

function formatTestMeta(t) {
  const d = t?.duration ?? t?.durationMinutes ?? t?.timeLimit
  if (d === undefined || d === null || d === '') return null
  if (typeof d === 'number') return `${d} min`
  const s = String(d).trim()
  return s || null
}

function StudyMaterialDetail() {
  const { subjectId } = useParams()
  const [subject, setSubject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedChapter, setExpandedChapter] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [viewMode, setViewMode] = useState('hierarchy')
  const [collapsedParts, setCollapsedParts] = useState([])
  const [collapsedUnits, setCollapsedUnits] = useState(() => new Set())
  const [isViewModeMenuOpen, setIsViewModeMenuOpen] = useState(false)
  
  // Viewer states
  const [videoPlayer, setVideoPlayer] = useState({ isOpen: false, data: null })
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, data: null })
  const [contentReader, setContentReader] = useState({ isOpen: false, data: null })

  // Fetch subject data
  useEffect(() => {
    const fetchSubject = async () => {
      try {
        const subjectData = await getStudyMaterialById(subjectId)
        setSubject(subjectData)
      } catch (error) {
        console.error('Failed to fetch subject:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSubject()
  }, [subjectId])

  useEffect(() => {
    if (!subject?.parts?.length) {
      setCollapsedParts([])
      setCollapsedUnits(new Set())
      return
    }
    // Open all sections and units by default
    setCollapsedParts([])
    setCollapsedUnits(new Set())
  }, [subject])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px]">Assembling Curriculum...</p>
        </div>
      </div>
    )
  }

  // Not found state
  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Subject Not Found</h1>
          <Link to="/study" className="text-brand-start hover:underline">
            Back to Study Materials
          </Link>
        </div>
      </div>
    )
  }

  const chaptersFromParts = subject.parts?.flatMap(part => part.units?.flatMap(unit => unit.chapters || []) || []) || []
  // IDs of all chapters already in the parts hierarchy
  const chapterIdsInParts = new Set(chaptersFromParts.map(c => String(c.id ?? c._id)))
  // Extra chapters from subject.chapters not already in the parts (e.g. admin-created, synthetic "General")
  const extraChapters = (subject.chapters || []).filter(c => !chapterIdsInParts.has(String(c.id ?? c._id)))
  const chaptersList = chaptersFromParts.length > 0
    ? [...chaptersFromParts, ...extraChapters]
    : (subject.chapters || [])

  const totalVideos = chaptersList.reduce((acc, c) => acc + (c.videoCount || c.videosList?.length || c.videos?.length || 0), 0)
  const totalNotes = chaptersList.reduce((acc, c) => acc + (c.pdfCount || c.pdfsList?.length || c.pdfs?.length || 0), 0)
  const totalTests = chaptersList.reduce((acc, c) => acc + (c.testCount || c.testsCount || c.testsList?.length || c.tests?.length || 0), 0)

  const totalChapters = chaptersList.length
  const totalTopics = chaptersList.reduce((acc, c) => acc + (c.topicCount || c.topics?.length || 0), 0)

  const tabs = [
    { id: 'all', label: 'All', count: totalChapters },
    { id: 'videos', label: 'Videos', count: subject.videos || totalVideos },
    { id: 'notes', label: 'Notes', count: subject.pdf || totalNotes },
    { id: 'tests', label: 'Tests', count: subject.tests || totalTests },
  ]

  const renderChapterItems = (chapter) => {
    const videoItems = (chapter.videosList || chapter.videos || []).filter(Boolean)
    const pdfItems = (chapter.pdfsList || chapter.pdfs || []).filter(Boolean)
    const testItems = (chapter.testsList || chapter.tests || []).filter(Boolean)

    return (
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(activeTab === 'all' || activeTab === 'videos') && (videoItems.length > 0 ? videoItems.map((vid, idx) => {
          const durLabel = formatVideoDuration(vid)
          return (
          <button key={`v-${idx}`} onClick={() => handleVideoClick(vid)} className="flex items-center gap-3 p-3 bg-blue-50/30 rounded-xl border border-blue-50 hover:border-blue-200 transition-colors">
            <Play className="w-4 h-4 text-blue-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">{vid.title || vid.name || 'Video Lecture'}</p>
              {durLabel && (
                <p className="text-[10px] font-bold text-blue-600">{durLabel}</p>
              )}
            </div>
          </button>
        )}) : (activeTab === 'all' || activeTab === 'videos') && <div className="col-span-full text-center text-gray-400 text-xs italic">No videos available.</div>)}

        {(activeTab === 'all' || activeTab === 'notes') && (pdfItems.length > 0 ? pdfItems.map((pdf, idx) => {
          const pagesLabel = formatPdfPages(pdf)
          return (
          <button key={`p-${idx}`} onClick={() => handlePDFClick(pdf)} className="flex items-center gap-3 p-3 bg-green-50/30 rounded-xl border border-green-50 hover:border-green-200 transition-colors">
            <FileText className="w-4 h-4 text-green-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">{pdf.title || pdf.name || 'Study Notes'}</p>
              {pagesLabel && (
                <p className="text-[10px] font-bold text-green-600">{pagesLabel}</p>
              )}
            </div>
          </button>
        )}) : (activeTab === 'all' || activeTab === 'notes') && <div className="col-span-full text-center text-gray-400 text-xs italic">No notes available.</div>)}

        {(activeTab === 'all' || activeTab === 'tests') && (testItems.length > 0 ? testItems.map((test, idx) => {
          const testMeta = formatTestMeta(test)
          return (
          <Link key={`t-${idx}`} to={`/test/${test.testId || test.id}`} className="flex items-center gap-3 p-3 bg-purple-50/30 rounded-xl border border-purple-50 hover:border-purple-200 transition-colors">
            <BarChartBig className="w-4 h-4 text-purple-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">{test.title || test.name || `Test ${idx + 1}`}</p>
              {testMeta && (
                <p className="text-[10px] font-bold text-purple-600">{testMeta}</p>
              )}
            </div>
          </Link>
        )}) : (activeTab === 'all' || activeTab === 'tests') && <div className="col-span-full text-center text-gray-400 text-xs italic">No tests available.</div>)}
      </div>
    )
  }

  // Handler functions for opening viewers
  const handleVideoClick = (videoData) => {
    setVideoPlayer({ 
      isOpen: true, 
      data: {
        title: videoData.title || videoData.name || 'Educational Video',
        description: videoData.description || '',
        url: videoData.videoUrl || videoData.url || ''
      }
    })
  }

  const handlePDFClick = (pdfData) => {
    setPdfViewer({ 
      isOpen: true, 
      data: {
        title: pdfData.title || pdfData.name || 'Study Material PDF',
        description: pdfData.description || '',
        url: pdfData.pdfUrl || pdfData.url || '',
        fileName: pdfData.fileName || pdfData.title || 'document.pdf',
        totalPages: pdfData.totalPages ?? pdfData.pages ?? 0
      }
    })
  }

  const handleContentClick = (contentData) => {
    setContentReader({ 
      isOpen: true, 
      data: {
        title: contentData.title || 'Study Notes',
        category: contentData.category || 'Study Material',
        author: contentData.author || 'Trstprep Team',
        date: contentData.date || new Date().toISOString(),
        readTime: contentData.readTime || 5,
        content: contentData.htmlContent || contentData.content || '<div class="flex flex-col items-center justify-center py-20 text-center"><div class="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4"><span class="text-3xl">📄</span></div><h3 class="text-xl font-bold text-gray-900 mb-2">Content Loading...</h3><p class="text-gray-500 max-w-xs">We are preparing these detailed notes for you. Check back shortly!</p></div>',
        tags: contentData.tags || [],
        featuredImage: contentData.featuredImage
      }
    })
  }

  const togglePart = (pIdx) => {
    setCollapsedParts(prev => 
      prev.includes(pIdx) ? prev.filter(i => i !== pIdx) : [...prev, pIdx]
    )
  }

  const unitKey = (part, unit, pIdx, uIdx) => `${part.id ?? `p${pIdx}`}-${unit.id ?? `u${uIdx}`}`

  const toggleUnit = (key) => {
    setCollapsedUnits((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb 
            items={[
              { label: 'Home', path: '/' },
              { label: 'Study Materials', path: '/study' },
              ...(subject.subjectGroup ? [{ label: subject.subjectGroup, path: '/study' }] : []),
              { label: subject.title || subject.name }
            ]}
          />
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 text-white pb-6 pt-8 md:pb-10 md:pt-12">
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] bg-pink-500/20 rounded-full blur-3xl mix-blend-screen opacity-50"></div>
           <div className="absolute top-40 -left-20 w-[20rem] h-[20rem] bg-blue-500/30 rounded-full blur-3xl mix-blend-screen opacity-40"></div>
           <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 animate-slide-in-up">
          <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-8 justify-between">
            <div className="flex items-center md:items-start gap-4 md:gap-6">
              <div className={`w-16 h-16 md:w-28 md:h-28 rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl flex-shrink-0 group hover:bg-white/20 transition-all`}>
                {subject.icon === 'bar-chart-2' && <BarChartBig className="w-8 h-8 md:w-14 md:h-14 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />}
                {subject.icon === 'brain' && <Brain className="w-8 h-8 md:w-14 md:h-14 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />}
                {subject.icon === 'book-open' && <BookOpen className="w-8 h-8 md:w-14 md:h-14 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />}
                {subject.icon === 'globe' && <Globe className="w-8 h-8 md:w-14 md:h-14 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />}
                {!subject.icon && <BookOpen className="w-8 h-8 md:w-14 md:h-14 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-[10px] md:text-xs font-bold mb-2 md:mb-3 shadow-sm uppercase tracking-wider text-amber-300">
                   <BookOpen className="w-3 h-3 md:w-3.5 md:h-3.5" />
                   Study Material
                </div>
                <h1 className="text-2xl md:text-5xl font-black text-white leading-tight mb-2 md:mb-3 tracking-tight truncate md:whitespace-normal">{subject.title}</h1>
                {subject.description && (
                  <p className="text-sm md:text-base text-white/70 mb-4 max-w-3xl">{subject.description}</p>
                )}

                {/* Subject Progress Bar */}
                <div className="mb-4 max-w-md">
                   <div className="flex items-center justify-between mb-1.5">
                     <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Overall Progress</p>
                     <span className="text-[10px] font-black text-cyan-400">{Math.round(((subject.chapters?.filter(c => c.isCompleted)?.length || 0) / (subject.chapters?.length || 1)) * 100)}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                     <div 
                       className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-full transition-all duration-1000"
                       style={{ width: `${Math.round(((subject.chapters?.filter(c => c.isCompleted)?.length || 0) / (subject.chapters?.length || 1)) * 100)}%` }}
                     />
                   </div>
                </div>

                <p className="text-white/80 font-medium text-xs md:text-lg flex flex-wrap items-center gap-2 md:gap-3">
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/60" /> {totalTopics} Topics</span>
                  <span className="text-white/30">•</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/60" /> {totalChapters} Chapters</span>
                  <span className="text-white/30">•</span>
                  <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/60" /> {subject.videos || totalVideos} Videos</span>
                </p>
              </div>
            </div>

            {/* Hero Stats Badges */}
            <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-1 md:pb-0">{[
              { key: 'videos', icon: Video, color: 'blue', count: subject.videos || totalVideos, label: 'Videos' },
              { key: 'notes', icon: FileText, color: 'green', count: subject.pdf || totalNotes, label: 'Notes' },
              { key: 'tests', icon: BookOpen, color: 'purple', count: subject.tests || totalTests, label: 'Tests' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <button
                  key={stat.key}
                  onClick={() => setActiveTab(stat.key)}
                  className={`flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border shadow-sm hover:bg-white/20 transition-all shrink-0 ${activeTab === stat.key ? `border-${stat.color}-400 bg-${stat.color}-500/20` : 'border-white/10'}`}
                >
                  <Icon className={`w-4 h-4 text-${stat.color}-300`} />
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white">{stat.count}</span>
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider hidden xs:inline">{stat.label}</span>
                  </div>
                </button>
              );
            })}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-6 min-h-screen bg-gray-50">
        {/* Filters & View Toggles */}
        <div className="flex flex-col gap-4 mb-8">
           {/* Section 1: Content Tabs */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between p-1.5 gap-2 relative">
              <div className="flex bg-gray-50 rounded-xl p-1 overflow-x-auto scrollbar-hide flex-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 sm:px-4 sm:py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${
                      activeTab === tab.id 
                        ? 'bg-white text-brand-start shadow-sm ring-1 ring-gray-100' 
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab.label === 'All' && <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    {tab.label === 'Videos' && <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    {tab.label === 'Notes' && <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    {tab.label === 'Tests' && <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    <span className="truncate">{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] ${
                      activeTab === tab.id ? 'bg-brand-light text-brand-start' : 'bg-gray-200 text-gray-500 font-black'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* View Mode Dropdown - Integrated with Tabs (As per Mobile Request) */}
              <div className="relative">
                <button 
                  onClick={() => setIsViewModeMenuOpen(!isViewModeMenuOpen)}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all shadow-sm border h-full ${
                    isViewModeMenuOpen 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-white'
                  }`}
                  title="Change Layout"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest hidden xs:block">
                    {viewMode === 'hierarchy' ? '🏗️ Structure' : '📋 List All'}
                  </span>
                  <span className="xs:hidden">
                    {viewMode === 'hierarchy' ? '🏗️' : '📋'}
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isViewModeMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isViewModeMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsViewModeMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in duration-200">
                      <div className="px-4 py-1 mb-1 border-b border-gray-50">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Layout Mode</span>
                      </div>
                      <button 
                        onClick={() => { setViewMode('hierarchy'); setIsViewModeMenuOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black transition-colors text-left ${viewMode === 'hierarchy' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Brain className={`w-4 h-4 ${viewMode === 'hierarchy' ? 'text-indigo-600' : 'text-gray-400'}`} /> 🏗️ Structure
                      </button>
                      <button 
                        onClick={() => { setViewMode('flat'); setIsViewModeMenuOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black transition-colors text-left ${viewMode === 'flat' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Package className={`w-4 h-4 ${viewMode === 'flat' ? 'text-indigo-600' : 'text-gray-400'}`} /> 📋 List All
                      </button>
                    </div>
                  </>
                )}
              </div>
           </div>
        </div>

        {/* Hierarchy View (Parts -> Units -> Chapters) */}
        {viewMode === 'hierarchy' && (
          <div className="space-y-8 pt-2">
            {subject.parts?.map((part, pIdx) => {
              const isCollapsed = collapsedParts.includes(pIdx);
              
              // Content tabs now only filter inside the chapter, not the chapter itself
              const filteredUnits = part.units?.map(unit => {
                return { ...unit, chapters: unit.chapters };
              }).filter(unit => unit.chapters && unit.chapters.length > 0);

              if (filteredUnits?.length === 0) return null;

              return (
                <div key={part.id || pIdx} className="animate-slide-in-up" style={{ animationDelay: `${pIdx * 0.1}s` }}>
                  {/* Part Header */}
                  <button 
                    onClick={() => togglePart(pIdx)}
                    className="w-full flex items-center justify-between mb-4 group/part"
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="h-6 md:h-8 w-1 md:w-1.5 bg-brand-start rounded-full"></div>
                      <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        {part.name}
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                          {['General Science', 'General Awareness', 'General Studies', 'GS'].some(term => subject.title?.includes(term)) ? 'Subject' : 'Section'}
                        </span>
                      </h2>
                    </div>
                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center transition-all group-hover/part:border-brand-start ${isCollapsed ? '' : 'rotate-180'}`}>
                      <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 group-hover/part:text-brand-start" />
                    </div>
                  </button>

                  {/* Units List (Conditional Rendering) */}
                  {!isCollapsed && (
                    <div className="space-y-6 animate-fade-in">
                      {filteredUnits?.map((unit, uIdx) => {
                        const uKey = unitKey(part, unit, pIdx, uIdx)
                        const isUnitCollapsed = collapsedUnits.has(uKey)
                        const unitTitle = unit.name !== part.name ? unit.name : 'Chapters'
                        return (
                        <div key={unit.id || uIdx} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleUnit(uKey)}
                            className="w-full bg-gray-50/50 px-4 py-2.5 md:px-5 md:py-3 border-b border-gray-100 flex items-center justify-between text-left hover:bg-gray-100/80 transition-colors"
                          >
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                              <Package className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500 shrink-0" />
                              <h3 className="text-[11px] md:text-sm font-bold text-indigo-900 uppercase tracking-widest truncate">{unitTitle}</h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[9px] md:text-[10px] font-black text-gray-400 bg-white px-2 py-0.5 md:py-1 rounded-md border border-gray-100">
                                {unit.chapters?.length || 0} CH
                              </span>
                              <div className={`w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center transition-transform ${isUnitCollapsed ? '' : 'rotate-180'}`}>
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              </div>
                            </div>
                          </button>

                      {/* Chapters in this Unit */}
                      {!isUnitCollapsed && (
                      <div className="divide-y divide-gray-50">
                        {unit.chapters?.map((chapter, cIdx) => {
                          const chapterIdentifier = getChapterIdentifier(chapter, unit.chapters, cIdx);
                          const globalIdx = `h-${pIdx}-${uIdx}-${chapterIdentifier}`;
                          const isExpanded = expandedChapter === globalIdx || activeTab !== 'all';
                          const progress = typeof chapter.progress === "number" ? chapter.progress : null;

                          return (
                            <div key={chapterIdentifier} className={`transition-all duration-300 ${isExpanded ? 'bg-indigo-50/10' : ''}`}>
                              {/* Chapter Row */}
                              <div className="w-full flex items-center justify-between hover:bg-gray-50/30 transition relative group">
                                <Link
                                  to={getChapterPath(subjectId, chapter, unit.chapters, cIdx)}
                                  className="flex flex-1 items-center gap-3 md:gap-4 min-w-0 p-3.5 md:p-5"
                                >
                                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center font-black text-xs md:text-sm transition-all shadow-sm ${isExpanded ? 'bg-brand-start text-white scale-110 rotate-3' : 'bg-white text-gray-400 border border-gray-100 group-hover:border-brand-start group-hover:text-brand-start'}`}>
                                    {cIdx + 1}
                                  </div>
                                  <div className="text-left min-w-0">
                                    <h4 className={`font-bold text-sm md:text-base transition-colors truncate ${isExpanded ? 'text-brand-start' : 'text-gray-900'}`}>
                                      {chapter.title || chapter.name}
                                    </h4>
                                    <div className="flex items-center gap-2 md:gap-3 mt-0.5 md:mt-1">
                                      <span className="text-[9px] md:text-[10px] font-bold text-gray-500 flex items-center gap-1 uppercase tracking-tighter">
                                        <Play className="w-2.5 h-2.5" /> {chapter.videoCount || 0} Videos
                                      </span>
                                      <span className="text-[9px] md:text-[10px] font-bold text-gray-500 flex items-center gap-1 uppercase tracking-tighter">
                                        <FileText className="w-2.5 h-2.5" /> {chapter.pdfCount || 0} Notes
                                      </span>
                                    </div>
                                  </div>
                                </Link>

                                <div className="flex items-center gap-2 md:gap-3 pr-3.5 md:pr-5">
                                  {progress !== null && (
                                    <div className="hidden sm:flex items-center gap-2 w-16 md:w-20 shrink-0">
                                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
                                      </div>
                                      <span className="text-[9px] md:text-[10px] font-bold text-green-600">{progress}%</span>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedChapter(isExpanded ? (activeTab === 'all' ? null : expandedChapter) : globalIdx)}
                                    className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-brand-start text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}
                                    aria-label={isExpanded ? 'Collapse chapter preview' : 'Expand chapter preview'}
                                  >
                                    <ChevronDown className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>

                              {/* Chapter Expansion */}
                              {isExpanded && (
                                <div className="px-5 pb-5 animate-fade-in">
                                  <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-inner">
                                    {/* Topics covered */}
                                    {chapter.topics && chapter.topics.length > 0 && (
                                      <div className="mb-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Structure</p>
                                        <div className="flex flex-wrap gap-2">
                                          {chapter.topics.map((topic, tIdx) => (
                                            <span key={topic.id || tIdx} className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg border border-gray-100">
                                              {topic.name || topic.title}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Content Grid (Filtered by Active Tab) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {(activeTab === 'all' || activeTab === 'videos') && chapter.videosList?.map((vid, idx) => {
                                        const dur = formatVideoDuration(vid)
                                        return (
                                        <button key={idx} onClick={() => handleVideoClick(vid)} className="flex items-center gap-3 p-3 bg-blue-50/30 rounded-xl border border-blue-50 hover:border-blue-200 transition-all group/item">
                                          <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm group-hover/item:scale-110 transition-transform">
                                            <Play className="w-4 h-4 fill-current" />
                                          </div>
                                          <div className="text-left min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">{vid.title || vid.name}</p>
                                            {dur && (
                                              <p className="text-[10px] font-bold text-blue-600 uppercase tabular-nums">{dur}</p>
                                            )}
                                          </div>
                                        </button>
                                      )})}
                                      {(activeTab === 'all' || activeTab === 'notes') && chapter.pdfsList?.map((pdf, idx) => {
                                        const pages = formatPdfPages(pdf)
                                        return (
                                        <button key={idx} onClick={() => handlePDFClick(pdf)} className="flex items-center gap-3 p-3 bg-green-50/30 rounded-xl border border-green-50 hover:border-green-200 transition-all group/item">
                                          <div className="p-2 bg-white rounded-lg text-green-600 shadow-sm group-hover/item:scale-110 transition-transform">
                                            <FileText className="w-4 h-4" />
                                          </div>
                                          <div className="text-left min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">{pdf.title || pdf.name}</p>
                                            {pages && (
                                              <p className="text-[10px] font-bold text-green-600 uppercase">{pages}</p>
                                            )}
                                          </div>
                                        </button>
                                      )})}
                                      {(activeTab === 'all' || activeTab === 'tests') && chapter.testsList?.map((test, idx) => {
                                        const tmeta = formatTestMeta(test)
                                        return (
                                        <Link key={idx} to={`/test/${test.testId || test.id}`} className="flex items-center gap-3 p-3 bg-purple-50/30 rounded-xl border border-purple-50 hover:border-purple-200 transition-all group/item">
                                          <div className="p-2 bg-white rounded-lg text-purple-600 shadow-sm group-hover/item:scale-110 transition-transform">
                                            <BarChartBig className="w-4 h-4" />
                                          </div>
                                          <div className="text-left min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">{test.title || test.name || `Practice test ${idx + 1}`}</p>
                                            {tmeta && (
                                              <p className="text-[10px] font-bold text-purple-600 uppercase">{tmeta}</p>
                                            )}
                                          </div>
                                        </Link>
                                      )})}

                                      {/* Empty state for filtered tab */}
                                      {activeTab === 'videos' && (!chapter.videosList || chapter.videosList.length === 0) && (
                                        <div className="col-span-full py-4 text-center text-gray-400 text-xs italic">No videos in this chapter</div>
                                      )}
                                      {activeTab === 'notes' && (!chapter.pdfsList || chapter.pdfsList.length === 0) && (
                                        <div className="col-span-full py-4 text-center text-gray-400 text-xs italic">No notes in this chapter</div>
                                      )}
                                      {activeTab === 'tests' && (!chapter.testsList || chapter.testsList.length === 0) && (
                                        <div className="col-span-full py-4 text-center text-gray-400 text-xs italic">No tests in this chapter</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      )}
                    </div>
                      )
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Extra chapters from subject.chapters not in the parts hierarchy (e.g. admin-created or synthetic "General") */}
            {extraChapters.length > 0 && (
              <div className="space-y-4 mt-8">
                {extraChapters.map((chapter, index) => {
                  const chapterId = chapter.id ?? chapter._id ?? `extra-${index}`
                  const globalIdx = `extra-${chapterId}`
                  const isExpanded = expandedChapter === globalIdx || activeTab !== 'all'
                  return (
                    <div key={chapterId} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isExpanded ? 'border-indigo-200' : 'border-gray-100'}`}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                        onClick={() => setExpandedChapter(isExpanded && activeTab === 'all' ? null : globalIdx)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-bold text-sm ${isExpanded ? 'text-indigo-600' : 'text-gray-900'}`}>{chapter.title || chapter.name}</h4>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                <Video className="w-2.5 h-2.5" /> {chapter.videoCount || 0} Videos
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                <FileText className="w-2.5 h-2.5" /> {chapter.pdfCount || 0} Notes
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5 animate-fade-in">
                          <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-inner">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {(activeTab === 'all' || activeTab === 'videos') && chapter.videosList?.map((vid, idx) => {
                                const dur = formatVideoDuration(vid)
                                return (
                                <button key={idx} onClick={() => handleVideoClick(vid)} className="flex items-center gap-3 p-3 bg-blue-50/30 rounded-xl border border-blue-50 hover:border-blue-200 transition-all group/item">
                                  <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm group-hover/item:scale-110 transition-transform">
                                    <Play className="w-4 h-4 fill-current" />
                                  </div>
                                  <div className="text-left min-w-0">
                                    <p className="text-xs font-bold text-gray-900 truncate">{vid.title || vid.name}</p>
                                    {dur && <p className="text-[10px] font-bold text-blue-600 uppercase tabular-nums">{dur}</p>}
                                  </div>
                                </button>
                              )})}
                              {(activeTab === 'all' || activeTab === 'notes') && chapter.pdfsList?.map((pdf, idx) => {
                                const pages = formatPdfPages(pdf)
                                return (
                                <button key={idx} onClick={() => handlePDFClick(pdf)} className="flex items-center gap-3 p-3 bg-green-50/30 rounded-xl border border-green-50 hover:border-green-200 transition-all group/item">
                                  <div className="p-2 bg-white rounded-lg text-green-600 shadow-sm group-hover/item:scale-110 transition-transform">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="text-left min-w-0">
                                    <p className="text-xs font-bold text-gray-900 truncate">{pdf.title || pdf.name}</p>
                                    {pages && <p className="text-[10px] font-bold text-green-600 uppercase">{pages}</p>}
                                  </div>
                                </button>
                              )})}
                              {(activeTab === 'all' || activeTab === 'notes') && (!chapter.pdfsList || chapter.pdfsList.length === 0) && (!chapter.videosList || chapter.videosList.length === 0) && (
                                <div className="col-span-full py-4 text-center text-gray-400 text-xs italic">No content in this chapter yet</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Fallback for legacy subjects (no subject.parts) */}
            {(!subject.parts || subject.parts.length === 0) && chaptersList.length > 0 && (
              <div className="space-y-4">
                {chaptersList.map((chapter, index) => {
                  const chapterIdentifier = getChapterIdentifier(chapter, chaptersList, index)
                  const chapterAndProgress = chapter.progress || (chapter.isCompleted ? 100 : 0)

                  return (
                    <div key={chapterIdentifier} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-brand-start/40 hover:shadow-md transition-all">
                      <Link
                        to={getChapterPath(subjectId, chapter, chaptersList, index)}
                        className="block px-4 py-4 sm:px-5 sm:py-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-gray-900 text-base sm:text-lg">{chapter.title || chapter.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">{chapter.description || chapter.desc || 'No chapter summary available.'}</p>
                          </div>
                          <span className="text-[10px] uppercase font-black tracking-wider text-gray-500">{chapterAndProgress}%</span>
                        </div>
                      </Link>
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                        {chapter.topics && chapter.topics.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Topics</p>
                            <div className="flex flex-wrap gap-2">
                              {chapter.topics.map((topic, tIdx) => (
                                <span key={topic.id || tIdx} className="px-2 py-1 rounded-lg bg-gray-50 text-xs font-semibold text-gray-600 border border-gray-100">
                                  {topic.title || topic.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {renderChapterItems(chapter)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Flat List View */}
        {viewMode === 'flat' && (
          <div className="space-y-3 pt-2">
             <div className="bg-indigo-900 p-4 rounded-2xl text-white mb-6">
                <h3 className="font-bold">Total Curriculum</h3>
                <p className="text-xs text-indigo-200">Browsing all modules matching your filter</p>
             </div>
             
             {chaptersList.map((chapter, index) => {
                const chapterIdentifier = getChapterIdentifier(chapter, chaptersList, index);
                const globalIdx = `f-${chapterIdentifier}`;
                const isExpanded = expandedChapter === globalIdx || activeTab !== 'all';
                const progress = typeof chapter.progress === "number" ? chapter.progress : null;

                return (
                  <div key={chapterIdentifier} className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-gray-200'}`}>
                    <div className="w-full flex items-center justify-between hover:bg-gray-50/10 transition relative group">
                      <Link
                        to={getChapterPath(subjectId, chapter, chaptersList, index)}
                        className="flex flex-1 items-center gap-4 min-w-0 p-4 md:p-5"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm ${isExpanded ? 'bg-indigo-600 text-white scale-110' : 'bg-gray-50 text-gray-400 border border-gray-100 group-hover:border-indigo-600 group-hover:text-indigo-600'}`}>
                          {index + 1}
                        </div>
                        <div className="text-left min-w-0">
                          <h4 className={`font-bold text-sm md:text-base transition-colors ${isExpanded ? 'text-indigo-600' : 'text-gray-900 line-clamp-1'}`}>
                            {chapter.title || chapter.name}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-tight">
                              <Play className="w-2.5 h-2.5" /> {(chapter.videoCount || chapter.videosList?.length || 0)} Videos
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-tight">
                              <FileText className="w-2.5 h-2.5" /> {(chapter.pdfCount || chapter.pdfsList?.length || 0)} Notes
                            </span>
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-3 pr-4 md:pr-5">
                        {progress !== null && (
                          <div className="hidden sm:flex items-center gap-2 w-16 shrink-0">
                            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-green-600">{progress}%</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedChapter(isExpanded ? (activeTab === 'all' ? null : expandedChapter) : globalIdx)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}
                          aria-label={isExpanded ? 'Collapse chapter preview' : 'Expand chapter preview'}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                       <div className="p-4 bg-gray-50/50 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(activeTab === 'all' || activeTab === 'videos') && chapter.videosList?.map((vid, vIdx) => {
                            const dur = formatVideoDuration(vid)
                            return (
                            <button key={vIdx} onClick={() => handleVideoClick(vid)} className="flex items-center gap-3 p-3 bg-blue-50/30 rounded-xl border border-blue-50 text-left hover:border-blue-200 transition-all">
                              <Play className="w-4 h-4 text-blue-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{vid.title || vid.name}</p>
                                {dur && <p className="text-[10px] font-bold text-blue-600">{dur}</p>}
                              </div>
                            </button>
                          )})}
                          {(activeTab === 'all' || activeTab === 'notes') && chapter.pdfsList?.map((pdf, pIdx) => {
                            const pages = formatPdfPages(pdf)
                            return (
                             <button key={pIdx} onClick={() => handlePDFClick(pdf)} className="flex items-center gap-3 p-3 bg-green-50/30 rounded-xl border border-green-50 text-left hover:border-green-200 transition-all">
                               <FileText className="w-4 h-4 text-green-600 shrink-0" />
                               <div className="min-w-0">
                                 <p className="text-xs font-bold text-gray-900 truncate">{pdf.title || pdf.name}</p>
                                 {pages && <p className="text-[10px] font-bold text-green-600">{pages}</p>}
                               </div>
                             </button>
                          )})}
                          {(activeTab === 'all' || activeTab === 'tests') && chapter.testsList?.map((test, tIdx) => {
                            const tmeta = formatTestMeta(test)
                            return (
                             <Link key={tIdx} to={`/test/${test.testId || test.id}`} className="flex items-center gap-3 p-3 bg-purple-50/30 rounded-xl border border-purple-50 text-left hover:border-purple-200 transition-all">
                               <BarChartBig className="w-4 h-4 text-purple-600 shrink-0" />
                               <div className="min-w-0">
                                 <p className="text-xs font-bold text-gray-900 truncate">{test.title || test.name || `Practice test ${tIdx + 1}`}</p>
                                 {tmeta && <p className="text-[10px] font-bold text-purple-600">{tmeta}</p>}
                               </div>
                             </Link>
                          )})}
                       </div>
                    )}
                  </div>
                )
             })}
          </div>
        )}
      </div>

      {/* Viewers */}
      <VideoPlayer 
        isOpen={videoPlayer.isOpen} 
        onClose={() => setVideoPlayer({ isOpen: false, data: null })} 
        videoData={videoPlayer.data} 
      />
      
      <PDFViewer 
        isOpen={pdfViewer.isOpen} 
        onClose={() => setPdfViewer({ isOpen: false, data: null })} 
        pdfData={pdfViewer.data} 
      />
      
      <ContentReader 
        isOpen={contentReader.isOpen} 
        onClose={() => setContentReader({ isOpen: false, data: null })} 
        contentData={contentReader.data} 
      />
    </div>
  )
}

export default StudyMaterialDetail
