import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BookOpen,
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import apiClient from '../../../shared/api/adminApi'
import { toast } from 'react-hot-toast'
import CurriculumBuilder from './CurriculumBuilder'

const SubjectTreeNode = ({ subject, level, onEdit, onDelete, expandedNodes, toggleExpand, allSubjects }) => {
  const isExpanded = expandedNodes.has(subject._id)
  const children = allSubjects.filter(s => String(s.parentId) === String(subject._id))
  const hasChildren = children.length > 0

  return (
    <>
      <div
        className={`bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition group`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <div className="p-4 flex items-center gap-4">
          <button
            onClick={() => toggleExpand(subject._id)}
            className={`w-6 h-6 rounded flex items-center justify-center ${hasChildren ? 'hover:bg-gray-100' : 'opacity-0'}`}
          >
            {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />)}
          </button>

          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: subject.color + '20' }}
          >
            {subject.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 truncate">{subject.name}</h3>
              {hasChildren && (
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                  {children.length} {children.length === 1 ? 'child' : 'children'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono">{subject.slug}</p>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(subject)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              title="Edit subject"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(subject._id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete subject (will recursively delete all children)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {subject.description && (
          <div className="px-4 pb-4">
            <p className="text-sm text-gray-600">{subject.description}</p>
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {children.map(child => (
            <SubjectTreeNode
              key={child._id}
              subject={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              allSubjects={allSubjects}
            />
          ))}
        </div>
      )}
    </>
  )
}

function SubjectsPanel() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '📚',
    color: '#667eea',
    description: '',
    parentId: '',
    order: 0,
    isActive: true
  })

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/admin/subjects')
      if (response.data?.success) {
        setSubjects(response.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error)
      toast.error('Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = useCallback((id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSubject) {
        await apiClient.put(`/admin/subjects/${editingSubject._id}`, formData)
        toast.success('Subject updated successfully')
      } else {
        await apiClient.post('/admin/subjects', formData)
        toast.success('Subject created successfully')
      }
      fetchSubjects()
      resetForm()
    } catch (error) {
      console.error('Failed to save subject:', error)
      toast.error('Failed to save subject')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this subject? ALL CHILD SUBJECTS WILL ALSO BE DELETED RECURSIVELY!')) return
    try {
      await apiClient.delete(`/admin/subjects/${id}`)
      toast.success('Subject deleted successfully')
      fetchSubjects()
    } catch (error) {
      console.error('Failed to delete subject:', error)
      toast.error('Failed to delete subject')
    }
  }

  const handleEdit = (subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      slug: subject.slug,
      icon: subject.icon || '📚',
      color: subject.color || '#667eea',
      description: subject.description || '',
      parentId: subject.parentId || '',
      order: subject.order || 0,
      isActive: subject.isActive !== false
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingSubject(null)
    setFormData({
      name: '',
      slug: '',
      icon: '📚',
      color: '#667eea',
      description: '',
      parentId: '',
      order: 0,
      isActive: true
    })
    setShowForm(false)
  }

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  const handleNameChange = (e) => {
    const name = e.target.value
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingSubject ? prev.slug : generateSlug(name)
    }))
  }

  const rootSubjects = useMemo(() => {
    return subjects.filter(s => !s.parentId).sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [subjects])

  const parentOptions = useMemo(() => {
    const options = [{ value: '', label: 'None (Root Subject)' }]

    const addToOptions = (list, level) => {
      list.forEach(s => {
        options.push({
          value: s._id,
          label: `${'　'.repeat(level)}${'└─ '} ${s.name}`
        })
        const children = subjects.filter(child => String(child.parentId) === String(s._id))
        addToOptions(children, level + 1)
      })
    }

    addToOptions(rootSubjects, 0)
    return options
  }, [subjects, rootSubjects])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Subjects Hierarchy Management
          </h1>
          <p className="text-gray-600 mt-1">Manage nested subjects with full Parent → Child hierarchy support</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Subject
        </button>
      </div>

      <div className="space-y-3">
        {rootSubjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900">No Subjects Found</h3>
            <p className="text-gray-500 mt-2">Add subjects to build your curriculum hierarchy</p>
          </div>
        ) : (
          rootSubjects.map(subject => (
            <SubjectTreeNode
              key={subject._id}
              subject={subject}
              level={0}
              onEdit={handleEdit}
              onDelete={handleDelete}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              allSubjects={subjects}
            />
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleNameChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., Quantitative Aptitude"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full h-11 px-1 border border-gray-200 rounded-xl cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Subject</label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {parentOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Select parent to create nested hierarchy (Subject → Chapter → Topic)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Brief description of this subject..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center pt-6">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                      id="isActive"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700">Active</label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Subject
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

export default function StudyMaterialsManager() {
  const [activeTab, setActiveTab] = useState('curriculum')

  const tabs = [
    {
      id: 'subjects',
      label: 'Subjects',
      icon: BookOpen,
      Component: SubjectsPanel,
      description: 'Manage root subjects'
    },
    {
      id: 'curriculum',
      label: 'Curriculum Builder',
      icon: Layers,
      Component: CurriculumBuilder,
      description: 'Build deeply nested topic hierarchy'
    }
  ]

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.Component

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 border-b pb-4 mb-4 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          Study Materials
        </h1>
        <p className="text-gray-600 mb-6 max-w-3xl">
          Build your curriculum hierarchy here. Start by creating a Subject, then add nested Chapters and Topics.
        </p>

        {/* Tab Navigation */}
        <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
                  isActive
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-lg" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Render Active Tab */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 min-h-[500px]">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}
