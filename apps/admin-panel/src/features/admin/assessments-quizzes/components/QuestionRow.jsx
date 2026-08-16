import { useState } from 'react'
import { Edit2, Trash2, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { DIFFICULTY_LEVELS } from '../../../../shared/config/difficultyConfig.js'
import { QUESTION_TYPES, STATUS_OPTIONS } from '../../../../shared/config/questionConstants.js'
import { Badge } from './Badge'

export const QuestionRow = ({ question, onEdit, onDelete, onToggleStatus, index }) => {
  const [expanded, setExpanded] = useState(false)
  const difficulty = DIFFICULTY_LEVELS.find(d => d.value === question.difficulty) || DIFFICULTY_LEVELS[1]
  const status = STATUS_OPTIONS.find(s => s.value === question.status) || STATUS_OPTIONS[1]
  const type = QUESTION_TYPES.find(t => t.value === question.type) || QUESTION_TYPES[0]
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-4 p-4 items-start sm:items-center hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="hidden sm:block sm:col-span-1 text-sm text-gray-500 font-mono">{index + 1}</div>
        <div className="w-full sm:col-span-5 min-w-0">
          <p className="text-sm text-gray-900 truncate font-medium">{question.questionText}</p>
          <p className="text-xs text-gray-500 mt-1">
            {question.subject} {question.chapter && `› ${question.chapter}`} {question.topic && `› ${question.topic}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 sm:col-span-3">
          <Badge variant="info">{type.label}</Badge>
          <Badge className={difficulty.color}>{difficulty.label}</Badge>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
        <div className="w-full sm:w-auto sm:col-span-2 text-sm text-gray-500 text-left sm:text-center">
          <span className="font-medium text-gray-700">+{question.marks}</span>
          {question.negativeMarks > 0 && <span className="text-red-500"> / -{question.negativeMarks}</span>}
        </div>
        <div className="w-full sm:w-auto sm:col-span-1 flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(question) }}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Edit"
            aria-label="Edit question"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(question) }}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
            title={question.status === 'active' ? 'Deactivate' : 'Activate'}
            aria-label={question.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            {question.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(question._id || question.id) }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {question.options?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Options</h4>
                <div className="space-y-1">
                  {question.options.map((opt, i) => {
                    const isCorrect = Array.isArray(question.correctOption)
                      ? question.correctOption.includes(i)
                      : question.correctOption === i
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                        ${isCorrect
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-white text-gray-700 border border-gray-200'}`}
                      >
                        <span className="font-mono font-medium">{letters[i]}</span>
                        <span>{opt}</span>
                        {isCorrect && <CheckCircle className="w-4 h-4 ml-auto" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {question.explanation && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Explanation</h4>
                <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                  {question.explanation}
                </p>
              </div>
            )}

            {question.tags?.length > 0 && (
              <div className="md:col-span-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {question.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
