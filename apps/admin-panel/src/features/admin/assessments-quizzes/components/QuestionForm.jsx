import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { FormInput, FormSelect, FormTextarea, FormCheckbox, FormGrid } from '../../../../shared/components/common/FormField'
import { questionSchema, validateForm } from '../../../../shared/lib/validationSchemas'

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'numeric', label: 'Numeric Answer' },
  { value: 'true-false', label: 'True/False' },
  { value: 'match', label: 'Match the Following' },
  { value: 'comprehension', label: 'Comprehension' }
]

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' }
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
]

export default function QuestionForm({
  isOpen,
  onClose,
  onSubmit,
  saving,
  editingId,
  formData,
  setFormData,
  subjects,
  chapters,
  topics,
  sections,
  tests,
  tagConfigs,
  passages
}) {
  const [activeTab, setActiveTab] = useState('basic')

  useEffect(() => {
    if (isOpen) setActiveTab('basic')
  }, [isOpen, editingId])

  const onChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'options', label: 'Options' },
    { id: 'meta', label: 'Metadata' },
    { id: 'advanced', label: 'Advanced' }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editingId ? 'Edit Question' : 'Add Question'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <FormTextarea
                label="Question Text"
                required
                value={formData.questionText}
                onChange={(e) => onChange('questionText', e.target.value)}
                rows={4}
                placeholder="Enter the question..."
              />
              <FormGrid cols={2}>
                <FormSelect
                  label="Type"
                  required
                  value={formData.type}
                  onChange={(e) => onChange('type', e.target.value)}
                  options={QUESTION_TYPES}
                />
                <FormSelect
                  label="Difficulty"
                  required
                  value={formData.difficulty}
                  onChange={(e) => onChange('difficulty', e.target.value)}
                  options={DIFFICULTY_OPTIONS}
                />
              </FormGrid>
              <FormGrid cols={2}>
                <FormSelect
                  label="Subject"
                  value={formData.subject}
                  onChange={(e) => onChange('subject', e.target.value)}
                  options={subjects.map(s => ({ value: s._id || s.id, label: s.name }))}
                  placeholder="Select subject"
                />
                <FormSelect
                  label="Chapter"
                  value={formData.chapter}
                  onChange={(e) => onChange('chapter', e.target.value)}
                  options={chapters.map(c => ({ value: c._id || c.id, label: c.title || c.name }))}
                  placeholder="Select chapter"
                  disabled={!formData.subject}
                />
              </FormGrid>
              <FormGrid cols={2}>
                <FormSelect
                  label="Topic"
                  value={formData.topic}
                  onChange={(e) => onChange('topic', e.target.value)}
                  options={topics.map(t => ({ value: t._id || t.id, label: t.title || t.name }))}
                  placeholder="Select topic"
                  disabled={!formData.chapter}
                />
                <FormSelect
                  label="Section"
                  value={formData.section}
                  onChange={(e) => onChange('section', e.target.value)}
                  options={(sections || []).map(s => {
                    if (typeof s === 'object' && s !== null) {
                      const name = s.name || s.title || s.label || '';
                      return { value: name, label: name };
                    }
                    return { value: s, label: s };
                  })}
                  placeholder="Select section"
                />
              </FormGrid>
            </div>
          )}

          {activeTab === 'options' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Answer Options <span className="text-red-500">*</span>
              </label>
              {(formData.options || ['', '', '', '']).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={formData.correctOption === i}
                    onChange={() => onChange('correctOption', i)}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...(formData.options || ['', '', '', ''])]
                      newOpts[i] = e.target.value
                      onChange('options', newOpts)
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                </div>
              ))}
              <p className="text-xs text-gray-500">Select the radio button next to the correct answer</p>

              <FormTextarea
                label="Explanation"
                value={formData.explanation}
                onChange={(e) => onChange('explanation', e.target.value)}
                rows={3}
                placeholder="Explain why the correct answer is right..."
              />
            </div>
          )}

          {activeTab === 'meta' && (
            <div className="space-y-4">
              <FormGrid cols={3}>
                <FormInput
                  label="Marks"
                  type="number"
                  value={formData.marks}
                  onChange={(e) => onChange('marks', parseInt(e.target.value) || 0)}
                />
                <FormInput
                  label="Negative Marks"
                  type="number"
                  step="0.25"
                  value={formData.negativeMarks}
                  onChange={(e) => onChange('negativeMarks', parseFloat(e.target.value) || 0)}
                />
                <FormSelect
                  label="Status"
                  value={formData.status}
                  onChange={(e) => onChange('status', e.target.value)}
                  options={STATUS_OPTIONS}
                />
              </FormGrid>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <input
                  type="text"
                  value={(formData.tags || []).join(', ')}
                  onChange={(e) => onChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="ssc-cgl, tier1, previous-year"
                />
                {tagConfigs?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tagConfigs.map(tag => {
                      const tagId = tag.id || tag.filterKey
                      const isSelected = (formData.tags || []).includes(tagId)
                      return (
                        <button
                          key={tagId}
                          type="button"
                          onClick={() => {
                            const current = formData.tags || []
                            const next = isSelected
                              ? current.filter(t => t !== tagId)
                              : [...current, tagId]
                            onChange('tags', next)
                          }}
                          className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${
                            isSelected
                              ? 'bg-indigo-200 text-indigo-800 border border-indigo-300'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {tag.icon && <span className="mr-1">{tag.icon}</span>}
                          {tag.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <FormInput
                label="Image URL"
                type="url"
                value={formData.imageUrl || ''}
                onChange={(e) => onChange('imageUrl', e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <FormSelect
                label="Test"
                value={formData.testId || ''}
                onChange={(e) => onChange('testId', e.target.value || null)}
                options={tests.map(t => ({ value: t._id || t.id, label: t.title || t.name }))}
                placeholder="Link to test (optional)"
              />
              <FormSelect
                label="Passage"
                value={formData.passageId || ''}
                onChange={(e) => onChange('passageId', e.target.value || null)}
                options={passages.map(p => ({ value: p._id || p.id, label: p.title || 'Untitled' }))}
                placeholder="Link to passage (optional)"
              />
              <FormInput
                label="Question Number"
                type="number"
                value={formData.questionNumber || ''}
                onChange={(e) => onChange('questionNumber', parseInt(e.target.value) || null)}
              />
              <FormInput
                label="Solution Image URL"
                type="url"
                value={formData.solutionImageUrl || ''}
                onChange={(e) => onChange('solutionImageUrl', e.target.value)}
                placeholder="https://example.com/solution.png"
              />
              <FormCheckbox
                label="Hindi Version Available"
                checked={!!formData.questionTextHi}
                onChange={(e) => {
                  if (!e.target.checked) onChange('questionTextHi', '')
                }}
              />
              {formData.questionTextHi && (
                <FormTextarea
                  label="Hindi Question Text"
                  value={formData.questionTextHi}
                  onChange={(e) => onChange('questionTextHi', e.target.value)}
                  rows={3}
                />
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Question' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
