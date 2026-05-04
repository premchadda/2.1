import { useState, useEffect, useCallback } from 'react'
import {
  Search, RefreshCw, Layers, BookOpen, FileText, Video,
  ChevronRight, GitBranch, ArrowRightLeft, Database, AlertCircle,
  CheckCircle, Filter, Download, Link2, X, Play, Eye, Plus
} from 'lucide-react'
import api from '../../../shared/lib/api'
import { toast } from 'react-hot-toast'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function SubjectRelationsManager() {
  const [subjects, setSubjects] = useState([])       // study_materials rows
  const [allChapters, setAllChapters] = useState([])
  const [allTopics, setAllTopics]     = useState([])
  const [allVideos, setAllVideos]     = useState([])
  const [allPdfs, setAllPdfs]         = useState([])
  const [allTests, setAllTests]       = useState([])
  const [allSeries, setAllSeries]     = useState([])

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Link detail panel
  const [selected, setSelected] = useState(null)
  const [showPanel, setShowPanel] = useState(false)
  const [panelChapters, setPanelChapters] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true)
      const responses = await Promise.allSettled([
        api.get('/admin/subjects-list'),          // study_materials — fast, no counts
        api.get('/admin/chapters'),
        api.get('/admin/topics'),
        api.get('/admin/subject-videos'),
        api.get('/admin/subject-pdfs'),
        api.get('/admin/topic-tests'),
        api.get('/admin/test-series'),
      ])

      const ok = (r) => r.status === 'fulfilled' ? (r.value.data?.data || []) : []

      setSubjects(ok(responses[0]))
      setAllChapters(ok(responses[1]))
      setAllTopics(ok(responses[2]))
      setAllVideos(ok(responses[3]))
      setAllPdfs(ok(responses[4]))
      setAllTests(ok(responses[5]))
      setAllSeries(ok(responses[6]))
    } catch (error) {
      console.error('Failed to fetch relation data:', error)
      toast.error('Failed to load subject relations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAllData() }, [fetchAllData])

  // ── Relation helpers ──
  const chaptersFor = (id) => allChapters.filter(c =>
    String(c.studyMaterialId || c.study_material_id || '') === String(id)
  )
  const topicsFor = (chapterIds) => allTopics.filter(t =>
    chapterIds.includes(String(t.chapterId || t.chapter_id || ''))
  )
  const videosFor = (id) => allVideos.filter(v =>
    String(v.studyMaterialId || v.study_material_id || '') === String(id)
  )
  const pdfsFor = (id) => allPdfs.filter(p =>
    String(p.studyMaterialId || p.study_material_id || '') === String(id)
  )
  const testsFor = (id) => allTests.filter(t =>
    String(t.studyMaterialId || t.study_material_id || '') === String(id)
  )
  const seriesFor = (id) => allSeries.filter(s =>
    String(s.studyMaterialId || s.study_material_id || '') === String(id)
  )

  // Open detail panel for a subject — load its chapters with topic counts
  const openPanel = async (subject) => {
    setSelected(subject)
    setShowPanel(true)
    setPanelLoading(true)
    try {
      const smId = subject._id || subject.id
      const res = await api.get(`/admin/chapters?studyMaterialId=${smId}`)
      setPanelChapters(res.data?.data || [])
    } catch {
      setPanelChapters([])
    } finally {
      setPanelLoading(false)
    }
  }

  const exportCSV = () => {
    let csv = 'Subject ID,Subject Name,Chapters,Topics,Videos,PDFs,Tests,Series\n'
    subjects.forEach(s => {
      const id = s._id || s.id
      const chs = chaptersFor(id)
      csv += `${id},"${s.title || s.name || ''}",${chs.length},${topicsFor(chs.map(c => String(c._id || c.id))).length},${videosFor(id).length},${pdfsFor(id).length},${testsFor(id).length},${seriesFor(id).length}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'subject_relations.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Exported successfully')
  }

  const filteredSubjects = subjects.filter(s => {
    const id = s._id || s.id
    const name = (s.title || s.name || '').toLowerCase()
    const matchSearch = name.includes(searchQuery.toLowerCase())
    const chs = chaptersFor(id)
    const linked = chs.length > 0 || videosFor(id).length > 0 || pdfsFor(id).length > 0
    const matchFilter =
      filterType === 'all' ||
      (filterType === 'linked'   &&  linked) ||
      (filterType === 'unlinked' && !linked) ||
      (filterType === 'has-videos' && videosFor(id).length > 0) ||
      (filterType === 'has-pdfs'   && pdfsFor(id).length   > 0)
    return matchSearch && matchFilter
  })

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading subject relations…</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subject Relations</h1>
          <p className="text-gray-500 mt-1">View chapters, topics, videos, PDFs and tests linked to each subject</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={fetchAllData} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Subjects', value: subjects.length, icon: Database, color: 'bg-indigo-100 text-indigo-600' },
          { label: 'Total Chapters', value: allChapters.length, icon: BookOpen, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Total Topics',   value: allTopics.length,   icon: Layers,   color: 'bg-amber-100 text-amber-600'   },
          { label: 'Unlinked',
            value: subjects.filter(s => { const id = s._id || s.id; return chaptersFor(id).length === 0 && videosFor(id).length === 0 }).length,
            icon: GitBranch, color: 'bg-rose-100 text-rose-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Search subjects…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Subjects</option>
              <option value="linked">Linked Only</option>
              <option value="unlinked">Unlinked Only</option>
              <option value="has-videos">Has Videos</option>
              <option value="has-pdfs">Has PDFs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Chapters</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Topics</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Videos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">PDFs</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Tests</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Series</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No subjects found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filter</p>
                  </td>
                </tr>
              ) : filteredSubjects.map((subject, idx) => {
                const id = subject._id || subject.id
                const chs = chaptersFor(id)
                const chIds = chs.map(c => String(c._id || c.id))
                const tCount = topicsFor(chIds).length
                const vCount = videosFor(id).length
                const pCount = pdfsFor(id).length
                const tstCount = testsFor(id).length
                const sCount = seriesFor(id).length
                const isLinked = chs.length > 0 || vCount > 0 || pCount > 0

                return (
                  <tr key={id} className={`hover:bg-gray-50 transition-colors ${!isLinked ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                          {(subject.title || subject.name || 'S')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{subject.title || subject.name || 'Unnamed'}</p>
                          {!isLinked
                            ? <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium"><AlertCircle className="w-3 h-3" />Unlinked</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium"><CheckCircle className="w-3 h-3" />Linked</span>
                          }
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={chs.length} color="blue" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={tCount} color="purple" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={vCount} color="amber" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={pCount} color="cyan" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={tstCount} color="green" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={sCount} color="indigo" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openPanel(subject)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Links
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {showPanel && selected && (
        <SubjectLinkPanel
          subject={selected}
          chapters={panelChapters}
          chaptersLoading={panelLoading}
          allTopics={allTopics}
          videos={videosFor(selected._id || selected.id)}
          pdfs={pdfsFor(selected._id || selected.id)}
          tests={testsFor(selected._id || selected.id)}
          series={seriesFor(selected._id || selected.id)}
          onClose={() => { setShowPanel(false); setSelected(null) }}
        />
      )}
    </div>
  )
}

// ── Badge component ──
function Badge({ value, color }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    amber:  'bg-amber-100 text-amber-800',
    cyan:   'bg-cyan-100 text-cyan-800',
    green:  'bg-green-100 text-green-800',
    indigo: 'bg-indigo-100 text-indigo-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.blue}`}>
      {value}
    </span>
  )
}

// ── Link Detail Panel (slide-over) ──
function SubjectLinkPanel({ subject, chapters, chaptersLoading, allTopics, videos, pdfs, tests, series, onClose }) {
  const topicsFor = (chId) => allTopics.filter(t => String(t.chapterId || t.chapter_id || '') === String(chId))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-xl shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {(subject.title || subject.name || 'S')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{subject.title || subject.name}</h2>
              <p className="text-xs text-gray-400">Content linked to this subject</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Chapters → Topics tree */}
          <Section icon={BookOpen} title="Chapters & Topics" count={chapters.length} iconColor="text-blue-600" bgColor="bg-blue-50">
            {chaptersLoading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Loading chapters…
              </div>
            ) : chapters.length === 0 ? (
              <EmptyState message="No chapters linked to this subject." />
            ) : (
              <ul className="space-y-2">
                {chapters.map(ch => {
                  const chTopics = topicsFor(ch._id || ch.id)
                  return (
                    <li key={ch._id || ch.id} className="text-sm">
                      <div className="flex items-center gap-2 font-medium text-gray-800">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {ch.title || ch.name}
                        <span className="text-xs text-gray-400 font-normal">({chTopics.length} topics)</span>
                      </div>
                      {chTopics.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {chTopics.map(t => (
                            <li key={t._id || t.id} className="text-xs text-gray-500 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                              {t.title || t.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          {/* Videos */}
          <Section icon={Play} title="Videos" count={videos.length} iconColor="text-amber-600" bgColor="bg-amber-50">
            {videos.length === 0 ? <EmptyState message="No videos linked." /> : (
              <ul className="space-y-1">
                {videos.map(v => (
                  <li key={v._id || v.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <Video className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    {v.title || v.name || 'Untitled Video'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* PDFs */}
          <Section icon={FileText} title="PDFs" count={pdfs.length} iconColor="text-cyan-600" bgColor="bg-cyan-50">
            {pdfs.length === 0 ? <EmptyState message="No PDFs linked." /> : (
              <ul className="space-y-1">
                {pdfs.map(p => (
                  <li key={p._id || p.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <FileText className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    {p.title || p.name || 'Untitled PDF'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Tests */}
          <Section icon={CheckCircle} title="Tests" count={tests.length} iconColor="text-green-600" bgColor="bg-green-50">
            {tests.length === 0 ? <EmptyState message="No tests linked." /> : (
              <ul className="space-y-1">
                {tests.map(t => (
                  <li key={t._id || t.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    {t.title || t.name || 'Untitled Test'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Test Series */}
          <Section icon={Layers} title="Test Series" count={series.length} iconColor="text-indigo-600" bgColor="bg-indigo-50">
            {series.length === 0 ? <EmptyState message="No test series linked." /> : (
              <ul className="space-y-1">
                {series.map(s => (
                  <li key={s._id || s.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    {s.title || s.name || 'Untitled Series'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Link hint */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Link2 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-800">To add content to this subject</p>
                <p className="text-xs text-indigo-600 mt-1">
                  Go to <strong>Content Manager</strong>, select <strong>{subject.title || subject.name}</strong> from the Subject dropdown, then use <strong>Add Video / Add PDF / Add Test</strong>. You can also use the <strong>Edit</strong> button on any existing content to re-link it here.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, count, iconColor, bgColor, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${bgColor}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <span className="text-xs text-gray-400">({count})</span>
      </div>
      <div className="pl-2">{children}</div>
    </div>
  )
}

function EmptyState({ message }) {
  return <p className="text-xs text-gray-400 italic">{message}</p>
}