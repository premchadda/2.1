import { useState, useEffect } from 'react'
import { X, Clock, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '../../../../shared/lib/dataService'

export default function QuestionHistoryModal({ questionId, onClose }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [restoring, setRestoring] = useState(null)

  useEffect(() => {
    if (!questionId) return
    setLoading(true)
    adminAPI.getQuestionHistory(questionId)
      .then(res => {
        setVersions(res.data?.data || [])
      })
      .catch(() => toast.error('Failed to load version history'))
      .finally(() => setLoading(false))
  }, [questionId])

  const handleRestore = async (versionId) => {
    setRestoring(versionId)
    try {
      await adminAPI.restoreQuestionVersion(questionId, versionId)
      toast.success('Question restored to this version')
      onClose()
    } catch {
      toast.error('Failed to restore version')
    } finally {
      setRestoring(null)
    }
  }

  if (!questionId) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date'
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const renderSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return <p className="text-gray-500 text-sm">No snapshot data</p>
    const fields = ['question_text', 'correct_option', 'difficulty', 'status', 'marks', 'negative_marks']
    return (
      <div className="space-y-2 text-sm">
        {fields.map(field => {
          const value = snapshot[field]
          if (value === undefined || value === null) return null
          return (
            <div key={field} className="flex gap-2">
              <span className="font-medium text-gray-600 min-w-[120px]">{field.replace(/_/g, ' ')}:</span>
              <span className="text-gray-900">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          )
        })}
        {snapshot.options && (
          <div className="mt-2">
            <span className="font-medium text-gray-600">Options:</span>
            <ul className="ml-4 mt-1 space-y-1">
              {(Array.isArray(snapshot.options) ? snapshot.options : []).map((opt, i) => (
                <li key={i} className="text-gray-900">
                  {String.fromCharCode(65 + i)}. {typeof opt === 'string' ? opt : opt?.text || JSON.stringify(opt)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Version History</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading history...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No version history found</div>
          ) : (
            <div className="space-y-3">
              {versions.map((v, idx) => (
                <div key={v.id} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {expandedId === v.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <span className="font-medium text-sm text-gray-900">Version {v.version_number}</span>
                      {idx === 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Latest</span>}
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(v.created_at)}</span>
                  </button>

                  {expandedId === v.id && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 space-y-2">
                        {v.edited_by && <p className="text-xs text-gray-500">Edited by: {v.edited_by}</p>}
                        {v.change_summary && <p className="text-xs text-gray-600">Change: {v.change_summary}</p>}
                        {renderSnapshot(v.snapshot)}
                      </div>
                      {idx !== 0 && (
                        <button
                          onClick={() => handleRestore(v.id)}
                          disabled={restoring === v.id}
                          className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {restoring === v.id ? 'Restoring...' : 'Restore this version'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
