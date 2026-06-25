import { X, Link2, FolderOpen, Loader2, CheckCircle2 } from 'lucide-react'
import { FormInput, FormSelect, FormTextarea, FormCheckbox } from '../../../../shared/components/common/FormField'

export default function ContentAddModal({
  show,
  onClose,
  activeTab,
  tabs,
  addForm,
  setAdd,
  saving,
  onSubmit,
  studyMaterials,
  modalChapters,
  modalChaptersLoading,
  modalTopics,
  modalTopicsLoading,
  availableTests,
  testsLoading,
  uploadingField,
  handleFileUpload,
  toSlug,
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-xl my-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-200">
            Add {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Shared: Study Material picker (always shown except notes) */}
          {activeTab !== 'notes' && (
            <div className="space-y-3">
              <div>
                <FormSelect
                  label="Study Material"
                  required
                  value={addForm.studyMaterialId || ''}
                  onChange={e => setAdd('studyMaterialId', e.target.value)}
                  options={studyMaterials.map(m => ({ value: String(m._id || m.id), label: m.title || m.name }))}
                  placeholder="— Select —"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chapter
                    {modalChaptersLoading && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">Loading…</span>}
                  </label>
                  <FormSelect
                    value={addForm.chapterId || ''}
                    onChange={e => setAdd('chapterId', e.target.value)}
                    options={modalChapters.map(c => ({ value: String(c._id || c.id), label: c.title || c.name }))}
                    placeholder="— None —"
                    disabled={!addForm.studyMaterialId || modalChaptersLoading}
                  />
                  {addForm.studyMaterialId && !modalChaptersLoading && modalChapters.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No chapters found.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Topic
                    {modalTopicsLoading && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">Loading…</span>}
                  </label>
                  <FormSelect
                    value={addForm.topicId || ''}
                    onChange={e => setAdd('topicId', e.target.value)}
                    options={modalTopics.map(t => ({ value: String(t._id || t.id), label: t.title || t.name }))}
                    placeholder="— None —"
                    disabled={!addForm.chapterId || modalTopicsLoading}
                  />
                  {addForm.chapterId && !modalTopicsLoading && modalTopics.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No topics in this chapter.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Videos & PDFs & Notes: title / slug / description */}
          {(activeTab === 'videos' || activeTab === 'pdfs' || activeTab === 'notes') && (
            <>
              <div>
                <FormInput
                  label="Title"
                  required
                  type="text"
                  value={addForm.title}
                  onChange={e => { setAdd('title', e.target.value); setAdd('slug', toSlug(e.target.value)) }}
                  placeholder="e.g. Introduction to Algebra"
                />
              </div>
              <div>
                <FormInput
                  label="Slug (auto-filled)"
                  type="text"
                  value={addForm.slug}
                  onChange={e => setAdd('slug', e.target.value)}
                  placeholder="url-safe-slug"
                  className="font-mono"
                />
              </div>
              <div>
                <FormTextarea
                  label="Description"
                  value={addForm.description}
                  onChange={e => setAdd('description', e.target.value)}
                  rows={2}
                  placeholder="Optional description…"
                />
              </div>
            </>
          )}

          {/* Videos specific */}
          {activeTab === 'videos' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Video File / URL <span className="text-red-500">*</span></label>
                <label
                  className="flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 cursor-pointer transition mb-2"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0], 'videoUrl', 'video') }}
                >
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={e => handleFileUpload(e.target.files[0], 'videoUrl', 'video')}
                  />
                  {uploadingField === 'videoUrl' ? (
                    <><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /><span className="text-xs text-indigo-600 dark:text-indigo-400">Uploading…</span></>
                  ) : addForm.videoUrl ? (
                    <><CheckCircle2 className="w-6 h-6 text-green-500" /><span className="text-xs text-green-600 dark:text-green-400 font-medium">File uploaded — or paste a new URL below</span></>
                  ) : (
                    <><FolderOpen className="w-6 h-6 text-indigo-400 dark:text-indigo-500" /><span className="text-xs text-indigo-500 dark:text-indigo-400">Click or drag &amp; drop a video file</span></>
                  )}
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <FormInput
                    type="url"
                    value={addForm.videoUrl}
                    onChange={e => setAdd('videoUrl', e.target.value)}
                    placeholder="…or paste a YouTube / direct URL"
                    className="pl-9"
                    wrapperClassName=""
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thumbnail File / URL</label>
                  <label
                    className="flex flex-col items-center justify-center gap-2 w-full h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition mb-2"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0], 'thumbnail', 'image') }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleFileUpload(e.target.files[0], 'thumbnail', 'image')}
                    />
                    {uploadingField === 'thumbnail' ? (
                      <><Loader2 className="w-6 h-6 text-gray-500 dark:text-gray-400 animate-spin" /><span className="text-xs text-gray-600 dark:text-gray-400">Uploading…</span></>
                    ) : addForm.thumbnail ? (
                      <><CheckCircle2 className="w-6 h-6 text-green-500" /><span className="text-xs text-green-600 dark:text-green-400 font-medium">Thumbnail ready</span></>
                    ) : (
                      <><FolderOpen className="w-6 h-6 text-gray-400 dark:text-gray-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Drop thumbnail image</span></>
                    )}
                  </label>
                  <FormInput
                    type="url"
                    value={addForm.thumbnail}
                    onChange={e => setAdd('thumbnail', e.target.value)}
                    placeholder="…or paste image URL"
                  />
                </div>
                <div className="col-span-2">
                  <FormInput
                    label="Duration (seconds)"
                    type="number"
                    min="0"
                    value={addForm.duration}
                    onChange={e => setAdd('duration', e.target.value)}
                    placeholder="e.g. 600"
                  />
                </div>
              </div>
              <FormCheckbox
                label="Pro content only"
                checked={addForm.isPro}
                onChange={e => setAdd('isPro', e.target.checked)}
              />
            </>
          )}

          {/* PDFs specific */}
          {activeTab === 'pdfs' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PDF File / URL <span className="text-red-500">*</span></label>
                <label
                  className="flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer transition mb-2"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0], 'pdfUrl', 'pdf') }}
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={e => handleFileUpload(e.target.files[0], 'pdfUrl', 'pdf')}
                  />
                  {uploadingField === 'pdfUrl' ? (
                    <><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /><span className="text-xs text-blue-600 dark:text-blue-400">Uploading…</span></>
                  ) : addForm.pdfUrl ? (
                    <><CheckCircle2 className="w-6 h-6 text-green-500" /><span className="text-xs text-green-600 dark:text-green-400 font-medium">File uploaded — or paste a new URL below</span></>
                  ) : (
                    <><FolderOpen className="w-6 h-6 text-blue-400 dark:text-blue-500" /><span className="text-xs text-blue-500 dark:text-blue-400">Click or drag &amp; drop a PDF file</span></>
                  )}
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <FormInput
                    type="url"
                    value={addForm.pdfUrl}
                    onChange={e => setAdd('pdfUrl', e.target.value)}
                    placeholder="…or paste a direct PDF URL"
                    className="pl-9"
                    wrapperClassName=""
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormInput
                    label="File Size (KB)"
                    type="number"
                    min="0"
                    value={addForm.fileSize}
                    onChange={e => setAdd('fileSize', e.target.value)}
                    placeholder="e.g. 2048"
                  />
                </div>
                <div>
                  <FormInput
                    label="Pages"
                    type="number"
                    min="0"
                    value={addForm.pages}
                    onChange={e => setAdd('pages', e.target.value)}
                    placeholder="e.g. 24"
                  />
                </div>
              </div>
              <FormCheckbox
                label="Pro content only"
                checked={addForm.isPro}
                onChange={e => setAdd('isPro', e.target.checked)}
              />
            </>
          )}

          {/* Tests specific */}
          {activeTab === 'tests' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link Test <span className="text-red-500">*</span></label>
                {testsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
                    Loading tests…
                  </div>
                ) : (
                  <FormSelect
                    value={addForm.testId}
                    onChange={e => setAdd('testId', e.target.value)}
                    options={availableTests.map(t => ({ value: String(t._id || t.id), label: `${t.title} ${t.seriesId ? '' : '(unlinked)'}` }))}
                    placeholder="— Select a test —"
                    required
                  />
                )}
              </div>
              <div>
                <FormSelect
                  label="Test Type"
                  value={addForm.testType}
                  onChange={e => setAdd('testType', e.target.value)}
                  options={[
                    { value: 'practice', label: 'Practice' },
                    { value: 'mock', label: 'Mock' },
                    { value: 'quiz', label: 'Quiz' },
                    { value: 'pyq', label: 'Previous Year' },
                  ]}
                  placeholder=""
                />
              </div>
            </>
          )}

          {/* Study Materials (notes tab) specific */}
          {activeTab === 'notes' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FormInput
                  label="Icon"
                  type="text"
                  value={addForm.icon}
                  onChange={e => setAdd('icon', e.target.value)}
                  placeholder="book-open"
                />
              </div>
              <div>
                <FormInput
                  label="Display Order"
                  type="number"
                  min="0"
                  value={addForm.order}
                  onChange={e => setAdd('order', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60 text-sm font-medium"
          >
            {saving ? 'Saving…' : `Add ${tabs.find(t => t.id === activeTab)?.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}
