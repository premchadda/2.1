import { useMemo } from 'react'
import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

export default function QuestionStats({ questions }) {
  const stats = useMemo(() => {
    const total = questions.length
    const active = questions.filter(q => q.status === 'active').length
    const draft = questions.filter(q => q.status === 'draft').length
    const byDifficulty = {
      easy: questions.filter(q => q.difficulty === 'easy').length,
      medium: questions.filter(q => q.difficulty === 'medium').length,
      hard: questions.filter(q => q.difficulty === 'hard').length
    }
    const avgMarks = total > 0
      ? (questions.reduce((sum, q) => sum + (q.marks || 0), 0) / total).toFixed(1)
      : 0

    return { total, active, draft, byDifficulty, avgMarks }
  }, [questions])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Total</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-gray-500">Active</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{stats.active}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-gray-500">Draft</span>
        </div>
        <p className="text-2xl font-bold text-yellow-600">{stats.draft}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-indigo-500" />
          <span className="text-sm text-gray-500">Avg Marks</span>
        </div>
        <p className="text-2xl font-bold text-indigo-600">{stats.avgMarks}</p>
      </div>
    </div>
  )
}
