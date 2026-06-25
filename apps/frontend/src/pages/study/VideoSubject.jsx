import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { AnimatedHero } from '../../shared/components'
import SearchBox from '../../shared/components/common/SearchBox'
import {
  Play, Clock, Lock, ChevronDown, ChevronLeft,
  Video, BookOpen, X, RefreshCw, VideoOff,
  Grid, Sparkles, Film, Eye, Users,
  FolderOpen, Star, Zap, Award, TrendingUp, MoveRight
} from 'lucide-react'
import api from '../../shared/lib/api'

/* ─── Video Card ─── */
const VideoCard = ({ video, index }) => {
  const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()}/mqdefault.jpg`

  return (
    <Link
      to={`/videos/${video._id || video.id}`}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      aria-label={`Watch video: ${video.title}`}
      style={{ animation: `fadeIn 0.4s ease-out ${index * 0.05}s both` }}
    >
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/80 to-pink-600/80 items-center justify-center text-white text-4xl hidden">
          <Play className="w-10 h-10" />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transform scale-0 group-hover:scale-100 transition-all duration-300 shadow-lg">
            <Play className="w-5 h-5 text-rose-500 ml-0.5" />
          </div>
        </div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        {!video.isFree && video.isPro && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-lg backdrop-blur-sm border border-white/20">
            <Lock className="w-2.5 h-2.5" /> PRO
          </div>
        )}
        {video.isFree && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500/90 text-white text-[10px] font-bold rounded-full shadow-lg backdrop-blur-sm border border-white/20">
            FREE
          </div>
        )}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded-md backdrop-blur-sm">
            {video.duration}
          </div>
        )}
      </div>
      <div className="p-3 relative">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-rose-500/0 via-rose-500/50 to-pink-500/0 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-rose-500 transition-colors text-sm leading-snug">
          {video.title}
        </h3>
        <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5 truncate min-w-0">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Users className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="truncate">{video.instructor || 'Expert Faculty'}</span>
          </span>
          <span className="flex items-center gap-1 flex-shrink-0 ml-2 text-gray-400">
            <Eye className="w-3 h-3" />
            {video.views?.toLocaleString() || 0}
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ─── Chapter Section ─── */
const ChapterSection = ({ chapter, subjectColor, isExpanded, onToggle }) => {
  const hasVideos = chapter.videos?.length > 0
  const hasTopics = chapter.topics?.length > 0
  const totalVideos = chapter.videoCount || chapter.videos?.length || 0
  const contentRef = useRef(null)

  return (
    <div className={`border rounded-xl overflow-hidden bg-white transition-all duration-300 hover:shadow-md ${isExpanded ? 'border-rose-200/60 shadow-md' : 'border-gray-100'}`}>
      <button
        onClick={() => onToggle(chapter._id)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50/80 transition-colors text-left group/chapter"
        aria-expanded={isExpanded}
        aria-controls={`chapter-content-${chapter._id}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover/chapter:scale-110"
            style={{ backgroundColor: (subjectColor || '#f43f5e') + '18' }}
          >
            {chapter.icon ? (
              <span className="text-sm">{chapter.icon}</span>
            ) : (
              <BookOpen className="w-4 h-4" style={{ color: subjectColor || '#f43f5e' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate group-hover/chapter:text-rose-500 transition-colors">{chapter.title}</h4>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {totalVideos} video{totalVideos !== 1 ? 's' : ''}
              {hasTopics && ` · ${chapter.topics.length} topic${chapter.topics.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${isExpanded ? 'bg-rose-500/10 rotate-180' : 'bg-gray-100 group-hover/chapter:bg-gray-200'}`}>
          <ChevronDown className={`w-3.5 h-3.5 transition-colors duration-300 ${isExpanded ? 'text-rose-500' : 'text-gray-400'}`} />
        </div>
      </button>

      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? contentRef.current?.scrollHeight + 200 || 2000 : 0 }}
      >
        <div id={`chapter-content-${chapter._id}`} className="border-t border-gray-100">
          {hasVideos && (
            <div className="p-3.5 bg-gray-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {chapter.videos.map((video, idx) => (
                  <VideoCard key={video._id || idx} video={video} index={idx} />
                ))}
              </div>
            </div>
          )}
          {hasTopics && chapter.topics.map((topic, topicIdx) => (
            <TopicSection
              key={topic._id || topicIdx}
              topic={topic}
              subjectColor={subjectColor}
              defaultExpanded={false}
            />
          ))}
          {!hasVideos && !hasTopics && (
            <div className="p-8 text-center text-gray-500">
              <Video className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">No videos available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Topic Section ─── */
const TopicSection = ({ topic, subjectColor, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const hasVideos = topic.videos?.length > 0
  const contentRef = useRef(null)

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left group/topic"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover/topic:scale-110"
            style={{ backgroundColor: (subjectColor || '#f43f5e') + '12' }}
          >
            <Video className="w-2.5 h-2.5" style={{ color: subjectColor || '#f43f5e' }} />
          </div>
          <span className="text-xs font-medium text-gray-700 truncate group-hover/topic:text-rose-500 transition-colors">{topic.title}</span>
          <span className="text-[10px] text-gray-400 flex-shrink-0">({topic.videoCount || topic.videos?.length || 0})</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-all duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180 text-rose-500' : ''}`}
        />
      </button>

      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? contentRef.current?.scrollHeight + 200 || 2000 : 0 }}
      >
        {isExpanded && hasVideos && (
          <div className="px-3.5 pb-3.5 bg-gray-50/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {topic.videos.map((video, idx) => (
                <VideoCard key={video._id || idx} video={video} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Skeleton ─── */
const SubjectSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <div className="lg:col-span-8 space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 skeleton rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton rounded w-2/5"></div>
              <div className="h-3 skeleton rounded w-1/4"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="lg:col-span-4 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="h-5 skeleton rounded w-1/2 mb-4"></div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 skeleton rounded-xl"></div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

/* ─── Main Page ─── */
function VideoSubject() {
  const { subjectSlugOrId } = useParams()
  const navigate = useNavigate()
  const [subject, setSubject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const [viewMode, setViewMode] = useState('chapters')
  const [expandedChapters, setExpandedChapters] = useState({})

  useEffect(() => {
    const fetchSubjectVideos = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get('/api/study/videos/hierarchical')
        if (response.data.success) {
          const found = response.data.data.find(s =>
            s.slug === subjectSlugOrId ||
            String(s._id) === String(subjectSlugOrId) ||
            String(s.id) === String(subjectSlugOrId)
          )
          if (found) {
            setSubject(found)
            // Auto-expand first chapter
            if (found.chapters?.length > 0) {
              setExpandedChapters({ [found.chapters[0]._id]: true })
            }
          } else {
            setError('Subject not found')
          }
        }
      } catch (err) {
        console.error('Failed to fetch subject videos:', err)
        setError('Failed to load videos. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchSubjectVideos()
  }, [subjectSlugOrId])

  const toggleChapter = useCallback((chapterId) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }))
  }, [])

  // All videos flat list
  const allVideos = useMemo(() => {
    if (!subject) return []
    const videos = []
    subject.chapters?.forEach(chapter => {
      chapter.videos?.forEach(v => videos.push({ ...v, chapter: chapter.title }))
      chapter.topics?.forEach(topic => {
        topic.videos?.forEach(v => videos.push({ ...v, chapter: chapter.title, topic: topic.title }))
      })
    })
    subject.unassignedVideos?.forEach(v => videos.push(v))
    return videos
  }, [subject])

  // Filtered
  const filteredChapters = useMemo(() => {
    if (!subject?.chapters) return []
    if (!searchQuery && !showFreeOnly) return subject.chapters

    const filterVideos = (videos) =>
      videos?.filter(video => {
        if (showFreeOnly && !video.isFree) return false
        if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
      }) || []

    return subject.chapters
      .map(chapter => ({
        ...chapter,
        videos: filterVideos(chapter.videos),
        topics: chapter.topics?.map(topic => ({
          ...topic,
          videos: filterVideos(topic.videos)
        })).filter(topic => topic.videos?.length > 0)
      }))
      .filter(chapter => chapter.videos?.length > 0 || chapter.topics?.length > 0)
  }, [subject, searchQuery, showFreeOnly])

  const filteredAllVideos = useMemo(() => {
    return allVideos.filter(video => {
      if (showFreeOnly && !video.isFree) return false
      if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [allVideos, searchQuery, showFreeOnly])

  const filteredUnassigned = useMemo(() => {
    if (!subject?.unassignedVideos) return []
    return subject.unassignedVideos.filter(video => {
      if (showFreeOnly && !video.isFree) return false
      if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [subject, searchQuery, showFreeOnly])

  const clearFilters = () => {
    setSearchQuery('')
    setShowFreeOnly(false)
  }

  const totalVideos = allVideos.length
  const freeVideos = allVideos.filter(v => v.isFree).length
  const accentColor = subject?.color || '#f43f5e'

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[
            { label: 'Home', path: '/' },
            { label: 'Video Lectures', path: '/videos' },
            { label: subject?.title || 'Subject' }
          ]} />
        </div>
      </div>

      {/* Hero */}
      <AnimatedHero pageType="videos" compact>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <button
              onClick={() => navigate('/videos')}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium mb-3 transition-colors group"
            >
              <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back to All Videos
            </button>
            <div className="flex items-center gap-3 mb-2">
              {subject?.icon && (
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl border border-white/20">
                  {(subject.icon.startsWith('http') || subject.icon.startsWith('/') || subject.icon.startsWith('data:')) ?
                    <img src={subject.icon} alt={subject.title} className="w-full h-full object-cover rounded-xl" /> :
                    subject.icon
                  }
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-extrabold text-white animate-slide-up leading-tight">
                {subject?.title || 'Loading...'}
              </h1>
            </div>
            {subject?.description && (
              <p className="text-white/70 text-sm mb-4 animate-slide-up max-w-xl" style={{ animationDelay: '0.1s' }}>
                {subject.description}
              </p>
            )}
            <SearchBox
              placeholder={`Search in ${subject?.title || 'videos'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              iconColorClass="group-focus-within:text-rose-500"
              compact
            />
          </div>

          {!loading && subject && (
            <div className="hidden md:grid grid-cols-2 gap-3 lg:w-[320px] animate-slide-in-right">
              {[
                { icon: Film, label: `${totalVideos} Videos`, color: 'bg-rose-500' },
                { icon: Sparkles, label: `${freeVideos} Free`, color: 'bg-emerald-500' },
                { icon: BookOpen, label: `${subject.chapters?.length || 0} Chapters`, color: 'bg-pink-500' },
                { icon: Award, label: `${totalVideos - freeVideos} Pro`, color: 'bg-amber-500' }
              ].map((feature, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 p-2.5 rounded-xl flex items-center gap-2.5 hover:bg-white/15 transition-colors">
                  <div className={`${feature.color} p-1.5 rounded-lg shadow-lg`}>
                    <feature.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-white font-bold text-xs">{feature.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AnimatedHero>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <SubjectSkeleton />
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-red-100 animate-fade-in">
            <RefreshCw className="w-10 h-10 mx-auto text-red-400 mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">{error === 'Subject not found' ? 'Subject Not Found' : 'Failed to Load'}</h3>
            <p className="text-sm text-gray-500 mb-5">{error}</p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/videos" className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                ← Back to Videos
              </Link>
              <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:shadow-lg transition-all">
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-8">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-4" style={{ animation: 'fadeIn 0.4s ease-out 0.1s both' }}>
                <button
                  onClick={() => setShowFreeOnly(!showFreeOnly)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 shadow-sm border ${
                    showFreeOnly
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-600'
                  }`}
                >
                  <Sparkles className={`w-3 h-3 ${showFreeOnly ? 'text-emerald-500' : ''}`} />
                  Free Only
                </button>

                <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm ml-auto">
                  <button
                    onClick={() => setViewMode('chapters')}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'chapters' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Chapters"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'grid' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Grid"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-xs text-gray-400 hidden sm:inline">
                  {viewMode === 'grid' ? filteredAllVideos.length : filteredChapters.reduce((s, ch) => s + (ch.videos?.length || 0) + (ch.topics?.reduce((ts, t) => ts + (t.videos?.length || 0), 0) || 0), 0)} videos
                </span>

                {(searchQuery || showFreeOnly) && (
                  <button onClick={clearFilters} className="text-xs text-rose-500 font-medium hover:underline">
                    Clear
                  </button>
                )}
              </div>

              {/* Active Filters */}
              {(searchQuery || showFreeOnly) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  <span className="text-xs text-gray-500">Active:</span>
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium border border-rose-100">
                      "{searchQuery}"
                      <button onClick={() => setSearchQuery('')} className="hover:bg-rose-100 rounded-full p-0.5 transition-all">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                  {showFreeOnly && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium border border-emerald-100">
                      Free Only
                      <button onClick={() => setShowFreeOnly(false)} className="hover:bg-emerald-100 rounded-full p-0.5 transition-all">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* Featured / Unassigned Videos */}
              {filteredUnassigned.length > 0 && viewMode === 'chapters' && (
                <div className="mb-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-bounce-subtle" />
                    Featured Videos
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredUnassigned.map((video, idx) => (
                      <VideoCard key={video._id || idx} video={video} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              {viewMode === 'grid' ? (
                filteredAllVideos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredAllVideos.map((video, idx) => (
                      <VideoCard key={video._id || idx} video={video} index={idx} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <VideoOff className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-900 mb-1">No Videos Found</h3>
                    <p className="text-sm text-gray-500 mb-4">Try adjusting your search or filters</p>
                    {(searchQuery || showFreeOnly) && (
                      <button onClick={clearFilters} className="px-5 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold rounded-xl">
                        Clear Filters
                      </button>
                    )}
                  </div>
                )
              ) : (
                filteredChapters.length > 0 ? (
                  <div className="space-y-3">
                    {filteredChapters.map((chapter, idx) => (
                      <ChapterSection
                        key={chapter._id || idx}
                        chapter={chapter}
                        subjectColor={accentColor}
                        isExpanded={expandedChapters[chapter._id]}
                        onToggle={toggleChapter}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <VideoOff className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-900 mb-1">
                      {searchQuery || showFreeOnly ? 'No Videos Found' : 'No Chapters Available'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {searchQuery || showFreeOnly ? 'Try adjusting your search or filters' : 'Videos will appear here once organized'}
                    </p>
                    {(searchQuery || showFreeOnly) && (
                      <button onClick={clearFilters} className="px-5 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold rounded-xl">
                        Clear Filters
                      </button>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="space-y-6">
                {/* Subject Stats */}
                <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out 0.15s both' }}>
                  <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Subject Stats
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center p-3 bg-rose-50/60 rounded-xl border border-rose-100/50">
                      <div className="flex items-center gap-1.5 text-rose-600 mb-1">
                        <Film className="w-3.5 h-3.5" />
                        <span className="font-bold text-lg">{totalVideos}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Videos</p>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-emerald-50/60 rounded-xl border border-emerald-100/50">
                      <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="font-bold text-lg">{freeVideos}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Free</p>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-purple-50/60 rounded-xl border border-purple-100/50">
                      <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span className="font-bold text-lg">{subject?.chapters?.length || 0}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chapters</p>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-amber-50/60 rounded-xl border border-amber-100/50">
                      <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                        <Award className="w-3.5 h-3.5" />
                        <span className="font-bold text-lg">{totalVideos - freeVideos}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Pro</p>
                    </div>
                  </div>
                </section>

                {/* Chapter Quick Nav */}
                {subject?.chapters?.length > 0 && (
                  <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out 0.25s both' }}>
                    <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-rose-500" />
                      Chapters
                    </h2>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {subject.chapters.map((chapter, idx) => (
                        <button
                          key={chapter._id || idx}
                          onClick={() => {
                            setViewMode('chapters')
                            setExpandedChapters(prev => ({ ...prev, [chapter._id]: true }))
                            // Scroll to chapter
                            document.getElementById(`chapter-content-${chapter._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-rose-50 transition-colors group/nav"
                        >
                          <div className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0" style={{ backgroundColor: accentColor + '15' }}>
                            {chapter.icon || <BookOpen className="w-3 h-3" style={{ color: accentColor }} />}
                          </div>
                          <span className="text-xs font-medium text-gray-700 truncate group-hover/nav:text-rose-500 transition-colors flex-1">{chapter.title}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{chapter.videoCount || chapter.videos?.length || 0}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Learning Tip */}
                <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out 0.35s both' }}>
                  <div className="p-4 bg-rose-50/80 rounded-xl border border-rose-100/60">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-rose-500" />
                      <span className="text-xs font-bold text-rose-900">Study Tip</span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      Complete all videos in a chapter before moving to the next. Take the chapter test right after to reinforce your learning.
                    </p>
                  </div>
                </section>

                {/* Pro Pass CTA */}
                <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 rounded-2xl p-6 text-white text-center relative overflow-hidden" style={{ animation: 'fadeIn 0.5s ease-out 0.4s both' }}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 animate-bounce-subtle" />
                      <h3 className="text-base font-bold">Unlock All Videos</h3>
                    </div>
                    <p className="text-pink-100 text-xs mt-1 mb-4 px-2">
                      Get Pro Pass for unlimited access
                    </p>
                    <Link
                      to="/pass"
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-white text-rose-500 text-sm font-bold rounded-xl hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-95 group/btn"
                    >
                      <Sparkles className="w-4 h-4 transition-transform group-hover/btn:rotate-12 duration-300" />
                      Get Pro Pass
                      <MoveRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 duration-300" />
                    </Link>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoSubject
