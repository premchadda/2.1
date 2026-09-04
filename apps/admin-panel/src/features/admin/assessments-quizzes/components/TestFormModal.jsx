import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  Clock,
  Layers,
  Search,
  Check,
  CheckSquare,
  FileText,
} from "lucide-react";
import SECTION_PRESETS from "../../../../shared/config/sectionPresets.js";
import {
  getSeriesId,
  getSectionId,
  getSectionName,
} from "./questionHelpers.js";
import {
  coerceArray,
  getEntityId,
  idsEqual,
  normalizeKey,
} from "../../../../shared/utils/questionHelpers";

const parseIdList = (value) =>
  coerceArray(value)
    .map((v) => String(v).trim())
    .filter(Boolean);

const TEST_CATEGORY_TABS = [
  { id: "mock-tests", label: "Mock Tests", icon: CheckSquare },
  { id: "pyp", label: "Previous Year Papers", icon: FileText },
  { id: "live-tests", label: "Live Tests", icon: Clock },
];

const getCategoryLabel = (category) =>
  category?.label ||
  category?.name ||
  category?.slug ||
  category?.categoryId ||
  category?.id ||
  "Not linked";

const getCategoryPath = (categoryId, flatCategories = []) => {
  const path = [];
  const visited = new Set();
  let current = flatCategories.find((cat) =>
    [cat.id, cat._id, cat.slug, cat.categoryId].some((value) =>
      idsEqual(value, categoryId),
    ),
  );
  while (current && path.length < 10) {
    const id = String(getEntityId(current) || "");
    if (visited.has(id)) break;
    visited.add(id);
    path.unshift(current);
    const parentId = current.parentId || current.parent_id;
    if (!parentId) break;
    current = flatCategories.find(
      (cat) => idsEqual(cat.id, parentId) || idsEqual(cat._id, parentId),
    );
  }
  return path;
};

const getCategoryPathLabel = (categoryId, flatCategories = []) => {
  const path = getCategoryPath(categoryId, flatCategories);
  return path.map((cat) => getCategoryLabel(cat)).join(" / ") || "Not linked";
};

// ─── Cascading Category Dropdown ────────────────────────────────────────────
export const CascadingCategorySelect = ({
  allSubCategories = [],
  flatTestCategories = [],
  value,
  onChange,
}) => {
  const subCatIdSet = useMemo(
    () => new Set(allSubCategories.map((c) => String(getEntityId(c) || ""))),
    [allSubCategories],
  );

  const levels = useMemo(() => {
    if (!value) return ["", "", "", ""];
    const path = getCategoryPath(String(value), flatTestCategories);
    const inSubs = path.filter((p) =>
      subCatIdSet.has(String(getEntityId(p) || "")),
    );
    return [
      inSubs[0] ? String(getEntityId(inSubs[0]) || "") : "",
      inSubs[1] ? String(getEntityId(inSubs[1]) || "") : "",
      inSubs[2] ? String(getEntityId(inSubs[2]) || "") : "",
      inSubs[3] ? String(getEntityId(inSubs[3]) || "") : "",
    ];
  }, [value, flatTestCategories, subCatIdSet]);

  const opts1 = useMemo(() => {
    return allSubCategories.filter((c) => c._depth === 1);
  }, [allSubCategories]);

  const opts2 = useMemo(() => {
    if (!levels[0]) return [];
    return allSubCategories.filter(
      (c) => c._depth === 2 && idsEqual(c.parentId, levels[0]),
    );
  }, [allSubCategories, levels]);

  const opts3 = useMemo(() => {
    if (!levels[1]) return [];
    return allSubCategories.filter(
      (c) => c._depth === 3 && idsEqual(c.parentId, levels[1]),
    );
  }, [allSubCategories, levels]);

  const opts4 = useMemo(() => {
    if (!levels[2]) return [];
    return allSubCategories.filter(
      (c) => c._depth === 4 && idsEqual(c.parentId, levels[2]),
    );
  }, [allSubCategories, levels]);

  const handleSelect = (depthIndex, selectedId) => {
    if (!selectedId) {
      const fallback = depthIndex > 0 ? levels[depthIndex - 1] : "";
      onChange(fallback);
      return;
    }
    onChange(selectedId);
  };

  const selectCls =
    "w-full px-2.5 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 dark:text-white transition-all";

  return (
    <div className="space-y-2">
      <div>
        <select
          value={levels[0]}
          onChange={(e) => handleSelect(0, e.target.value)}
          className={selectCls}
        >
          <option value="">-- Select Subcategory (Level 1) --</option>
          {opts1.map((cat) => (
            <option key={getEntityId(cat)} value={getEntityId(cat)}>
              {cat.label || cat.name}
            </option>
          ))}
        </select>
      </div>

      {levels[0] && opts2.length > 0 && (
        <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-1.5">
          <select
            value={levels[1]}
            onChange={(e) => handleSelect(1, e.target.value)}
            className={selectCls}
          >
            <option value="">-- Select Child Subcategory (Level 2) --</option>
            {opts2.map((cat) => (
              <option key={getEntityId(cat)} value={getEntityId(cat)}>
                {cat.label || cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {levels[1] && opts3.length > 0 && (
        <div className="pl-6 border-l-2 border-indigo-300 dark:border-indigo-700 space-y-1.5">
          <select
            value={levels[2]}
            onChange={(e) => handleSelect(2, e.target.value)}
            className={selectCls}
          >
            <option value="">-- Select Sub-child (Level 3) --</option>
            {opts3.map((cat) => (
              <option key={getEntityId(cat)} value={getEntityId(cat)}>
                {cat.label || cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {levels[2] && opts4.length > 0 && (
        <div className="pl-9 border-l-2 border-indigo-400 dark:border-indigo-600 space-y-1.5">
          <select
            value={levels[3]}
            onChange={(e) => handleSelect(3, e.target.value)}
            className={selectCls}
          >
            <option value="">-- Select Deep Child (Level 4) --</option>
            {opts4.map((cat) => (
              <option key={getEntityId(cat)} value={getEntityId(cat)}>
                {cat.label || cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {value && (
        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
          ✓ {getCategoryPathLabel(String(value), flatTestCategories)}
        </p>
      )}
    </div>
  );
};

// ─── Compact Section Picker Component ──────────────────────────────────────
export const CompactSectionPicker = ({
  availableSections = [],
  value = "",
  onChange,
  contextLabel,
}) => {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const selectedIds = useMemo(() => {
    return parseIdList(value).map(String);
  }, [value]);

  const { matchingSections, otherSections } = useMemo(() => {
    const matching = [];
    const other = [];

    const stageText = String(contextLabel || "").toLowerCase();

    const isSectionStageMatch = (sec) => {
      const secStageLower = String(
        sec.exam_stage || sec.stage_name || sec.paper || "",
      ).toLowerCase();
      const secNameLower = String(sec.name || "").toLowerCase();

      if (
        secStageLower &&
        (stageText.includes(secStageLower) || secStageLower.includes(stageText))
      ) {
        return true;
      }

      const isTier1Target =
        stageText.includes("tier-i") ||
        stageText.includes("tier 1") ||
        stageText.includes("tier i") ||
        stageText.includes("cbt-1") ||
        stageText.includes("cbt 1") ||
        stageText.includes("prelims") ||
        stageText.includes("paper-i") ||
        stageText.includes("paper 1");

      if (isTier1Target) {
        const isTier1Section =
          secNameLower.includes("general intelligence") ||
          secNameLower.includes("reasoning") ||
          secNameLower.includes("general awareness") ||
          secNameLower.includes("quantitative aptitude") ||
          secNameLower.includes("english comprehension") ||
          (secNameLower.includes("english") &&
            !secNameLower.includes("computer") &&
            (sec.expected_questions <= 25 || sec.expected_questions === 0));
        const isTier2Exclusive =
          secNameLower.includes("computer") ||
          secNameLower.includes("data entry") ||
          secNameLower.includes("dest") ||
          secNameLower.includes("statistics") ||
          secNameLower.includes("mathematical abilities");
        return isTier1Section && !isTier2Exclusive;
      }

      const isTier2Target =
        stageText.includes("tier-ii") ||
        stageText.includes("tier 2") ||
        stageText.includes("tier ii") ||
        stageText.includes("cbt-2") ||
        stageText.includes("cbt 2") ||
        stageText.includes("mains") ||
        stageText.includes("paper-ii") ||
        stageText.includes("paper 2");

      if (isTier2Target) {
        return (
          secNameLower.includes("mathematical abilities") ||
          secNameLower.includes("reasoning & general intelligence") ||
          secNameLower.includes("computer") ||
          secNameLower.includes("data entry") ||
          secNameLower.includes("dest") ||
          secNameLower.includes("statistics") ||
          (secNameLower.includes("english") && sec.expected_questions > 25) ||
          (secNameLower.includes("awareness") && sec.expected_questions > 0)
        );
      }

      return (
        sec.source === "test" ||
        sec.source === "series_stage" ||
        Boolean(sec.test_series_id) ||
        Boolean(sec.exam_id)
      );
    };

    availableSections.forEach((sec) => {
      if (isSectionStageMatch(sec)) {
        matching.push(sec);
      } else {
        other.push(sec);
      }
    });

    return {
      matchingSections: matching.length > 0 ? matching : availableSections,
      otherSections: matching.length > 0 ? other : [],
    };
  }, [availableSections, contextLabel]);

  const displayedList = useMemo(() => {
    let list = showAll
      ? [...matchingSections, ...otherSections]
      : matchingSections;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.exam_stage || "").toLowerCase().includes(q) ||
          (s.paper || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [matchingSections, otherSections, showAll, search]);

  const toggleSection = (id) => {
    const strId = String(id);
    let newSelected = [];
    if (selectedIds.includes(strId)) {
      newSelected = selectedIds.filter((i) => i !== strId);
    } else {
      newSelected = [...selectedIds, strId];
    }
    onChange(newSelected.join(", "));
  };

  const selectAllDisplayed = () => {
    const newIds = new Set([
      ...selectedIds,
      ...displayedList.map((s) => String(s.id)),
    ]);
    onChange(Array.from(newIds).join(", "));
  };

  const deselectAll = () => {
    onChange("");
  };

  if (availableSections.length === 0) {
    return (
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
        No sections available for this exam scheme. Select an exam scheme below
        or create sections.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
          Test Sections
          <span className="ml-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
            {selectedIds.length} selected
          </span>
        </label>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAllDisplayed}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold cursor-pointer p-1"
          >
            Select All
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold cursor-pointer p-1"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter sections by name..."
            className="w-full pl-8 pr-3 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 dark:text-white min-h-[38px] sm:min-h-0"
          />
        </div>

        {otherSections.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className={`px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 text-center ${
              showAll
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100"
            }`}
          >
            {showAll
              ? `Exam Linked (${matchingSections.length})`
              : `Show All (${availableSections.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30 scrollbar-thin">
        {displayedList.map((sec) => {
          const isSelected = selectedIds.includes(String(sec.id));
          return (
            <div
              key={sec.id}
              onClick={() => toggleSection(sec.id)}
              className={`p-2.5 sm:p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 min-h-[44px] ${
                isSelected
                  ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 text-indigo-950 dark:text-indigo-200 shadow-sm"
                  : "bg-white dark:bg-gray-800 hover:bg-gray-100/70 dark:hover:bg-gray-700/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate leading-tight">
                    {sec.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
                    <span>⏱️ {sec.duration} min</span>
                    {sec.expected_questions > 0 && (
                      <span>• ❓ {sec.expected_questions} Qs</span>
                    )}
                    {sec.exam_stage && (
                      <span className="px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                        {sec.exam_stage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {sec.source === "series_stage" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-bold shrink-0">
                  Stage
                </span>
              )}
              {sec.source === "test" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold shrink-0">
                  Test
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── TestFormModal Main Component ──────────────────────────────────────────
export default function TestFormModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingId,
  contextLabel,
  saving,
  relationshipSummary,
  availableSections,
  allSubCategories,
  flatTestCategories,
  selectedPresetId,
  setSelectedPresetId,
  applySectionPreset,
  seriesList = [],
  selectedSeries = null,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formData);
  };

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in"
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full ${editingId && relationshipSummary ? "max-w-5xl" : "max-w-3xl"} max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700`}
      >
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/75 dark:bg-gray-800/75 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {editingId ? "Edit Test" : "Create Test"}
            </h2>
            {contextLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                {contextLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 min-h-0">
            <div
              className={
                editingId && relationshipSummary
                  ? "grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start"
                  : "space-y-4 sm:space-y-5"
              }
            >
              <div
                className={`${editingId && relationshipSummary ? "md:col-span-2" : ""} space-y-4 sm:space-y-5`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {seriesList.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Test Series *
                      </label>
                      <select
                        required
                        value={
                          formData.testSeriesId ||
                          (selectedSeries
                            ? String(getSeriesId(selectedSeries))
                            : "")
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            testSeriesId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                      >
                        <option value="">Select Test Series...</option>
                        {seriesList.map((s) => (
                          <option key={getSeriesId(s)} value={getSeriesId(s)}>
                            {s.title || s.name || s.slug}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Test Category *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {TEST_CATEGORY_TABS.map((tab) => {
                        const isSelected =
                          formData.type === tab.id ||
                          (tab.id === "live-tests" && formData.isLive) ||
                          (!formData.type &&
                            tab.id === "mock-tests" &&
                            !formData.isLive);
                        const TabIcon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              const isLive = tab.id === "live-tests";
                              setFormData((prev) => ({
                                ...prev,
                                type: tab.id,
                                isLive,
                                testCategoryId: "",
                                subCategoryLevel1: "",
                                subCategoryLevel2: "",
                                subCategoryLevel3: "",
                                subCategoryLevel4: "",
                              }));
                            }}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center ${
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20"
                                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                            }`}
                          >
                            <TabIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      required
                      value={formData.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setFormData((prev) => {
                          const autoSlug = normalizeKey(newTitle);
                          const isAutoSlug =
                            !prev.isCustomSlug ||
                            !prev.slug ||
                            prev.slug === normalizeKey(prev.title);
                          return {
                            ...prev,
                            title: newTitle,
                            slug: isAutoSlug ? autoSlug : prev.slug,
                          };
                        });
                      }}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                      placeholder="e.g. SSC CGL Tier-I Full Mock Test 1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Slug (URL)
                    </label>
                    <input
                      value={formData.slug}
                      onChange={(e) => {
                        const val = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, "-");
                        setFormData((prev) => ({
                          ...prev,
                          slug: val,
                          isCustomSlug: true,
                        }));
                      }}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-xs sm:text-sm bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                      placeholder="auto-generated-from-title"
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 break-all">
                      URL Slug:{" "}
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {formData.slug ||
                          normalizeKey(formData.title) ||
                          "auto-generated-slug"}
                      </span>
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Test Subcategory
                    </label>
                    <CascadingCategorySelect
                      allSubCategories={allSubCategories}
                      flatTestCategories={flatTestCategories}
                      value={formData.testCategoryId || ""}
                      onChange={(selectedId) => {
                        if (!selectedId) {
                          setFormData({
                            ...formData,
                            testCategoryId: "",
                            subCategoryLevel1: "",
                            subCategoryLevel2: "",
                            subCategoryLevel3: "",
                            subCategoryLevel4: "",
                          });
                          return;
                        }
                        const subIds = new Set(
                          allSubCategories.map((c) =>
                            String(getEntityId(c) || ""),
                          ),
                        );
                        const path = getCategoryPath(
                          selectedId,
                          flatTestCategories,
                        ).filter((p) =>
                          subIds.has(String(getEntityId(p) || "")),
                        );
                        setFormData({
                          ...formData,
                          testCategoryId: selectedId,
                          subCategoryLevel1: path[0]
                            ? String(getEntityId(path[0]) || "")
                            : "",
                          subCategoryLevel2: path[1]
                            ? String(getEntityId(path[1]) || "")
                            : "",
                          subCategoryLevel3: path[2]
                            ? String(getEntityId(path[2]) || "")
                            : "",
                          subCategoryLevel4: path[3]
                            ? String(getEntityId(path[3]) || "")
                            : "",
                        });
                      }}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <CompactSectionPicker
                      availableSections={availableSections}
                      value={formData.sectionIds}
                      onChange={(newSectionIds) =>
                        setFormData({ ...formData, sectionIds: newSectionIds })
                      }
                      contextLabel={contextLabel}
                    />
                    {editingId && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                          Exam Scheme:
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={selectedPresetId}
                            onChange={(e) =>
                              setSelectedPresetId(e.target.value)
                            }
                            className="flex-1 px-2.5 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-left whitespace-normal break-words bg-white dark:bg-gray-800 dark:text-white"
                            style={{
                              textOverflow: "unset",
                              whiteSpace: "normal",
                            }}
                          >
                            {SECTION_PRESETS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label} — {p.description}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={applySectionPreset}
                            disabled={saving}
                            className="px-3.5 py-2 sm:py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-xs sm:text-sm hover:bg-gray-800 dark:hover:bg-white disabled:opacity-50 transition-colors w-full sm:w-auto text-center font-medium shrink-0"
                          >
                            Apply to Test
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {[
                    ["duration", "Duration (minutes)", 1, "1"],
                    ["negativeMarking", "Negative Marking", 0, "0.5"],
                  ].map(([key, label, min, step]) => (
                    <div key={key}>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        min={min}
                        step={step}
                        value={formData[key]}
                        onChange={(e) =>
                          setFormData({ ...formData, [key]: e.target.value })
                        }
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                      />
                    </div>
                  ))}

                  {editingId && (
                    <>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-500 mb-1">
                          Total Questions (Auto)
                        </label>
                        <input
                          readOnly
                          value={formData.totalQuestions || 0}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 rounded-lg outline-none text-gray-500 cursor-not-allowed text-xs sm:text-sm min-h-[40px] sm:min-h-0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-500 mb-1">
                          Total Marks (Auto)
                        </label>
                        <input
                          readOnly
                          value={formData.totalMarks || 0}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 rounded-lg outline-none text-gray-500 cursor-not-allowed text-xs sm:text-sm min-h-[40px] sm:min-h-0"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) =>
                        setFormData({ ...formData, difficulty: e.target.value })
                      }
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  {formData.isLive && (
                    <div className="sm:col-span-2 p-3.5 sm:p-4 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                        <h4 className="text-xs font-bold text-red-900 dark:text-red-300 uppercase tracking-wider">
                          Live Test Schedule & Availability Window
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Live Start Time (Available From) *
                          </label>
                          <input
                            type="datetime-local"
                            value={
                              formData.scheduledAt
                                ? String(formData.scheduledAt).slice(0, 16)
                                : ""
                            }
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                scheduledAt: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xs bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                          />
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            Exact date & time when the live test becomes active
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Live End Time (Available Until) *
                          </label>
                          <input
                            type="datetime-local"
                            value={
                              formData.scheduledEnd
                                ? String(formData.scheduledEnd).slice(0, 16)
                                : ""
                            }
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                scheduledEnd: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xs bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                          />
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            When the live contest window closes
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags
                    </label>
                    <input
                      value={formData.tags}
                      onChange={(e) =>
                        setFormData({ ...formData, tags: e.target.value })
                      }
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
                      placeholder="comma, separated, tags"
                    />
                  </div>
                </div>

                <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                    Timer Mode & Visibility Access
                  </h4>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                    {[
                      ["hasSectionalTiming", "⏱️ Sectional Timing"],
                      ["isPro", "⭐ Pro Pass Required"],
                      ["isComingSoon", "🚀 Coming Soon"],
                      ["isLive", "🔴 Live Test"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 cursor-pointer group bg-gray-50 hover:bg-gray-100 dark:bg-gray-750 dark:hover:bg-gray-700 p-2.5 sm:px-3 sm:py-2 rounded-xl border border-gray-200 dark:border-gray-700 transition-all min-h-[42px]"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(formData[key])}
                          onChange={(e) => {
                            const updates = { [key]: e.target.checked };
                            if (key === "isLive") {
                              updates.type = e.target.checked
                                ? "live-tests"
                                : "mock-tests";
                            }
                            setFormData({ ...formData, ...updates });
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors select-none">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {editingId && relationshipSummary && (
                <div className="md:col-span-1 md:sticky md:top-0">
                  <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 sm:p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 sm:mb-4 border-b border-indigo-100/55 dark:border-indigo-900/30 pb-2.5">
                      <Layers className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-xs sm:text-sm font-bold text-indigo-900 dark:text-indigo-300">
                        Linked Relationships
                      </h3>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3.5">
                      {[
                        ["Test Series", relationshipSummary.series],
                        ["Stage", relationshipSummary.stage],
                        ["Test Category", relationshipSummary.testCategory],
                        [
                          "Test Subcategory",
                          relationshipSummary.testSubcategory,
                        ],
                        ["Test Sections", relationshipSummary.sections],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-white/90 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 sm:px-3.5 sm:py-3 shadow-sm"
                        >
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            {label}
                          </div>
                          <div className="mt-0.5 sm:mt-1 text-xs font-bold text-gray-800 dark:text-gray-200 break-words leading-relaxed">
                            {value || "Not linked"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 sm:px-6 bg-gray-50/90 dark:bg-gray-800/90 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 shrink-0 sticky bottom-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all text-xs sm:text-sm font-semibold shadow-sm text-center"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : `${editingId ? "Update" : "Create"} Test`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
