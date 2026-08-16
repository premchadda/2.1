import { useState, useEffect } from 'react'
import { Plus, Trash2, Download, RefreshCw, Clock, CheckCircle, XCircle, Loader, AlertCircle, RotateCcw } from 'lucide-react'
import { apiClient as api } from '../../../shared/lib/dataService'
import { useAuth } from '../../../shared/providers/AuthContext'
import { toast } from 'react-hot-toast'
import { confirmOnce } from '../../../shared/components/common/ConfirmModal'

export default function BackupsManager() {
  const { user } = useAuth()
  const isSuper = user?.role === 'super_admin' || user?.isSuperAdmin === true || (user?.permissions || []).includes('*')
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [restoring, setRestoring] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', type: 'manual' })

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    try {
      setLoading(true)
      setFetchError(null)
      const response = await api.get('/admin/backups')
      if (response.data?.success) {
        const data = response.data.data || []
        if (data.length === 0) {
          setBackups([])
          setFetchError('The server returned no backup records. Backups may be unavailable or unsupported in this environment.')
        } else {
          setBackups(data)
        }
      } else {
        setBackups([])
        setFetchError(response.data?.message || 'Failed to fetch backups')
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error)
      setBackups([])
      setFetchError(error.response?.data?.message || error.message || 'Failed to fetch backups')
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
      } else {
        toast.error(response.data?.message || 'Failed to create backup')
      }
    } catch (error) {
      console.error('Failed to create backup:', error)
      toast.error('Failed to create backup')
    } finally {
      setCreating(false)
    }
  }

  const sanitizeFileName = (name) =>
    (name || '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '') || 'backup.sql'

  const isForbidden = (error) =>
    error?.name === 'AuthenticationError' && error?.message === 'Access forbidden'

  const handleDownloadBackup = async (backup) => {
    const id = backup._id || backup.id
    const fileName = sanitizeFileName(backup.fileName || `backup_${id}.sql`)
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
      if (isForbidden(error)) {
        toast.error('Super-admin privilege required to download backups')
      } else {
        toast.error('Failed to download backup. File may not be available.')
      }
    } finally {
      setDownloading(null)
    }
  }

  const handleDeleteBackup = async (id) => {
    const confirmed = await confirmOnce({
      title: 'Delete Backup',
      message: 'Are you sure you want to delete this backup? This cannot be undone.',
      danger: true
    })
    if (!confirmed) return
    try {
      const response = await api.delete(`/admin/backups/${id}`)
      if (response.data?.success) {
        fetchBackups()
        toast.success('Backup deleted successfully')
      } else {
        toast.error(response.data?.message || 'Failed to delete backup')
      }
    } catch (error) {
      console.error('Failed to delete backup:', error)
      if (isForbidden(error)) {
        toast.error('Super-admin privilege required to delete backups')
      } else {
        toast.error('Failed to delete backup')
      }
    }
  }

  const handleRestoreBackup = async (backup) => {
    const id = backup._id || backup.id
    const confirmed = await confirmOnce({
      title: 'Restore Backup',
      message: `Are you sure you want to restore "${backup.name || 'this backup'}"? This will overwrite the current database. This action cannot be undone.`,
      danger: true
    })
    if (!confirmed) return
    setRestoring(id)
    try {
      const response = await api.post(`/admin/backups/${id}/restore`)
      if (response.data?.success) {
        toast.success('Backup restored successfully')
      }
    } catch (error) {
      console.error('Failed to restore backup:', error)
      if (isForbidden(error)) {
        toast.error('Super-admin privilege required to restore backups')
      } else {
        const msg = error.response?.data?.message || error.message || 'Failed to restore backup'
        toast.error(msg)
      }
    } finally {
      setRestoring(null)
    }
  }

  const getStatusDisplay = (backup) => {
    const status = backup.status || 'pending'
    switch (status) {
      case 'completed':
        return <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="w-4 h-4" /> Ready</span>
      case 'in_progress':
      case 'running':
        return <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><RefreshCw className="w-4 h-4 animate-spin" /> In Progress</span>
      case 'failed':
      case 'error':
        return <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><XCircle className="w-4 h-4" /> Failed</span>
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
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backups</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage database backups</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchBackups} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Backup</h2>
          <form onSubmit={handleCreateBackup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Backup"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Type</label>
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
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center">
                  <Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">{fetchError}</p>
                    <button
                      onClick={fetchBackups}
                      className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                    >
                      <RefreshCw className="w-4 h-4" /> Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No backups found. Create your first backup!
                </td>
              </tr>
            ) : (
              backups.map((backup) => (
                <tr key={backup._id || backup.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <span className="font-medium">{backup.name || 'Unnamed Backup'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 capitalize">{backup.type || 'manual'}</td>
                  <td className="px-6 py-4">{getStatusDisplay(backup)}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {backup.fileSize != null
                      ? backup.fileSize > 1024 * 1024
                        ? `${(backup.fileSize / 1024 / 1024).toFixed(2)} MB`
                        : backup.fileSize > 1024
                          ? `${(backup.fileSize / 1024).toFixed(1)} KB`
                          : `${backup.fileSize} B`
                      : (backup.size || '—')}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(backup.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {isSuper ? (
                        <button
                          onClick={() => handleRestoreBackup(backup)}
                          disabled={restoring === (backup._id || backup.id) || backup.status === 'failed' || backup.status === 'pending'}
                          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:bg-green-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Restore Backup"
                        >
                          {restoring === (backup._id || backup.id)
                            ? <Loader className="w-4 h-4 animate-spin" />
                            : <RotateCcw className="w-4 h-4" />
                          }
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-2 text-gray-300 dark:text-gray-600 rounded-lg opacity-50 cursor-not-allowed"
                          title="Restore requires super-admin privilege"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {isSuper ? (
                        <button
                          onClick={() => handleDownloadBackup(backup)}
                          disabled={downloading === (backup._id || backup.id) || backup.status === 'failed'}
                          className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Download Backup"
                        >
                          {downloading === (backup._id || backup.id)
                            ? <Loader className="w-4 h-4 animate-spin" />
                            : <Download className="w-4 h-4" />
                          }
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-2 text-gray-300 dark:text-gray-600 rounded-lg opacity-50 cursor-not-allowed"
                          title="Download requires super-admin privilege"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {isSuper ? (
                        <button
                          onClick={() => handleDeleteBackup(backup._id || backup.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg"
                          title="Delete Backup"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-2 text-gray-300 dark:text-gray-600 rounded-lg opacity-50 cursor-not-allowed"
                          title="Delete requires super-admin privilege"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}