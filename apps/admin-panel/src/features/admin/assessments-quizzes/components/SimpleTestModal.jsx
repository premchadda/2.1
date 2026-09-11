import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getSeriesId } from "./questionHelpers.js";

export default function SimpleTestModal({
  isOpen,
  editingTestId,
  selectedSeries,
  activeStageId,
  selectedTestSubCategoryId,
  testFormData,
  setTestFormData,
  handleTestSubmit,
  resetTestForm,
  testSaving,
  selectedStageLabel,
  activeCatLabel,
  selectedTestSubCategoryRecord,
}) {
  if (!isOpen) return null;

  return createPortal(
    <div
      key={
        editingTestId ||
        `create-${getSeriesId(selectedSeries) || "none"}-${activeStageId || "all"}-${selectedTestSubCategoryId}`
      }
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-900">
            {editingTestId ? "Edit Test" : "Create Test"}
          </h3>
          <button
            onClick={resetTestForm}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={handleTestSubmit}
          className="p-6 overflow-y-auto space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              required
              value={testFormData.title}
              onChange={(e) =>
                setTestFormData({
                  ...testFormData,
                  title: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={testFormData.description}
              onChange={(e) =>
                setTestFormData({
                  ...testFormData,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration
              </label>
              <input
                type="number"
                value={testFormData.duration}
                onChange={(e) =>
                  setTestFormData({
                    ...testFormData,
                    duration: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Questions
              </label>
              <input
                type="number"
                value={testFormData.totalQuestions}
                onChange={(e) =>
                  setTestFormData({
                    ...testFormData,
                    totalQuestions: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marks
              </label>
              <input
                type="number"
                value={testFormData.totalMarks}
                onChange={(e) =>
                  setTestFormData({
                    ...testFormData,
                    totalMarks: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Negative
              </label>
              <input
                type="number"
                step="0.25"
                value={testFormData.negativeMarking}
                onChange={(e) =>
                  setTestFormData({
                    ...testFormData,
                    negativeMarking: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <input
                value={testFormData.type}
                onChange={(e) =>
                  setTestFormData({
                    ...testFormData,
                    type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty
              </label>
              <select
                value={testFormData.difficulty}
                onChange={(e) =>
                  setTestFormData({
                    ...testFormData,
                    difficulty: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passing Marks
              </label>
              <input
                type="number"
                value={testFormData.passingMarks}
                onChange={(e) =>
                  setTestFormData({
                    ...testFormData,
                    passingMarks: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              value={testFormData.tags}
              onChange={(e) =>
                setTestFormData({
                  ...testFormData,
                  tags: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="comma, separated, tags"
            />
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900">
            Linked to: {selectedSeries?.title || selectedSeries?.name} /{" "}
            {selectedStageLabel} / {activeCatLabel} /{" "}
            {selectedTestSubCategoryRecord?.name ||
              selectedTestSubCategoryRecord?.label ||
              "All test subcategories"}
          </div>
          <div className="pt-4 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={resetTestForm}
              className="px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={testSaving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              {testSaving ? "Saving..." : "Save Test"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
