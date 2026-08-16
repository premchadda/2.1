import { useState, useEffect } from 'react'
import {
  Plus, Search, Edit2, Trash2, Tag, BookOpen,
  X, Save
} from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'
import { confirmOnce } from '../../../shared/components/common/ConfirmModal'

export default function TopicsManager() {
  const [topics, setTopics] = useState([])
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChapter, setSelectedChapter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editingTopic, setEditingTopic] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📚',
    chapterId: '',
    order: 0,
    isActive: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [topicsRes, chaptersRes] = await Promise.all([
        apiClient.get('/admin/topics'),
        apiClient.get('/admin/chapters')
      ])

      if (topicsRes.data?.success) {
        setTopics(topicsRes.data.data)
      }
      if (chaptersRes.data?.success) {
        setChapters(chaptersRes.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTopics = async () => {
    try {
      const response = await apiClient.get('/admin/topics')
      if (response.data?.success) {
        setTopics(response.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch topics:', error)
    }
  }

  const getChapterName = (chapterId) => {
    const chapter = chapters.find(c => String(c.id || c._id) === String(chapterId))
    return chapter?.title || chapter?.name || (chapterId ? `Chapter #${chapterId}` : '—')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.chapterId) {
      toast.error('Please select a chapter')
      return
    }
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        chapterId: formData.chapterId,
        order: formData.order,
        isActive: formData.isActive
      }
      if (editingTopic) {
        const topicId = editingTopic.id || editingTopic._id
        await apiClient.put(`/admin/topics/${topicId}`, payload)
        toast.success('Topic updated successfully')
      } else {
        await apiClient.post('/admin/topics', payload)
        toast.success('Topic created successfully')
      }
      fetchTopics()
      resetForm()
    } catch (error) {
      console.error('Failed to save topic:', error)
      toast.error('Failed to save topic')
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: 'Delete Topic',
      message: 'Are you sure you want to delete this topic?',
      danger: true
    })
    if (!confirmed) return
    try {
      await apiClient.delete(`/admin/topics/${id}`)
      toast.success('Topic deleted successfully')
      fetchTopics()
    } catch (error) {
      console.error('Failed to delete topic:', error)
      toast.error('Failed to delete topic')
    }
  }

  const handleEdit = (topic) => {
    setEditingTopic(topic)
    setFormData({
      name: topic.name || '',
      description: topic.description || '',
      icon: topic.icon || '📚',
      chapterId: topic.chapterId ?? '',
      order: topic.order ?? topic.orderIndex ?? 0,
      isActive: topic.isActive !== false
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingTopic(null)
    setFormData({
      name: '',
      description: '',
      icon: '📚',
      chapterId: '',
      order: 0,
      isActive: true
    })
    setShowForm(false)
  }

  const filteredTopics = topics.filter(topic => {
    const matchesSearch = (topic.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesChapter = selectedChapter === 'All' || String(topic.chapterId) === String(selectedChapter)
    return matchesSearch && matchesChapter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-indigo-600" />
            Topics Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage topics within chapters</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Topic
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Chapters</option>
            {chapters.map(chapter => {
              const id = chapter.id || chapter._id
              return <option key={id} value={id}>{chapter.title || chapter.name}</option>
            })}
          </select>
        </div>
      </div>

      {/* Topics List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 dark:bg-gray-900 text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[640px]">
          <div className="col-span-5">Topic Name</div>
          <div className="col-span-3">Chapter</div>
          <div className="col-span-1">Order</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {filteredTopics.map(topic => {
          const topicId = topic.id || topic._id

          return (
            <div key={topicId}>
              <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800 min-w-[640px]">
                <div className="col-span-5 flex items-center gap-2">
                  <span className="text-xl">{topic.icon || '📚'}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{topic.name}</p>
                    {topic.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{topic.description}</p>
                    )}
                  </div>
                </div>
                <div className="col-span-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{getChapterName(topic.chapterId)}</span>
                </div>
                <div className="col-span-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{topic.order ?? topic.orderIndex ?? 0}</span>
                </div>
                <div className="col-span-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    topic.isActive !== false
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {topic.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(topic)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(topicId)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        </div>

        {filteredTopics.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No topics found</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
    <div className="p-3 sm:p-4 md:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingTopic ? 'Edit Topic' : 'Add New Topic'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Topic Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Number System"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chapter *
                  </label>
                  <select
                    required
                    value={formData.chapterId}
                    onChange={(e) => setFormData({ ...formData, chapterId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select chapter...</option>
                    {chapters.map(chapter => {
                      const id = chapter.id || chapter._id
                      return <option key={id} value={id}>{chapter.title || chapter.name}</option>
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Brief description of this topic..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Icon
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center text-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                </label>

                <div className="flex justify-end gap-3 pt-4 border-t flex-wrap">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Save className="w-4 h-4" />
                    {editingTopic ? 'Update' : 'Create'}
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
