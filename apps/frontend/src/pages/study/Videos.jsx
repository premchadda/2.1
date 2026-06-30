import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { AnimatedHero } from '../../shared/components'
import {
  Search, Play, Filter, Clock, Lock, ChevronRight, ChevronDown,
  Video, BookOpen, FolderOpen, X, RefreshCw, VideoOff,
  Grid, List, Sparkles, Flame, TrendingUp
} from 'lucide-react'
import api from '../../shared/lib/api'

// ── Video Card ──────────────────────────────────────────────
const VideoCard = ({ video, index = 0 }) => {
  const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()}/mqdefault.jpg`

  return (
    <Link
      to={`/videos/${video._id || video.id}`}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/80 to-pink-600/80 items-center justify-center text-white text-4xl hidden">
          <Play className="w-10 h-10" />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 text-rose-500 ml-0.5" />
          </div>
        </div>
        {!video.isFree && video.isPro && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-full flex items-center gap-0.5 shadow-lg">
            <Lock className="w-2.5 h-2.5" /> PRO
          </div>
        )}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded">
            {video.duration}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-rose-500 transition-colors text-xs leading-snug">
          {video.title}
        </h3>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {video.instructor || 'Expert Faculty'}
          </span>
          <span>{video.views?.toLocaleString() || 0} views</span>
        </div>
      </div>
    </Link>
  )
}

// ── Trending Card (horizontal) ──────────────────────────────
const TrendingCard = ({ video }) => {
  const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()}/mqdefault.jpg`

  return (
    <Link
      to={`/videos/${video._id || video.id}`}
      className="group flex-shrink-0 w-44 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all"
    >
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        <img src={thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-rose-500 ml-0.5" />
          </div>
        </div>
        {!video.isFree && video.isPro && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold rounded-full">PRO</div>
        )}
        {video.duration && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[9px] rounded">{video.duration}</div>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-rose-500 transition-colors text-[11px] leading-snug">{video.title}</h3>
        <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
          <span>{video.views?.toLocaleString() || 0} views</span>
        </div>
      </div>
    </Link>
  )
}

// ── Loading Skeleton ────────────────────────────────────────
const VideoSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
        <div className="aspect-video bg-gray-200" />
        <div className="p-3 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
          <div className="h-2 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
)

// ── Empty State ─────────────────────────────────────────────
const EmptyState = ({ onClear }) => (
  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
    <div className="text-4xl mb-4">📺</div>
    <h3 className="text-lg font-bold text-gray-900">No Videos Found</h3>
    <p className="text-gray-500 mt-2">Try adjusting your filters or search</p>
    <button onClick={onClear} className="mt-3 text-sm font-medium text-rose-500 hover:underline">Clear all filters</button>
  </div>
)

// ── Sort Options ───────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Viewed' },
  { value: 'duration-asc', label: 'Shortest' },
  { value: 'duration-desc', label: 'Longest' },
]

// ── Main Videos Component ──────────────────────────────────
function Videos() {
  const [hierarchicalData, setHierarchicalData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')

  // Fetch hierarchical video data
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get('/api/study/videos/hierarchical')
        if (response.data.success) {
          setHierarchicalData(response.data.data)
        }
      } catch (err) {
        console.error('Failed to fetch videos:', err)
        setError('Failed to load video content. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchVideos()
  }, [])

  // All videos flattened
  const allVideos = useMemo(() => {
    const videos = []
    hierarchicalData.forEach((subject) => {
      const subjTitle = subject.title
      const subjIcon = subject.icon || '📚'
      subject.chapters?.forEach((chapter) => {
        chapter.videos?.forEach((v) => videos.push({ ...v, subject: subjTitle, subjectIcon: subjIcon, chapter: chapter.title }))
        chapter.topics?.forEach((topic) => {
          topic.videos?.forEach((v) => videos.push({ ...v, subject: subjTitle, subjectIcon: subjIcon, chapter: chapter.title, topic: topic.title }))
        })
      })
      subject.unassignedVideos?.forEach((v) => videos.push({ ...v, subject: subjTitle, subjectIcon: subjIcon }))
    })
    return videos
  }, [hierarchicalData])

  // Trending videos (top by views)
  const trendingVideos = useMemo(() => {
    return [...allVideos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6)
  }, [allVideos])

  // Sort helper
  const sortVideos = useCallback((videos, sort) => {
    const sorted = [...videos]
    switch (sort) {
      case 'popular':
        return sorted.sort((a, b) => (b.views || 0) - (a.views || 0))
      case 'duration-asc':
        return sorted.sort((a, b) => (parseDuration(a.duration) || 9999) - (parseDuration(b.duration) || 9999))
      case 'duration-desc':
        return sorted.sort((a, b) => (parseDuration(b.duration) || 0) - (parseDuration(a.duration) || 0))
      case 'newest':
      default:
        return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    }
  }, [])

  // Filtered + sorted videos
  const filteredVideos = useMemo(() => {
    let result = allVideos.filter((video) => {
      if (selectedSubject !== 'all') {
        const subj = hierarchicalData.find((s) => s._id === selectedSubject || s.slug === selectedSubject)
        if (video.subject !== subj?.title) return false
      }
      if (showFreeOnly && !video.isFree) return false
      if (searchQuery && !video.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
    return sortVideos(result, sortBy)
  }, [allVideos, searchQuery, selectedSubject, showFreeOnly, sortBy, hierarchicalData, sortVideos])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedSubject('all')
    setShowFreeOnly(false)
    setSortBy('newest')
  }

  const totalVideos = allVideos.length
  const freeVideos = allVideos.filter((v) => v.isFree).length
  const hasFilters = searchQuery || selectedSubject !== 'all' || showFreeOnly

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Video Lectures' }]} />
        </div>
      </div>

      {/* Hero */}
      <AnimatedHero pageType="videos" compact>
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🎬</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 animate-slide-up">Video Lectures</h1>
          <p className="text-white/80 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Learn from expert faculty with our comprehensive video courses
          </p>
          {!loading && (
            <div className="mt-4 flex items-center justify-center gap-4 text-white/70 text-sm animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <span className="flex items-center gap-1"><Video className="w-4 h-4" />{totalVideos} Videos</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Sparkles className="w-4 h-4" />{freeVideos} Free</span>
              <span>•</span>
              <span>{hierarchicalData.length} Subjects</span>
            </div>
          )}
        </div>
      </AnimatedHero>

      {/* Main Content — sidebar + grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* LEFT: Subject sidebar */}
          <div className="lg:w-52 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Subjects</h2>
              </div>
              <div className="max-h-[60vh] overflow-y-auto py-1">
                <button
                  onClick={() => setSelectedSubject('all')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-l-3 ${
                    selectedSubject === 'all'
                      ? 'bg-rose-50 border-l-4 border-rose-500 text-rose-700 font-semibold'
                      : 'border-l-4 border-transparent text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">📋</span>
                  <span className="text-xs flex-1">All Videos</span>
                  <span className="text-[10px] text-gray-400">{totalVideos}</span>
                </button>
                {hierarchicalData.map((subject) => {
                  const isActive = selectedSubject === subject._id || selectedSubject === subject.slug
                  const count = subject.totalVideos || 0
                  return (
                    <button
                      key={subject._id}
                      onClick={() => setSelectedSubject(isActive ? 'all' : subject._id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-l-3 ${
                        isActive
                          ? 'bg-rose-50 border-l-4 border-rose-500 text-rose-700 font-semibold'
                          : 'border-l-4 border-transparent text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{subject.icon || '📚'}</span>
                      <span className="text-xs flex-1 truncate">{subject.title}</span>
                      <span className="text-[10px] text-gray-400">{count}</span>
                    </button>
                  )
                })}
                {hierarchicalData.length === 0 && !loading && (
                  <div className="px-3 py-4 text-center text-[11px] text-gray-400">No subjects yet</div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Top bar + Trending + Grid */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Top bar: search + filters */}
            <div className="bg-white rounded-lg border border-gray-100 p-2">
              <div className="flex flex-row items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search videos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md bg-white cursor-pointer hover:bg-gray-50 flex-shrink-0">
                  <input type="checkbox" checked={showFreeOnly} onChange={(e) => setShowFreeOnly(e.target.checked)} className="w-3.5 h-3.5 rounded text-rose-500 focus:ring-rose-500" />
                  <span className="text-xs text-gray-700">Free</span>
                </label>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-rose-500 flex-shrink-0"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <div className="flex items-center bg-gray-100 rounded-md p-0.5 flex-shrink-0">
                  <button onClick={() => setViewMode('grid')} className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-rose-500' : 'text-gray-400'}`} title="Grid view">
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-rose-500' : 'text-gray-400'}`} title="List view">
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-xs text-gray-500 flex-shrink-0 hidden md:inline">{filteredVideos.length} videos</span>

                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-rose-500 font-medium hover:underline flex-shrink-0">Clear</button>
                )}
              </div>
            </div>

            {/* Loading */}
            {loading ? (
              <VideoSkeleton />
            ) : error ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-red-100">
                <div className="text-red-500 mb-4"><RefreshCw className="w-12 h-12 mx-auto" /></div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Failed to Load Videos</h3>
                <p className="text-gray-500 mb-6">{error}</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-rose-500 text-white font-semibold rounded-lg hover:bg-rose-600 transition">Try Again</button>
              </div>
            ) : (
              <>
                {/* Trending row — only when no filters active */}
                {!hasFilters && trendingVideos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Flame className="w-4 h-4 text-rose-500" />
                      <h2 className="text-sm font-bold text-gray-900">Trending</h2>
                      <span className="text-xs text-gray-400">Most watched</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                      {trendingVideos.map((video) => (
                        <TrendingCard key={video._id} video={video} />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Videos grid */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    {selectedSubject !== 'all' ? (
                      <>
                        {(() => {
                          const subj = hierarchicalData.find((s) => s._id === selectedSubject || s.slug === selectedSubject)
                          return <span className="text-base">{subj?.icon || '📚'}</span>
                        })()}
                        <h2 className="text-sm font-bold text-gray-900">
                          {hierarchicalData.find((s) => s._id === selectedSubject || s.slug === selectedSubject)?.title || 'Videos'}
                        </h2>
                      </>
                    ) : (
                      <h2 className="text-sm font-bold text-gray-900">All Videos</h2>
                    )}
                    <span className="text-xs text-gray-400">{filteredVideos.length}</span>
                  </div>

                  {filteredVideos.length > 0 ? (
                    viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredVideos.map((video, idx) => (
                          <VideoCard key={video._id || idx} video={video} index={idx} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredVideos.map((video, idx) => (
                          <Link
                            key={video._id || idx}
                            to={`/videos/${video._id || video.id}`}
                            className="flex gap-3 bg-white rounded-xl border border-gray-100 p-2.5 hover:shadow-md hover:border-rose-200 transition-all"
                          >
                            <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <img
                                src={video.thumbnail || `https://img.youtube.com/vi/${video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()}/mqdefault.jpg`}
                                alt={video.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                <Play className="w-6 h-6 text-white/80" />
                              </div>
                              {video.duration && (
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] rounded">{video.duration}</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 line-clamp-2 text-xs leading-snug">{video.title}</h3>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                                <span>{video.instructor || 'Expert Faculty'}</span>
                                <span>·</span>
                                <span>{video.views?.toLocaleString() || 0} views</span>
                              </div>
                              {video.chapter && <span className="text-[10px] text-gray-400">{video.subject} · {video.chapter}</span>}
                            </div>
                            {!video.isFree && video.isPro && (
                              <div className="flex-shrink-0 self-start">
                                <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold rounded-full flex items-center gap-0.5">
                                  <Lock className="w-2 h-2" /> PRO
                                </span>
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )
                  ) : (
                    <EmptyState onClear={clearFilters} />
                  )}
                </div>
              </>
            )}

            {/* CTA */}
            {!loading && !error && (
              <div className="mt-8 bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-6 text-center text-white">
                <h3 className="text-xl font-bold mb-2">Unlock All Videos</h3>
                <p className="text-rose-100 mb-4 text-sm">Get Pro Pass to access all premium video lectures</p>
                <Link to="/pass" className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-rose-500 font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105 text-sm">
                  <Sparkles className="w-4 h-4" /> Get Pro Pass <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper: parse "MM:SS" or "HH:MM:SS" to seconds
function parseDuration(d) {
  if (!d) return null
  if (typeof d === 'number') return d
  const parts = String(d).split(':').map(Number)
  if (parts.some(isNaN)) return null
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

export default Videos