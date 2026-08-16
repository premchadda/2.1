import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { Mail, Plus, Edit, Trash2, Save, X, Eye, Send, RefreshCw } from 'lucide-react'
import { confirmOnce } from '../../../shared/components/common/ConfirmModal'
import sanitizeHtml from '../../../shared/lib/sanitizeHtml'

export default function EmailTemplatesManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showPreview, setShowPreview] = useState(null)
  const [formData, setFormData] = useState({ name: '', type: 'general', subject: '', content: '', variables: [], isActive: true })
  const [testEmail, setTestEmail] = useState('')

  const fetchTemplates = useCallback(async (signal) => {
    try {
      setLoading(true)
      const res = await adminAPI.apiClient.get('/admin/email-templates', { signal })
      if (!signal.aborted) {
        const raw = res.data?.data
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.templates) ? raw.templates : [])
        setTemplates(list)
      }
    } catch (error) {
      if (signal.aborted) return
      console.error('Error fetching email templates:', error)
      toast.error('Failed to load email templates')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchTemplates(controller.signal)
    return () => controller.abort()
  }, [fetchTemplates])

  const handleCreate = () => {
    setEditingId('new')
    setFormData({ name: '', type: 'general', subject: '', content: '', variables: [], isActive: true })
  }

  const handleEdit = (template) => {
    const templateId = template.id || template._id
    setEditingId(templateId)
    setFormData({
      name: template.name || '',
      type: template.type || 'general',
      subject: template.subject || '',
      content: template.content || template.body || template.body_html || '',
      variables: template.variables || [],
      isActive: template.isActive !== false && template.enabled !== false
    })
  }

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.subject || !formData.content) {
        toast.error('Name, subject, and content are required')
        return
      }

      // Map frontend field names to backend-expected field names.
      // Backend (admin-email-templates.js) requires: name, type, subject, body.
      // The active flag is stored as `enabled` (not `isActive`).
      const payload = {
        name: formData.name,
        type: formData.type || 'general',
        subject: formData.subject,
        body: formData.content,
        variables: formData.variables || [],
        enabled: formData.isActive
      }

      if (editingId === 'new') {
        const res = await adminAPI.apiClient.post('/admin/email-templates', payload)
        const newItem = res.data?.data?.template || res.data?.data
        if (newItem) {
          setTemplates(prev => [...(Array.isArray(prev) ? prev : []), newItem])
        }
        toast.success('Template created')
      } else {
        const res = await adminAPI.apiClient.put(`/admin/email-templates/${editingId}`, payload)
        const updatedItem = res.data?.data?.template || res.data?.data
        if (updatedItem) {
          setTemplates(prev => (Array.isArray(prev) ? prev : []).map(t => (t.id || t._id) === editingId ? updatedItem : t))
        }
        toast.success('Template updated')
      }
      setEditingId(null)
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: 'Delete Template',
      message: 'Delete this email template?',
      danger: true
    })
    if (!confirmed) return
    try {
      await adminAPI.apiClient.delete(`/admin/email-templates/${id}`)
      setTemplates(prev => (Array.isArray(prev) ? prev : []).filter(t => (t.id || t._id) !== id))
      toast.success('Template deleted')
    } catch (error) {
      toast.error('Failed to delete template')
    }
  }

  const handleTestSend = async (template) => {
    if (!testEmail) {
      toast.error('Enter a test email address')
      return
    }
    const templateId = template?.id || template?._id
    if (!templateId) {
      toast.error('Template ID is required to send a test email')
      return
    }
    try {
      // Backend route is POST /admin/email-templates/:id/test and expects
      // { to_email, test_data }. The route is parameterized by template ID,
      // not template name.
      await adminAPI.apiClient.post(`/admin/email-templates/${templateId}/test`, {
        to_email: testEmail,
        test_data: { name: 'Test User', score: '85', testName: 'Mock Test', resetLink: '#', examName: 'SSC CGL', date: '2026-05-01' }
      })
      toast.success('Test email sent')
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

  const safeTemplates = Array.isArray(templates) ? templates : []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Email Templates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage system transactional email templates</p>
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
        {safeTemplates.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No email templates found</p>
            <p className="text-sm">Create your first template to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {safeTemplates.map(template => {
              const templateId = template.id || template._id
              return (
              <div key={templateId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                {editingId === templateId ? (
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
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="general">General</option>
                        <option value="welcome">Welcome</option>
                        <option value="verification">Verification</option>
                        <option value="reset">Password Reset</option>
                        <option value="notification">Notification</option>
                        <option value="payment">Payment</option>
                        <option value="subscription">Subscription</option>
                        <option value="test">Test</option>
                      </select>
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
                        {template.isActive === false || template.enabled === false ? (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs rounded">Inactive</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowPreview(templateId)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Preview">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleTestSend(template)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Test send">
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(template)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(templateId)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-red-500 hover:text-red-700" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview Modal */}
                {showPreview === templateId && (
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
                        <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(template.content || template.body || template.body_html || '') }} />
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
            )})}
          </div>
        )}
      </div>
    </div>
  )
}