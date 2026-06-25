import { Edit2, Eye, EyeOff, Trash2 } from 'lucide-react'
import Badge from './Badge'

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-700' }
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-500' }
]

const QUESTION_TYPES = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'true-false', label: 'True/False' },
  { value: 'match', label: 'Match' },
  { value: 'comprehension', label: 'Comprehension' }
]

export default function QuestionListItem({
  question,
  index,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleStatus
}) {
  const difficulty = DIFFICULTY_LEVELS.find(d => d.value === question.difficulty) || DIFFICULTY_LEVELS[1]
  const status = STATUS_OPTIONS.find(s => s.value === question.status) || STATUS_OPTIONS[0]
  const type = QUESTION_TYPES.find(t => t.value === question.type) || QUESTION_TYPES[0]

  return (
    <div className={`bg-white border rounded-xl p-4 transition-colors ${isSelected ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(question._id || question.id)}
            className="w-4 h-4 mt-1 accent-indigo-600 cursor-pointer"
          />
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 inline-flex items-center justify-center text-xs font-bold">
                {index + 1}
              </span>
              <Badge variant="info">{type.label}</Badge>
              <Badge className={difficulty.color}>{difficulty.label}</Badge>
              <Badge className={status.color}>{status.label}</Badge>
              {question.marks && (
                <span className="text-xs text-gray-600">
                  <span className="text-green-600 font-semibold">+{question.marks}</span>
                  {question.negativeMarks > 0 && <span className="text-red-600"> / -{question.negativeMarks}</span>}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-900 line-clamp-3">{question.questionText}</p>
            {question.options && question.options.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                {question.options.slice(0, 4).map((opt, i) => (
                  <span key={i} className={`px-2 py-1 rounded ${opt.isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'bg-gray-50 text-gray-600'}`}>
                    {String.fromCharCode(65 + i)}. {opt.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onToggleStatus(question)}
            title={question.status === 'active' ? 'Deactivate' : 'Activate'}
            className={`p-2 rounded-lg transition-colors ${question.status === 'active' ? 'text-green-600 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
          >
            {question.status === 'active' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button onClick={() => onEdit(question)} className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(question._id || question.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
