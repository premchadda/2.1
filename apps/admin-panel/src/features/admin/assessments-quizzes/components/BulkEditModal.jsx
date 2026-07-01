import { useState } from 'react'
import { X, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '../../../../shared/lib/dataService'

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'No change' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'No change' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

const SUBJECT_OPTIONS = [
  { value: '', label: 'No change' },
  { value: 'quantitative-aptitude', label: 'Quantitative Aptitude' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'english', label: 'English' },
  { value: 'general-awareness', label: 'General Awareness' },
  { value: 'general-science', label: 'General Science' },
  { value: 'current-affairs', label: 'Current Affairs' },
]

export default function BulkEditModal({ isOpen, onClose, selectedIds, onSuccess }) {
  const [difficulty, setDifficulty] = useState('')
  const [status, setStatus] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isOpen || !selectedIds || selectedIds.length === 0) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const updates = {}
    if (difficulty) updates.difficulty = difficulty
    if (status) updates.status = status
    if (subject) updates.subject = subject

    if (Object.keys(updates).length === 0) {
      toast.error('Select at least one field to update')
      return
    }

    setSaving(true)
    try {
      const result = await adminAPI.bulkUpdateQuestions({ questionIds: selectedIds, updates })
      if (result.data?.success) {
        toast.success(`Updated ${result.data.updated} question(s)`)
        setDifficulty('')
        setStatus('')
        setSubject('')
        onSuccess?.()
        onClose()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bulk update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Edit Questions</h2>
            <p className="text-sm text-gray-500 mt-1">{selectedIds.length} question(s) selected</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">Only selected fields will be updated. Unchanged fields are left as-is.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              {DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              {SUBJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50">
              {saving ? 'Updating...' : <><Save className="w-4 h-4" /> Apply Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
