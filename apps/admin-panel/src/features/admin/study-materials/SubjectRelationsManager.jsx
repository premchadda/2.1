import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, RefreshCw, Layers, BookOpen, FileText, Video,
  ChevronRight, GitBranch, ArrowRightLeft, Database, AlertCircle,
  CheckCircle, Filter, Download, Link2, X, Play, Eye
} from 'lucide-react'
import { apiClient as api } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import EmptyState from '../../../shared/components/ui/EmptyState'

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

  // Precomputed stats map for all subjects to avoid O(subjects * items) scans during render
  const subjectStatsMap = useMemo(() => {
    const chaptersBySm = new Map()
    const topicsByChapter = new Map()
    const videosBySm = new Map()
    const pdfsBySm = new Map()
    const testsBySm = new Map()
    const seriesBySm = new Map()

    for (const c of allChapters) {
      const smId = String(c.studyMaterialId || c.study_material_id || '')
      if (!chaptersBySm.has(smId)) chaptersBySm.set(smId, [])
      chaptersBySm.get(smId).push(c)
    }

    for (const t of allTopics) {
      const chId = String(t.chapterId || t.chapter_id || '')
      if (!topicsByChapter.has(chId)) topicsByChapter.set(chId, [])
      topicsByChapter.get(chId).push(t)
    }

    for (const v of allVideos) {
      const smId = String(v.studyMaterialId || v.study_material_id || '')
      videosBySm.set(smId, (videosBySm.get(smId) || 0) + 1)
    }

    for (const p of allPdfs) {
      const smId = String(p.studyMaterialId || p.study_material_id || '')
      pdfsBySm.set(smId, (pdfsBySm.get(smId) || 0) + 1)
    }

    for (const t of allTests) {
      const smId = String(t.studyMaterialId || t.study_material_id || '')
      testsBySm.set(smId, (testsBySm.get(smId) || 0) + 1)
    }

    for (const s of allSeries) {
      const smId = String(s.studyMaterialId || s.study_material_id || '')
      seriesBySm.set(smId, (seriesBySm.get(smId) || 0) + 1)
    }

    const map = new Map()
    for (const s of subjects) {
      const id = String(s._id || s.id || '')
      const chs = chaptersBySm.get(id) || []
      let tCount = 0
      for (const ch of chs) {
        const chId = String(ch._id || ch.id || '')
        tCount += (topicsByChapter.get(chId) || []).length
      }
      const vCount = videosBySm.get(id) || 0
      const pCount = pdfsBySm.get(id) || 0
      const tstCount = testsBySm.get(id) || 0
      const sCount = seriesBySm.get(id) || 0
      const isLinked = chs.length > 0 || vCount > 0 || pCount > 0

      map.set(id, {
        chaptersCount: chs.length,
        topicsCount: tCount,
        videosCount: vCount,
        pdfsCount: pCount,
        testsCount: tstCount,
        seriesCount: sCount,
        isLinked
      })
    }
    return map
  }, [subjects, allChapters, allTopics, allVideos, allPdfs, allTests, allSeries])

  // Precomputed resource lists per subject for the detail panel (avoids O(subjects * items) scans)
  const subjectResourcesMap = useMemo(() => {
    const videosBySm = new Map()
    const pdfsBySm = new Map()
    const testsBySm = new Map()
    const seriesBySm = new Map()
    const push = (map, key, item) => {
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    for (const v of allVideos) push(videosBySm, String(v.studyMaterialId || v.study_material_id || ''), v)
    for (const p of allPdfs)   push(pdfsBySm,   String(p.studyMaterialId || p.study_material_id || ''), p)
    for (const t of allTests)  push(testsBySm,  String(t.studyMaterialId || t.study_material_id || ''), t)
    for (const s of allSeries) push(seriesBySm, String(s.studyMaterialId || s.study_material_id || ''), s)

    const map = new Map()
    for (const s of subjects) {
      const id = String(s._id || s.id || '')
      map.set(id, {
        videos: videosBySm.get(id) || [],
        pdfs: pdfsBySm.get(id) || [],
        tests: testsBySm.get(id) || [],
        series: seriesBySm.get(id) || [],
      })
    }
    return map
  }, [subjects, allVideos, allPdfs, allTests, allSeries])

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
    const escapeCsvField = (val) => {
      if (val === null || val === undefined) return '""'
      let str = String(val)
      if (/^[=+\-@]/.test(str)) {
        str = "'" + str
      }
      return `"${str.replace(/"/g, '""')}"`
    }

    let csv = 'Subject ID,Subject Name,Chapters,Topics,Videos,PDFs,Tests,Series\n'
    subjects.forEach(s => {
      const id = s._id || s.id
      const stats = subjectStatsMap.get(String(id)) || { chaptersCount: 0, topicsCount: 0, videosCount: 0, pdfsCount: 0, testsCount: 0, seriesCount: 0 }
      const name = s.title || s.name || ''
      csv += `${escapeCsvField(id)},${escapeCsvField(name)},${stats.chaptersCount},${stats.topicsCount},${stats.videosCount},${stats.pdfsCount},${stats.testsCount},${stats.seriesCount}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'subject_relations.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Exported successfully')
  }

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const id = String(s._id || s.id || '')
      const name = (s.title || s.name || '').toLowerCase()
      const matchSearch = name.includes(searchQuery.toLowerCase())
      const stats = subjectStatsMap.get(id) || { isLinked: false, videosCount: 0, pdfsCount: 0 }
      const matchFilter =
        filterType === 'all' ||
        (filterType === 'linked' && stats.isLinked) ||
        (filterType === 'unlinked' && !stats.isLinked) ||
        (filterType === 'has-videos' && stats.videosCount > 0) ||
        (filterType === 'has-pdfs' && stats.pdfsCount > 0)
      return matchSearch && matchFilter
    })
  }, [subjects, searchQuery, filterType, subjectStatsMap])

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading subject relations…</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subject Relations</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View chapters, topics, videos, PDFs and tests linked to each subject</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={fetchAllData} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Subjects', value: subjects.length, icon: Database, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
          { label: 'Total Chapters', value: allChapters.length, icon: BookOpen, color: 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' },
          { label: 'Total Topics',   value: allTopics.length,   icon: Layers,   color: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'   },
          { label: 'Unlinked',
            value: subjects.filter(s => !(subjectStatsMap.get(String(s._id || s.id))?.isLinked)).length,
            icon: GitBranch, color: 'bg-rose-100 dark:bg-rose-900/20 text-rose-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text" placeholder="Search subjects…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chapters</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topics</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Videos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PDFs</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tests</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Series</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No subjects found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filter</p>
                  </td>
                </tr>
              ) : filteredSubjects.map((subject, idx) => {
                const id = String(subject._id || subject.id)
                const stats = subjectStatsMap.get(id) || {
                  chaptersCount: 0,
                  topicsCount: 0,
                  videosCount: 0,
                  pdfsCount: 0,
                  testsCount: 0,
                  seriesCount: 0,
                  isLinked: false
                }
                const isLinked = stats.isLinked

                return (
                  <tr key={id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors ${!isLinked ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                          {(subject.title || subject.name || 'S')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">{subject.title || subject.name || 'Unnamed'}</p>
                          {!isLinked
                            ? <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium"><AlertCircle className="w-3 h-3" />Unlinked</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium"><CheckCircle className="w-3 h-3" />Linked</span>
                          }
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={stats.chaptersCount} color="blue" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={stats.topicsCount} color="purple" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={stats.videosCount} color="amber" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={stats.pdfsCount} color="cyan" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={stats.testsCount} color="green" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge value={stats.seriesCount} color="indigo" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openPanel(subject)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-xs font-semibold transition-colors"
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
      {showPanel && selected && (() => {
        const resources = subjectResourcesMap.get(String(selected._id || selected.id)) || { videos: [], pdfs: [], tests: [], series: [] }
        return (
          <SubjectLinkPanel
            subject={selected}
            chapters={panelChapters}
            chaptersLoading={panelLoading}
            allTopics={allTopics}
            videos={resources.videos}
            pdfs={resources.pdfs}
            tests={resources.tests}
            series={resources.series}
            onClose={() => { setShowPanel(false); setSelected(null) }}
          />
        )
      })()}
    </div>
  )
}

// ── Badge component ──
function Badge({ value, color }) {
  const colors = {
    blue:   'bg-blue-100 dark:bg-blue-900/20 text-blue-800',
    purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-800',
    amber:  'bg-amber-100 dark:bg-amber-900/20 text-amber-800',
    cyan:   'bg-cyan-100 dark:bg-cyan-900/20 text-cyan-800',
    green:  'bg-green-100 dark:bg-green-900/20 text-green-800',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800',
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
        className="bg-white dark:bg-gray-800 h-full w-full max-w-xl shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {(subject.title || subject.name || 'S')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{subject.title || subject.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Content linked to this subject</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Chapters → Topics tree */}
          <Section icon={BookOpen} title="Chapters & Topics" count={chapters.length} iconColor="text-blue-600 dark:text-blue-400" bgColor="bg-blue-50">
            {chaptersLoading ? (
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm py-2">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Loading chapters…
              </div>
            ) : chapters.length === 0 ? (
              <EmptyState title="No chapters linked to this subject." />
            ) : (
              <ul className="space-y-2">
                {chapters.map(ch => {
                  const chTopics = topicsFor(ch._id || ch.id)
                  return (
                    <li key={ch._id || ch.id} className="text-sm">
                      <div className="flex items-center gap-2 font-medium text-gray-800">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                        {ch.title || ch.name}
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">({chTopics.length} topics)</span>
                      </div>
                      {chTopics.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {chTopics.map(t => (
                            <li key={t._id || t.id} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
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
          <Section icon={Play} title="Videos" count={videos.length} iconColor="text-amber-600 dark:text-amber-400" bgColor="bg-amber-50 dark:bg-amber-900/20">
            {videos.length === 0 ? <EmptyState title="No videos linked." /> : (
              <ul className="space-y-1">
                {videos.map(v => (
                  <li key={v._id || v.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Video className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    {v.title || v.name || 'Untitled Video'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* PDFs */}
          <Section icon={FileText} title="PDFs" count={pdfs.length} iconColor="text-cyan-600 dark:text-cyan-400" bgColor="bg-cyan-50 dark:bg-cyan-900/20">
            {pdfs.length === 0 ? <EmptyState title="No PDFs linked." /> : (
              <ul className="space-y-1">
                {pdfs.map(p => (
                  <li key={p._id || p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <FileText className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    {p.title || p.name || 'Untitled PDF'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Tests */}
          <Section icon={CheckCircle} title="Tests" count={tests.length} iconColor="text-green-600 dark:text-green-400" bgColor="bg-green-50 dark:bg-green-900/20">
            {tests.length === 0 ? <EmptyState title="No tests linked." /> : (
              <ul className="space-y-1">
                {tests.map(t => (
                  <li key={t._id || t.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    {t.title || t.name || 'Untitled Test'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Test Series */}
          <Section icon={Layers} title="Test Series" count={series.length} iconColor="text-indigo-600 dark:text-indigo-400" bgColor="bg-indigo-50 dark:bg-indigo-900/20">
            {series.length === 0 ? <EmptyState title="No test series linked." /> : (
              <ul className="space-y-1">
                {series.map(s => (
                  <li key={s._id || s.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    {s.title || s.name || 'Untitled Series'}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Link hint */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-800">To add content to this subject</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
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
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">({count})</span>
      </div>
      <div className="pl-2">{children}</div>
    </div>
  )
}