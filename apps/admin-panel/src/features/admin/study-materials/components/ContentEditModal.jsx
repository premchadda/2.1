import { X, Link2, ChevronRight } from 'lucide-react'
import { FormInput, FormSelect, FormTextarea } from '../../../../shared/components/common/FormField'

export default function ContentEditModal({
  show,
  onClose,
  activeTab,
  tabs,
  editingItem,
  editForm,
  setEditForm,
  saving,
  onSubmit,
  studyMaterials,
  editChapters,
  editChaptersLoading,
  editTopics,
  editTopicsLoading,
}) {
  if (!show || !editingItem) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-14 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-xl my-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-200 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-500" />
              Edit {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Update content details and curriculum linking</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Content Details */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Content Details</h3>
            <div className="space-y-3">
              <div>
                <FormInput
                  label="Title"
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <FormTextarea
                  label="Description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Curriculum Linking (not for study-material notes tab) */}
          {activeTab !== 'notes' && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Curriculum Link
              </h3>
              <div className="bg-indigo-50/60 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 space-y-3">

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Subject</label>
                  <FormSelect
                    value={editForm.studyMaterialId || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, studyMaterialId: e.target.value, chapterId: '', topicId: '' }))}
                    options={studyMaterials.map(m => ({ value: String(m._id || m.id), label: m.title || m.name }))}
                    placeholder="— Unlinked —"
                  />
                </div>

                {/* Chapter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Chapter
                    {editChaptersLoading && <span className="ml-1 text-indigo-400 dark:text-indigo-500 font-normal">Loading…</span>}
                  </label>
                  <FormSelect
                    value={editForm.chapterId || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, chapterId: e.target.value, topicId: '' }))}
                    options={editChapters.map(c => ({ value: String(c._id || c.id), label: c.title || c.name }))}
                    placeholder="— No Chapter —"
                    disabled={!editForm.studyMaterialId || editChaptersLoading}
                  />
                  {editForm.studyMaterialId && !editChaptersLoading && editChapters.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No chapters for this subject.</p>
                  )}
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Topic
                    {editTopicsLoading && <span className="ml-1 text-indigo-400 dark:text-indigo-500 font-normal">Loading…</span>}
                  </label>
                  <FormSelect
                    value={editForm.topicId || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, topicId: e.target.value }))}
                    options={editTopics.map(t => ({ value: String(t._id || t.id), label: t.title || t.name }))}
                    placeholder="— No Topic —"
                    disabled={!editForm.chapterId || editTopicsLoading}
                  />
                  {editForm.chapterId && !editTopicsLoading && editTopics.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No topics in this chapter.</p>
                  )}
                </div>

                {/* Current link breadcrumb */}
                <div className="pt-1 flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 flex-wrap">
                  <span>{studyMaterials.find(m => String(m._id || m.id) === editForm.studyMaterialId)?.title || '—'}</span>
                  {editForm.chapterId && <><ChevronRight className="w-3 h-3 opacity-50" /><span>{editChapters.find(c => String(c._id || c.id) === editForm.chapterId)?.title || '…'}</span></>}
                  {editForm.topicId   && <><ChevronRight className="w-3 h-3 opacity-50" /><span className="text-indigo-400 dark:text-indigo-500">{editTopics.find(t => String(t._id || t.id) === editForm.topicId)?.title || '…'}</span></>}
                </div>

              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm text-gray-700 dark:text-gray-300"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60 text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
