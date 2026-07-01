import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChartBig,
  BookOpen,
  Bookmark,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Play,
  Share2,
  MessageSquare,
  Send,
  Star,
  Edit,
  Trash2,
  Target,
  Printer,
} from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import { apiClient, getStudyMaterialById, getTestSeries } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import PDFViewer from '../../shared/components/common/PDFViewer'
import VideoPlayer from '../../shared/components/common/VideoPlayer'
import { getChapterPath, matchesChapterIdentifier } from './studyMaterialUtils'

const formatDuration = (value, fallback = '') => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'number') return `${value} min`
  return value
}

const getPreferredTab = (chapter) => {
  const topicCount = chapter?.topicCount || chapter?.topics?.length || 0
  const videoCount = chapter?.videoCount || chapter?.videosList?.length || 0
  const pdfCount = chapter?.pdfCount || chapter?.pdfsList?.length || 0
  const testCount = chapter?.testCount || chapter?.testsList?.length || 0

  if (topicCount > 0) return 'overview'
  if (videoCount > 0) return 'videos'
  if (pdfCount > 0) return 'notes'
  if (testCount > 0) return 'tests'
  return 'overview'
}

export default function StudyMaterialChapter() {
  const { subjectId, chapterId } = useParams()
  const navigate = useNavigate()
  const [subject, setSubject] = useState(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showAllChapters, setShowAllChapters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [videoPlayer, setVideoPlayer] = useState({ isOpen: false, data: null })
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, data: null })
  const [activeTab, setActiveTab] = useState('overview')
  const [activeTopicIndex, setActiveTopicIndex] = useState(0)
  const [discussions, setDiscussions] = useState([])
  const [newDiscussion, setNewDiscussion] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const { user: currentUser, isAdmin } = useAuth()
  const [relatedTests, setRelatedTests] = useState([])
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showResumeBar, setShowResumeBar] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const resumeTimerRef = useRef(null)
  const mainContentRef = useRef(null)

  const chapters = subject?.chapters || []
  const chapterIndex = chapters.findIndex((item, index) =>
    matchesChapterIdentifier(item, chapterId, chapters, index)
  )
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : null
  const previousChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null
  const nextChapter = chapterIndex >= 0 && chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null
  const completedCount = chapters.filter(item => item.isCompleted).length
  const subjectProgress = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0
  const chapterProgress = chapter?.progress || (chapter?.isCompleted ? 100 : 0)

  useEffect(() => {
    if (!chapter) return
    setActiveTab(getPreferredTab(chapter))
    setActiveTopicIndex(0)
  }, [chapter])

  useEffect(() => {
    const fetchSubjectContent = async () => {
      try {
        setLoading(true)
        setError(null)
        const subjectData = await getStudyMaterialById(subjectId)
        setSubject(subjectData)
      } catch (err) {
        console.error('Failed to fetch subject content:', err)
        setError('Failed to load subject content')
      } finally {
        setLoading(false)
      }
    }

    if (subjectId) {
      fetchSubjectContent()
    }
  }, [subjectId])

  useEffect(() => {
    const fetchDiscussions = async () => {
      if (!chapter) return
      try {
        // Find discussions/doubts related to this subject/chapter
        const res = await apiClient.get('/api/doubts', {
          params: { 
            category: subject?.title || subject?.name,
            limit: 10
          }
        })
        setDiscussions(res.data?.data || [])
      } catch (err) {
        console.error('Failed to fetch discussions:', err)
      }
    }

    if (chapter) {
      fetchDiscussions()
    }
  }, [chapter, subject])

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await apiClient.get('/api/users/analytics')
        setAnalytics(res.data?.data || res.data || null)
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
      }
    }
    fetchAnalytics()
  }, [])

  useEffect(() => {
    if (!subject) return
    const fetchRelatedTests = async () => {
      try {
        const allSeries = await getTestSeries()
        const subjectTitle = (subject.title || subject.name || '').toLowerCase()
        const subjectGroup = (subject.subjectGroup || '').toLowerCase()
        const matches = allSeries.filter(s => {
          const cat = (s.categoryName || s.category || '').toLowerCase()
          return cat === subjectTitle || cat === subjectGroup ||
            subjectTitle.includes(cat) || cat.includes(subjectTitle)
        }).slice(0, 3)
        setRelatedTests(matches)
      } catch {
        setRelatedTests([])
      }
    }
    fetchRelatedTests()
  }, [subject])

  const chapterIdKey = chapter ? `chapter-scroll-${chapter._id || chapter.id || chapterId}` : null

  useEffect(() => {
    if (!chapterIdKey) return
    const stored = localStorage.getItem(chapterIdKey)
    if (stored && !dismissed) {
      const pct = parseFloat(stored)
      if (!isNaN(pct) && pct > 2 && pct < 95) {
        setShowResumeBar(true)
        resumeTimerRef.current = setTimeout(() => setShowResumeBar(false), 5000)
      }
    }
    return () => { if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current) }
  }, [chapterIdKey, dismissed])

  useEffect(() => {
    if (!chapterIdKey) return
    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      setTimeout(() => {
        const el = document.documentElement
        const scrollTop = window.scrollY
        const docHeight = el.scrollHeight - window.innerHeight
        if (docHeight > 0) {
          const pct = Math.round((scrollTop / docHeight) * 100)
          setScrollProgress(Math.min(pct, 100))
          localStorage.setItem(chapterIdKey, String(pct))
        }
        ticking = false
      }, 1000)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [chapterIdKey])

  const handleResume = useCallback(() => {
    const stored = localStorage.getItem(chapterIdKey)
    if (stored) {
      const pct = parseFloat(stored)
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: (pct / 100) * docHeight, behavior: 'smooth' })
    }
    setShowResumeBar(false)
  }, [chapterIdKey])

  const handlePrint = useCallback(() => {
    if (!chapter) return
    const topicsHtml = chapterTopics.map(t =>
      `<div style="margin-bottom:12px"><h3 style="font-size:14px;font-weight:700;margin:0 0 4px">${t.name || t.title || ''}</h3><p style="font-size:12px;color:#555;margin:0">${t.description || ''}</p></div>`
    ).join('')
    const videosHtml = chapterVideos.length > 0
      ? `<h2 style="font-size:16px;font-weight:700;margin:24px 0 8px">Video Lessons</h2>${chapterVideos.map(v => `<div style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px">${v.title || v.name || 'Video'}</div>`).join('')}`
      : ''
    const pdfsHtml = chapterPdfs.length > 0
      ? `<h2 style="font-size:16px;font-weight:700;margin:24px 0 8px">Notes & PDFs</h2>${chapterPdfs.map(p => `<div style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px">${p.title || p.name || 'PDF'}</div>`).join('')}`
      : ''
    const html = `<!DOCTYPE html><html><head><title>${chapter.title || 'Chapter'}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}h1{font-size:28px;margin:0 0 8px}h2{border-bottom:2px solid #eee;padding-bottom:4px}p{margin:8px 0}.btn{display:none}@media print{.btn{display:none!important}}</style></head><body><div class="btn"><button onclick="window.print()" style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button></div><h1>${chapter.title || chapter.name || 'Chapter'}</h1><p style="color:#666">${chapter.description || ''}</p>${topicsHtml}${videosHtml}${pdfsHtml}<p style="font-size:11px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:8px">Printed from Trstprep - ${new Date().toLocaleDateString()}</p></body></html>`
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }, [chapter, chapterTopics, chapterVideos, chapterPdfs])

  const handleDiscussionSubmit = async () => {
    if (!newDiscussion.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await apiClient.post('/api/doubts', {
        title: `Question about ${chapter.title || 'Chapter'}`,
        description: newDiscussion,
        category: subject.title || subject.name,
        tags: [chapter.title || 'Chapter', subject.title || 'Subject']
      })
      
      if (res.data?.success) {
        setDiscussions([res.data.data, ...discussions])
        setNewDiscussion('')
      }
    } catch (err) {
      console.error('Failed to post discussion:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteDiscussion = async (discussionId) => {
    if (!window.confirm('Are you sure you want to delete this discussion?')) return
    try {
      await apiClient.delete(`/api/doubts/${discussionId}`)
      setDiscussions(discussions.filter(d => (d.id || d._id) !== discussionId))
    } catch (err) {
      console.error('Failed to delete discussion:', err)
    }
  }

  const handleUpdateDiscussion = async (discussionId) => {
    if (!editContent.trim()) return
    try {
      const res = await apiClient.put(`/api/doubts/${discussionId}`, {
        description: editContent
      })
      if (res.data?.success) {
        setDiscussions(discussions.map(d => 
          (d.id || d._id) === discussionId ? { ...d, ...res.data.data } : d
        ))
        setEditingId(null)
        setEditContent('')
      }
    } catch (err) {
      console.error('Failed to update discussion:', err)
    }
  }

  const visibleChapterStart = showAllChapters ? 0 : Math.max(0, chapterIndex - 3)
  const visibleChapterEnd = showAllChapters ? chapters.length : Math.min(chapters.length, chapterIndex + 4)
  const visibleChapters = chapters.slice(visibleChapterStart, visibleChapterEnd)
  const hasHiddenChapters = chapters.length > visibleChapters.length

  useEffect(() => {
    setShowAllChapters(false)
  }, [subjectId, chapterId])

  const handleBookmark = async () => {
    const nextState = !isBookmarked
    setIsBookmarked(nextState)

    try {
      await apiClient.post('/api/bookmarks/toggle', {
        itemId: chapter?._id || chapter?.id || chapterId,
        itemType: 'chapter',
        title: chapter?.title || chapter?.name || '',
      })
    } catch (err) {
      console.error('Failed to bookmark:', err)
      setIsBookmarked(!nextState)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: chapter?.title || 'Study Material',
          text: `Check out this study chapter: ${chapter?.title || chapter?.name || ''}`,
          url: window.location.href,
        })
        return
      } catch { /* not supported */ }
    }

    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch (err) {
      console.error('Failed to copy chapter link:', err)
    }
  }

  const handleVideoClick = (videoData) => {
    setVideoPlayer({
      isOpen: true,
      data: {
        title: videoData.title || videoData.name || 'Educational Video',
        description: videoData.description || '',
        url: videoData.videoUrl || videoData.url || '',
      },
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
        totalPages: pdfData.totalPages ?? pdfData.pages ?? 0,
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading chapter...</p>
        </div>
      </div>
    )
  }

  if (error || !subject) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Subject Not Found</h2>
        <p className="text-gray-600 mb-6">The subject you&apos;re looking for doesn&apos;t exist or could not be loaded.</p>
        <button
          onClick={() => navigate('/study')}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Back to Study Materials
        </button>
      </div>
    )
  }

  if (!chapter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Chapter Not Found</h2>
        <p className="text-gray-600 mb-6">This chapter could not be matched to the selected subject.</p>
        <button
          onClick={() => navigate(`/study/${subjectId}`)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Back to Subject
        </button>
      </div>
    )
  }

  const chapterTopics = chapter?.topics || []
  const currentTopic = chapterTopics[activeTopicIndex]
  const currentTopicId = currentTopic ? String(currentTopic.id || currentTopic._id) : null

  const chapterVideos = (chapter?.videosList || []).filter(v => 
    !currentTopicId || (!v.topicId && !v.topic_id) || String(v.topicId || v.topic_id) === currentTopicId
  )
  const chapterPdfs = (chapter?.pdfsList || []).filter(p => 
    !currentTopicId || (!p.topicId && !p.topic_id) || String(p.topicId || p.topic_id) === currentTopicId
  )
  const chapterTests = (chapter?.testsList || []).filter(t => 
    !currentTopicId || (!t.topicId && !t.topic_id) || String(t.topicId || t.topic_id) === currentTopicId
  )

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen, count: chapterTopics.length || 0, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'videos', label: 'Video Lessons', icon: Play, count: chapterVideos.length, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'notes', label: 'Notes & PDFs', icon: FileText, count: chapterPdfs.length, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'tests', label: 'Practice Tests', icon: BarChartBig, count: chapterTests.length, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent" style={{ pointerEvents: 'none' }}>
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300"
          style={{ width: `${scrollProgress}%`, pointerEvents: 'auto' }}
        />
      </div>
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Study Materials', path: '/study' },
              { label: subject.title || subject.name, path: `/study/${subjectId}` },
              { label: chapter.title || chapter.name || 'Chapter' },
            ]}
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-8 md:gap-12">
            {/* Left Column: Core Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => navigate(`/study/${subjectId}`)}
                  className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/60 hover:text-white transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <div className="h-3 w-px bg-white/10 mx-1"></div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                  <BookOpen className="w-3 h-3 text-cyan-400" />
                  CH {chapterIndex + 1} / {chapters.length}
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight mb-2 sm:mb-4">
                {chapter.title || chapter.name}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-white/60 max-w-2xl leading-relaxed mb-4 sm:mb-6 line-clamp-2 sm:line-clamp-none">
                {chapter.description || 'Chapter resources, notes, and practice items are collected here.'}
              </p>

              {/* Mobile: Progress card LEFT + Save/Share buttons stacked RIGHT — one row */}
              <div className="flex items-stretch gap-3 lg:hidden">
                {/* Mini Progress Card */}
                <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-md shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center shrink-0">
                      <svg className="w-12 h-12 -rotate-90">
                        <circle cx="50%" cy="50%" r="35%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/10" />
                        <circle cx="50%" cy="50%" r="35%" stroke="currentColor" strokeWidth="4" fill="transparent"
                          strokeDasharray="100%"
                          strokeDashoffset={`${100 - chapterProgress}%`}
                          className="text-cyan-400 transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-black text-white">{chapterProgress}%</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">Progress</p>
                      <h4 className="text-sm font-black text-white truncate">{chapterProgress === 100 ? 'Completed' : 'In Progress'}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-white/40 font-bold">{chapterIndex + 1}/{chapters.length}</span>
                        <span className="text-white/20">·</span>
                        <span className="text-[9px] text-white/40 font-bold">{chapterTopics.length} topics</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save / Share / Print buttons stacked on right */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleBookmark}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                      isBookmarked
                        ? 'bg-amber-400 text-amber-950 border-amber-400'
                        : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                    }`}
                  >
                    <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-current' : ''}`} />
                    {isBookmarked ? 'Saved' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all print:hidden"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>
              </div>

              {/* Desktop: Save/Share/Print inline */}
              <div className="hidden lg:flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBookmark}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                    isBookmarked
                      ? 'bg-amber-400 text-amber-950 border-amber-400'
                      : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                  }`}
                >
                  <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-current' : ''}`} />
                  {isBookmarked ? 'Saved' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                >
                  <Share2 className="w-3 h-3" />
                  Share
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all print:hidden"
                >
                  <Printer className="w-3 h-3" />
                  Print
                </button>
              </div>
            </div>

            {/* Right Column: Desktop full card only */}
            <div className="hidden lg:block w-full lg:w-[360px] shrink-0">
              <div className="rounded-3xl border border-white/10 bg-black/40 p-5 backdrop-blur-md shadow-xl relative overflow-hidden">
                <div className="flex flex-col gap-4 relative z-10">
                  {/* Progress Section */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center shrink-0">
                      <svg className="w-16 h-16 -rotate-90">
                        <circle cx="50%" cy="50%" r="35%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/10" />
                        <circle cx="50%" cy="50%" r="35%" stroke="currentColor" strokeWidth="4" fill="transparent" 
                          strokeDasharray="100%" 
                          strokeDashoffset={`${100 - chapterProgress}%`}
                          className="text-cyan-400 transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-xs font-black text-white">{chapterProgress}%</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">Chapter Progress</p>
                      <h4 className="text-lg font-black text-white truncate">{chapterProgress === 100 ? 'Completed' : 'In Progress'}</h4>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <p className="text-[8px] font-black uppercase tracking-tighter text-white/20">Current</p>
                      <p className="text-sm font-black text-white">{chapterIndex + 1}</p>
                    </div>
                    <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <p className="text-[8px] font-black uppercase tracking-tighter text-white/20">Total</p>
                      <p className="text-sm font-black text-white">{chapters.length}</p>
                    </div>
                    <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <p className="text-[8px] font-black uppercase tracking-tighter text-white/20">Topics</p>
                      <p className="text-sm font-black text-white">{chapterTopics.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content Area (3/4 on desktop) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Unified Content Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              {/* TOP: Topic No & Name */}
              {chapterTopics.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-50 bg-indigo-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-xl border border-indigo-100 bg-white shadow-sm flex items-center gap-3">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] whitespace-nowrap">
                        Topic {String(activeTopicIndex + 1).padStart(2, '0')}
                      </span>
                      <span className="h-4 w-px bg-indigo-100"></span>
                      <h3 className="font-extrabold text-gray-900 text-sm sm:text-base italic leading-none pb-0.5">
                        {chapterTopics[activeTopicIndex]?.name || chapterTopics[activeTopicIndex]?.title || 'Core Concepts'}
                      </h3>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-100 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                      {activeTopicIndex + 1} / {chapterTopics.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Tabs Integration */}
              <div className="p-2 pb-0">
                <div className="flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-4 gap-1.5 bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:py-2.5 rounded-xl font-black transition-all whitespace-nowrap min-w-max sm:min-w-0 flex-1 ${
                        activeTab === tab.id
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                          : 'text-gray-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm'
                      }`}
                    >
                      <tab.icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                      <span className="uppercase tracking-tighter sm:tracking-widest text-[9px] sm:text-xs">{tab.label}</span>
                      {tab.count > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black ${
                          activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white text-gray-400 border border-gray-100'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Area */}
              <div className="p-2">
                {activeTab === 'overview' && (
                  <section className="bg-white rounded-2xl border border-gray-50 overflow-hidden page-transition fade-in">
                    <div className="p-3 border-b border-gray-50 bg-gradient-to-r from-white to-indigo-50/40">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900">Chapter Overview</h2>
                          <p className="text-sm text-gray-500">Browse the topic sequence before lessons, notes, and tests are added.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3">
                      {chapterTopics.length > 0 ? (
                        <div className="space-y-5">
                          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Current Topic</p>
                            <h3 className="mt-2 text-xl font-black text-gray-900">
                              {chapterTopics[activeTopicIndex]?.name || chapterTopics[activeTopicIndex]?.title || 'Core Concepts'}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-gray-600">
                              {chapterTopics[activeTopicIndex]?.description || chapter.description || 'This chapter currently contains a structured topic outline. Media resources can be added later without changing the chapter flow.'}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {chapterTopics.map((topic, index) => (
                              <button
                                key={topic.id || topic._id || index}
                                type="button"
                                onClick={() => setActiveTopicIndex(index)}
                                className={`rounded-2xl border p-4 text-left transition-all ${
                                  activeTopicIndex === index
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                    : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                                    activeTopicIndex === index ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className={`text-sm font-bold ${activeTopicIndex === index ? 'text-white' : 'text-gray-900'}`}>
                                      {topic.name || topic.title}
                                    </h4>
                                    <p className={`mt-1 text-xs leading-relaxed ${activeTopicIndex === index ? 'text-indigo-100' : 'text-gray-500'}`}>
                                      {topic.description || 'Topic outline available for this chapter.'}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900">No Topic Outline Yet</h3>
                          <p className="text-gray-500 text-sm">This chapter exists, but the detailed topic outline hasn't been published yet.</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'videos' && (
                  <section className="bg-white rounded-2xl border border-gray-50 overflow-hidden page-transition fade-in">
                    <div className="p-2 border-b border-gray-50 bg-gradient-to-r from-white to-blue-50/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900">Video Lessons</h2>
                          <p className="text-sm text-gray-500">Master the concepts through expert video lectures.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      {chapterVideos.length > 0 ? (
                        <div className="space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {chapterVideos.map((video, index) => (
                              <button
                                key={video.id || video._id || `${index}-${video.title || 'video'}`}
                                type="button"
                                onClick={() => handleVideoClick(video)}
                                className="group flex flex-col items-stretch p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md transition-all duration-300 text-left"
                              >
                                <div className="relative aspect-video rounded-xl bg-gray-900 overflow-hidden mb-4 group-hover:scale-[1.02] transition-transform">
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                    <div className="w-12 h-12 rounded-full bg-white/90 text-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                      <Play className="w-5 h-5 fill-current ml-0.5" />
                                    </div>
                                  </div>
                                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
                                    {formatDuration(video.duration, 'Lesson')}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">{video.title}</h3>
                                  <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">{video.description || 'Watch and learn core concepts.'}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                          <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900">No Videos Available</h3>
                          <p className="text-gray-500 text-sm">Use the overview tab to browse the chapter topics while video lessons are being added.</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'notes' && (
                  <section className="bg-white rounded-2xl border border-gray-50 overflow-hidden page-transition fade-in">
                    <div className="p-2 border-b border-gray-50 bg-gradient-to-r from-white to-green-50/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 text-green-600 rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900">Notes and PDFs</h2>
                          <p className="text-sm text-gray-500">Comprehensive study guides and reference material.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      {chapterPdfs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {chapterPdfs.map((pdf, index) => (
                            <button
                              key={pdf.id || pdf._id || `${index}-${pdf.title || 'pdf'}`}
                              type="button"
                              onClick={() => handlePDFClick(pdf)}
                              className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-white hover:border-green-200 hover:shadow-md transition-all duration-300 text-left"
                            >
                              <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shadow-sm shrink-0 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                <FileText className="w-6 h-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2">{pdf.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider">{pdf.pages || pdf.totalPages || 0} Pages</span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-xs font-medium text-gray-500">PDF Document</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900">No PDFs Available</h3>
                          <p className="text-gray-500 text-sm">Use the overview tab to browse the chapter topics while notes are being added.</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'tests' && (
                  <section className="bg-white rounded-2xl border border-gray-50 overflow-hidden page-transition fade-in">
                    <div className="p-2 border-b border-gray-50 bg-gradient-to-r from-white to-purple-50/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl">
                          <BarChartBig className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900">Practice Tests</h2>
                          <p className="text-sm text-gray-500">Validate knowledge with assessments.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      {chapterTests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {chapterTests.map((test, index) => (
                            <Link
                              key={test.id || test._id || `${index}-${test.title || 'test'}`}
                              to={`/test/${test.testId || test.id}`}
                              className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-white hover:border-purple-200 hover:shadow-md transition-all duration-300"
                            >
                              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <BarChartBig className="w-6 h-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                                  {test.title || `Chapter Test ${index + 1}`}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">{formatDuration(test.duration, 'Start test')}</span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-xs font-medium text-gray-500">Attempt Test</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                          <BarChartBig className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900">No Tests Available</h3>
                          <p className="text-gray-500 text-sm">Use the overview tab to browse the chapter topics while practice tests are being added.</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>

              {/* BOTTOM: Next/Previous Topic Navigation */}
              {chapterTopics.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-gray-50/50 border-t border-gray-100 gap-4">
                  <button 
                    onClick={() => setActiveTopicIndex(Math.max(0, activeTopicIndex - 1))}
                    disabled={activeTopicIndex === 0}
                    className="flex flex-col items-start gap-1 px-4 py-2 rounded-xl text-[10px] font-black text-gray-400 hover:bg-white hover:text-indigo-600 transition-all disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest border border-transparent hover:border-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" />
                      Previous
                    </div>
                    {activeTopicIndex > 0 && (
                      <span className="text-[11px] normal-case font-bold text-gray-700 truncate max-w-[120px]">
                        {chapterTopics[activeTopicIndex - 1]?.name || chapterTopics[activeTopicIndex - 1]?.title}
                      </span>
                    )}
                  </button>
                  
                  <div className="hidden xs:flex items-center gap-1.5">
                    {chapterTopics.map((_, idx) => (
                      <div 
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${activeTopicIndex === idx ? 'w-4 bg-indigo-600' : 'w-1.5 bg-gray-200'}`}
                      />
                    ))}
                  </div>

                  <button 
                    onClick={() => setActiveTopicIndex(Math.min(chapterTopics.length - 1, activeTopicIndex + 1))}
                    disabled={activeTopicIndex === chapterTopics.length - 1}
                    className="flex flex-col items-end gap-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest"
                  >
                    <div className="flex items-center gap-1">
                      Next
                      <ChevronRight className="w-3 h-3" />
                    </div>
                    {activeTopicIndex < chapterTopics.length - 1 && (
                      <span className="text-[11px] normal-case font-bold text-indigo-100 truncate max-w-[120px]">
                        {chapterTopics[activeTopicIndex + 1]?.name || chapterTopics[activeTopicIndex + 1]?.title}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Pagination / Navigation */}
            {(previousChapter || nextChapter) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                {previousChapter ? (
                  <Link
                    to={getChapterPath(subjectId, previousChapter, chapters, chapterIndex - 1)}
                    className="flex flex-col p-5 bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      Previous Chapter
                    </div>
                    <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {previousChapter.title || previousChapter.name}
                    </p>
                  </Link>
                ) : (
                  <div className="hidden md:block" />
                )}

                {nextChapter && (
                  <Link
                    to={getChapterPath(subjectId, nextChapter, chapters, chapterIndex + 1)}
                    className="flex flex-col items-end p-5 bg-indigo-600 rounded-2xl border border-indigo-700 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-100 transition-all group"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-100 uppercase tracking-[0.2em] mb-3">
                      Next Chapter
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="font-bold text-white line-clamp-1 text-right">
                      {nextChapter.title || nextChapter.name}
                    </p>
                  </Link>
                )}
              </div>
            )}

            {relatedTests.length > 0 && (
              <section className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl border border-purple-100 p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl">
                    <BarChartBig className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Practice What You&apos;ve Learned</h2>
                    <p className="text-sm text-gray-500">Test your knowledge with these related series</p>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {relatedTests.map((s) => (
                    <Link
                      key={s._id || s.id}
                      to={`/test-series/${s.slug || s.id || s._id}`}
                      className="flex-shrink-0 w-64 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-lg hover:border-purple-200 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                          <BarChartBig className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm truncate group-hover:text-purple-600 transition-colors">{s.title}</h3>
                          <p className="text-[10px] text-gray-500 font-medium">{s.totalTests || 0} Tests</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">{s.categoryName || s.category || 'Exam'}</span>
                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                          Attempt <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Discussion Forum */}
            <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mt-8">
              <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-white to-amber-50/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900">Chapter Forum</h2>
                      <p className="text-sm text-gray-500">Discuss concepts and clear your doubts with peers.</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {discussions.length} Active Discussions
                  </div>
                </div>
              </div>

              <div className="p-6">
                {chapter.description && (
                  <div className="mb-8 bg-amber-50/50 rounded-2xl p-5 border border-amber-100">
                    <h3 className="text-[10px] font-black text-amber-900 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <Star className="w-3.5 h-3.5 text-amber-600 fill-current" />
                      Key Takeaways
                    </h3>
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      {chapter.description}
                    </p>
                  </div>
                )}
                
                {/* Input Section */}
                <div className="flex gap-4 mb-10">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-white shadow-sm overflow-hidden shrink-0 mt-1">
                    <img src="https://ui-avatars.com/api/?name=You&background=4F46E5&color=fff" alt="User" />
                  </div>
                  <div className="flex-1 relative">
                    <textarea 
                      value={newDiscussion}
                      onChange={(e) => setNewDiscussion(e.target.value)}
                      placeholder="Share your thoughts or ask a question about this chapter..."
                      className="w-full p-4 pr-14 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-100 text-sm font-medium min-h-[100px] resize-none transition-all"
                    />
                    <button 
                      onClick={handleDiscussionSubmit}
                      disabled={isSubmitting || !newDiscussion.trim()}
                      className="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-8">
                  {discussions.length > 0 ? (
                    discussions.map((item, idx) => (
                      <div key={item.id || item._id || idx} className="flex gap-4 group">
                        <div className={`w-10 h-10 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-xs font-black text-gray-500 overflow-hidden shrink-0`}>
                          <img src={`https://ui-avatars.com/api/?name=${item.userName || item.user?.name || 'User'}&background=random`} alt={item.userName || 'User'} />
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-2xl p-5 border border-transparent hover:border-gray-100 hover:bg-white transition-all group-hover:shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-gray-900">{item.userName || item.user?.name || 'Anonymous User'}</h4>
                                {item.updatedAt && new Date(item.updatedAt) > new Date(item.createdAt) && (
                                  <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Edited {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Just now'}
                                </span>
                                {(isAdmin() || (currentUser && (item.userId === currentUser.id || item.user?._id === currentUser.id))) && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingId(item.id || item._id)
                                        setEditContent(item.description || item.content)
                                      }}
                                      className="p-1 hover:text-indigo-600 transition-colors"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteDiscussion(item.id || item._id)}
                                      className="p-1 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {editingId === (item.id || item._id) ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full p-3 rounded-xl bg-white border border-indigo-100 text-sm font-medium min-h-[80px] focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
                                />
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingId(null)} className="px-3 py-1 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600">Cancel</button>
                                  <button onClick={() => handleUpdateDiscussion(item.id || item._id)} className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase shadow-md shadow-indigo-100">Save</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 leading-relaxed font-medium">{item.description || item.content}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-6 mt-3 px-1">
                            <button className="text-[10px] font-black uppercase text-indigo-600 hover:underline tracking-widest">Reply</button>
                            <button className="text-[10px] font-black uppercase text-gray-400 hover:text-indigo-600 tracking-widest font-bold">
                              {item.upvotes || 0} Likes
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No discussions yet. Be the first to start one!</p>
                    </div>
                  )}
                </div>

                <div className="mt-10 pt-6 border-t border-gray-50 text-center">
                  <button className="text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-[0.2em] transition-all">
                    View All Discussions
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 lg:self-start">
            
            {/* Chapters Topics Sidebar (Added per request) */}
            {chapterTopics.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/30">
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Topics Covered</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Follow the sequence</p>
                </div>
                <div className="p-3 space-y-2 max-h-[25rem] overflow-y-auto">
                  {chapterTopics.map((topic, index) => (
                    <button 
                      key={topic.id || topic._id || index}
                      onClick={() => {
                        setActiveTopicIndex(index);
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all group w-full text-left ${
                        activeTopicIndex === index 
                          ? 'bg-indigo-600 border-indigo-700 shadow-md' 
                          : 'bg-slate-50 border-transparent hover:bg-white hover:border-indigo-100'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg border text-[10px] font-black flex items-center justify-center shrink-0 transition-colors ${
                        activeTopicIndex === index 
                          ? 'bg-white/20 border-white/20 text-white' 
                          : 'bg-white border-slate-100 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100'
                      }`}>
                        {index + 1}
                      </div>
                      <p className={`text-xs font-bold transition-colors leading-relaxed ${
                        activeTopicIndex === index ? 'text-white' : 'text-slate-700 group-hover:text-indigo-900'
                      }`}>
                        {topic.name || topic.title}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* All Chapters List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-black text-gray-900">All Chapters</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{chapters.length} Total</span>
              </div>
              <div className="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
                {visibleChapters.map((item, visibleIndex) => {
                  const index = visibleChapterStart + visibleIndex
                  const isActive = index === chapterIndex

                  return (
                    <Link
                      key={item.id || item._id || item.slug || index}
                      to={getChapterPath(subjectId, item, chapters, index)}
                      className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {item.isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold line-clamp-2 ${isActive ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {item.title || item.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-indigo-400" />
                            {item.topicCount || item.topics?.length || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            {(item.videoCount || 0) + (item.pdfCount || 0) + (item.testCount || 0) > 0 ? 'Resources' : 'Overview'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}

                {!showAllChapters && hasHiddenChapters && (
                  <button
                    type="button"
                    onClick={() => setShowAllChapters(true)}
                    className="w-full mt-2 rounded-xl border border-dashed border-gray-200 py-3 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-wider"
                  >
                    View All {chapters.length} Chapters
                  </button>
                )}
              </div>
            </div>

            {/* Your Performance Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-700 opacity-50" />
               <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider mb-5 flex items-center gap-2">
                 <BarChartBig className="w-4 h-4 text-indigo-600" />
                 Your Metrics
               </h3>
               
               <div className="space-y-4 relative z-10">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Clock className="w-4 h-4" />
                       </div>
                       <span className="text-xs font-bold text-gray-600">Time Spent</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{analytics?.stats?.studyHours || 0}h {analytics?.stats?.studyMinutes || 0}m</span>
                 </div>
                 
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4" />
                       </div>
                       <span className="text-xs font-bold text-gray-600">Completed</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{completedCount}/{chapters.length}</span>
                 </div>

                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <BarChartBig className="w-4 h-4" />
                       </div>
                       <span className="text-xs font-bold text-gray-600">Accuracy</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600">{analytics?.performance?.avgAccuracy || 0}%</span>
                 </div>
               </div>
            </div>

            {/* Instructor Quick View */}
            <div className="p-6 rounded-3xl bg-slate-900 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-3xl rounded-full -mr-16 -mt-16" />
               <div className="relative z-10 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 p-0.5 border border-white/20 backdrop-blur-sm overflow-hidden shrink-0">
                     <img 
                        src={`https://ui-avatars.com/api/?name=${subject.instructor_name || 'Instructor'}&background=4f46e5&color=fff`} 
                        alt="Instructor" 
                        className="w-full h-full rounded-xl object-cover"
                     />
                  </div>
                  <div className="min-w-0">
                     <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Course Expert</p>
                     <p className="text-sm font-black truncate">{subject.instructor_name || 'Senior Academic Head'}</p>
                  </div>
               </div>
               <button className="w-full mt-5 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                  Contact Instructor
               </button>
            </div>
          </aside>
        </div>
      </div>


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

      {showResumeBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in-up">
          <div className="bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 border border-gray-700">
            <p className="text-sm font-bold">Continue reading from where you left off?</p>
            <button
              type="button"
              onClick={handleResume}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => { setShowResumeBar(false); setDismissed(true) }}
              className="text-gray-400 hover:text-white transition-colors text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
