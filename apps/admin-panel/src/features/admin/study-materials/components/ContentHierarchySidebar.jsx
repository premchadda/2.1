import { Book, ChevronRight } from 'lucide-react'
import { FormSelect } from '../../../../shared/components/common/FormField'

export default function ContentHierarchySidebar({
  studyMaterials,
  selectedMaterialId,
  setSelectedMaterialId,
  selectedChapterId,
  setSelectedChapterId,
  selectedTopicId,
  chapters,
  sidebarTopics,
  sidebarTopicsLoading,
  filteredContent
}) {
  const selectedMaterial = studyMaterials.find(m => String(m._id || m.id) === selectedMaterialId)
  const selectedChapter = chapters.find(c => String(c._id || c.id) === selectedChapterId)
  const selectedTopic = sidebarTopics.find(t => String(t._id || t.id) === selectedTopicId)

  return (
    <div className="xl:w-80 flex flex-col gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Book className="w-4 h-4 text-indigo-500" />
          Content Context
        </h3>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            1. Subject
          </label>
          <FormSelect
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            options={studyMaterials.map(m => ({ value: String(m._id || m.id), label: m.title || m.name }))}
            placeholder="— All Subjects —"
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            2. Chapter
            {!selectedMaterialId && <span className="ml-1 text-gray-300 dark:text-gray-600 font-normal normal-case">(pick subject first)</span>}
          </label>
          <FormSelect
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            options={chapters.map(c => ({ value: String(c._id || c.id), label: c.title || c.name }))}
            placeholder="— All Chapters —"
            disabled={!selectedMaterialId}
          />
          {selectedMaterialId && chapters.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No chapters for this subject.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            3. Topic
            {sidebarTopicsLoading && <span className="ml-1 text-indigo-400 font-normal normal-case">Loading…</span>}
            {!selectedChapterId && <span className="ml-1 text-gray-300 dark:text-gray-600 font-normal normal-case">(pick chapter first)</span>}
          </label>
          <FormSelect
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            options={sidebarTopics.map(t => ({ value: String(t._id || t.id), label: t.title || t.name }))}
            placeholder="— All Topics —"
            disabled={!selectedChapterId || sidebarTopicsLoading}
          />
          {selectedChapterId && !sidebarTopicsLoading && sidebarTopics.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No topics in this chapter.</p>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 p-4">
        <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2 text-xs uppercase tracking-wider">Active Filter</h4>
        <div className="flex flex-col gap-1 text-sm text-indigo-700 dark:text-indigo-400">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-semibold">{selectedMaterial ? (selectedMaterial.title || selectedMaterial.name) : 'All Subjects'}</span>
            {selectedChapter && (
              <>
                <ChevronRight className="w-3 h-3 opacity-50" />
                <span className="font-semibold">{selectedChapter.title || selectedChapter.name}</span>
              </>
            )}
            {selectedTopic && (
              <>
                <ChevronRight className="w-3 h-3 opacity-50" />
                <span className="font-semibold text-indigo-500 dark:text-indigo-300">{selectedTopic.title || selectedTopic.name}</span>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2">
          {filteredContent.length} item{filteredContent.length !== 1 ? 's' : ''} found
        </p>
      </div>
    </div>
  )
}
