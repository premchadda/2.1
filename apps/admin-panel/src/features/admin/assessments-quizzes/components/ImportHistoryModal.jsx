import { useState, useEffect } from 'react'
import { X, History, Clock, CheckCircle, AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { adminAPI } from '../../../../shared/lib/dataService'

const ImportHistoryModal = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    adminAPI.getImportHistory(20)
      .then(res => {
        setHistory(res.data?.data || [])
      })
      .catch(err => {
        setError(err.response?.data?.message || err.message || 'Failed to load import history')
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  const safeJsonParse = (str, fallback) => {
    try {
      return JSON.parse(str || '')
    } catch {
      return fallback
    }
  }

  if (!isOpen) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Import History</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Recent test and question imports</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Loading import history...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No imports recorded yet</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-3">
              {history.map((item) => {
                const id = item.id || item._id
                const isExpanded = expandedId === id
                const metadata = typeof item.metadata === 'string' ? safeJsonParse(item.metadata, {}) : (item.metadata || {})
                const errors = typeof item.errors === 'string' ? safeJsonParse(item.errors, []) : (item.errors || [])

                return (
                  <div key={id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.records_failed > 0 ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {metadata.testTitle || item.file_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.source} — {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                        <span className="text-green-600 font-medium">{item.records_imported} imported</span>
                        {item.records_failed > 0 && (
                          <span className="text-red-600 font-medium">{item.records_failed} skipped</span>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                          <div>
                            <span className="text-gray-500">File:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300">{item.file_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Imported by:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300">{item.imported_by || 'system'}</span>
                          </div>
                          {metadata.sectionsCreated !== undefined && (
                            <div>
                              <span className="text-gray-500">Sections:</span>{' '}
                              <span className="text-gray-700 dark:text-gray-300">{metadata.sectionsCreated}</span>
                            </div>
                          )}
                          {metadata.testId && (
                            <div>
                              <span className="text-gray-500">Test ID:</span>{' '}
                              <span className="text-gray-700 dark:text-gray-300 font-mono">{metadata.testId}</span>
                            </div>
                          )}
                        </div>
                        {metadata.warnings?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Warnings:</p>
                            {metadata.warnings.map((w, i) => (
                              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {w}</p>
                            ))}
                          </div>
                        )}
                        {errors.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-red-700 dark:text-red-300">Errors:</p>
                            {errors.slice(0, 5).map((e, i) => (
                              <p key={i} className="text-xs text-red-600 dark:text-red-400">
                                • {e.questionId ? `[Q: ${e.questionId}] ` : ''}{e.message || e}
                              </p>
                            ))}
                            {errors.length > 5 && (
                              <p className="text-xs text-gray-500">... and {errors.length - 5} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportHistoryModal
