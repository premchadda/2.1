import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { Shield, Plus, Edit, Trash2, Save, X, Users, Key, RefreshCw, Check, XCircle } from 'lucide-react'

const ALL_PERMISSIONS = [
  { resource: 'users', actions: ['read', 'write', 'delete', 'export'] },
  { resource: 'tests', actions: ['read', 'write', 'delete', 'export'] },
  { resource: 'questions', actions: ['read', 'write', 'delete', 'export'] },
  { resource: 'content', actions: ['read', 'write', 'delete', 'export'] },
  { resource: 'media', actions: ['read', 'write', 'delete'] },
  { resource: 'analytics', actions: ['read', 'export'] },
  { resource: 'settings', actions: ['read', 'write'] },
  { resource: 'roles', actions: ['read', 'write', 'delete'] },
  { resource: 'audit_logs', actions: ['read', 'export'] }
]

export default function RolePermissionsManager() {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ name: '', displayName: '', description: '', permissions: [], isSystem: false })
  const [activeTab, setActiveTab] = useState('roles')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [rolesRes, permsRes] = await Promise.allSettled([
        adminAPI.apiClient.get('/admin/roles'),
        adminAPI.apiClient.get('/admin/permissions')
      ])
      if (rolesRes.status === 'fulfilled') {
        const rData = rolesRes.value.data?.data;
        setRoles(Array.isArray(rData) ? rData : (rData?.roles || []));
      }
      if (permsRes.status === 'fulfilled') {
        const pData = permsRes.value.data?.data;
        setPermissions(Array.isArray(pData) ? pData : (pData?.permissions || ALL_PERMISSIONS));
      }
    } catch (error) {
      console.error('Error fetching roles/permissions:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = () => {
    setEditingId('new')
    setFormData({ name: '', displayName: '', description: '', permissions: [], isSystem: false })
  }

  const handleEdit = (role) => {
    setEditingId(role.id)
    setFormData({
      name: role.name || '',
      displayName: role.displayName || '',
      description: role.description || '',
      permissions: role.permissions || [],
      isSystem: role.isSystem || false
    })
  }

  const togglePermission = (perm) => {
    const fullPerm = `${perm}`
    setFormData(prev => {
      const perms = prev.permissions || []
      if (perms.includes(fullPerm)) {
        return { ...prev, permissions: perms.filter(p => p !== fullPerm) }
      } else {
        return { ...prev, permissions: [...perms, fullPerm] }
      }
    })
  }

  const toggleAllForResource = (resource, actions) => {
    const resourcePerms = actions.map(a => `${resource}:${a}`)
    setFormData(prev => {
      const perms = prev.permissions || []
      const allSelected = resourcePerms.every(p => perms.includes(p))
      if (allSelected) {
        return { ...prev, permissions: perms.filter(p => !resourcePerms.includes(p)) }
      } else {
        return { ...prev, permissions: [...new Set([...perms, ...resourcePerms])] }
      }
    })
  }

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.displayName) {
        toast.error('Name and display name are required')
        return
      }
      if (editingId === 'new') {
        const res = await adminAPI.apiClient.post('/admin/roles', formData)
        setRoles(prev => [...prev, res.data?.data])
        toast.success('Role created')
      } else {
        const res = await adminAPI.apiClient.put(`/admin/roles/${editingId}`, formData)
        setRoles(prev => prev.map(r => r.id === editingId ? res.data?.data : r))
        toast.success('Role updated')
      }
      setEditingId(null)
    } catch (error) {
      console.error('Error saving role:', error)
      toast.error('Failed to save role')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this role? Users with this role will need to be reassigned.')) return
    try {
      await adminAPI.apiClient.delete(`/admin/roles/${id}`)
      setRoles(prev => prev.filter(r => r.id !== id))
      toast.success('Role deleted')
    } catch (error) {
      toast.error('Failed to delete role')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading roles and permissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage admin roles and granular permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> New Role
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {[
          { id: 'roles', label: 'Roles', icon: Shield },
          { id: 'permissions', label: 'Permissions Matrix', icon: Key }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {roles.map(role => (
            <div key={role.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              {editingId === role.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Role name (e.g., content_manager)"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Display name (e.g., Content Manager)"
                      value={formData.displayName}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />

                  {/* Permission Checkboxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ALL_PERMISSIONS.map(({ resource, actions }) => {
                      const resourcePerms = actions.map(a => `${resource}:${a}`)
                      const allSelected = resourcePerms.every(p => (formData.permissions || []).includes(p))
                      const someSelected = resourcePerms.some(p => (formData.permissions || []).includes(p))
                      return (
                        <div key={resource} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-sm font-medium capitalize">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                                onChange={() => toggleAllForResource(resource, actions)}
                                className="rounded"
                              />
                              {resource}
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {actions.map(action => {
                              const perm = `${resource}:${action}`
                              const isSelected = (formData.permissions || []).includes(perm)
                              return (
                                <button
                                  key={action}
                                  onClick={() => togglePermission(perm)}
                                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                    isSelected
                                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                      : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  {action}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                      <Save className="w-4 h-4" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role.isSystem ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'}`}>
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{role.displayName || role.name}</h3>
                        {role.isSystem && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded">System</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{role.description || 'No description'}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(role.permissions || []).slice(0, 8).map(perm => (
                          <span key={perm} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                            {perm}
                          </span>
                        ))}
                        {(role.permissions || []).length > 8 && (
                          <span className="text-xs text-gray-400">+{(role.permissions || []).length - 8} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!role.isSystem && (
                      <>
                        <button onClick={() => handleEdit(role)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(role.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Permissions Matrix Tab */}
      {activeTab === 'permissions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Permission</th>
                  {roles.map(role => (
                    <th key={role.id} className="px-4 py-3 text-center font-medium text-gray-500">
                      {role.displayName || role.name}
                      {role.isSystem && <span className="ml-1 text-purple-500">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map(({ resource, actions }) => (
                  actions.map(action => (
                    <tr key={`${resource}:${action}`} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white capitalize">
                        {resource}:{action}
                      </td>
                      {roles.map(role => {
                        const hasPerm = (role.permissions || []).includes(`${resource}:${action}`) || (role.permissions || []).includes('*')
                        return (
                          <td key={role.id} className="px-4 py-2 text-center">
                            {hasPerm ? (
                              <Check className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}