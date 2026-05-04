import { useState, useEffect } from 'react'
import {
  Plus, Search, Edit2, Trash2, Play, Lock,
  Clock, Eye, User, X, Save, Video
} from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'

export default function VideosManager() {
  const [videos, setVideos] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    duration: '',
    thumbnail: '',
    isFree: false,
    views: '0',
    instructor: '',
    videoUrl: '',
    description: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [videosRes, subjectsRes] = await Promise.all([
        apiClient.get('/admin/videos'),
        apiClient.get('/admin/subjects').catch(() => ({ data: { data: [] } }))
      ])
      if (videosRes.data?.success) {
        setVideos(videosRes.data.data)
      }
      const fetchedSubjects = subjectsRes.data?.data || []
      setSubjects(fetchedSubjects)
      if (fetchedSubjects.length > 0 && !formData.subject) {
        setFormData(prev => ({ ...prev, subject: fetchedSubjects[0].name }))
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingVideo) {
        await apiClient.put(`/admin/videos/${editingVideo._id}`, formData)
        toast.success('Video updated successfully')
      } else {
        await apiClient.post('/admin/videos', formData)
        toast.success('Video created successfully')
      }
      fetchData()
      resetForm()
    } catch (error) {
      console.error('Failed to save video:', error)
      toast.error('Failed to save video')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this video?')) return
    try {
      await apiClient.delete(`/admin/videos/${id}`)
      toast.success('Video deleted successfully')
      fetchData()
    } catch (error) {
      console.error('Failed to delete video:', error)
      toast.error('Failed to delete video')
    }
  }

  const handleEdit = (video) => {
    setEditingVideo(video)
    setFormData({
      title: video.title,
      subject: video.subject,
      duration: video.duration,
      thumbnail: video.thumbnail || '',
      isFree: video.isFree,
      views: video.views || '0',
      instructor: video.instructor || '',
      videoUrl: video.videoUrl || '',
      description: video.description || ''
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingVideo(null)
    const defaultSubject = subjects.length > 0 ? subjects[0].name : ''
    setFormData({
      title: '',
      subject: defaultSubject,
      duration: '',
      thumbnail: '',
      isFree: false,
      views: '0',
      instructor: '',
      videoUrl: '',
      description: ''
    })
    setShowForm(false)
  }

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = selectedSubject === 'All' || video.subject === selectedSubject
    return matchesSearch && matchesSubject
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Video className="w-6 h-6 text-indigo-600" />
            Video Lectures Management
          </h1>
          <p className="text-gray-600 mt-1">Manage video lectures and content</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Video
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject._id || subject.id || subject.name} value={subject.name}>{subject.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVideos.map(video => (
          <div key={video._id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition group">
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gray-100">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-4xl">
                  ▶️
                </div>
              )}
              {!video.isFree && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded flex items-center gap-1">
                  <Lock className="w-3 h-3" /> PRO
                </div>
              )}
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                {video.duration}
              </div>
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <button 
                  onClick={() => handleEdit(video)}
                  className="p-2 bg-white rounded-full mx-1"
                >
                  <Edit2 className="w-5 h-5 text-gray-700" />
                </button>
                <button 
                  onClick={() => handleDelete(video._id)}
                  className="p-2 bg-red-500 rounded-full mx-1"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <span className="text-xs text-indigo-600 font-medium">{video.subject}</span>
              <h3 className="font-bold text-gray-900 mt-1 line-clamp-2">{video.title}</h3>
              <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" /> {video.instructor || 'N/A'}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {video.views || '0'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Video className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900">No Videos Found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your filters or add a new video</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingVideo ? 'Edit Video' : 'Add New Video'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Video Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Number System - Complete Concept"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject *
                    </label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {subjects.map(subject => (
                        <option key={subject._id || subject.id || subject.name} value={subject.name}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 45:30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Instructor
                    </label>
                    <input
                      type="text"
                      value={formData.instructor}
                      onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Vivek Sir"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Views
                    </label>
                    <input
                      type="text"
                      value={formData.views}
                      onChange={(e) => setFormData({ ...formData, views: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 12.5K"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thumbnail URL
                  </label>
                  <input
                    type="url"
                    value={formData.thumbnail}
                    onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://via.placeholder.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Video URL
                  </label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Brief description of the video..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isFree}
                    onChange={(e) => setFormData({ ...formData, isFree: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                    id="isFree"
                  />
                  <label htmlFor="isFree" className="text-sm font-medium text-gray-700">
                    Free Video (Available to all users)
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Save className="w-4 h-4" />
                    {editingVideo ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
