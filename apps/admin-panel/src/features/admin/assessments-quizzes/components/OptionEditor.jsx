import { Plus, CheckCircle } from 'lucide-react'

// Option Editor Component
export const OptionEditor = ({ options, correctOption, onChange, onCorrectChange, type }) => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']

  if (type === 'numeric') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Correct Answer (Numerical)
        </label>
        <input
          type="number"
          step="any"
          value={correctOption || ''}
          onChange={(e) => onCorrectChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter the numerical answer"
        />
      </div>
    )
  }

  if (type === 'descriptive') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Model Answer
        </label>
        <textarea
          value={correctOption || ''}
          onChange={(e) => onCorrectChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter the model answer for reference"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Options <span className="text-red-500">*</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-2">
          (Click the radio button to mark the correct answer)
        </span>
      </label>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onCorrectChange(type === 'msq'
                ? (Array.isArray(correctOption)
                  ? correctOption.includes(index)
                    ? correctOption.filter(i => i !== index)
                    : [...correctOption, index]
                  : [index])
                : index
              )}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                ${(type === 'msq'
                  ? Array.isArray(correctOption) && correctOption.includes(index)
                  : correctOption === index
                )
                  ? 'bg-green-100 dark:bg-green-900/60 border-green-500 text-white'
                  : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'}`}
            >
              {(type === 'msq'
                ? Array.isArray(correctOption) && correctOption.includes(index)
                : correctOption === index
              ) && <CheckCircle className="w-4 h-4" />}
            </button>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">{letters[index]}</span>
            <input
              type="text"
              value={option}
              onChange={(e) => {
                const newOptions = [...options]
                newOptions[index] = e.target.value
                onChange(newOptions)
              }}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder={`Option ${letters[index]}`}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...options, ''])}
        className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Option
      </button>
    </div>
  )
}
