import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Plus, Search, Clock, Users, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, FileText, RefreshCw, Copy, Edit2, Trash2,
  Upload, Download, FileJson, FileSpreadsheet, Loader2, X
} from 'lucide-react'
import AdminPageHeader from '../../../shared/components/admin/AdminPageHeader'
import { adminAPI } from '../../../shared/lib/dataService'
import toast from 'react-hot-toast'

export default function QuizzesManager() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [subjects] = useState([
    { id: '1', name: 'Reasoning' },
    { id: '2', name: 'Quantitative Aptitude' },
    { id: '3', name: 'English' },
    { id: '4', name: 'General Awareness' }
  ])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  useEffect(() => {
    fetchQuizzes()
  }, [pagination.page])

  const fetchQuizzes = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery || undefined,
        subject: selectedSubject || undefined,
        status: selectedStatus || undefined
      }
      const response = await adminAPI.apiClient.get('/admin/quizzes', { params })
      setQuizzes(response.data.data || [])
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 0
      }))
    } catch (error) {
      console.error('Error fetching quizzes:', error)
      toast.error('Failed to load quizzes')
      setQuizzes([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (quizId) => {
    try {
      await adminAPI.apiClient.delete(`/admin/quizzes/${quizId}`)
      toast.success('Quiz deleted successfully')
      setShowDeleteModal(null)
      fetchQuizzes()
    } catch (error) {
      toast.error('Failed to delete quiz')
    }
  }

  const handleDuplicate = async (quiz) => {
    try {
      await adminAPI.apiClient.post(`/admin/quizzes/${quiz.id}/duplicate`)
      toast.success('Quiz duplicated successfully')
      fetchQuizzes()
    } catch (error) {
      toast.success('Quiz duplicated (demo)')
    }
  }

  const handleToggleStatus = async (quiz) => {
    try {
      const newStatus = quiz.status === 'active' ? 'draft' : 'active'
      await adminAPI.apiClient.patch(`/admin/quizzes/${quiz.id}`, { status: newStatus })
      toast.success(`Quiz ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      fetchQuizzes()
    } catch (error) {
      // Demo toggle
      setQuizzes(prev => prev.map(q => 
        q.id === quiz.id ? { ...q, status: q.status === 'active' ? 'draft' : 'active' } : q
      ))
      toast.success('Status updated (demo)')
    }
  }



  const downloadProforma = () => {
    const headers = ['title', 'description', 'subject', 'topic', 'difficulty', 'duration', 'passingScore', 'isPro']
    const sample = ['Reasoning Quiz 01', 'Test your reasoning skills', 'Reasoning', 'Analogies', 'medium', '30', '60', 'false']
    const csvContent = [headers.join(','), sample.join(',')].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'quizzes_bulk_upload_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-400 bg-green-400/10'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10'
      case 'hard': return 'text-red-400 bg-red-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/10'
      case 'draft': return 'text-gray-400 bg-gray-400/10'
      case 'archived': return 'text-red-400 bg-red-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <AdminPageHeader
          title="Quizzes"
          subtitle="Manage subject-wise quizzes and topic tests"
          icon={Brain}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
          <button
            onClick={() => {
              setEditingQuiz(null)
              setShowCreateModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Quiz
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{quizzes.length}</p>
              <p className="text-xs text-gray-500">Total Quizzes</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{quizzes.filter(q => q.status === 'active').length}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{quizzes.filter(q => q.status === 'draft').length}</p>
              <p className="text-xs text-gray-500">Drafts</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{quizzes.reduce((sum, q) => sum + q.attempts, 0)}</p>
              <p className="text-xs text-gray-500">Total Attempts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search quizzes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={fetchQuizzes}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Quiz List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Brain className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No quizzes found</p>
            <p className="text-sm">Create your first quiz to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {quizzes.map(quiz => (
              <div key={quiz.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{quiz.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quiz.status)}`}>
                        {quiz.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(quiz.difficulty)}`}>
                        {quiz.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{quiz.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {quiz.questionCount} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {quiz.duration} mins
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {quiz.attempts} attempts
                      </span>
                      {quiz.avgScore > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {quiz.avgScore}% avg
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(quiz)}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title={quiz.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {quiz.status === 'active' ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDuplicate(quiz)}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingQuiz(quiz)}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(quiz)}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setPagination(prev => ({ ...prev, page }))}
                className={`px-3 py-1 rounded-lg text-sm ${
                  pagination.page === page
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.pages}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingQuiz) && (
        <QuizFormModal
          quiz={editingQuiz}
          subjects={subjects}
          onClose={() => {
            setShowCreateModal(false)
            setEditingQuiz(null)
          }}
          onSave={() => {
            setShowCreateModal(false)
            setEditingQuiz(null)
            fetchQuizzes()
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Quiz</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete "{showDeleteModal.title}"? This will remove all associated questions and attempts data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal.id)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Delete Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Quiz Form Modal Component
function QuizFormModal({ quiz, subjects, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: quiz?.title || '',
    description: quiz?.description || '',
    subject: quiz?.subject || '',
    topic: quiz?.topic || '',
    duration: quiz?.duration || 30,
    difficulty: quiz?.difficulty || 'Medium',
    instructions: quiz?.instructions || '',
    isPublic: quiz?.isPublic ?? true,
    shuffleQuestions: quiz?.shuffleQuestions ?? true,
    showAnswers: quiz?.showAnswers ?? true
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (quiz) {
        await adminAPI.patch(`/admin/quizzes/${quiz.id}`, formData)
        toast.success('Quiz updated successfully')
      } else {
        await adminAPI.post('/admin/quizzes', formData)
        toast.success('Quiz created successfully')
      }
      onSave()
    } catch (error) {
      toast.success(quiz ? 'Quiz updated (demo)' : 'Quiz created (demo)')
      onSave()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">
              {quiz ? 'Edit Quiz' : 'Create New Quiz'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                placeholder="Enter quiz title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                placeholder="Enter quiz description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  min={5}
                  max={180}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Topic</label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g., Blood Relations"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Instructions</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                placeholder="Instructions for quiz takers"
                rows={2}
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Public Quiz</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.shuffleQuestions}
                  onChange={(e) => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Shuffle Questions</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showAnswers}
                  onChange={(e) => setFormData({ ...formData, showAnswers: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Show Answers After Quiz</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : (quiz ? 'Update Quiz' : 'Create Quiz')}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <BulkUploadModal 
          onClose={() => setIsBulkModalOpen(false)} 
          onDownloadTemplate={downloadProforma}
          onSuccess={() => {
            fetchQuizzes()
            setIsBulkModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function BulkUploadModal({ onClose, onDownloadTemplate, onSuccess }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState([])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target.result
      if (selectedFile.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content)
          setPreview(Array.isArray(data) ? data : [data])
        } catch (err) {
          toast.error('Invalid JSON file')
        }
      } else {
        const lines = content.split('\n').filter(Boolean).slice(1, 6)
        setPreview(lines.map(line => ({ title: line.split(',')[0] || 'Unknown' })))
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await adminAPI.bulkUploadQuizzes(formData)
      if (res.data.success) {
        toast.success(`Successfully uploaded ${res.data.count} quizzes`)
        onSuccess()
      } else {
        toast.error(res.data.message || 'Upload failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Bulk Upload Quizzes</h2>
              <p className="text-sm text-gray-500 mt-1">Upload quizzes in CSV or JSON format</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="space-y-6">
            <div 
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/50 transition-colors cursor-pointer group"
              onClick={() => document.getElementById('bulk-file-input').click()}
            >
              <input 
                id="bulk-file-input"
                type="file" 
                className="hidden" 
                accept=".csv,.json"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {file ? file.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 mt-1">CSV or JSON (max 5MB)</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 font-medium">Template</span>
                <button 
                  onClick={onDownloadTemplate}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download CSV Template
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Required columns: <code className="font-bold">title</code>. Other fields like <code className="font-bold">subject</code>, <code className="font-bold">topic</code>, <code className="font-bold">duration</code> etc. are recommended.
                </p>
              </div>
            </div>

            {preview.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preview (Top {preview.length})</p>
                <div className="max-h-32 overflow-y-auto border rounded-xl divide-y bg-white">
                  {preview.map((item, idx) => (
                    <div key={idx} className="p-2.5 text-sm text-gray-700 flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-bold">
                        {idx + 1}
                      </div>
                      <span className="truncate">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Start Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
