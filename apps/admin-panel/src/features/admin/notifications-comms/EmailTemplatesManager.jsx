import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { Mail, Plus, Edit, Trash2, Save, X, Eye, Send, RefreshCw } from 'lucide-react'

export default function EmailTemplatesManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showPreview, setShowPreview] = useState(null)
  const [formData, setFormData] = useState({ name: '', subject: '', content: '', variables: [], isActive: true })
  const [testEmail, setTestEmail] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminAPI.apiClient.get('/admin/email-templates')
      setTemplates(res.data?.data || [])
    } catch (error) {
      console.error('Error fetching email templates:', error)
      toast.error('Failed to load email templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleCreate = () => {
    setEditingId('new')
    setFormData({ name: '', subject: '', content: '', variables: [], isActive: true })
  }

  const handleEdit = (template) => {
    setEditingId(template.id)
    setFormData({
      name: template.name || '',
      subject: template.subject || '',
      content: template.content || '',
      variables: template.variables || [],
      isActive: template.isActive !== false
    })
  }

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.subject || !formData.content) {
        toast.error('Name, subject, and content are required')
        return
      }

      if (editingId === 'new') {
        const res = await adminAPI.apiClient.post('/admin/email-templates', formData)
        setTemplates(prev => [...prev, res.data?.data])
        toast.success('Template created')
      } else {
        const res = await adminAPI.apiClient.put(`/admin/email-templates/${editingId}`, formData)
        setTemplates(prev => prev.map(t => t.id === editingId ? res.data?.data : t))
        toast.success('Template updated')
      }
      setEditingId(null)
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this email template?')) return
    try {
      await adminAPI.apiClient.delete(`/admin/email-templates/${id}`)
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template deleted')
    } catch (error) {
      toast.error('Failed to delete template')
    }
  }

  const handleTestSend = async (templateName) => {
    if (!testEmail) {
      toast.error('Enter a test email address')
      return
    }
    try {
      await adminAPI.apiClient.post('/admin/email-templates/test', {
        templateName,
        recipient: testEmail,
        variables: { name: 'Test User', score: '85', testName: 'Mock Test', resetLink: '#', examName: 'SSC CGL', date: '2026-05-01' }
      })
      toast.success('Test email logged (integrate with email service for actual sending)')
    } catch (error) {
      toast.error('Failed to send test email')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading email templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage transactional and marketing email templates</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="email"
            placeholder="Test email address"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> New Template
          </button>
          <button onClick={fetchTemplates} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Templates List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {templates.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No email templates found</p>
            <p className="text-sm">Create your first template to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {templates.map(template => (
              <div key={template.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                {editingId === template.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Template name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Email subject"
                        value={formData.subject}
                        onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <textarea
                      placeholder="Email content (HTML supported)"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                          />
                          Active
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                          <X className="w-4 h-4" />
                        </button>
                        <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                          <Save className="w-4 h-4" /> Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-indigo-500" />
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
                          <p className="text-sm text-gray-500">{template.subject}</p>
                        </div>
                        {!template.isActive && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs rounded">Inactive</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowPreview(template.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Preview">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleTestSend(template.name)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Test send">
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(template)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(template.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-red-500 hover:text-red-700" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview Modal */}
                {showPreview === template.id && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 dark:text-white">Preview: {template.name}</h3>
                        <button onClick={() => setShowPreview(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
                        <p className="text-sm text-gray-500 mb-2">Subject: {template.subject}</p>
                        <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: template.content }} />
                        {template.variables?.length > 0 && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Available variables:</p>
                            <div className="flex flex-wrap gap-1">
                              {template.variables.map(v => (
                                <code key={v} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded">
                                  {'{{'}{v}{'}}'}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}