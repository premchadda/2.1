import { useState, useEffect } from 'react'
import { Plus, Trash2, Download, RefreshCw, Clock, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react'
import api from '../../../shared/lib/api'
import { toast } from 'react-hot-toast'

export default function BackupsManager() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', type: 'manual' })

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/backups')
      if (response.data?.success) {
        setBackups(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error)
      toast.error('Failed to fetch backups')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async (e) => {
    e.preventDefault()
    try {
      setCreating(true)
      const response = await api.post('/admin/backups', formData)
      if (response.data?.success) {
        setShowCreateForm(false)
        setFormData({ name: '', type: 'manual' })
        fetchBackups()
        toast.success('Backup created successfully!')
      }
    } catch (error) {
      console.error('Failed to create backup:', error)
      toast.error('Failed to create backup')
    } finally {
      setCreating(false)
    }
  }

  const handleDownloadBackup = async (backup) => {
    const id = backup._id || backup.id
    const fileName = backup.fileName || `backup_${id}.sql`
    setDownloading(id)
    try {
      const response = await api.get(`/admin/backups/${id}/download`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Backup downloaded successfully')
    } catch (error) {
      console.error('Failed to download backup:', error)
      toast.error('Failed to download backup. File may not be available.')
    } finally {
      setDownloading(null)
    }
  }

  const handleDeleteBackup = async (id) => {
    if (!confirm('Are you sure you want to delete this backup? This cannot be undone.')) return
    try {
      const response = await api.delete(`/admin/backups/${id}`)
      if (response.data?.success) {
        fetchBackups()
        toast.success('Backup deleted successfully')
      }
    } catch (error) {
      console.error('Failed to delete backup:', error)
      toast.error('Failed to delete backup')
    }
  }

  const getStatusDisplay = (backup) => {
    const status = backup.status || 'pending'
    switch (status) {
      case 'completed':
        return <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-4 h-4" /> Ready</span>
      case 'in_progress':
      case 'running':
        return <span className="flex items-center gap-1 text-blue-600"><RefreshCw className="w-4 h-4 animate-spin" /> In Progress</span>
      case 'failed':
      case 'error':
        return <span className="flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> Failed</span>
      case 'pending':
      default:
        return <span className="flex items-center gap-1 text-yellow-600"><Clock className="w-4 h-4" /> Pending</span>
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="p-6">
      {/* Warning Banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-6">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Database dump requires backend configuration</p>
          <p className="text-xs text-amber-700 mt-1">
            The backup feature needs pg_dump/mongodump configured on the server. Until then, only backup metadata is tracked.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backups</h1>
          <p className="text-gray-600">Manage database backups</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchBackups} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" /> Create Backup
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Backup</h2>
          <form onSubmit={handleCreateBackup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Backup Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Backup"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Backup Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="manual">Manual</option>
                <option value="automatic">Automatic</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center">
                  <Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No backups found. Create your first backup!
                </td>
              </tr>
            ) : (
              backups.map((backup) => (
                <tr key={backup._id || backup.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-gray-400" />
                      <span className="font-medium">{backup.name || 'Unnamed Backup'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{backup.type || 'manual'}</td>
                  <td className="px-6 py-4">{getStatusDisplay(backup)}</td>
                  <td className="px-6 py-4 text-gray-600">{backup.size || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(backup.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadBackup(backup)}
                        disabled={downloading === (backup._id || backup.id) || backup.status === 'failed'}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Download Backup"
                      >
                        {downloading === (backup._id || backup.id) 
                          ? <Loader className="w-4 h-4 animate-spin" />
                          : <Download className="w-4 h-4" />
                        }
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup._id || backup.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete Backup"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}