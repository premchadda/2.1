import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { 
  Play, Clock, Eye, Lock, ChevronLeft, ChevronRight, ChevronDown,
  BookOpen, Video, Share2, Bookmark, BookmarkCheck, ThumbsUp,
  MessageCircle, Download, Shield, CheckCircle, ArrowLeft,
  User, Calendar, Tag, ExternalLink, Copy, Check, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import { AnimatedHero } from '../../shared/components'
import VideoPlayer from '../../shared/components/common/VideoPlayer'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import api from '../../shared/lib/api'

// Security Badge Component
function SecurityBadge({ isEncrypted, encryptionType }) {
  if (!isEncrypted) return null
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-semibold">
      <Shield className="w-3.5 h-3.5" />
      FortSpy {encryptionType || 'AES-256'} Encrypted
    </div>
  )
}

// Video Meta Info Component
function VideoMetaInfo({ video }) {
  const metaItems = []
  if (video.duration) metaItems.push({ icon: Clock, label: video.duration })
  if (video.views !== undefined) metaItems.push({ icon: Eye, label: `${video.views?.toLocaleString() || 0} views` })
  if (video.createdAt) metaItems.push({ icon: Calendar, label: new Date(video.createdAt).toLocaleDateString() })
  if (video.instructor) metaItems.push({ icon: User, label: video.instructor })

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
      {metaItems.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <item.icon className="w-4 h-4" />
          {item.label}
        </span>
      ))}
    </div>
  )
}

// Playlist/Chapter Sidebar Component
function PlaylistSidebar({ chapters, currentVideoId, onVideoSelect, subjectTitle }) {
  const [expandedChapters, setExpandedChapters] = useState({})

  useEffect(() => {
    // Auto-expand the chapter containing the current video
    if (chapters && currentVideoId) {
      for (const chapter of chapters) {
        const allVideos = [
          ...(chapter.videos || []),
          ...(chapter.topics?.flatMap(t => t.videos || []) || [])
        ]
        if (allVideos.some(v => (v._id || v.id) === currentVideoId)) {
          setExpandedChapters(prev => ({ ...prev, [chapter._id]: true }))
          break
        }
      }
    }
  }, [chapters, currentVideoId])

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }))
  }

  let globalIndex = 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-brand-start/5 to-brand-end/5">
        <h3 className="font-bold text-gray-900 text-sm">{subjectTitle || 'Playlist'}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {chapters?.reduce((sum, ch) => sum + (ch.videoCount || ch.videos?.length || 0), 0) || 0} videos
        </p>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        {chapters?.map((chapter) => {
          const videos = chapter.videos || []
          const topicVideos = chapter.topics?.flatMap(t => t.videos || []) || []
          const allVideos = [...videos, ...topicVideos]
          const isExpanded = expandedChapters[chapter._id]

          return (
            <div key={chapter._id} className="border-b border-gray-50 last:border-0">
              <button
                onClick={() => toggleChapter(chapter._id)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-xs font-semibold text-gray-700 truncate">{chapter.title}</span>
                <span className="text-xs text-gray-400">{allVideos.length}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && (
                <div className="bg-gray-50/50">
                  {allVideos.map((video) => {
                    const idx = globalIndex++
                    const isActive = (video._id || video.id) === currentVideoId
                    return (
                      <button
                        key={video._id || idx}
                        onClick={() => onVideoSelect(video)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-brand-start/10 border-l-2 border-brand-start' : 'hover:bg-gray-100 border-l-2 border-transparent'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isActive ? 'bg-brand-start text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {isActive ? <Play className="w-3 h-3 ml-0.5" /> : idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${isActive ? 'text-brand-start' : 'text-gray-700'}`}>
                            {video.title}
                          </p>
                          {video.duration && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {video.duration}
                            </p>
                          )}
                        </div>
                        {!video.isFree && video.isPro && (
                          <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Related Videos Component
function RelatedVideos({ videos, currentVideoId }) {
  const related = useMemo(() => {
    return videos
      .filter(v => (v._id || v.id) !== currentVideoId)
      .slice(0, 6)
  }, [videos, currentVideoId])

  if (related.length === 0) return null

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Related Videos</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {related.map((video, idx) => {
          const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()}/mqdefault.jpg`
          return (
            <Link
              key={video._id || idx}
              to={`/videos/${video._id || video.id}`}
              className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              <div className="relative aspect-video bg-gray-100">
                <img src={thumbnailUrl} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-brand-start ml-0.5" />
                  </div>
                </div>
                {video.duration && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded">
                    {video.duration}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-brand-start transition-colors">
                  {video.title}
                </h4>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                  {video.instructor && <span>{video.instructor}</span>}
                  {video.views !== undefined && <span>{video.views?.toLocaleString()} views</span>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// Main VideoDetail Component
export default function VideoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [video, setVideo] = useState(null)
  const [chapters, setChapters] = useState([])
  const [subjectTitle, setSubjectTitle] = useState('')
  const [allSubjectVideos, setAllSubjectVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showPlayer, setShowPlayer] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDescription, setShowDescription] = useState(true)

  // Fetch video details
  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true)
        setError(null)

        // Try the public video endpoint first
        try {
          const response = await api.get(`/api/videos/${id}`)
          if (response.data.success) {
            const videoData = response.data.data
            setVideo(videoData)
            setSubjectTitle(videoData.subject || '')
            
            // Fetch related videos from the same subject
            if (videoData.subjectId || videoData.studyMaterialId) {
              try {
                const hierResponse = await api.get('/api/study/videos/hierarchical')
                if (hierResponse.data.success) {
                  const subjects = hierResponse.data.data
                  // Find the subject this video belongs to
                  for (const subject of subjects) {
                    const allVids = subject.chapters?.flatMap(ch => [
                      ...(ch.videos || []),
                      ...(ch.topics?.flatMap(t => t.videos || []) || [])
                    ]) || []
                    if (allVids.some(v => (v._id || v.id) === id)) {
                      setChapters(subject.chapters || [])
                      setSubjectTitle(subject.title)
                      setAllSubjectVideos(allVids)
                      break
                    }
                  }
                  // If not found in hierarchical, use flat list
                  if (allSubjectVideos.length === 0) {
                    const flatVideos = subjects.flatMap(s => 
                      s.chapters?.flatMap(ch => [
                        ...(ch.videos || []),
                        ...(ch.topics?.flatMap(t => t.videos || []) || [])
                      ]) || []
                    )
                    setAllSubjectVideos(flatVideos)
                  }
                }
              } catch {
                // Hierarchical fetch failed, continue without playlist
              }
            }
            setShowPlayer(true)
            return
          }
        } catch {
          // Try hierarchical endpoint
        }

        // Fallback: search in hierarchical data
        const hierResponse = await api.get('/api/study/videos/hierarchical')
        if (hierResponse.data.success) {
          const subjects = hierResponse.data.data
          for (const subject of subjects) {
            const allVids = subject.chapters?.flatMap(ch => [
              ...(ch.videos || []),
              ...(ch.topics?.flatMap(t => t.videos || []) || [])
            ]) || []
            const found = allVids.find(v => (v._id || v.id) === id)
            if (found) {
              setVideo({
                ...found,
                videoUrl: found.videoUrl || found.url,
                subject: subject.title
              })
              setChapters(subject.chapters || [])
              setSubjectTitle(subject.title)
              setAllSubjectVideos(allVids)
              setShowPlayer(true)
              return
            }
          }
        }

        setError('Video not found')
      } catch (err) {
        console.error('Failed to fetch video:', err)
        setError('Failed to load video. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchVideo()
  }, [id])

  const handleVideoSelect = (selectedVideo) => {
    navigate(`/videos/${selectedVideo._id || selectedVideo.id}`)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked)
  }

  // Find prev/next videos
  const currentIndex = allSubjectVideos.findIndex(v => (v._id || v.id) === id)
  const prevVideo = currentIndex > 0 ? allSubjectVideos[currentIndex - 1] : null
  const nextVideo = currentIndex < allSubjectVideos.length - 1 ? allSubjectVideos[currentIndex + 1] : null

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="aspect-video bg-gray-200 rounded-xl" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-md">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{error || 'Video Not Found'}</h2>
          <p className="text-gray-500 mb-6">The video you're looking for doesn't exist or has been removed.</p>
          <Link to="/videos" className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-start text-white font-semibold rounded-lg hover:opacity-90 transition">
            <ArrowLeft className="w-4 h-4" />
            Back to Videos
          </Link>
        </div>
      </div>
    )
  }

  const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()}/sddefault.jpg`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Videos', path: '/videos' },
              { label: subjectTitle, path: '/videos' },
              { label: video.title }
            ]}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player */}
            <div className="bg-black rounded-xl overflow-hidden shadow-lg">
              {showPlayer && (
                <VideoPlayer
                  isOpen={showPlayer}
                  onClose={() => setShowPlayer(false)}
                  videoData={{
                    title: video.title,
                    description: video.description,
                    url: video.videoUrl || video.url
                  }}
                />
              )}
              {/* Thumbnail fallback when player is closed */}
              {!showPlayer && (
                <div className="relative aspect-video cursor-pointer group" onClick={() => setShowPlayer(true)}>
                  <img src={thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl">
                      <Play className="w-10 h-10 text-brand-start ml-1" />
                    </div>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/80 text-white text-sm font-medium rounded-lg">
                      {video.duration}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Video Title & Meta */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{video.title}</h1>
                  <VideoMetaInfo video={video} />
                </div>
                {video.isEncrypted && (
                  <SecurityBadge isEncrypted={video.isEncrypted} encryptionType={video.encryptionType} />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <button
                  onClick={() => setIsLiked(!isLiked)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isLiked ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  {isLiked ? 'Liked' : 'Like'}
                </button>
                <button
                  onClick={handleBookmark}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isBookmarked ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  {isBookmarked ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Share'}
                </button>
                {video.videoUrl && (
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                )}
              </div>

              {/* FortSpy Security Info */}
              {video.isEncrypted && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-800">Protected by FortSpy</h4>
                      <p className="text-xs text-emerald-700 mt-1">
                        This video is encrypted at the pixel level using AES-256 military-grade encryption.
                        Frames are decrypted in real-time during playback for secure viewing.
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {video.encryptionType || 'AES-256-CTR'}
                        </span>
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Pixel-level encryption
                        </span>
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Real-time decryption
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {video.description && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <button
                    onClick={() => setShowDescription(!showDescription)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDescription ? 'rotate-180' : ''}`} />
                    Description
                  </button>
                  {showDescription && (
                    <div className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {video.description}
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {video.tags?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {video.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Prev/Next Navigation */}
            <div className="flex items-center gap-3">
              {prevVideo ? (
                <Link
                  to={`/videos/${prevVideo._id || prevVideo.id}`}
                  className="flex-1 flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-brand-start/30 hover:shadow-sm transition-all group"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-brand-start transition-colors" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Previous</p>
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-start transition-colors">{prevVideo.title}</p>
                  </div>
                </Link>
              ) : <div className="flex-1" />}
              {nextVideo ? (
                <Link
                  to={`/videos/${nextVideo._id || nextVideo.id}`}
                  className="flex-1 flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-brand-start/30 hover:shadow-sm transition-all group text-right"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Next</p>
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-start transition-colors">{nextVideo.title}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-start transition-colors" />
                </Link>
              ) : <div className="flex-1" />}
            </div>

            {/* Related Videos */}
            <RelatedVideos videos={allSubjectVideos} currentVideoId={id} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              <PlaylistSidebar
                chapters={chapters}
                currentVideoId={id}
                onVideoSelect={handleVideoSelect}
                subjectTitle={subjectTitle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
