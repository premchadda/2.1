import { useState, useEffect } from 'react'
import { FileText, Search, Download, Eye, BarChart2, X } from 'lucide-react'
import { adminAPI } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'

// FIX C6: ResultsManager now has working Export CSV, View Details modal, and Analytics buttons

export default function ResultsManager() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedResult, setSelectedResult] = useState(null)
  const [showAnalytics, setShowAnalytics] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(15)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filter])

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    try {
      const response = await adminAPI.getResults()
      if (response.data.success) {
        setResults(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch results:', error)
      toast.error('Failed to load results')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // FIX C6: Export CSV handler
  const handleExportCSV = () => {
    if (results.length === 0) {
      toast.error('No results to export')
      return
    }
    const headers = ['User', 'Test', 'Score', 'Total Marks', 'Percentage', 'Rank', 'Time (min)', 'Date']
    const csvContent = [
      headers.join(','),
      ...results.map(r => [
        `"${r.userName || ''}"`,
        `"${r.testName || ''}"`,
        r.score || 0,
        r.totalMarks || 0,
        `${r.percentage || 0}%`,
        r.rank || '-',
        r.timeTaken || '-',
        r.attemptedAt ? new Date(r.attemptedAt).toLocaleDateString() : '-'
      ].join(','))
    ].join('\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `results_export_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${results.length} results to CSV`)
  }

  // FIX C6: Analytics view handler
  const handleViewAnalytics = (result) => {
    setShowAnalytics(result)
  }

  const filteredResults = results.filter(r => {
    const matchesSearch = r.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.testName?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === 'all' ||
      (filter === 'passed' && r.percentage >= 50) ||
      (filter === 'failed' && r.percentage < 50)
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.ceil(filteredResults.length / pageSize)
  const paginatedResults = filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const stats = {
    total: results.length,
    passed: results.filter(r => r.percentage >= 50).length,
    failed: results.filter(r => r.percentage < 50).length,
    avgScore: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length) : 0
  }

  const getScoreColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600 dark:text-green-400'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-red-600 dark:text-red-400'
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Results</h1>
          <p className="text-gray-600 dark:text-gray-400">View and analyze all test results</p>
        </div>
        {/* FIX C6: Export CSV button now works */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Attempts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500 dark:text-gray-400">Passed</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.passed}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500 dark:text-gray-400">Average Score</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.avgScore}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by user or test..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Results</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Test</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Percentage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedResults.map((result) => (
                <tr key={result._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{result.userName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 dark:text-white">{result.testName}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {result.score}/{result.totalMarks}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${getScoreColor(result.percentage)}`}>
                      {result.percentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-sm font-medium">
                      #{result.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {result.timeTaken} min
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {result.attemptedAt ? new Date(result.attemptedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {/* FIX C6: View Details button now opens modal */}
                      <button
                        onClick={() => setSelectedResult(result)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {/* FIX C6: Analytics button now opens analytics view */}
                      <button
                        onClick={() => handleViewAnalytics(result)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400"
                        title="Analytics"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredResults.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No results found</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-<strong>{Math.min(currentPage * pageSize, filteredResults.length)}</strong> of <strong>{filteredResults.length}</strong> results
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:cursor-not-allowed">
              Previous
            </button>
            {(() => {
              const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
              const endPage = Math.min(totalPages, startPage + 4)
              return (
                <>
                  {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                    const pageNum = startPage + i
                    return (
                      <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 text-sm rounded-lg font-medium ${currentPage === pageNum ? 'bg-indigo-600 text-white' : 'border hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'}`}>
                        {pageNum}
                      </button>
                    )
                  })}
                  {endPage < totalPages && <span className="px-2 text-sm text-gray-400 dark:text-gray-500">…</span>}
                </>
              )
            })()}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}

      {/* FIX C6: View Details Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Result Details</h2>
              <button onClick={() => setSelectedResult(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">User</label>
                <p className="font-medium">{selectedResult.userName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Test</label>
                <p className="font-medium">{selectedResult.testName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Score</label>
                  <p className="font-medium">{selectedResult.score} / {selectedResult.totalMarks}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Percentage</label>
                  <p className={`font-medium ${getScoreColor(selectedResult.percentage)}`}>{selectedResult.percentage}%</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Rank</label>
                  <p className="font-medium">#{selectedResult.rank}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Time Taken</label>
                  <p className="font-medium">{selectedResult.timeTaken} min</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Date</label>
                <p>{selectedResult.attemptedAt ? new Date(selectedResult.attemptedAt).toLocaleString() : '-'}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button onClick={() => setSelectedResult(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIX C6: Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Result Analytics</h2>
              <button onClick={() => setShowAnalytics(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{showAnalytics.userName}</p>
                <p className="text-lg font-bold mb-4">{showAnalytics.testName}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{showAnalytics.score}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Marks Obtained</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{showAnalytics.totalMarks}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Marks</p>
                </div>
                <div className={`p-4 rounded-lg ${showAnalytics.percentage >= 50 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <p className={`text-2xl font-bold ${showAnalytics.percentage >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {showAnalytics.percentage}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Score</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Time Taken</span>
                  <span className="font-medium">{showAnalytics.timeTaken} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Rank</span>
                  <span className="font-medium">#{showAnalytics.rank}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Detailed question-wise analytics coming soon.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button onClick={() => setShowAnalytics(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}