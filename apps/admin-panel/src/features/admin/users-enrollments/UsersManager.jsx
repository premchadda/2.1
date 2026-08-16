import { useState, useEffect, useRef } from 'react'
import {
  Users, Search, Eye,
  Ban, CheckCircle,
  Award,
  Download, X, Shield,
  BookOpen, TestTube2, CreditCard, AlertCircle, Smartphone, Trash2, RefreshCw
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient as api } from '../../../shared/lib/dataService'
import { confirmOnce } from '../../../shared/components/common/ConfirmModal'

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
  const [exporting, setExporting] = useState(false)

  // FIX UX-1: Replace window.prompt/confirm for Pro Pass grant/revoke with a
  // proper modal + dropdown. Previously used window.prompt which is blocked in
  // some iframe contexts and provides no validation.
  const [proPassModal, setProPassModal] = useState({ open: false, user: null, action: 'grant' })
  const [proPassType, setProPassType] = useState('pro_yearly')

  // FIX PERF-5: Server-side pagination + search. The backend now supports
  // ?page=&limit=&search=&role=&status=&pro= and returns the filtered page,
  // so we no longer load the entire user table into the browser.
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalUsers, setTotalUsers] = useState(0)
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize))

  // Debounce search so we don't fire a request on every keystroke
  const searchDebounceRef = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setCurrentPage(1)
      setSelectedUsers([])
      setShowBulkActions(false)
    }, 350)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
    setSelectedUsers([])
    setShowBulkActions(false)
  }, [filterStatus, filterRole])

  const [userStats, setUserStats] = useState({ users: 0, activeUsers: 0, proUsers: 0, admins: 0 })

  const fetchUsers = async (pageToFetch = currentPage, signal) => {
    try {
      setLoading(true)
      const params = { page: pageToFetch, limit: pageSize }
      if (debouncedSearch) params.search = debouncedSearch
      if (filterStatus === 'active') params.status = 'active'
      else if (filterStatus === 'inactive') { params.status = 'inactive'; params.includeInactive = 'true' }
      if (filterRole === 'admin') params.role = 'admin'
      else if (filterRole === 'user') params.role = 'user'
      else if (filterRole === 'pro') params.pro = 'true'

      const [usersRes, statsRes] = await Promise.allSettled([
        api.get('/admin/users', { params, signal }),
        api.get('/admin/stats', { signal })
      ])

      if (signal.aborted) return

      if (usersRes.status === 'fulfilled') {
        const usersData = usersRes.value.data?.data
        setUsers(Array.isArray(usersData) ? usersData : (usersData?.users || []))
        const serverTotal = usersRes.value.data?.total
        if (typeof serverTotal === 'number') setTotalUsers(serverTotal)
      }
      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value.data?.data
        if (statsData) {
          setUserStats({
            users: statsData.users ?? 0,
            activeUsers: statsData.activeUsers ?? 0,
            proUsers: statsData.proUsers ?? 0,
            admins: statsData.admins ?? 0
          })
        }
      }
    } catch (error) {
      if (signal.aborted) return
      console.error('Failed to fetch data:', error)
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  // Refetch whenever the server-side inputs change
  useEffect(() => {
    const controller = new AbortController()
    fetchUsers(currentPage, controller.signal)
    return () => controller.abort()
  }, [currentPage, debouncedSearch, filterStatus, filterRole])

  // The server already filtered + paginated, so `users` IS the current page.
  const paginatedUsers = users

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
      throw error
    } finally {
      setActionLoading(null)
    }
  }

  const updateUserStatus = (userId, isActive) => doAction(userId, 'status', { isActive }, { isActive })
  const updateUserRole = (userId, role) => doAction(userId, 'role', { role }, { role })

  const toggleProPass = (user) => {
    const newPro = !user.isProUser
    setProPassModal({ open: true, user, action: newPro ? 'grant' : 'revoke' })
    if (newPro) setProPassType('pro_yearly')
  }

  const confirmProPass = async () => {
    const { user, action } = proPassModal
    if (!user) return
    const userId = user.id || user._id
    const newPro = action === 'grant'
    const passType = newPro ? proPassType : null
    setProPassModal({ open: false, user: null, action: 'grant' })
    await doAction(userId, 'pro-pass', { isProUser: newPro, passType }, { isProUser: newPro, passType })
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

  const maskIP = (ip) => {
    if (!ip) return 'Unknown'
    if (ip.includes(':')) {
      const parts = ip.split(':')
      return parts.slice(0, 2).join(':') + ':***'
    }
    const parts = ip.split('.')
    if (parts.length !== 4) return ip
    parts[3] = '***'
    return parts.join('.')
  }

  const handleBulkStatus = async (isActive) => {
    const actionLabel = isActive ? 'Activate' : 'Deactivate'
    if (!(await confirmOnce({
      title: `Confirm ${actionLabel}`,
      message: `${actionLabel} ${selectedUsers.length} user(s)? This will change their account status immediately.`,
      confirmLabel: actionLabel,
      danger: !isActive
    }))) return
    setActionLoading('bulk-status')
    try {
      const results = await Promise.allSettled(
        selectedUsers.map(id => updateUserStatus(id, isActive))
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - succeeded
      if (failed > 0) {
        toast.error(`Updated ${succeeded} users, ${failed} failed`)
      } else {
        toast.success(`Successfully updated ${succeeded} users`)
      }
      setSelectedUsers([])
      setShowBulkActions(false)
    } catch (err) {
      console.error('Bulk status update failed:', err)
      toast.error('Bulk status update failed')
    } finally {
      setActionLoading('')
    }
  }

  const handleBulkRole = async (role, roleLabel) => {
    const isAdminGrant = role === 'admin'
    const msg = isAdminGrant
      ? `GRANT ADMIN privileges to ${selectedUsers.length} user(s)? This gives full administrative access.`
      : `Set role to ${roleLabel} for ${selectedUsers.length} user(s)?`
    if (!(await confirmOnce({
      title: 'Confirm Bulk Role Change',
      message: msg,
      confirmLabel: isAdminGrant ? 'Grant Admin' : 'Set Role',
      danger: isAdminGrant
    }))) return
    setActionLoading('bulk-role')
    try {
      const results = await Promise.allSettled(
        selectedUsers.map(id => updateUserRole(id, role))
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - succeeded
      if (failed > 0) {
        toast.error(`Updated ${succeeded} users, ${failed} failed`)
      } else {
        toast.success(`Successfully updated ${succeeded} users`)
      }
      setSelectedUsers([])
      setShowBulkActions(false)
    } catch (err) {
      console.error('Bulk role update failed:', err)
      toast.error('Bulk role update failed')
    } finally {
      setActionLoading('')
    }
  }

  const exportUsersAsCSV = async () => {
    try {
      setExporting(true)
      let allUsers = []
      let page = 1
      const limit = 100
      let hasMore = true

      while (hasMore) {
        const params = { page, limit }
        if (debouncedSearch) params.search = debouncedSearch
        if (filterStatus === 'active') params.status = 'active'
        else if (filterStatus === 'inactive') { params.status = 'inactive'; params.includeInactive = 'true' }
        if (filterRole === 'admin') params.role = 'admin'
        else if (filterRole === 'user') params.role = 'user'
        else if (filterRole === 'pro') params.pro = 'true'

        const res = await api.get('/admin/users', { params })
        const pageUsers = res.data?.data?.users || res.data?.data || []
        allUsers = allUsers.concat(pageUsers)

        const serverTotal = res.data?.total || 0
        if (page * limit >= serverTotal || pageUsers.length === 0) {
          hasMore = false
        } else {
          page++
        }
      }

      const csvField = (val) => {
        const raw = String(val ?? '')
        const sanitized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
        return /[",\n\r]/.test(sanitized) ? `"${sanitized.replace(/"/g, '""')}"` : sanitized
      }

      const headers = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Created At', 'Last Login']
      const rows = allUsers.map(u => [
        u.id || u._id || '',
        u.name || '',
        u.email || '',
        u.phone || '',
        u.role || 'user',
        u.createdAt || '',
        u.lastLogin || u.last_login || ''
      ].map(csvField))

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `users_export_${Date.now()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${allUsers.length} users to CSV`)
    } catch (error) {
      console.error('Failed to export users:', error)
      toast.error('Failed to export users')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Action Bar */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <button onClick={exportUsersAsCSV} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-400 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: userStats.users, icon: Users, color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
          { label: 'Active', value: userStats.activeUsers, icon: CheckCircle, color: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
          { label: 'Pro Users', value: userStats.proUsers, icon: Award, color: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600' },
          { label: 'Admins', value: userStats.admins, icon: Shield, color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="pro">Pro Users</option>
          </select>
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg">
              <span className="text-sm text-indigo-700 dark:text-indigo-400 font-medium">{selectedUsers.length} selected</span>
              <button onClick={() => setShowBulkActions(!showBulkActions)} className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 underline">
                {showBulkActions ? 'Hide' : 'Actions'}
              </button>
            </div>
          )}
        </div>
        {showBulkActions && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
            {/* Bulk actions using parallel Promise.allSettled */}
            <button onClick={() => handleBulkStatus(true)}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">Activate All</button>
            <button onClick={() => handleBulkStatus(false)}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">Deactivate All</button>
            <button onClick={() => handleBulkRole('admin', 'Admin')}
              className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">Make Admin</button>
            <button onClick={() => handleBulkRole('user', 'User')}
              className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">Remove Admin</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUsers.includes(u.id || u._id))}
                    onChange={toggleSelectAll} className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Subscription</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {paginatedUsers.map(user => {
                const uid = user.id || user._id
                return (
                  <tr key={uid} className={`hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors ${selectedUsers.includes(uid) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedUsers.includes(uid)}
                        onChange={() => toggleUserSelection(uid)} className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{user.name || 'Unnamed User'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive !== false ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        {user.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role || 'user'}
                        onChange={async (e) => {
                          const newRole = e.target.value
                          const roleText = e.target.options[e.target.selectedIndex].text
                          if (await confirmOnce({
                            title: 'Change User Role',
                            message: `Change role to ${roleText}?`,
                            confirmLabel: 'Change Role'
                          })) {
                            try {
                              await updateUserRole(uid, newRole)
                            } catch (err) {
                              console.error('Failed to update user role:', err)
                              toast.error('Failed to update role')
                            }
                          } else {
                            e.target.value = user.role || 'user'
                          }
                        }}
                        disabled={actionLoading === uid + 'role'}
                        className={`text-xs font-medium border-0 rounded-full px-2 py-0.5 cursor-pointer focus:ring-2 focus:ring-indigo-500
                          ${user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                      >
                        <option value="user">User</option>
                        <option value="admin">👑 Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-fit ${user.isProUser ? 'bg-yellow-100 text-yellow-700 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                          {user.isProUser ? `⭐ ${(user.passType || user.pass_type || 'Pro Pass').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : 'Free'}
                        </span>
                        {user.proPassExpiry && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Exp: {new Date(user.proPassExpiry).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* View Enrollments */}
                        <button onClick={() => viewEnrollments(user)}
                          title="View Enrollments"
                          className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/20 rounded transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* View Sessions */}
                        <button onClick={() => viewSessions(user)}
                          title="View Active Sessions"
                          className="p-1.5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:bg-cyan-900/20 rounded transition-colors">
                          <Smartphone className="w-4 h-4" />
                        </button>
                        {/* Toggle Active */}
                        <button onClick={() => updateUserStatus(uid, user.isActive === false)}
                          title={user.isActive !== false ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded transition-colors ${user.isActive !== false ? 'text-red-500 hover:bg-red-50' : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:bg-green-900/20'}`}>
                          {user.isActive !== false ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        {/* Toggle Pro */}
                        <button onClick={() => toggleProPass(user)}
                          title={user.isProUser ? 'Revoke Pro Pass' : 'Grant Pro Pass'}
                          className={`p-1.5 rounded transition-colors ${user.isProUser ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700'}`}>
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
        {paginatedUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Users className="mx-auto h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">No users found</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-<strong>{Math.min(currentPage * pageSize, totalUsers)}</strong> of <strong>{totalUsers}</strong> users
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:cursor-not-allowed">
              Previous
            </button>
            {(() => {
              const maxButtons = 7
              let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2))
              let endPage = startPage + maxButtons - 1
              if (endPage > totalPages) {
                endPage = totalPages
                startPage = Math.max(1, endPage - maxButtons + 1)
              }
              const pages = []
              for (let p = startPage; p <= endPage; p++) {
                pages.push(p)
              }
              return pages.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 text-sm rounded-lg font-medium ${
                    currentPage === pageNum ? 'bg-indigo-600 text-white' : 'border hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
                  }`}
                >
                  {pageNum}
                </button>
              ))
            })()}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}

      {/* User Detail Modal (Enrollments + Sessions) */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingUser(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-lg">
                  {(viewingUser.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{viewingUser.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{viewingUser.email}</p>
                </div>
              </div>
              <button onClick={() => setViewingUser(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* User Meta */}
            <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewingUser.isActive !== false ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                {viewingUser.isActive !== false ? 'Active' : 'Inactive'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewingUser.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {viewingUser.role}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewingUser.isProUser ? 'bg-yellow-100 text-yellow-700 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {viewingUser.isProUser ? '⭐ Pro Pass' : 'Free User'}
              </span>
              {viewingUser.proPassExpiry && (
                <span className="text-xs text-gray-400 dark:text-gray-500">Expires: {new Date(viewingUser.proPassExpiry).toLocaleDateString('en-IN')}</span>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b">
              <button onClick={() => setActiveModalTab('enrollments')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeModalTab === 'enrollments' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'}`}>
                <CreditCard className="w-4 h-4" /> Enrollments
              </button>
              <button onClick={() => viewSessions(viewingUser)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeModalTab === 'sessions' ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 bg-cyan-50 dark:bg-cyan-900/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'}`}>
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
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-500" />
                    Enrollments & Purchases
                  </h3>
                  {enrollmentLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                    </div>
                  ) : displayEnrollments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                      <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No enrollments found for this user</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayEnrollments.map((enrollment, i) => {
                        const enrollmentName = enrollment.seriesName || enrollment.studyMaterialName || enrollment.planName || 'Enrollment'
                        const passLabel = enrollment.isPassPurchase
                          ? `⭐ ${(enrollment.passType || 'Pass').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
                          : (enrollment.passType || 'Enrolled')
                        return (
                        <div key={enrollment.id || i} className="flex items-start gap-3 p-3 rounded-xl border bg-gray-50 dark:bg-gray-900 hover:bg-white dark:bg-gray-800 transition-colors">
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
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {enrollmentName}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${enrollment.isPassPurchase || enrollment.passType === 'Pro Pass' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                                {passLabel}
                              </span>
                              {enrollment.seriesName && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">Test Series</span>
                              )}
                              {enrollment.studyMaterialName && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">Study Material</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
                            {enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString('en-IN') : ''}
                          </p>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </>
                );
              })()}

              {/* Sessions Tab */}
              {activeModalTab === 'sessions' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-cyan-500" />
                      Active Sessions
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full ml-1">
                        {userSessions?.length || 0} / {
                          viewingUser?.sessionLimit || (
                            viewingUser?.role === 'admin' ? 5 :
                            viewingUser?.isProUser ? 3 : 1
                          )
                        } Allowed
                      </span>
                    </h3>
                    <div className="flex items-center gap-3">
                      <select
                        value={viewingUser?.sessionLimit || ''}
                        onChange={(e) => updateSessionLimit(viewingUser.id || viewingUser._id, e.target.value)}
                        className="text-xs border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
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
                        className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${sessionsLoading ? 'animate-spin' : ''}`} /> Refresh
                      </button>
                    </div>
                  </div>
                  {sessionsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
                    </div>
                  ) : userSessions?.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                      <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">No active sessions</p>
                      <p className="text-xs mt-1 text-gray-300">Sessions appear when this user logs in</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(userSessions || []).map((session) => (
                        <div key={session.id} className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-900 hover:bg-white dark:bg-gray-800 transition-colors">
                          <div className="flex items-start gap-3">
                            {/* Device type icon */}
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              session.type === 'Mobile'  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                              session.type === 'Tablet'  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Browser + OS */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">{session.browser && session.browser.toLowerCase() !== 'unknown' ? session.browser : 'Unknown Browser'}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  session.type === 'Mobile'  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' :
                                  session.type === 'Tablet'  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' :
                                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>{session.type || 'Desktop'}</span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{session.os && session.os.toLowerCase() !== 'unknown' ? session.os : 'Unknown OS'}</p>
                              {/* IP + Location + last active */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400 dark:text-gray-500">
                                <span className="font-mono">IP: {maskIP(session.ip)}</span>
                                <span>· {session.city && session.country ? `${session.city}, ${session.country}` : session.country || session.city || 'Unknown Location'}</span>
                                <span>· {formatLastActive(session.lastActive)}</span>
                              </div>
                            </div>
                            {/* Revoke button */}
                            <button onClick={() => revokeSession(session.id)}
                              className="p-1.5 text-red-400 dark:text-red-500 hover:bg-red-50 dark:bg-red-900/20 hover:text-red-600 dark:text-red-400 rounded-lg transition-colors shrink-0"
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
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 rounded-b-2xl text-xs text-gray-400 dark:text-gray-500 text-right">
              {activeModalTab === 'enrollments' 
                ? `Total: ${viewingEnrollments?.totalEnrollments ?? '...'} enrollment(s)`
                : `${userSessions?.length ?? '...'} active session(s)`}
            </div>
          </div>
        </div>
      )}

      {/* Pro Pass Grant/Revoke Modal */}
      {proPassModal.open && proPassModal.user && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setProPassModal({ open: false, user: null, action: 'grant' })}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {proPassModal.action === 'grant' ? 'Grant Pro Pass' : 'Revoke Pro Pass'}
              </h3>
              <button onClick={() => setProPassModal({ open: false, user: null, action: 'grant' })} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {proPassModal.action === 'grant'
                  ? `Grant a Pro Pass to ${proPassModal.user.name || proPassModal.user.email}?`
                  : `Revoke the Pro Pass from ${proPassModal.user.name || proPassModal.user.email}? This will remove Pro access immediately.`}
              </p>
              {proPassModal.action === 'grant' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Pass Type</label>
                  <select
                    value={proPassType}
                    onChange={(e) => setProPassType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pro_yearly">Pro Yearly</option>
                    <option value="pro_monthly">Pro Monthly</option>
                    <option value="pro_half_yearly">Pro Half-Yearly</option>
                    <option value="pro_quarterly">Pro Quarterly</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
              <button
                onClick={() => setProPassModal({ open: false, user: null, action: 'grant' })}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmProPass}
                className={`px-4 py-2 text-sm rounded-lg text-white ${proPassModal.action === 'grant' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {proPassModal.action === 'grant' ? 'Grant' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
