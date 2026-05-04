import { useState, useEffect, useMemo } from 'react'
import {
  Users, Search, Plus, Edit, Eye,
  Ban, CheckCircle, XCircle, Clock,
  TrendingUp, Award, Star,
  Download, MoreHorizontal, X, Shield,
  BookOpen, TestTube2, CreditCard, ChevronRight, AlertCircle, Smartphone, Trash2, RefreshCw
} from 'lucide-react'
import api from '../../../shared/lib/api'

export default function UsersManagerEnhanced() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [viewingUser, setViewingUser] = useState(null)
  const [viewingEnrollments, setViewingEnrollments] = useState(null)
  const [userSessions, setUserSessions] = useState(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [activeModalTab, setActiveModalTab] = useState('enrollments') // 'enrollments' | 'sessions'
  
  // FIX 1: Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  useEffect(() => {
    fetchUsers()
  }, [])

  const [systemRoles, setSystemRoles] = useState([])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const [usersRes, rolesRes] = await Promise.allSettled([
        api.get('/admin/users'),
        api.get('/admin/roles')
      ])
      
      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.data?.data || [])
      }
      if (rolesRes.status === 'fulfilled') {
        setSystemRoles(rolesRes.value.data?.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' ||
                           (filterStatus === 'active' && user.isActive !== false) ||
                           (filterStatus === 'inactive' && user.isActive === false)
      const matchesRole = filterRole === 'all' ||
                         (filterRole === 'admin' && user.role === 'admin') ||
                         (filterRole === 'user' && user.role !== 'admin') ||
                         (filterRole === 'pro' && user.isProUser)
      return matchesSearch && matchesStatus && matchesRole
    })
  }, [users, searchTerm, filterStatus, filterRole])

  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus, filterRole])

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const toggleSelectAll = () => {
    const pageIds = paginatedUsers.map(user => user.id || user._id)
    const allPageSelected = pageIds.every(id => selectedUsers.includes(id))
    if (allPageSelected) {
      setSelectedUsers(prev => prev.filter(id => !pageIds.includes(id)))
    } else {
      setSelectedUsers(prev => [...new Set([...prev, ...pageIds])])
    }
  }

  const doAction = async (userId, endpoint, body, optimistic) => {
    setActionError(null)
    setActionLoading(userId + endpoint)
    try {
      await api.put(`/admin/users/${userId}/${endpoint}`, body)
      setUsers(prev => prev.map(u => (u.id === userId || u._id === userId) ? { ...u, ...optimistic } : u))
    } catch (error) {
      setActionError(error.response?.data?.message || error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const updateUserStatus = (userId, isActive) => doAction(userId, 'status', { isActive }, { isActive })
  const updateUserRole = (userId, role) => doAction(userId, 'role', { role }, { role })
  const toggleProPass = (user) => {
    const userId = user.id || user._id;
    const newPro = !user.isProUser;
    let passType = null;
    if (newPro) {
      const input = window.prompt('Enter Pass Type to grant (e.g., pro_yearly, pro_monthly):', 'pro_yearly');
      if (input === null) return;
      passType = input.trim();
    } else {
      if (!window.confirm(`Revoke Pro Pass for ${user.name}?`)) return;
    }
    doAction(userId, 'pro-pass', { isProUser: newPro, passType }, { isProUser: newPro, passType });
  }

  const viewEnrollments = async (user) => {
    setViewingUser(user)
    setEnrollmentLoading(true)
    setViewingEnrollments(null)
    setActiveModalTab('enrollments')
    try {
      const userId = user.id || user._id
      const res = await api.get(`/admin/enrollments/user/${userId}`)
      setViewingEnrollments(res.data.data)
    } catch (error) {
      setViewingEnrollments({ enrollments: [], totalEnrollments: 0 })
    } finally {
      setEnrollmentLoading(false)
    }
  }

  const viewSessions = async (user) => {
    setViewingUser(user)
    setSessionsLoading(true)
    setActiveModalTab('sessions')
    try {
      const userId = user.id || user._id
      const res = await api.get(`/admin/users/${userId}/sessions`)
      setUserSessions(res.data.data || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      setUserSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }

  const revokeSession = async (sessionId) => {
    try {
      await api.delete(`/admin/sessions/${sessionId}`)
      setUserSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Failed to revoke session:', error)
      setActionError('Failed to revoke session')
    }
  }

  const updateSessionLimit = async (userId, limit) => {
    try {
      const res = await api.put(`/admin/users/${userId}/session-limit`, { sessionLimit: limit })
      setViewingUser(prev => ({ ...prev, sessionLimit: limit }))
      setUsers(prev => prev.map(u => (u.id === userId || u._id === userId) ? { ...u, sessionLimit: limit } : u))
    } catch (error) {
      console.error('Failed to update session limit:', error)
      setActionError('Failed to update session limit')
    }
  }

  const formatLastActive = (dateStr) => {
    if (!dateStr) return 'Unknown'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.round(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.round(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.round(diffHrs / 24)
    return `${diffDays}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage user accounts, roles, and subscriptions</p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Download className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'bg-blue-100 text-blue-600' },
          { label: 'Active', value: users.filter(u => u.isActive !== false).length, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
          { label: 'Pro Users', value: users.filter(u => u.isProUser).length, icon: Award, color: 'bg-yellow-100 text-yellow-600' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: Shield, color: 'bg-purple-100 text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="pro">Pro Users</option>
          </select>
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-lg">
              <span className="text-sm text-indigo-700 font-medium">{selectedUsers.length} selected</span>
              <button onClick={() => setShowBulkActions(!showBulkActions)} className="text-xs text-indigo-500 hover:text-indigo-700 underline">
                {showBulkActions ? 'Hide' : 'Actions'}
              </button>
            </div>
          )}
        </div>
        {showBulkActions && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
            <button onClick={() => { selectedUsers.forEach(id => updateUserStatus(id, true)); setSelectedUsers([]); setShowBulkActions(false) }}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">Activate All</button>
            <button onClick={() => { selectedUsers.forEach(id => updateUserStatus(id, false)); setSelectedUsers([]); setShowBulkActions(false) }}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">Deactivate All</button>
            <button onClick={() => { selectedUsers.forEach(id => updateUserRole(id, 'admin')); setSelectedUsers([]); setShowBulkActions(false) }}
              className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">Make Admin</button>
            <button onClick={() => { selectedUsers.forEach(id => updateUserRole(id, 'user')); setSelectedUsers([]); setShowBulkActions(false) }}
              className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">Remove Admin</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleSelectAll} className="rounded border-gray-300 text-indigo-600" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Subscription</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedUsers.map(user => {
                const uid = user.id || user._id
                return (
                  <tr key={uid} className={`hover:bg-gray-50 transition-colors ${selectedUsers.includes(uid) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedUsers.includes(uid)}
                        onChange={() => toggleUserSelection(uid)} className="rounded border-gray-300 text-indigo-600" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name || 'Unnamed User'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {user.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
  value={user.role || 'user'}
  onChange={(e) => {
    if (window.confirm(`Change role to ${e.target.options[e.target.selectedIndex].text}?`)) {
      updateUserRole(uid, e.target.value)
    }
  }}
  disabled={actionLoading === uid + 'role'}
  className={`text-xs font-medium border-0 rounded-full px-2 py-0.5 cursor-pointer focus:ring-2 focus:ring-indigo-500
    ${user.role === 'super_admin' ? 'bg-red-100 text-red-700' : 
      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
      systemRoles.some(r => r.name === user.role) ? 'bg-blue-100 text-blue-700' :
      'bg-gray-100 text-gray-600'}`}
>
  <option value="user">User</option>
  <option value="admin">👑 Admin</option>
  <option value="super_admin">⚡ Super Admin</option>
  {systemRoles.map(role => (
    !['user', 'admin', 'super_admin'].includes(role.name) && (
      <option key={role.id} value={role.name}>{role.displayName || role.name}</option>
    )
  ))}
</select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-fit ${user.isProUser ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.isProUser ? `⭐ ${(user.passType || user.pass_type || 'Pro Pass').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : 'Free'}
                        </span>
                        {user.proPassExpiry && (
                          <span className="text-xs text-gray-400">Exp: {new Date(user.proPassExpiry).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* View Enrollments */}
                        <button onClick={() => viewEnrollments(user)}
                          title="View Enrollments"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* View Sessions */}
                        <button onClick={() => viewSessions(user)}
                          title="View Active Sessions"
                          className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded transition-colors">
                          <Smartphone className="w-4 h-4" />
                        </button>
                        {/* Toggle Active */}
                        <button onClick={() => updateUserStatus(uid, user.isActive === false)}
                          title={user.isActive !== false ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded transition-colors ${user.isActive !== false ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                          {user.isActive !== false ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        {/* Toggle Pro */}
                        <button onClick={() => toggleProPass(user)}
                          title={user.isProUser ? 'Revoke Pro Pass' : 'Grant Pro Pass'}
                          className={`p-1.5 rounded transition-colors ${user.isProUser ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                          <Award className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="mx-auto h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">No users found</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-<strong>{Math.min(currentPage * pageSize, filteredUsers.length)}</strong> of <strong>{filteredUsers.length}</strong> users
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed">
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const pageNum = i + 1
              return (
                <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 text-sm rounded-lg font-medium ${currentPage === pageNum ? 'bg-indigo-600 text-white' : 'border hover:bg-gray-50'}`}>
                  {pageNum}
                </button>
              )
            })}
            {totalPages > 7 && (
              <span className="px-2 text-sm text-gray-400">…</span>
            )}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="text-sm text-gray-500 text-right">
        Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
      </div>

      {/* User Detail Modal (Enrollments + Sessions) */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                  {(viewingUser.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{viewingUser.name}</h2>
                  <p className="text-sm text-gray-500">{viewingUser.email}</p>
                </div>
              </div>
              <button onClick={() => setViewingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* User Meta */}
            <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewingUser.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {viewingUser.isActive !== false ? 'Active' : 'Inactive'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewingUser.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {viewingUser.role}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewingUser.isProUser ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                {viewingUser.isProUser ? '⭐ Pro Pass' : 'Free User'}
              </span>
              {viewingUser.proPassExpiry && (
                <span className="text-xs text-gray-400">Expires: {new Date(viewingUser.proPassExpiry).toLocaleDateString('en-IN')}</span>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b">
              <button onClick={() => setActiveModalTab('enrollments')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeModalTab === 'enrollments' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700'}`}>
                <CreditCard className="w-4 h-4" /> Enrollments
              </button>
              <button onClick={() => viewSessions(viewingUser)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeModalTab === 'sessions' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-cyan-50/50' : 'text-gray-500 hover:text-gray-700'}`}>
                <Smartphone className="w-4 h-4" /> Sessions
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Enrollments Tab */}
              {activeModalTab === 'enrollments' && (() => {
                const displayEnrollments = [...(viewingEnrollments?.enrollments || [])];
                if (viewingUser?.isProUser) {
                  displayEnrollments.unshift({
                    id: 'synthetic-pro-pass',
                    passType: viewingUser.passType || viewingUser.pass_type || 'Pro Pass',
                    isPassPurchase: true,
                    enrolledAt: viewingUser.updatedAt || viewingUser.createdAt
                  });
                }
                
                return (
                <>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-500" />
                    Enrollments & Purchases
                  </h3>
                  {enrollmentLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                    </div>
                  ) : displayEnrollments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No enrollments found for this user</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayEnrollments.map((enrollment, i) => (
                        <div key={enrollment.id || i} className="flex items-start gap-3 p-3 rounded-xl border bg-gray-50 hover:bg-white transition-colors">
                          <div className="mt-0.5">
                            {enrollment.seriesName ? (
                              <TestTube2 className="w-5 h-5 text-indigo-500" />
                            ) : enrollment.studyMaterialName ? (
                              <BookOpen className="w-5 h-5 text-green-500" />
                            ) : (
                              <Award className="w-5 h-5 text-yellow-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">
                              {enrollment.seriesName || enrollment.studyMaterialName || 'Subscription Pass'}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${enrollment.isPassPurchase || enrollment.passType === 'Pro Pass' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-600'}`}>
                                {enrollment.isPassPurchase ? `⭐ ${(enrollment.passType).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : (enrollment.passType || 'Free')}
                              </span>
                              {enrollment.seriesName && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-600">Test Series</span>
                              )}
                              {enrollment.studyMaterialName && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-600">Study Material</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 shrink-0 mt-0.5">
                            {enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString('en-IN') : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
                );
              })()}

              {/* Sessions Tab */}
              {activeModalTab === 'sessions' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-cyan-500" />
                      Active Sessions
                      <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-1">
                        {userSessions?.length || 0} / {
                          viewingUser?.sessionLimit || (
                            viewingUser?.role === 'admin' || viewingUser?.role === 'super_admin' ? 5 :
                            viewingUser?.isProUser ? 3 : 1
                          )
                        } Allowed
                      </span>
                    </h3>
                    <div className="flex items-center gap-3">
                      <select
                        value={viewingUser?.sessionLimit || ''}
                        onChange={(e) => updateSessionLimit(viewingUser.id || viewingUser._id, e.target.value)}
                        className="text-xs border-gray-300 rounded px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                        title="Override Session Limit"
                      >
                        <option value="">Default Limit</option>
                        <option value="1">1 Session</option>
                        <option value="2">2 Sessions</option>
                        <option value="3">3 Sessions</option>
                        <option value="5">5 Sessions</option>
                        <option value="10">10 Sessions</option>
                        <option value="100">Unlimited (100)</option>
                      </select>
                      <button onClick={() => viewSessions(viewingUser)} disabled={sessionsLoading}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${sessionsLoading ? 'animate-spin' : ''}`} /> Refresh
                      </button>
                    </div>
                  </div>
                  {sessionsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
                    </div>
                  ) : userSessions?.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">No active sessions</p>
                      <p className="text-xs mt-1 text-gray-300">Sessions appear when this user logs in</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(userSessions || []).map((session) => (
                        <div key={session.id} className="p-3 rounded-xl border bg-gray-50 hover:bg-white transition-colors">
                          <div className="flex items-start gap-3">
                            {/* Device type icon */}
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              session.type === 'Mobile'  ? 'bg-blue-100 text-blue-600' :
                              session.type === 'Tablet'  ? 'bg-purple-100 text-purple-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Browser + OS */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-gray-900 text-sm">{session.browser && session.browser.toLowerCase() !== 'unknown' ? session.browser : 'Unknown Browser'}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  session.type === 'Mobile'  ? 'bg-blue-100 text-blue-700' :
                                  session.type === 'Tablet'  ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{session.type || 'Desktop'}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{session.os && session.os.toLowerCase() !== 'unknown' ? session.os : 'Unknown OS'}</p>
                              {/* IP + Location + last active */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                                <span className="font-mono">IP: {session.ip}</span>
                                <span>· {session.city && session.country ? `${session.city}, ${session.country}` : session.country || session.city || 'Unknown Location'}</span>
                                <span>· {formatLastActive(session.lastActive)}</span>
                              </div>
                            </div>
                            {/* Revoke button */}
                            <button onClick={() => revokeSession(session.id)}
                              className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors shrink-0"
                              title="Revoke Session">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-2xl text-xs text-gray-400 text-right">
              {activeModalTab === 'enrollments' 
                ? `Total: ${viewingEnrollments?.totalEnrollments ?? '...'} enrollment(s)`
                : `${userSessions?.length ?? '...'} active session(s)`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
