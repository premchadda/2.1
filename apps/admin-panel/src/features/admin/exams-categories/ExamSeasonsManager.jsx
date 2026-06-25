import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Plus, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react'
import { apiClient } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'
import { logger } from '../../../shared/lib/logger.js'

const EMPTY_FORM = {
  examId: '',
  title: '',
  seasonSlug: '',
  year: new Date().getFullYear(),
  notificationDate: '',
  applicationStartDate: '',
  applicationEndDate: '',
  examDate: '',
  resultDate: '',
  admitCardDate: '',
  vacancyTotal: 0,
  status: 'upcoming',
  description: '',
  isActive: true
}

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'result_out', label: 'Result Out' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' }
]

export default function ExamSeasonsManager() {
  const [seasons, setSeasons] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState(null)
  const [backendMissing, setBackendMissing] = useState(false)

  const fetchExams = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/admin/exam-categories')
      if (res.data?.success) {
        setExams(res.data.data || [])
      }
    } catch (error) {
      logger.error('Failed to fetch exams:', error)
    }
  }, [])

  const fetchSeasons = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/api/admin/exam-seasons')
      if (res.data?.success) {
        setSeasons(res.data.data || [])
        setBackendMissing(false)
      } else {
        setSeasons([])
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setBackendMissing(true)
      } else {
        logger.error('Failed to fetch exam seasons:', error)
        toast.error('Failed to load exam seasons')
      }
      setSeasons([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSeasons()
    fetchExams()
  }, [fetchSeasons, fetchExams])

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.examId || !formData.title || !formData.year) {
      toast.error('Exam, title, and year are required')
      return
    }

    const payload = {
      examId: parseInt(formData.examId),
      title: formData.title,
      seasonSlug: formData.seasonSlug || generateSlug(formData.title),
      year: parseInt(formData.year),
      notificationDate: formData.notificationDate || null,
      applicationStartDate: formData.applicationStartDate || null,
      applicationEndDate: formData.applicationEndDate || null,
      examDate: formData.examDate || null,
      resultDate: formData.resultDate || null,
      admitCardDate: formData.admitCardDate || null,
      vacancyTotal: parseInt(formData.vacancyTotal) || 0,
      status: formData.status,
      description: formData.description,
      isActive: formData.isActive
    }

    try {
      if (editingId) {
        await apiClient.put(`/api/admin/exam-seasons/${editingId}`, payload)
        toast.success('Exam season updated')
      } else {
        await apiClient.post('/api/admin/exam-seasons', payload)
        toast.success('Exam season created')
      }
      resetForm()
      fetchSeasons()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save exam season')
    }
  }

  const handleEdit = (season) => {
    setFormData({
      examId: season.examId || season.exam_id || '',
      title: season.title || '',
      seasonSlug: season.seasonSlug || season.season_slug || '',
      year: season.year || new Date().getFullYear(),
      notificationDate: season.notificationDate?.slice(0, 10) || season.notification_date?.slice(0, 10) || '',
      applicationStartDate: season.applicationStartDate?.slice(0, 10) || season.application_start_date?.slice(0, 10) || '',
      applicationEndDate: season.applicationEndDate?.slice(0, 10) || season.application_end_date?.slice(0, 10) || '',
      examDate: season.examDate?.slice(0, 10) || season.exam_date?.slice(0, 10) || '',
      resultDate: season.resultDate?.slice(0, 10) || season.result_date?.slice(0, 10) || '',
      admitCardDate: season.admitCardDate?.slice(0, 10) || season.admit_card_date?.slice(0, 10) || '',
      vacancyTotal: season.vacancyTotal || season.vacancy_total || 0,
      status: season.status || 'upcoming',
      description: season.description || '',
      isActive: season.isActive !== false
    })
    setEditingId(season._id || season.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/api/admin/exam-seasons/${id}`)
      toast.success('Exam season deleted')
      setDeleteId(null)
      fetchSeasons()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete exam season')
    }
  }

  const getExamName = (examId) => {
    const exam = exams.find(e => e.id === examId || e._id === examId)
    return exam?.name || exam?.title || `Exam #${examId}`
  }

  if (backendMissing) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exam Seasons Manager</h1>
            <p className="text-gray-500 mt-1">Manage yearly exam cycles, season schedules, and notifications</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center max-w-2xl mx-auto mt-12">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Backend Not Implemented</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            The <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm">/api/admin/exam-seasons</code> endpoint is not available on the backend yet.
            This feature requires backend implementation before it can be used.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm font-medium">
            <Clock className="w-4 h-4" />
            See audit notes (A2) for implementation status
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Seasons Manager</h1>
          <p className="text-gray-500 mt-1">Manage yearly exam cycles, season schedules, and notifications</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Season
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : seasons.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No exam seasons yet</h3>
          <p className="text-gray-500 text-sm">Create your first season to get started</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seasons.map((season) => {
            const id = season._id || season.id
            return (
              <div key={id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{season.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {getExamName(season.examId || season.exam_id)} • {season.year}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {season.examDate?.slice(0, 10) || season.exam_date?.slice(0, 10) || 'No date set'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    season.status === 'open' ? 'bg-green-100 text-green-700' :
                    season.status === 'result_out' ? 'bg-blue-100 text-blue-700' :
                    season.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {season.status || 'upcoming'}
                  </span>
                </div>
                {season.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{season.description}</p>
                )}
                {season.vacancyTotal > 0 && (
                  <p className="text-xs text-gray-500 mb-3">Vacancies: {season.vacancyTotal}</p>
                )}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button onClick={() => handleEdit(season)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setDeleteId(id)} className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{editingId ? 'Edit Season' : 'Add New Season'}</h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exam *</label>
                    <select
                      required
                      value={formData.examId}
                      onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Exam</option>
                      {exams.map(exam => (
                        <option key={exam.id || exam._id} value={exam.id || exam._id}>
                          {exam.name || exam.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                    <input
                      type="number"
                      required
                      min="2020"
                      max="2030"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., SSC CGL 2026 Tier-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Season Slug</label>
                  <input
                    type="text"
                    value={formData.seasonSlug}
                    onChange={(e) => setFormData({ ...formData, seasonSlug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Auto-generated from title if empty"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notification Date</label>
                    <input
                      type="date"
                      value={formData.notificationDate}
                      onChange={(e) => setFormData({ ...formData, notificationDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exam Date</label>
                    <input
                      type="date"
                      value={formData.examDate}
                      onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Application Start</label>
                    <input
                      type="date"
                      value={formData.applicationStartDate}
                      onChange={(e) => setFormData({ ...formData, applicationStartDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Application End</label>
                    <input
                      type="date"
                      value={formData.applicationEndDate}
                      onChange={(e) => setFormData({ ...formData, applicationEndDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Result Date</label>
                    <input
                      type="date"
                      value={formData.resultDate}
                      onChange={(e) => setFormData({ ...formData, resultDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admit Card Date</label>
                    <input
                      type="date"
                      value={formData.admitCardDate}
                      onChange={(e) => setFormData({ ...formData, admitCardDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vacancy Total</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.vacancyTotal}
                      onChange={(e) => setFormData({ ...formData, vacancyTotal: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Exam Season</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this exam season?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
