import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { AnimatedHero } from '../../shared/components'
import { 
  Search, Play, Filter, Clock, Lock, ChevronRight, ChevronDown, 
  Video, BookOpen, FolderOpen, X, RefreshCw, VideoOff, Loader2,
  Grid, List, Sparkles
} from 'lucide-react'
import api from '../../shared/lib/api'
import SearchBox from '../../shared/components/common/SearchBox'

// Video Card Component
const VideoCard = ({ video, index }) => {
  const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()}/mqdefault.jpg`
  
  return (
    <Link 
      to={`/videos/${video._id || video.id}`}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-hover-card transition-all duration-300 animate-slide-in-up"
      style={{ animationDelay: `${index * 0.05}s` }}
      aria-label={`Watch video: ${video.title}`}
    >
      {/* Thumbnail */}
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
        <div className="absolute inset-0 bg-gradient-to-br from-brand-start/80 to-brand-end/80 items-center justify-center text-white text-4xl hidden">
          <Play className="w-12 h-12" />
        </div>
        
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-6 h-6 text-brand-start ml-1" />
          </div>
        </div>
        
        {/* Pro Badge */}
        {!video.isFree && video.isPro && (
          <div className="absolute top-2 right-2 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg">
            <Lock className="w-3 h-3" /> PRO
          </div>
        )}
        
        {/* Duration Badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded-md">
            {video.duration}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-brand-start transition-colors text-sm leading-snug">
          {video.title}
        </h3>
        <div className="flex items-center justify-between mt-2.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {video.instructor || 'Expert Faculty'}
          </span>
          <span>{video.views?.toLocaleString() || 0} views</span>
        </div>
      </div>
    </Link>
  )
}

// Chapter Section Component
const ChapterSection = ({ chapter, subjectColor, isExpanded, onToggle }) => {
  const hasVideos = chapter.videos?.length > 0
  const hasTopics = chapter.topics?.length > 0
  const totalVideos = chapter.videoCount || chapter.videos?.length || 0

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Chapter Header */}
      <button
        onClick={() => onToggle(chapter._id)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls={`chapter-content-${chapter._id}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (subjectColor || '#667eea') + '20' }}
          >
            {chapter.icon ? (
              <span className="text-lg">{chapter.icon}</span>
            ) : (
              <BookOpen className="w-5 h-5" style={{ color: subjectColor || '#667eea' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{chapter.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalVideos} video{totalVideos !== 1 ? 's' : ''}
              {hasTopics && ` • ${chapter.topics.length} topics`}
            </p>
          </div>
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Chapter Content */}
      {isExpanded && (
        <div 
          id={`chapter-content-${chapter._id}`}
          className="border-t border-gray-100 animate-slide-in-up"
        >
          {/* Direct Videos */}
          {hasVideos && (
            <div className="p-4 bg-gray-50/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {chapter.videos.map((video, idx) => (
                  <VideoCard key={video._id || idx} video={video} index={idx} />
                ))}
              </div>
            </div>
          )}

          {/* Topics within Chapter */}
          {hasTopics && chapter.topics.map((topic, topicIdx) => (
            <TopicSection 
              key={topic._id || topicIdx} 
              topic={topic} 
              subjectColor={subjectColor}
              defaultExpanded={false}
            />
          ))}

          {/* Empty State */}
          {!hasVideos && !hasTopics && (
            <div className="p-8 text-center text-gray-500">
              <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No videos available in this chapter</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Topic Section Component
const TopicSection = ({ topic, subjectColor, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const hasVideos = topic.videos?.length > 0

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div 
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (subjectColor || '#667eea') + '15' }}
          >
            <Video className="w-3 h-3" style={{ color: subjectColor || '#667eea' }} />
          </div>
          <span className="text-sm font-medium text-gray-700 truncate">{topic.title}</span>
          <span className="text-xs text-gray-400">({topic.videoCount || topic.videos?.length || 0})</span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      
      {isExpanded && hasVideos && (
        <div className="px-4 pb-4 bg-gray-50/30 animate-slide-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topic.videos.map((video, idx) => (
              <VideoCard key={video._id || idx} video={video} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Subject Accordion Component
const SubjectAccordion = ({ subject, isExpanded, onToggle, expandedChapters, onChapterToggle }) => {
  const totalChapters = subject.chapters?.length || 0
  const totalVideos = subject.totalVideos || 0

  return (
    <div 
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-slide-in-up"
    >
      {/* Subject Header */}
      <button
        onClick={() => onToggle(subject._id)}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-50/50 transition-colors text-left group"
        aria-expanded={isExpanded}
        aria-controls={`subject-content-${subject._id}`}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner"
            style={{ backgroundColor: (subject.color || '#667eea') + '20' }}
          >
            {subject.icon || '📚'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-brand-start transition-colors">
              {subject.title}
            </h3>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                {totalVideos} videos
              </span>
              <span className="flex items-center gap-1">
                <FolderOpen className="w-4 h-4" />
                {totalChapters} chapters
              </span>
            </p>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180 bg-brand-start/10' : ''}`}>
          <ChevronDown className={`w-5 h-5 transition-colors ${isExpanded ? 'text-brand-start' : 'text-gray-400'}`} />
        </div>
      </button>

      {/* Subject Content */}
      {isExpanded && (
        <div 
          id={`subject-content-${subject._id}`}
          className="border-t border-gray-100 animate-slide-in-up"
        >
          {/* Unassigned Videos */}
          {subject.unassignedVideos?.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Featured Videos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subject.unassignedVideos.map((video, idx) => (
                  <VideoCard key={video._id || idx} video={video} index={idx} />
                ))}
              </div>
            </div>
          )}

          {/* Chapters */}
          {subject.chapters?.length > 0 ? (
            <div className="p-4 space-y-3">
              {subject.chapters.map((chapter, idx) => (
                <ChapterSection
                  key={chapter._id || idx}
                  chapter={chapter}
                  subjectColor={subject.color}
                  isExpanded={expandedChapters[chapter._id]}
                  onToggle={(id) => onChapterToggle(id)}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No chapters available</p>
              <p className="text-sm mt-1">Videos for this subject will be organized here</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Loading Skeleton
const VideoPageSkeleton = () => (
  <div className="space-y-6">
    {/* Search Skeleton */}
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-lg"></div>
    </div>
    
    {/* Subject Skeletons */}
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gray-200 rounded-xl"></div>
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
)

// Empty State Component
const EmptyState = ({ hasSearch, onClear }) => (
  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
    <div className="w-20 h-20 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
      <VideoOff className="w-10 h-10 text-gray-400" />
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">
      {hasSearch ? 'No Videos Found' : 'No Videos Available'}
    </h3>
    <p className="text-gray-500 mb-6 max-w-md mx-auto">
      {hasSearch 
        ? 'Try adjusting your search or filters to find what you\'re looking for'
        : 'Video lectures will be available here once published'
      }
    </p>
    {hasSearch && (
      <button
        onClick={onClear}
        className="px-6 py-2.5 bg-brand-start text-white font-semibold rounded-lg hover:opacity-90 transition"
      >
        Clear Filters
      </button>
    )}
  </div>
)

// Main Videos Component
function Videos() {
  const [hierarchicalData, setHierarchicalData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const [viewMode, setViewMode] = useState('hierarchical') // 'hierarchical' | 'grid'
  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [expandedChapters, setExpandedChapters] = useState({})

  // Fetch hierarchical video data
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await api.get('/api/study/videos/hierarchical')
        
        if (response.data.success) {
          setHierarchicalData(response.data.data)
          // Auto-expand first subject
          if (response.data.data.length > 0) {
            setExpandedSubjects({ [response.data.data[0]._id]: true })
          }
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

  // Toggle subject expansion
  const toggleSubject = useCallback((subjectId) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }))
  }, [])

  // Toggle chapter expansion
  const toggleChapter = useCallback((chapterId) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }))
  }, [])

  // Filter videos based on search and filters
  const filteredData = useMemo(() => {
    if (!searchQuery && selectedSubject === 'all' && !showFreeOnly) {
      return hierarchicalData
    }

    return hierarchicalData
      .filter(subject => {
        // Subject filter
        if (selectedSubject !== 'all' && subject._id !== selectedSubject && subject.slug !== selectedSubject) {
          return false
        }
        return true
      })
      .map(subject => {
        if (!searchQuery && !showFreeOnly) return subject

        // Filter videos within subject
        const filterVideos = (videos) => {
          return videos?.filter(video => {
            if (showFreeOnly && !video.isFree) return false
            if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
            return true
          }) || []
        }

        const filteredChapters = subject.chapters?.map(chapter => ({
          ...chapter,
          videos: filterVideos(chapter.videos),
          topics: chapter.topics?.map(topic => ({
            ...topic,
            videos: filterVideos(topic.videos)
          })).filter(topic => topic.videos?.length > 0)
        })).filter(chapter => chapter.videos?.length > 0 || chapter.topics?.length > 0)

        const filteredUnassigned = filterVideos(subject.unassignedVideos)

        const totalFilteredVideos = 
          filteredUnassigned.length +
          filteredChapters?.reduce((sum, ch) => sum + (ch.videos?.length || 0) + 
            (ch.topics?.reduce((tSum, t) => tSum + (t.videos?.length || 0), 0) || 0), 0) || 0

        if (totalFilteredVideos === 0 && (searchQuery || showFreeOnly)) return null

        return {
          ...subject,
          chapters: filteredChapters,
          unassignedVideos: filteredUnassigned,
          totalVideos: totalFilteredVideos
        }
      })
      .filter(Boolean)
  }, [hierarchicalData, searchQuery, selectedSubject, showFreeOnly])

  // Get all videos for grid view
  const allVideos = useMemo(() => {
    const videos = []
    hierarchicalData.forEach(subject => {
      subject.chapters?.forEach(chapter => {
        chapter.videos?.forEach(v => videos.push({ ...v, subject: subject.title, chapter: chapter.title }))
        chapter.topics?.forEach(topic => {
          topic.videos?.forEach(v => videos.push({ 
            ...v, 
            subject: subject.title, 
            chapter: chapter.title,
            topic: topic.title 
          }))
        })
      })
      subject.unassignedVideos?.forEach(v => videos.push({ ...v, subject: subject.title }))
    })
    return videos
  }, [hierarchicalData])

  // Filtered videos for grid view
  const filteredVideos = useMemo(() => {
    return allVideos.filter(video => {
      if (selectedSubject !== 'all' && video.subject !== hierarchicalData.find(s => s._id === selectedSubject || s.slug === selectedSubject)?.title) {
        return false
      }
      if (showFreeOnly && !video.isFree) return false
      if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [allVideos, searchQuery, selectedSubject, showFreeOnly, hierarchicalData])

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedSubject('all')
    setShowFreeOnly(false)
  }

  // Expand all subjects
  const expandAll = () => {
    const allExpanded = {}
    hierarchicalData.forEach(s => allExpanded[s._id] = true)
    setExpandedSubjects(allExpanded)
  }

  // Collapse all subjects
  const collapseAll = () => {
    setExpandedSubjects({})
    setExpandedChapters({})
  }

  // Stats
  const totalVideos = allVideos.length
  const freeVideos = allVideos.filter(v => v.isFree).length
  const subjectOptions = hierarchicalData.map(s => ({ value: s._id, label: s.title }))

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb 
            items={[
              { label: 'Home', path: '/' },
              { label: 'Video Lectures' }
            ]}
          />
        </div>
      </div>

      {/* Header with Animated Background */}
      <AnimatedHero pageType="videos" compact>
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🎬</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 animate-slide-up">Video Lectures</h1>
          <p className="text-white/80 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Learn from expert faculty with our comprehensive video courses
          </p>
          {!loading && (
            <div className="mt-4 flex items-center justify-center gap-4 text-white/70 text-sm animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <span className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                {totalVideos} Videos
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                {freeVideos} Free
              </span>
              <span>•</span>
              <span>{hierarchicalData.length} Subjects</span>
            </div>
          )}
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compact Search & Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-2 mb-4">
          <div className="flex flex-row items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-start focus:border-brand-start transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subject Filter */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start flex-shrink-0"
            >
              <option value="all">All Subjects</option>
              {subjectOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Free Only Toggle */}
            <label className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md bg-white cursor-pointer hover:bg-gray-50 flex-shrink-0">
              <input
                type="checkbox"
                checked={showFreeOnly}
                onChange={(e) => setShowFreeOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-brand-start focus:ring-brand-start"
              />
              <span className="text-xs text-gray-700">Free</span>
            </label>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-md p-0.5 flex-shrink-0">
              <button
                onClick={() => setViewMode('hierarchical')}
                className={`p-1 rounded ${viewMode === 'hierarchical' ? 'bg-white shadow-sm' : ''}`}
                title="Categories view"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                title="Grid view"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Results Count */}
            <span className="text-xs text-gray-500 flex-shrink-0 hidden md:inline">
              {viewMode === 'grid' ? `${filteredVideos.length} videos` : `${filteredData.length} subjects`}
            </span>

            {/* Clear Button */}
            {(searchQuery || selectedSubject !== 'all' || showFreeOnly) && (
              <button onClick={clearFilters} className="text-xs text-brand-start font-medium hover:underline flex-shrink-0">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || selectedSubject !== 'all' || showFreeOnly) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">Filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-start/10 text-brand-start rounded-full text-sm font-medium">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="hover:bg-brand-start/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedSubject !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-start/10 text-brand-start rounded-full text-sm font-medium">
                {subjectOptions.find(o => o.value === selectedSubject)?.label}
                <button onClick={() => setSelectedSubject('all')} className="hover:bg-brand-start/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {showFreeOnly && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Free Only
                <button onClick={() => setShowFreeOnly(false)} className="hover:bg-green-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <VideoPageSkeleton />
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-red-100">
            <div className="text-red-500 mb-4">
              <RefreshCw className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Failed to Load Videos</h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-brand-start text-white font-semibold rounded-lg hover:opacity-90 transition"
            >
              Try Again
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View
          filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredVideos.map((video, idx) => (
                <VideoCard key={video._id || idx} video={video} index={idx} />
              ))}
            </div>
          ) : (
            <EmptyState hasSearch={!!(searchQuery || showFreeOnly)} onClear={clearFilters} />
          )
        ) : (
          // Hierarchical View
          filteredData.length > 0 ? (
            <div className="space-y-4">
              {filteredData.map((subject, idx) => (
                <SubjectAccordion
                  key={subject._id || idx}
                  subject={subject}
                  isExpanded={expandedSubjects[subject._id]}
                  onToggle={toggleSubject}
                  expandedChapters={expandedChapters}
                  onChapterToggle={toggleChapter}
                />
              ))}
            </div>
          ) : (
            <EmptyState hasSearch={!!(searchQuery || showFreeOnly || selectedSubject !== 'all')} onClear={clearFilters} />
          )
        )}

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-brand-start to-brand-end rounded-2xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-2">Unlock All Videos</h3>
          <p className="text-purple-100 mb-6">Get Pro Pass to access all premium video lectures</p>
          <Link 
            to="/pass"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-brand-start font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105"
          >
            <Sparkles className="w-5 h-5" />
            Get Pro Pass
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Videos