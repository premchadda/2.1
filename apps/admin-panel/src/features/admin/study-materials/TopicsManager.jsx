import { useState, useEffect } from 'react'
import {
  Plus, Search, Edit2, Trash2, Tag, BookOpen,
  ChevronDown, ChevronRight, Filter, X, Save,
  Star, TrendingUp, AlertCircle
} from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'



const IMPORTANCE_LEVELS = [
  { value: 'high', label: 'High', color: 'text-red-600 bg-red-50' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'low', label: 'Low', color: 'text-green-600 bg-green-50' }
]

export default function TopicsManager() {
  const [topics, setTopics] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editingTopic, setEditingTopic] = useState(null)
  const [expandedTopics, setExpandedTopics] = useState({})
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subject: '',
    parentTopic: null,
    description: '',
    icon: '📚',
    estimatedQuestions: 0,
    importance: 'medium',
    frequentlyAsked: false,
    difficulty: 'Mixed',
    order: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [topicsRes, subjectsRes] = await Promise.all([
        apiClient.get('/admin/topics'),
        apiClient.get('/admin/subjects')
      ])

      if (topicsRes.data?.success) {
        setTopics(topicsRes.data.data)
      }
      if (subjectsRes.data?.success) {
        const fetchedSubjects = subjectsRes.data.data
        setSubjects(fetchedSubjects)

        setFormData(prev => ({
          ...prev,
          subject: prev.subject || (fetchedSubjects.length > 0 ? fetchedSubjects[0].name : '')
        }))
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingTopic) {
        await apiClient.put(`/admin/topics/${editingTopic._id}`, formData)
        toast.success('Topic updated successfully')
      } else {
        await apiClient.post('/admin/topics', formData)
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
    if (!confirm('Are you sure you want to delete this topic?')) return
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
      name: topic.name,
      slug: topic.slug,
      subject: topic.subject,
      parentTopic: topic.parentTopic,
      description: topic.description,
      icon: topic.icon || '📚',
      estimatedQuestions: topic.estimatedQuestions,
      importance: topic.importance,
      frequentlyAsked: topic.frequentlyAsked,
      difficulty: topic.difficulty,
      order: topic.order
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingTopic(null)
    setFormData({
      name: '',
      slug: '',
      subject: subjects.length > 0 ? subjects[0].name : '',
      parentTopic: null,
      description: '',
      icon: '📚',
      estimatedQuestions: 0,
      importance: 'medium',
      frequentlyAsked: false,
      difficulty: 'Mixed',
      order: 0
    })
    setShowForm(false)
  }

  const toggleExpand = (topicId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }))
  }

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  const handleNameChange = (e) => {
    const name = e.target.value
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingTopic ? prev.slug : generateSlug(name)
    }))
  }

  // Filter and organize topics
  const filteredTopics = topics.filter(topic => {
    const matchesSearch = topic.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = selectedSubject === 'All' || topic.subject === selectedSubject
    return matchesSearch && matchesSubject && !topic.parentTopic
  })

  const getSubTopics = (parentId) => {
    return topics.filter(t => t.parentTopic === parentId)
  }

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
            <Tag className="w-6 h-6 text-indigo-600" />
            Topics Management
          </h1>
          <p className="text-gray-600 mt-1">Manage topics and sub-topics for SSC & Railway exams</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Topic
        </button>
      </div>

      {/* Subject Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedSubject('All')}
          className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors rounded-t-lg whitespace-nowrap ${
            selectedSubject === 'All'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          All Subjects
        </button>
        {subjects.map(subject => (
          <button
            key={subject._id}
            onClick={() => setSelectedSubject(subject.name)}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors rounded-t-lg whitespace-nowrap ${
              selectedSubject === subject.name
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {subject.name}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Topics List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
          <div className="col-span-4">Topic Name</div>
          <div className="col-span-2">Subject</div>
          <div className="col-span-2">Importance</div>
          <div className="col-span-2">Questions</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {filteredTopics.map(topic => {
          const subTopics = getSubTopics(topic._id)
          const isExpanded = expandedTopics[topic._id]
          const importance = IMPORTANCE_LEVELS.find(i => i.value === topic.importance)

          return (
            <div key={topic._id} className="border-b last:border-b-0">
              <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50">
                <div className="col-span-4 flex items-center gap-2">
                  {subTopics.length > 0 && (
                    <button
                      onClick={() => toggleExpand(topic._id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  )}
                  <span className="text-xl">{topic.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{topic.name}</p>
                    <p className="text-xs text-gray-500">{topic.slug}</p>
                  </div>
                  {topic.frequentlyAsked && (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-gray-600">{topic.subject}</span>
                </div>
                <div className="col-span-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${importance?.color || ''}`}>
                    {importance?.label}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-gray-600">{topic.estimatedQuestions || 0}</span>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(topic)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(topic._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sub-topics */}
              {isExpanded && subTopics.length > 0 && (
                <div className="bg-gray-50">
                  {subTopics.map(subTopic => (
                    <div key={subTopic._id} className="grid grid-cols-12 gap-4 p-4 pl-12 items-center border-t border-gray-100">
                      <div className="col-span-4 flex items-center gap-2">
                        <span className="text-lg">{subTopic.icon}</span>
                        <div>
                          <p className="font-medium text-gray-700">{subTopic.name}</p>
                          <p className="text-xs text-gray-500">{subTopic.slug}</p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-500">Sub-topic</span>
                      </div>
                      <div className="col-span-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          IMPORTANCE_LEVELS.find(i => i.value === subTopic.importance)?.color || ''
                        }`}>
                          {IMPORTANCE_LEVELS.find(i => i.value === subTopic.importance)?.label}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-gray-600">{subTopic.estimatedQuestions || 0}</span>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(subTopic)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(subTopic._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filteredTopics.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No topics found</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingTopic ? 'Edit Topic' : 'Add New Topic'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Topic Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleNameChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Number System"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slug *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
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
                        <option key={subject._id} value={subject.name}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parent Topic (Optional)
                    </label>
                    <select
                      value={formData.parentTopic || ''}
                      onChange={(e) => setFormData({ ...formData, parentTopic: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">None (Main Topic)</option>
                      {topics.filter(t => !t.parentTopic).map(topic => (
                        <option key={topic._id} value={topic._id}>{topic.name}</option>
                      ))}
                    </select>
                  </div>
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
                    placeholder="Brief description of this topic..."
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icon
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center text-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importance
                    </label>
                    <select
                      value={formData.importance}
                      onChange={(e) => setFormData({ ...formData, importance: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {IMPORTANCE_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                      <option value="Mixed">Mixed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Questions
                    </label>
                    <input
                      type="number"
                      value={formData.estimatedQuestions}
                      onChange={(e) => setFormData({ ...formData, estimatedQuestions: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.frequentlyAsked}
                        onChange={(e) => setFormData({ ...formData, frequentlyAsked: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Frequently Asked</span>
                    </label>
                  </div>
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
