import React from "react";
import { createPortal } from "react-dom";
import { Layers, X } from "lucide-react";

export default function CurriculumGeneralModal({
  modalConfig,
  setModalConfig,
  activeTab,
  formData,
  setFormData,
  handleSave,
  HIERARCHY_TABS,
  subjects,
  units,
  chapters,
  topics,
  subtopics,
  selectedSubject,
  getEntityId,
}) {
  if (
    !modalConfig ||
    ["subjects", "hierarchy"].includes(activeTab) ||
    typeof document === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <h3 className="font-bold text-gray-900 dark:text-white capitalize flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {modalConfig.item ? "Edit" : "Add"}{" "}
            {HIERARCHY_TABS.find(
              (t) => t.id === modalConfig.tabId,
            )?.label.slice(0, -1)}
          </h3>
          <button
            onClick={() => setModalConfig(null)}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Parent Dropdowns based on activeTab */}

          {modalConfig.tabId === "parts" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign to Subject *
              </label>
              <select
                required
                value={formData.parentId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, parentId: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
              >
                <option value="">-- Select Subject --</option>
                {(selectedSubjectId ? filteredSubjects : data.subjects).map(
                  (s) => (
                    <option key={getEntityId(s)} value={getEntityId(s)}>
                      {s.name}
                    </option>
                  ),
                )}
              </select>
            </div>
          )}

          {modalConfig.tabId === "units" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign to Subject *
              </label>
              <select
                required
                value={formData.parentId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, parentId: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
              >
                <option value="">-- Select Subject --</option>
                {(selectedSubjectId ? filteredSubjects : data.subjects).map(
                  (s) => (
                    <option key={getEntityId(s)} value={getEntityId(s)}>
                      {s.name}
                    </option>
                  ),
                )}
              </select>
            </div>
          )}

          {modalConfig.tabId === "chapters" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign to (Subject or Unit) *
              </label>
              <select
                required
                value={formData.parentId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, parentId: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
              >
                <option value="">-- Select Parent --</option>
                <optgroup label="Directly under Subject">
                  {(selectedSubjectId ? filteredSubjects : data.subjects).map(
                    (s) => (
                      <option key={getEntityId(s)} value={getEntityId(s)}>
                        {s.name}
                      </option>
                    ),
                  )}
                </optgroup>
                <optgroup label="Inside a Unit">
                  {(selectedSubjectId ? filteredUnits : data.units).map((u) => (
                    <option key={getEntityId(u)} value={getEntityId(u)}>
                      {u.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {modalConfig.tabId === "topics" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign to Chapter *
              </label>
              <select
                required
                value={formData.parentId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, parentId: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
              >
                <option value="">-- Select Chapter --</option>
                {(selectedSubjectId ? filteredChapters : data.chapters).map(
                  (c) => (
                    <option key={getEntityId(c)} value={getEntityId(c)}>
                      {c.title || c.name}
                    </option>
                  ),
                )}
              </select>
            </div>
          )}

          {modalConfig.tabId === "subtopics" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign to Topic *
              </label>
              <select
                required
                value={formData.parentId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, parentId: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
              >
                <option value="">-- Select Topic --</option>
                {(selectedSubjectId ? filteredTopics : data.topics).map((t) => (
                  <option key={getEntityId(t)} value={getEntityId(t)}>
                    {t.name || t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name / Title *
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData((f) => ({
                  ...f,
                  name: e.target.value,
                  slug:
                    f.slug ||
                    e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                }));
              }}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g., Fundamentals of Physics"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slug *
              </label>
              <input
                required
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, slug: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icon / Thumbnail URL
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, icon: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 text-center text-sm"
                placeholder="icon keyword or https://"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((f) => ({
                  ...f,
                  description: e.target.value,
                }))
              }
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={() => setModalConfig(null)}
              className="px-5 py-2 text-gray-600 dark:text-gray-400 border rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
