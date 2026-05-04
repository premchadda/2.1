import { useState, useEffect, useMemo } from 'react'
import {
  Users, Search, Download, Eye, X, Filter,
  TestTube2, BookOpen, CreditCard, Award,
  CheckCircle, XCircle, Clock, RefreshCw,
  ChevronDown, User, Calendar, GraduationCap
} from 'lucide-react'
import api from '../../../shared/lib/api'

const PASS_COLORS = {
  'Pro Pass':        'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Pro Monthly':     'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Pro Yearly':      'bg-amber-100 text-amber-700 border-amber-200',
  'Free':            'bg-gray-100 text-gray-600 border-gray-200',
  'Basic':           'bg-blue-100 text-blue-700 border-blue-200',
  'default':         'bg-indigo-100 text-indigo-700 border-indigo-200',
}

const userStatusBadge = (isActive, isProUser) => {
  if (isActive === false) return { label: 'Inactive', cls: 'bg-red-100 text-red-600' }
  if (isProUser)          return { label: 'Pro',      cls: 'bg-yellow-100 text-yellow-700' }
  return                         { label: 'Active',   cls: 'bg-green-100 text-green-700' }
}

export default function EnrollmentsManager() {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)

  // Filters
  const [search, setSearch]           = useState('')
  const [filterPass, setFilterPass]   = useState('all')
  const [filterUserStatus, setFilterUserStatus] = useState('all')
  const [filterSeries, setFilterSeries]   = useState('all')
  const [filterMaterial, setFilterMaterial] = useState('all')

  // Detail drawer
  const [selected, setSelected] = useState(null)

  useEffect(() => { load() }, [])

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await api.get('/admin/enrollments')
      setEnrollments(res.data.data || [])
    } catch (err) {
      console.error('Enrollments fetch failed:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Derive unique filter options from data
  const allSeriesNames   = useMemo(() => [...new Set(enrollments.flatMap(e => e.series.map(s => s.name)))], [enrollments])
  const allMaterialNames = useMemo(() => [...new Set(enrollments.flatMap(e => e.studyMaterials.map(m => m.name)))], [enrollments])
  const uniquePasses     = useMemo(() => [...new Set(enrollments.map(e => e.passBadge).filter(Boolean))], [enrollments])

  const filtered = useMemo(() => {
    return enrollments.filter(e => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        e.userName?.toLowerCase().includes(q) ||
        e.userEmail?.toLowerCase().includes(q) ||
        e.series.some(s => s.name.toLowerCase().includes(q)) ||
        e.studyMaterials.some(m => m.name.toLowerCase().includes(q)) ||
        e.exams.some(x => x.name.toLowerCase().includes(q))

      const matchPass = filterPass === 'all' || e.passBadge === filterPass

      const matchUserStatus =
        filterUserStatus === 'all'      ? true :
        filterUserStatus === 'active'   ? e.isActive !== false :
        filterUserStatus === 'inactive' ? e.isActive === false :
        filterUserStatus === 'pro'      ? e.isProUser : true

      const matchSeries   = filterSeries === 'all'   || e.series.some(s => s.name === filterSeries)
      const matchMaterial = filterMaterial === 'all' || e.studyMaterials.some(m => m.name === filterMaterial)

      return matchSearch && matchPass && matchUserStatus && matchSeries && matchMaterial
    })
  }, [enrollments, search, filterPass, filterUserStatus, filterSeries, filterMaterial])

  const stats = useMemo(() => ({
    total:    enrollments.length,
    pro:      enrollments.filter(e => e.isProUser).length,
    free:     enrollments.filter(e => !e.isProUser).length,
    series:   enrollments.reduce((sum, e) => sum + e.seriesCount, 0),
    exams:    enrollments.reduce((sum, e) => sum + e.examCount, 0),
    study:    enrollments.reduce((sum, e) => sum + e.studyMaterialCount, 0),
  }), [enrollments])

  const exportCSV = () => {
    const rows = [
      ['User', 'Email', 'Pass Type', 'User Status', 'Series', 'Exams', 'Study Materials', 'Enrolled At'],
      ...filtered.map(e => [
        e.userName, e.userEmail, e.passBadge,
        e.isActive === false ? 'Inactive' : e.isProUser ? 'Pro' : 'Active',
        e.series.map(s => s.name).join('; '),
        e.exams.map(x => x.name).join('; '),
        e.studyMaterials.map(m => m.name).join('; '),
        e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString('en-IN') : ''
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'enrollments.csv'; a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enrollments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track who purchased what — passes, test series, exams &amp; study materials</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Users',       value: stats.total,  icon: Users,       cls: 'text-indigo-600 bg-indigo-50' },
          { label: 'Pro Pass Users',    value: stats.pro,    icon: Award,       cls: 'text-yellow-600 bg-yellow-50' },
          { label: 'Free Users',        value: stats.free,   icon: User,        cls: 'text-gray-600 bg-gray-50' },
          { label: 'Series Enrolled',   value: stats.series, icon: TestTube2,   cls: 'text-blue-600 bg-blue-50' },
          { label: 'Exam Enrolled',     value: stats.exams,  icon: GraduationCap, cls: 'text-purple-600 bg-purple-50' },
          { label: 'Study Enrolled',    value: stats.study,  icon: BookOpen,    cls: 'text-green-600 bg-green-50' },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className={`p-3 rounded-xl ${cls}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search user, email, series, exam, material..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
          </div>

          <select value={filterUserStatus} onChange={e => setFilterUserStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
            <option value="all">All User Status</option>
            <option value="active">Active Users</option>
            <option value="pro">Pro Users</option>
            <option value="inactive">Inactive Users</option>
          </select>

          <select value={filterPass} onChange={e => setFilterPass(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
            <option value="all">All Pass Types</option>
            {uniquePasses.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          {allSeriesNames.length > 0 && (
            <select value={filterSeries} onChange={e => setFilterSeries(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
              <option value="all">All Test Series</option>
              {allSeriesNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {allMaterialNames.length > 0 && (
            <select value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
              <option value="all">All Study Materials</option>
              {allMaterialNames.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}

          {(search || filterPass !== 'all' || filterUserStatus !== 'all' || filterSeries !== 'all' || filterMaterial !== 'all') && (
            <button onClick={() => { setSearch(''); setFilterPass('all'); setFilterUserStatus('all'); setFilterSeries('all'); setFilterMaterial('all') }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}

          <span className="text-xs text-gray-400 flex items-center ml-auto">
            Showing <strong className="mx-1 text-gray-700">{filtered.length}</strong> of {enrollments.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Pass Type</th>
                <th className="px-4 py-3 text-left">Test Series</th>
                <th className="px-4 py-3 text-left">Exams</th>
                <th className="px-4 py-3 text-left">Study Material</th>
                <th className="px-4 py-3 text-left">Enrolled</th>
                <th className="px-4 py-3 text-left">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((enrollment) => {
                const { label: statusLabel, cls: statusCls } = userStatusBadge(enrollment.isActive, enrollment.isProUser)
                const passCls = PASS_COLORS[enrollment.passBadge] || PASS_COLORS.default
                return (
                  <tr key={enrollment.userId} className="hover:bg-indigo-50/30 transition-colors">
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
                          {(enrollment.userName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 leading-tight">{enrollment.userName || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{enrollment.userEmail}</p>
                        </div>
                      </div>
                    </td>

                    {/* User Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>
                        {statusLabel === 'Active'   && <CheckCircle className="w-3 h-3" />}
                        {statusLabel === 'Inactive' && <XCircle className="w-3 h-3" />}
                        {statusLabel === 'Pro'      && <Award className="w-3 h-3" />}
                        {statusLabel}
                      </span>
                    </td>

                    {/* Pass Type */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${passCls}`}>
                        <CreditCard className="w-3 h-3" />
                        {enrollment.passBadge || 'Free'}
                      </span>
                    </td>

                    {/* Test Series */}
                    <td className="px-4 py-3">
                      {enrollment.seriesCount > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <TestTube2 className="w-3 h-3" />
                            {enrollment.seriesCount}
                          </span>
                          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={enrollment.series.map(s => s.name).join(', ')}>
                            {enrollment.series.map(s => s.name).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Exams */}
                    <td className="px-4 py-3">
                      {enrollment.examCount > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            <GraduationCap className="w-3 h-3" />
                            {enrollment.examCount}
                          </span>
                          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={enrollment.exams.map(x => x.name).join(', ')}>
                            {enrollment.exams.map(x => x.name).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Study Material */}
                    <td className="px-4 py-3">
                      {enrollment.studyMaterialCount > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            <BookOpen className="w-3 h-3" />
                            {enrollment.studyMaterialCount}
                          </span>
                          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={enrollment.studyMaterials.map(m => m.name).join(', ')}>
                            {enrollment.studyMaterials.map(m => m.name).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </td>

                    {/* View */}
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(enrollment)}
                        className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No enrollments match your filters</p>
            <p className="text-sm mt-1">Try adjusting or clearing the filters</p>
          </div>
        )}
      </div>

      {/* Detail Drawer / Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                  {(selected.userName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selected.userName}</p>
                  <p className="text-sm text-gray-400">{selected.userEmail}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* User Status */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  Account Status
                </div>
                {(() => {
                  const { label, cls } = userStatusBadge(selected.isActive, selected.isProUser)
                  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                })()}
              </div>

              {/* Pass Type */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CreditCard className="w-4 h-4" />
                  Pass Type
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PASS_COLORS[selected.passBadge] || PASS_COLORS.default}`}>
                  {selected.passBadge || 'Free'}
                </span>
              </div>

              {/* Pass Expiry */}
              {selected.proPassExpiry && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    Pass Expiry
                  </div>
                  <span className="text-sm text-gray-700">
                    {new Date(selected.proPassExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}

              {/* Test Series */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <TestTube2 className="w-4 h-4" />
                  Test Series ({selected.seriesCount})
                </div>
                {selected.series.length > 0 ? (
                  <div className="space-y-1.5">
                    {selected.series.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{s.progress}% done</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <span className="text-xs text-gray-400">Not enrolled</span>}
              </div>

              {/* Exams */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <GraduationCap className="w-4 h-4" />
                  Exams ({selected.examCount})
                </div>
                {selected.exams.length > 0 ? (
                  <div className="space-y-1.5">
                    {selected.exams.map((x, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800">{x.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${x.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {x.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <span className="text-xs text-gray-400">Not enrolled</span>}
              </div>

              {/* Study Material */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <BookOpen className="w-4 h-4" />
                  Study Material ({selected.studyMaterialCount})
                </div>
                {selected.studyMaterials.length > 0 ? (
                  <div className="space-y-1.5">
                    {selected.studyMaterials.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{m.progress}% done</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {m.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <span className="text-xs text-gray-400">Not enrolled</span>}
              </div>

              {/* Enrolled At */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  First Enrolled
                </div>
                <span className="text-sm text-gray-700">
                  {selected.enrolledAt ? new Date(selected.enrolledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button onClick={() => setSelected(null)}
                className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
