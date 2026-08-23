import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  Folder,
  Layers,
  Plus,
  Trash2,
  Edit2,
  ListTree,
  Filter,
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  BookOpen,
  TestTube2,
  X,
  Download,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Settings,
  Search,
  Check,
  Loader2,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { useNavigate } from "react-router-dom";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import { toast as hotToast } from "react-hot-toast";

const HIERARCHY_TABS = [
  {
    id: "subjects",
    label: "Subjects",
    desc: "Root subjects for curriculum hierarchy",
  },
  {
    id: "units",
    label: "Units",
    desc: "Sub-divisions within subjects",
  },
  { id: "chapters", label: "Chapters", desc: "Main content containers" },
  { id: "topics", label: "Topics", desc: "Granular topics inside chapters" },
  { id: "subtopics", label: "Subtopics", desc: "Deepest level of content" },
  {
    id: "hierarchy",
    label: "Hierarchy View",
    desc: "Visualize full nested structure for selected subject",
  },
];

const getEntityId = (item) => item?.id ?? item?._id;
const normalizeId = (value) =>
  value === null || value === undefined ? "" : String(value);
const isSameId = (a, b) =>
  normalizeId(a) !== "" && normalizeId(a) === normalizeId(b);

const entityMatchesParentId = (entity, parentId) => {
  if (!entity || !parentId) return false;
  const strParentId = normalizeId(parentId);
  return (
    normalizeId(entity.id) === strParentId ||
    normalizeId(entity._id) === strParentId ||
    normalizeId(entity.public_id) === strParentId ||
    normalizeId(entity.subjectId) === strParentId ||
    normalizeId(entity.subject_id) === strParentId ||
    normalizeId(entity.partId) === strParentId ||
    normalizeId(entity.part_id) === strParentId ||
    normalizeId(entity.unitId) === strParentId ||
    normalizeId(entity.unit_id) === strParentId ||
    normalizeId(entity.chapterId) === strParentId ||
    normalizeId(entity.chapter_id) === strParentId ||
    normalizeId(entity.topicId) === strParentId ||
    normalizeId(entity.topic_id) === strParentId
  );
};
const toSet = (items, mapper) => new Set(items.map(mapper).filter(Boolean));

const getPartSubjectId = (part) => part?.subjectId ?? part?.subject_id;
const getUnitPartId = (unit) => unit?.partId ?? unit?.part_id;
const getUnitSubjectId = (unit) =>
  unit?.subjectId ?? unit?.subject_id ?? unit?.subject;
const getChapterUnitId = (chapter) => chapter?.unitId ?? chapter?.unit_id;
const getChapterSubjectId = (chapter) =>
  chapter?.subjectId ??
  chapter?.subject_id ??
  chapter?.studyMaterialId ??
  chapter?.study_material_id;
const getTopicChapterId = (topic) => topic?.chapterId ?? topic?.chapter_id;
const getSubtopicTopicId = (subtopic) =>
  subtopic?.topicId ?? subtopic?.topic_id;
const getOrderIndex = (item) =>
  item?.orderIndex ??
  item?.order_index ??
  item?.order ??
  item?.sortOrder ??
  item?.sort_order ??
  0;

// Natural sort comparator: handles embedded numbers correctly ("Unit 2" < "Unit 10")
const naturalCompare = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const getItemName = (item) => item?.name || item?.title || "";

const sortByOrderAndId = (items) =>
  [...items].sort((a, b) => {
    const aOrder = Number(getOrderIndex(a));
    const bOrder = Number(getOrderIndex(b));
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Tiebreak 1: natural sort by name (handles "Unit 1", "Unit 2", … "Unit 10" correctly)
    const nameCmp = naturalCompare(getItemName(a), getItemName(b));
    if (nameCmp !== 0) return nameCmp;
    // Tiebreak 2: numeric DB id
    return Number(getEntityId(a)) - Number(getEntityId(b));
  });

const ICON_NAME_TO_EMOJI = {
  "book-open": "\u{1F4DA}",
  book_open: "\u{1F4DA}",
  book: "\u{1F4D8}",
  bookmark: "\u{1F516}",
  folder: "\u{1F4C1}",
  layers: "\u{1F5C2}\u{FE0F}",
  "file-text": "\u{1F4C4}",
  file_text: "\u{1F4C4}",
  "list-tree": "\u{1F333}",
};

const LEVEL_EMOJI = {
  subjects: "\u{1F393}",
  parts: "\u{1F9E9}",
  units: "\u{1F4E6}",
  chapters: "\u{1F4D6}",
  topics: "\u{1F4DD}",
  subtopics: "\u{1F539}",
  hierarchy: "\u{1F333}",
};

const getLevelEmoji = (level) => LEVEL_EMOJI[level] || "\u{1F4DA}";

const SUBJECT_PALETTE_CB = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#ef4444",
];
const paletteColorCB = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return SUBJECT_PALETTE_CB[Math.abs(hash) % SUBJECT_PALETTE_CB.length];
};

const CHAPTER_CONTENT_TABS = [
  {
    id: "videos",
    label: "Videos",
    icon: Video,
    emptyText: "No videos linked to this context.",
  },
  {
    id: "pdfs",
    label: "PDFs",
    icon: FileText,
    emptyText: "No PDFs linked to this context.",
  },
  {
    id: "notes",
    label: "Notes",
    icon: BookOpen,
    emptyText: "No notes linked to this context.",
  },
  {
    id: "tests",
    label: "Tests/Quizzes",
    icon: TestTube2,
    emptyText: "No tests or quizzes linked to this context.",
  },
];

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim();
const includesAny = (text, patterns) => patterns.some((p) => text.includes(p));

function CurriculumBuilder() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    subjects: [],
    parts: [],
    units: [],
    chapters: [],
    topics: [],
    subtopics: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chapters");

  // Toast via react-hot-toast (CU-03 fix)
  const showToast = useCallback((message, type = "success") => {
    if (type === "error") hotToast.error(message);
    else if (type === "info") hotToast(message);
    else hotToast.success(message);
  }, []);

  // Slug validation state (CU-04 fix)
  const [slugError, setSlugError] = useState("");

  // Reorder state (CB2 fix)
  const [reorderLoading, setReorderLoading] = useState(new Set());

  // Global filter - curriculum builder revolves around a specific subject, '' means All Subjects
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const subjectDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        subjectDropdownRef.current &&
        !subjectDropdownRef.current.contains(e.target)
      ) {
        setSubjectDropdownOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setSubjectDropdownOpen(false);
    };
    if (subjectDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEsc);
      };
    }
  }, [subjectDropdownOpen]);

  // Bulk selection state (chapters, topics, subtopics)
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());

  // Reset bulk selection on tab/subject change
  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [activeTab, selectedSubjectId]);

  // Collapse state for grouping headers
  // FIX BUG [CURR-LOW]: Persist expanded/collapsed state across re-renders using localStorage
  // FIX BUG [CURR-LOW]: Persist expanded/collapsed state across re-renders using localStorage
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem("curriculum-collapsed-groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist collapsed state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        "curriculum-collapsed-groups",
        JSON.stringify(collapsedGroups),
      );
    } catch {
      // Ignore storage errors
    }
  }, [collapsedGroups]);

  const [modalConfig, setModalConfig] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    parentId: "",
  });
  const [chapterView, setChapterView] = useState({
    open: false,
    chapter: null,
    subject: null,
    topics: [],
    selectedTopicId: "",
    selectedSubtopicId: "",
    activeTab: "videos",
    loading: false,
    resources: {
      videos: [],
      pdfs: [],
      notes: [],
      topicTests: [],
      quizzes: [],
    },
  });

  // silent=true skips the loading spinner — used after mutations so the UI
  // stays stable instead of unmounting/remounting the full content tree.
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const fetchApi = async (url) => {
        try {
          const res = await apiClient.get(url);
          return res.data.data;
        } catch (e) {
          return [];
        }
      };

      const [subjects, parts, units, chapters, topics, subtopics] =
        await Promise.all([
          fetchApi("/admin/subjects"),
          fetchApi("/admin/subject-parts"),
          fetchApi("/admin/units"),
          fetchApi("/admin/chapters"),
          fetchApi("/admin/topics"),
          fetchApi("/admin/subtopics"),
        ]);
      setData({ subjects, parts, units, chapters, topics, subtopics });
    } catch (error) {
      console.error(error);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Derived filtered lists based on the globally selected subject.
  // Filtering follows hierarchy links: subject -> parts -> units -> chapters -> topics -> subtopics.
  const filteredSubjects = useMemo(
    () =>
      selectedSubjectId
        ? data.subjects.filter((s) =>
            entityMatchesParentId(s, selectedSubjectId),
          )
        : data.subjects,
    [data.subjects, selectedSubjectId],
  );

  // Build a set of ALL identity values for the selected subject so we can
  // match regardless of whether units stored the numeric id, slug, or public_id.
  const selectedSubjectIdSet = useMemo(() => {
    if (!selectedSubjectId) return new Set();
    const subject = data.subjects.find(
      (s) =>
        isSameId(s.id, selectedSubjectId) ||
        isSameId(s._id, selectedSubjectId) ||
        s.slug === selectedSubjectId ||
        s.public_id === selectedSubjectId,
    );
    const ids = [
      selectedSubjectId,
      subject?.id,
      subject?._id,
      subject?.slug,
      subject?.public_id,
    ]
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map(normalizeId);
    return new Set(ids);
  }, [data.subjects, selectedSubjectId]);

  const filteredParts = useMemo(
    () =>
      selectedSubjectId
        ? data.parts.filter((p) =>
            selectedSubjectIdSet.has(normalizeId(getPartSubjectId(p))),
          )
        : data.parts,
    [data.parts, selectedSubjectId, selectedSubjectIdSet],
  );

  const filteredUnits = useMemo(() => {
    if (!selectedSubjectId) return data.units;
    return data.units.filter((u) => {
      const subId = normalizeId(getUnitSubjectId(u));
      const partId = normalizeId(getUnitPartId(u));
      return (
        selectedSubjectIdSet.has(subId) || selectedSubjectIdSet.has(partId)
      );
    });
  }, [data.units, selectedSubjectId, selectedSubjectIdSet]);

  const filteredChapters = useMemo(() => {
    if (!selectedSubjectId) return data.chapters;
    const unitIdSet = new Set();
    filteredUnits.forEach((u) => {
      [u.id, u._id, u.public_id]
        .filter(Boolean)
        .forEach((v) => unitIdSet.add(normalizeId(v)));
    });
    return data.chapters.filter((c) => {
      const byUnit = unitIdSet.has(normalizeId(getChapterUnitId(c)));
      const byDirectSubject = selectedSubjectIdSet.has(
        normalizeId(getChapterSubjectId(c)),
      );
      return byUnit || byDirectSubject;
    });
  }, [data.chapters, filteredUnits, selectedSubjectId, selectedSubjectIdSet]);

  const filteredTopics = useMemo(() => {
    if (!selectedSubjectId) return data.topics;
    const chapterIdSet = new Set();
    filteredChapters.forEach((c) => {
      [c.id, c._id, c.public_id]
        .filter(Boolean)
        .forEach((v) => chapterIdSet.add(normalizeId(v)));
    });
    return data.topics.filter((t) =>
      chapterIdSet.has(normalizeId(getTopicChapterId(t))),
    );
  }, [data.topics, filteredChapters, selectedSubjectId]);

  const filteredSubtopics = useMemo(() => {
    if (!selectedSubjectId) return data.subtopics;
    const topicIdSet = new Set();
    filteredTopics.forEach((t) => {
      [t.id, t._id, t.public_id]
        .filter(Boolean)
        .forEach((v) => topicIdSet.add(normalizeId(v)));
    });
    return data.subtopics.filter((s) =>
      topicIdSet.has(normalizeId(getSubtopicTopicId(s))),
    );
  }, [data.subtopics, filteredTopics, selectedSubjectId]);

  const selectedSubject = useMemo(
    () =>
      data.subjects.find((s) => entityMatchesParentId(s, selectedSubjectId)) ||
      null,
    [data.subjects, selectedSubjectId],
  );

  const filteredSubjectsForDropdown = useMemo(
    () => sortByOrderAndId(data.subjects),
    [data.subjects],
  );

  const hierarchyTree = useMemo(() => {
    if (!selectedSubjectId) return { parts: [], directChapters: [] };

    const sortedParts = sortByOrderAndId(filteredParts);
    const sortedUnits = sortByOrderAndId(filteredUnits);
    const sortedChapters = sortByOrderAndId(filteredChapters);
    const sortedTopics = sortByOrderAndId(filteredTopics);
    const sortedSubtopics = sortByOrderAndId(filteredSubtopics);

    const chaptersByUnit = new Map();
    const topicsByChapter = new Map();
    const subtopicsByTopic = new Map();

    sortedChapters.forEach((chapter) => {
      const unitId = normalizeId(getChapterUnitId(chapter));
      if (!unitId) return;
      if (!chaptersByUnit.has(unitId)) chaptersByUnit.set(unitId, []);
      chaptersByUnit.get(unitId).push(chapter);
    });

    sortedTopics.forEach((topic) => {
      const chapterId = normalizeId(getTopicChapterId(topic));
      if (!chapterId) return;
      if (!topicsByChapter.has(chapterId)) topicsByChapter.set(chapterId, []);
      topicsByChapter.get(chapterId).push(topic);
    });

    sortedSubtopics.forEach((subtopic) => {
      const topicId = normalizeId(getSubtopicTopicId(subtopic));
      if (!topicId) return;
      if (!subtopicsByTopic.has(topicId)) subtopicsByTopic.set(topicId, []);
      subtopicsByTopic.get(topicId).push(subtopic);
    });

    const includedChapterIds = new Set();

    const units = sortedUnits.map((unit) => {
      const unitId = normalizeId(getEntityId(unit));
      const chapters = (chaptersByUnit.get(unitId) || []).map((chapter) => {
        const chapterId = normalizeId(getEntityId(chapter));
        includedChapterIds.add(chapterId);
        const topics = (topicsByChapter.get(chapterId) || []).map((topic) => {
          const topicId = normalizeId(getEntityId(topic));
          return {
            ...topic,
            subtopics: subtopicsByTopic.get(topicId) || [],
          };
        });
        return { ...chapter, topics };
      });
      return { ...unit, chapters };
    });

    const directChapters = sortedChapters
      .filter((chapter) => {
        const chapterId = normalizeId(getEntityId(chapter));
        const hasUnit = !!normalizeId(getChapterUnitId(chapter));
        return !hasUnit || !includedChapterIds.has(chapterId);
      })
      .map((chapter) => {
        const chapterId = normalizeId(getEntityId(chapter));
        const topics = (topicsByChapter.get(chapterId) || []).map((topic) => {
          const topicId = normalizeId(getEntityId(topic));
          return {
            ...topic,
            subtopics: subtopicsByTopic.get(topicId) || [],
          };
        });
        return { ...chapter, topics };
      });

    return { units, directChapters };
  }, [
    selectedSubjectId,
    filteredUnits,
    filteredChapters,
    filteredTopics,
    filteredSubtopics,
  ]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const getChapterContext = (chapter) => {
    const chapterUnitId = getChapterUnitId(chapter);
    const chapterSubjectId = getChapterSubjectId(chapter);

    if (chapterSubjectId) {
      const subject = data.subjects.find((s) =>
        entityMatchesParentId(s, chapterSubjectId),
      );
      return { subject };
    }

    const unit = data.units.find((u) =>
      entityMatchesParentId(u, chapterUnitId),
    );
    if (!unit) return { subject: null };
    const part = data.parts.find((p) =>
      entityMatchesParentId(p, getUnitPartId(unit)),
    );
    if (!part) return { subject: null };
    const subject = data.subjects.find((s) =>
      entityMatchesParentId(s, getPartSubjectId(part)),
    );
    return { subject };
  };

  const openChapterView = async (chapter) => {
    const chapterId = getEntityId(chapter);
    const chapterTopics = filteredTopics
      .filter((topic) => isSameId(getTopicChapterId(topic), chapterId))
      .map((topic) => ({
        ...topic,
        subtopics: filteredSubtopics.filter((st) =>
          isSameId(getSubtopicTopicId(st), getEntityId(topic)),
        ),
      }));

    const { subject } = getChapterContext(chapter);

    setChapterView({
      open: true,
      chapter,
      subject,
      topics: chapterTopics,
      selectedTopicId: chapterTopics[0]
        ? String(getEntityId(chapterTopics[0]))
        : "",
      selectedSubtopicId: "",
      activeTab: "videos",
      loading: true,
      resources: {
        videos: [],
        pdfs: [],
        notes: [],
        topicTests: [],
        quizzes: [],
      },
    });

    const subjectId = getEntityId(subject);
    const chapterIdStr = String(chapterId);

    const params = new URLSearchParams();
    if (subjectId) params.append("studyMaterialId", String(subjectId));
    params.append("chapterId", chapterIdStr);
    const chapterQuery = params.toString() ? `?${params.toString()}` : "";

    const safeFetch = async (url) => {
      try {
        const res = await apiClient.get(url);
        return res.data?.data || [];
      } catch {
        return [];
      }
    };

    const quizQuery = new URLSearchParams();
    if (subject?.name) quizQuery.append("subject", subject.name);
    quizQuery.append("active", "true");

    const [videos, pdfs, topicTests, quizzes] = await Promise.all([
      safeFetch(`/admin/subject-videos${chapterQuery}`),
      safeFetch(`/admin/subject-pdfs${chapterQuery}`),
      safeFetch(`/admin/topic-tests${chapterQuery}`),
      safeFetch(`/admin/quizzes?${quizQuery.toString()}`),
    ]);

    // FIX ISSUE CU-02: Notes are now determined by a dedicated type field on PDFs
    // Fall back to keyword matching for legacy PDFs that don't have a type field
    const noteKeywords = [
      "note",
      "notes",
      "handout",
      "class note",
      "lecture note",
    ];
    const notes = pdfs.filter((pdf) => {
      // Check for explicit type field first (preferred method)
      const pdfType = (
        pdf.type ||
        pdf.pdfType ||
        pdf.fileType ||
        ""
      ).toLowerCase();
      if (pdfType === "note" || pdfType === "notes" || pdfType === "handout") {
        return true;
      }
      // Fall back to keyword matching for legacy PDFs
      const hay = normalizeText(
        `${pdf.title || ""} ${pdf.description || ""} ${pdf.slug || ""}`,
      );
      return includesAny(hay, noteKeywords);
    });

    setChapterView((prev) => ({
      ...prev,
      loading: false,
      resources: {
        videos,
        pdfs,
        notes,
        topicTests,
        quizzes,
      },
    }));
  };

  const closeChapterView = () => {
    setChapterView((prev) => ({ ...prev, open: false }));
  };

  const handleReorderResource = async (direction, item, index) => {
    const tabId = chapterView.activeTab;
    if (!["videos", "pdfs", "tests", "notes"].includes(tabId)) return;

    // notes is actually derived from pdfs, but handled separately here
    const isNote = tabId === "notes";
    const resourceKeyMapping = {
      videos: "videos",
      pdfs: "pdfs",
      notes: "pdfs",
      tests: "topicTests",
    };

    // Quizzes are not reorderable via this endpoint
    if (tabId === "tests" && item.__type === "quiz") {
      showToast("Quizzes cannot be reordered here", "info");
      return;
    }

    const resourceKey = resourceKeyMapping[tabId];
    const fullItems = [...chapterView.resources[resourceKey]];

    // Find absolute index in the full list
    const actualIndex = fullItems.findIndex((i) => {
      const id1 = getEntityId(i) || i.testId || i.test_id;
      const id2 = getEntityId(item) || item.testId || item.test_id;
      return id1 === id2;
    });

    if (actualIndex === -1) return;

    // For reordering, we want to move relative to the VISIBLE items
    // If the list is filtered, "Up" should skip over items not shown?
    // User expectation is usually to swap with the item above/below in the current view.
    const visibleIndex = index;
    if (direction === "up" && visibleIndex === 0) return;
    if (direction === "down" && visibleIndex === chapterActiveItems.length - 1)
      return;

    const neighborVisibleItem =
      chapterActiveItems[
        direction === "up" ? visibleIndex - 1 : visibleIndex + 1
      ];
    if (!neighborVisibleItem) return;

    const neighborActualIndex = fullItems.findIndex((i) => {
      const id1 = getEntityId(i) || i.testId || i.test_id;
      const id2 =
        getEntityId(neighborVisibleItem) ||
        neighborVisibleItem.testId ||
        neighborVisibleItem.test_id;
      return id1 === id2;
    });

    if (neighborActualIndex === -1) return;

    // Optimistic Swap in fullItems
    const newFullItems = [...fullItems];
    [newFullItems[actualIndex], newFullItems[neighborActualIndex]] = [
      newFullItems[neighborActualIndex],
      newFullItems[actualIndex],
    ];

    // Recalculate derived notes if needed
    let newNotes = chapterView.resources.notes;
    if (resourceKey === "pdfs") {
      const noteKeywords = [
        "note",
        "notes",
        "handout",
        "class note",
        "lecture note",
      ];
      newNotes = newFullItems.filter((pdf) => {
        const pdfType = (
          pdf.type ||
          pdf.pdfType ||
          pdf.fileType ||
          ""
        ).toLowerCase();
        if (pdfType === "note" || pdfType === "notes" || pdfType === "handout")
          return true;
        const hay = normalizeText(
          `${pdf.title || ""} ${pdf.description || ""} ${pdf.slug || ""}`,
        );
        return includesAny(hay, noteKeywords);
      });
    }

    setChapterView((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        [resourceKey]: newFullItems,
        notes: newNotes,
      },
    }));

    try {
      const endpointMapping = {
        videos: "subject-videos",
        pdfs: "subject-pdfs",
        notes: "subject-pdfs",
        tests: "topic-tests",
      };
      const endpoint = endpointMapping[tabId];
      const movedItemId = getEntityId(item) || item.id || item._id;
      const neighborItemId =
        getEntityId(neighborVisibleItem) ||
        neighborVisibleItem.id ||
        neighborVisibleItem.id;

      // Swap their display_order values in backend
      // Note: Backend handles the conversion from camelCase displayOrder to snake_case display_order
      await Promise.all([
        apiClient.put(`/admin/${endpoint}/${movedItemId}/reorder`, {
          order: neighborActualIndex,
        }),
        apiClient.put(`/admin/${endpoint}/${neighborItemId}/reorder`, {
          order: actualIndex,
        }),
      ]);

      showToast("Order saved");
    } catch (error) {
      console.error("Reorder failed:", error);
      showToast("Reorder synchronization failed", "error");
    }
  };

  useEffect(() => {
    if (!chapterView.open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setChapterView((prev) => ({ ...prev, open: false }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chapterView.open]);

  // Handle form actions
  const handleAction = (tabId, existingItem = null) => {
    let defaultParent = "";
    if (existingItem) {
      if (tabId === "parts") defaultParent = getPartSubjectId(existingItem);
      if (tabId === "units")
        defaultParent =
          getUnitSubjectId(existingItem) || getUnitPartId(existingItem);
      if (tabId === "chapters")
        defaultParent =
          getChapterUnitId(existingItem) || getChapterSubjectId(existingItem);
      if (tabId === "topics") defaultParent = getTopicChapterId(existingItem);
      if (tabId === "subtopics")
        defaultParent = getSubtopicTopicId(existingItem);
    } else {
      // New item, set default parent if applicable
      if (selectedSubjectId) {
        if (tabId === "parts" || tabId === "units" || tabId === "chapters")
          defaultParent = selectedSubjectId;
      }
    }

    setFormData({
      name: existingItem?.name || existingItem?.title || "",
      slug: existingItem?.slug || "",
      description: existingItem?.description || "",
      icon: existingItem?.icon || "",
      parentId: defaultParent || "",
    });
    setModalConfig({ tabId, item: existingItem });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const { tabId, item } = modalConfig;

    let url = "";
    let payload = {
      slug: formData.slug,
      description: formData.description,
      icon: formData.icon,
    };

    if (tabId === "subjects") {
      url = "/admin/subjects";
      payload.name = formData.name;
      payload.isActive = true;
    } else if (tabId === "parts") {
      url = "/admin/subject-parts";
      payload.name = formData.name;
      payload.subjectId = formData.parentId;
      if (!payload.subjectId) {
        showToast("Please select a Subject.", "error");
        return;
      }
    } else if (tabId === "units") {
      url = "/admin/units";
      payload.name = formData.name;

      const parentSub = data.subjects.find(
        (s) =>
          isSameId(s.id, formData.parentId) ||
          isSameId(s._id, formData.parentId) ||
          s.slug === formData.parentId ||
          s.public_id === formData.parentId,
      );

      const targetSubId = parentSub?.id
        ? Number(parentSub.id)
        : !isNaN(formData.parentId) && formData.parentId !== ""
          ? Number(formData.parentId)
          : null;

      if (!targetSubId) {
        showToast("Please select a Subject.", "error");
        return;
      }
      payload.subjectId = targetSubId;
    } else if (tabId === "chapters") {
      url = "/admin/chapters";
      payload.title = formData.name;

      // FIX ISSUE CU-01: Enforce single-parent model for chapters
      // A chapter must belong to EITHER a unit OR a subject, not both
      // This prevents confusion when units are moved between subjects
      const isUnit = data.units.find((u) =>
        entityMatchesParentId(u, formData.parentId),
      );
      if (isUnit) {
        // Chapter is linked to a unit — unit determines the subject
        payload.unitId = formData.parentId;
        const parentPart = data.parts.find((p) =>
          entityMatchesParentId(p, getUnitPartId(isUnit)),
        );
        payload.studyMaterialId =
          getPartSubjectId(parentPart) || selectedSubjectId || null;
        if (!payload.studyMaterialId) {
          showToast(
            "The unit's parent part is not linked to a subject.",
            "error",
          );
          return;
        }
      } else {
        // Chapter is linked directly to a subject (no unit)
        payload.unitId = null;
        payload.studyMaterialId = formData.parentId;
      }
      if (!payload.studyMaterialId) {
        showToast("Please select a Unit or Subject.", "error");
        return;
      }
    } else if (tabId === "topics") {
      url = "/admin/topics";
      payload.name = formData.name;
      payload.chapterId = formData.parentId;
      if (!payload.chapterId) {
        showToast("Please select a Chapter.", "error");
        return;
      }
    } else if (tabId === "subtopics") {
      url = "/admin/subtopics";
      payload.name = formData.name;
      payload.topicId = formData.parentId;
      if (!payload.topicId) {
        showToast("Please select a Topic.", "error");
        return;
      }
    }

    try {
      if (item) {
        await apiClient.put(`${url}/${getEntityId(item)}`, payload);
        showToast(`${modalConfig.tabId.slice(0, -1)} updated successfully!`);
      } else {
        await apiClient.post(url, payload);
        showToast(`${modalConfig.tabId.slice(0, -1)} created successfully!`);
      }
      setModalConfig(null);
      setSlugError("");
      loadData(true); // silent — no full-page spinner
    } catch (error) {
      console.error("Error saving:", error);
      showToast(
        "Failed to save. " + (error.response?.data?.message || ""),
        "error",
      );
    }
  };

  const getDeleteDependencySummary = (tabId, item) => {
    const id = getEntityId(item);
    if (!id) return "";
    if (tabId === "subjects") {
      const parts = data.parts.filter((p) => isSameId(getPartSubjectId(p), id));
      const partIdSet = new Set(parts.map((p) => String(getEntityId(p))));
      const units = data.units.filter((u) =>
        partIdSet.has(String(getUnitPartId(u))),
      );
      const unitIdSet = new Set(units.map((u) => String(getEntityId(u))));
      const directChapters = data.chapters.filter((ch) =>
        isSameId(getChapterSubjectId(ch), id),
      );
      const unitChapters = data.chapters.filter((ch) => {
        const uid = getChapterUnitId(ch);
        return uid != null && unitIdSet.has(String(uid));
      });
      const allChapters = [...directChapters, ...unitChapters];
      return `${parts.length} part(s), ${units.length} unit(s), ${allChapters.length} chapter(s) in loaded data (nested under this subject).`;
    }
    if (tabId === "parts") {
      const units = data.units.filter((u) => isSameId(getUnitPartId(u), id));
      const unitIdSet = new Set(units.map((u) => String(getEntityId(u))));
      const chapters = data.chapters.filter((ch) => {
        const uid = getChapterUnitId(ch);
        return uid != null && unitIdSet.has(String(uid));
      });
      const chIdSet = new Set(chapters.map((c) => String(getEntityId(c))));
      const topics = data.topics.filter((t) =>
        chIdSet.has(String(getTopicChapterId(t))),
      );
      const topicIdSet = new Set(topics.map((t) => String(getEntityId(t))));
      const subtopics = data.subtopics.filter((st) =>
        topicIdSet.has(String(getSubtopicTopicId(st))),
      );
      return `${units.length} unit(s), ${chapters.length} chapter(s), ${topics.length} topic(s), ${subtopics.length} subtopic(s) in loaded data (nested under this part).`;
    }
    if (tabId === "units") {
      const chapters = data.chapters.filter((ch) =>
        isSameId(getChapterUnitId(ch), id),
      );
      const chIdSet = new Set(chapters.map((c) => String(getEntityId(c))));
      const topics = data.topics.filter((t) =>
        chIdSet.has(String(getTopicChapterId(t))),
      );
      const topicIdSet = new Set(topics.map((t) => String(getEntityId(t))));
      const subtopics = data.subtopics.filter((st) =>
        topicIdSet.has(String(getSubtopicTopicId(st))),
      );
      return `${chapters.length} chapter(s), ${topics.length} topic(s), ${subtopics.length} subtopic(s) in loaded data.`;
    }
    if (tabId === "chapters") {
      const topics = data.topics.filter((t) =>
        isSameId(getTopicChapterId(t), id),
      );
      const topicIdSet = new Set(topics.map((t) => String(getEntityId(t))));
      const subtopics = data.subtopics.filter((st) =>
        topicIdSet.has(String(getSubtopicTopicId(st))),
      );
      return `${topics.length} topic(s), ${subtopics.length} subtopic(s) in loaded data.`;
    }
    if (tabId === "topics") {
      const n = data.subtopics.filter((st) =>
        isSameId(getSubtopicTopicId(st), id),
      ).length;
      return `${n} subtopic(s) in loaded data.`;
    }
    if (tabId === "subtopics") {
      return "No nested curriculum rows in loaded data.";
    }
    return "";
  };

  const handleDelete = async (tabId, item) => {
    const label = item?.name || item?.title || "this item";
    const summary = getDeleteDependencySummary(tabId, item);
    const msg = summary
      ? `Move "${label}" to recycle bin?\n\nLoaded data shows dependents: ${summary}\n\nContinue?`
      : `Move "${label}" to recycle bin? You can restore it later.`;
    const confirmed = await confirmOnce({
      title: "Move to Recycle Bin",
      message: msg,
      danger: true,
    });
    if (!confirmed) return;

    let url = "";
    if (tabId === "subjects") url = "/admin/subjects";
    if (tabId === "parts") url = "/admin/subject-parts";
    if (tabId === "units") url = "/admin/units";
    if (tabId === "chapters") url = "/admin/chapters";
    if (tabId === "topics") url = "/admin/topics";
    if (tabId === "subtopics") url = "/admin/subtopics";

    try {
      await apiClient.delete(`${url}/${getEntityId(item)}`);
      showToast(`${label} moved to recycle bin.`);
      loadData(true); // silent — no full-page spinner
    } catch (error) {
      console.error("Error deleting:", error);
      showToast("Failed to delete item.", "error");
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedItemIds.size;
    if (count === 0) return;

    const confirmed = await confirmOnce({
      title: "Move Selected Items to Recycle Bin",
      message: `Are you sure you want to move the ${count} selected ${activeTab} to the recycle bin?`,
      danger: true,
    });
    if (!confirmed) return;

    let url = "";
    if (activeTab === "chapters") url = "/admin/chapters";
    if (activeTab === "topics") url = "/admin/topics";
    if (activeTab === "subtopics") url = "/admin/subtopics";

    setLoading(true);
    try {
      // Execute all delete requests in parallel
      await Promise.all(
        Array.from(selectedItemIds).map((id) =>
          apiClient.delete(`${url}/${id}`),
        ),
      );
      showToast(`Successfully moved ${count} items to the recycle bin.`);
      setSelectedItemIds(new Set());
      loadData(true); // silent refresh
    } catch (error) {
      console.error("Error bulk deleting:", error);
      showToast("Failed to delete some items.", "error");
    } finally {
      setLoading(false);
    }
  };

  // CU-04: Slug uniqueness validation
  const validateSlug = useCallback(
    (slug, excludeId = null) => {
      if (!slug) return "";
      const entityMap = {
        parts: data.parts,
        units: data.units,
        chapters: data.chapters,
        topics: data.topics,
        subtopics: data.subtopics,
      };
      const items = entityMap[activeTab] || [];
      const duplicate = items.find(
        (c) =>
          c.slug === slug &&
          getEntityId(c) !== excludeId &&
          getEntityId(c) !== modalConfig?.item?.id &&
          getEntityId(c) !== modalConfig?.item?._id,
      );
      return duplicate
        ? "This slug already exists. Please choose a different name."
        : "";
    },
    [data, activeTab, modalConfig],
  );

  // CB2: Reorder among siblings by swapping orderIndex
  const handleReorder = async (item, direction) => {
    const tabId = activeTab;
    if (tabId === "subjects" || tabId === "hierarchy") return;

    const entityMap = {
      parts: data.parts,
      units: data.units,
      chapters: data.chapters,
      topics: data.topics,
      subtopics: data.subtopics,
    };
    const items = entityMap[tabId] || [];

    // Determine parent key for sibling grouping
    const getParentKey = (it) => {
      if (tabId === "parts") return String(getPartSubjectId(it) || "");
      if (tabId === "units") return String(getUnitPartId(it) || "");
      if (tabId === "chapters")
        return String(getChapterUnitId(it) || getChapterSubjectId(it) || "");
      if (tabId === "topics") return String(getTopicChapterId(it) || "");
      if (tabId === "subtopics") return String(getSubtopicTopicId(it) || "");
      return "";
    };

    const pid = getParentKey(item);
    const siblings = items
      .filter((c) => getParentKey(c) === pid)
      .sort((a, b) => getOrderIndex(a) - getOrderIndex(b));
    const idx = siblings.findIndex((c) => getEntityId(c) === getEntityId(item));
    const j = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= siblings.length) return;

    const a = siblings[idx];
    const b = siblings[j];
    const oa = getOrderIndex(a);
    const ob = getOrderIndex(b);

    const urlMap = {
      parts: "/admin/subject-parts",
      units: "/admin/units",
      chapters: "/admin/chapters",
      topics: "/admin/topics",
      subtopics: "/admin/subtopics",
    };
    const url = urlMap[tabId];
    if (!url) return;

    const aId = getEntityId(a);
    const bId = getEntityId(b);
    setReorderLoading((prev) => new Set(prev).add(aId).add(bId));
    try {
      await Promise.all([
        apiClient.put(`${url}/${aId}`, { orderIndex: ob }),
        apiClient.put(`${url}/${bId}`, { orderIndex: oa }),
      ]);
      showToast("Order updated");
      loadData();
    } catch (error) {
      console.error("Reorder failed:", error);
      showToast("Failed to reorder", "error");
    } finally {
      setReorderLoading((prev) => {
        const next = new Set(prev);
        next.delete(aId);
        next.delete(bId);
        return next;
      });
    }
  };

  // Which data is currently active? Sort by orderIndex so list views respect ordering.
  let activeData = [];
  if (activeTab === "subjects") activeData = sortByOrderAndId(filteredSubjects);
  if (activeTab === "parts") activeData = sortByOrderAndId(filteredParts);
  if (activeTab === "units") activeData = sortByOrderAndId(filteredUnits);
  if (activeTab === "chapters") activeData = sortByOrderAndId(filteredChapters);
  if (activeTab === "topics") activeData = sortByOrderAndId(filteredTopics);
  if (activeTab === "subtopics")
    activeData = sortByOrderAndId(filteredSubtopics);

  const currentTabConfig = HIERARCHY_TABS.find((t) => t.id === activeTab);

  // Render grouped lists!
  const groupItemsByParent = () => {
    const groups = {};

    // Helper: resolve parent entity and its orderIndex for a given tab + parentId
    const resolveParentOrder = (tab, pid) => {
      let entity = null;
      if (tab === "parts" || tab === "units")
        entity = data.subjects.find((s) => entityMatchesParentId(s, pid));
      else if (tab === "chapters") {
        entity = data.units.find((u) => entityMatchesParentId(u, pid));
        if (!entity)
          entity = data.subjects.find((s) => entityMatchesParentId(s, pid));
      } else if (tab === "topics")
        entity = data.chapters.find((c) => entityMatchesParentId(c, pid));
      else if (tab === "subtopics")
        entity = data.topics.find((t) => entityMatchesParentId(t, pid));
      return {
        parentOrder: Number(getOrderIndex(entity)),
        parentNumericId: Number(getEntityId(entity) ?? 0),
        parentEntityName: getItemName(entity),
      };
    };

    activeData.forEach((item) => {
      let parentId = "unassigned";
      let parentName = "Unassigned";

      if (activeTab === "subjects") {
        parentId = "all";
        parentName = "All Subjects";
      } else if (activeTab === "parts" && getPartSubjectId(item)) {
        parentId = getPartSubjectId(item);
        parentName =
          data.subjects.find((s) => entityMatchesParentId(s, parentId))?.name ||
          "Unknown Subject";
      } else if (activeTab === "units") {
        const uSubId = getUnitSubjectId(item) || getUnitPartId(item);
        if (uSubId) {
          parentId = uSubId;
          const foundSubject = data.subjects.find((s) =>
            entityMatchesParentId(s, parentId),
          );
          const foundPart = data.parts.find((p) =>
            entityMatchesParentId(p, parentId),
          );
          parentName =
            foundSubject?.name ||
            foundPart?.name ||
            item.subjectName ||
            "Unknown Subject";
        }
      } else if (activeTab === "chapters") {
        if (getChapterUnitId(item)) {
          parentId = getChapterUnitId(item);
          const foundUnit = data.units.find((u) =>
            entityMatchesParentId(u, parentId),
          );
          parentName = foundUnit?.name || item.unitName || "Unknown Unit";
        } else if (getChapterSubjectId(item)) {
          parentId = getChapterSubjectId(item);
          const foundSubject = data.subjects.find((s) =>
            entityMatchesParentId(s, parentId),
          );
          parentName =
            foundSubject?.name || item.subjectName || "Directly under Subject";
        }
      } else if (activeTab === "topics" && getTopicChapterId(item)) {
        parentId = getTopicChapterId(item);
        parentName =
          data.chapters.find((c) => entityMatchesParentId(c, parentId))
            ?.title || "Unknown Chapter";
      } else if (activeTab === "subtopics" && getSubtopicTopicId(item)) {
        parentId = getSubtopicTopicId(item);
        parentName =
          data.topics.find((t) => entityMatchesParentId(t, parentId))?.name ||
          "Unknown Topic";
      }

      const isOrphan =
        parentName === "Unknown Chapter" ||
        parentName === "Unknown Topic" ||
        parentName === "Unknown Unit" ||
        parentName === "Unknown Subject" ||
        parentName === "Unassigned" ||
        parentName === "Directly under Subject";
      const groupKey = isOrphan
        ? `__orphan__${parentName}`
        : `${parentName}-${parentId}`;
      if (!groups[groupKey]) {
        const orphanOrder = isOrphan ? 9999 : undefined;
        const resolved = isOrphan
          ? {
              parentOrder: 9999,
              parentNumericId: 0,
              parentEntityName: parentName,
            }
          : resolveParentOrder(activeTab, parentId);
        groups[groupKey] = {
          id: groupKey,
          name: parentName,
          items: [],
          parentOrder: resolved.parentOrder,
          parentNumericId: resolved.parentNumericId,
          parentEntityName: resolved.parentEntityName,
          isOrphan,
        };
      }
      groups[groupKey].items.push(item);
    });

    return groups;
  };

  const groupedData = activeTab === "hierarchy" ? {} : groupItemsByParent();

  // Chapters, topics, and subtopics open with their parent groups collapsed.
  // The scope ref prevents a user expanding a group from being overwritten on
  // every render, while still resetting groups when the tab/subject changes.
  const collapsedGroupIdsKey = Object.values(groupedData)
    .map((group) => group.id)
    .sort()
    .join("|");
  const collapseScopeKey = `${activeTab}:${selectedSubjectId}:${collapsedGroupIdsKey}`;
  const shouldDefaultCollapse =
    ["chapters", "topics", "subtopics"].includes(activeTab) &&
    Boolean(collapsedGroupIdsKey);
  const collapseDefaultsScopeRef = useRef("");
  const forceInitialCollapse =
    shouldDefaultCollapse &&
    collapseDefaultsScopeRef.current !== collapseScopeKey;

  useEffect(() => {
    if (!shouldDefaultCollapse) return;

    const groupIds = collapsedGroupIdsKey.split("|");
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      groupIds.forEach((groupId) => {
        if (next[groupId] !== true) {
          next[groupId] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    collapseDefaultsScopeRef.current = collapseScopeKey;
  }, [collapseScopeKey, collapsedGroupIdsKey, shouldDefaultCollapse]);

  if (loading)
    return (
      <div
        className="min-h-[420px] p-4 sm:p-8 flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Loading curriculum builder"
      >
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-8 sm:px-8 sm:py-10 text-center shadow-sm">
          <div className="relative mx-auto mb-5 w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 animate-ping opacity-60" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Loader2
                className="w-7 h-7 text-white animate-spin"
                aria-hidden="true"
              />
            </div>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            Loading curriculum builder
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Preparing your subjects, chapters, topics, and subtopics...
          </p>
          <div className="mt-6 grid grid-cols-5 gap-2" aria-hidden="true">
            {["w-3/5", "w-4/5", "w-2/5", "w-full", "w-3/4"].map(
              (width, index) => (
                <div
                  key={index}
                  className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
                >
                  <div
                    className={`${width} h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse`}
                    style={{ animationDelay: `${index * 120}ms` }}
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    );

  const selectedChapterTopic =
    chapterView.topics.find((topic) =>
      entityMatchesParentId(topic, chapterView.selectedTopicId),
    ) || null;

  const selectedChapterSubtopic =
    (selectedChapterTopic?.subtopics || []).find((subtopic) =>
      entityMatchesParentId(subtopic, chapterView.selectedSubtopicId),
    ) || null;

  const selectedTopicName = normalizeText(
    selectedChapterTopic?.name || selectedChapterTopic?.title || "",
  );
  const selectedSubtopicName = normalizeText(
    selectedChapterSubtopic?.name || selectedChapterSubtopic?.title || "",
  );

  const resourceHasTopicContext = (item) => {
    const topicId = normalizeId(
      item?.topicId ??
        item?.topic_id ??
        item?.parentTopicId ??
        item?.parent_topic_id,
    );
    const subtopicId = normalizeId(item?.subtopicId ?? item?.subtopic_id);
    const topicText = normalizeText(
      item?.topic ?? item?.topicName ?? item?.topic_title ?? "",
    );
    const subtopicText = normalizeText(
      item?.subtopic ?? item?.subtopicName ?? "",
    );
    return Boolean(topicId || subtopicId || topicText || subtopicText);
  };

  const resourceMatchesTopicContext = (item) => {
    if (!chapterView.selectedTopicId && !chapterView.selectedSubtopicId)
      return true;

    const topicId = normalizeId(
      item?.topicId ??
        item?.topic_id ??
        item?.parentTopicId ??
        item?.parent_topic_id,
    );
    const subtopicId = normalizeId(item?.subtopicId ?? item?.subtopic_id);
    const topicText = normalizeText(
      item?.topic ?? item?.topicName ?? item?.topic_title ?? "",
    );
    const subtopicText = normalizeText(
      item?.subtopic ?? item?.subtopicName ?? "",
    );
    const haystack = normalizeText(
      `${item?.title || ""} ${item?.name || ""} ${item?.description || ""} ${item?.slug || ""}`,
    );

    if (chapterView.selectedSubtopicId && subtopicId) {
      return isSameId(subtopicId, chapterView.selectedSubtopicId);
    }
    if (chapterView.selectedTopicId && topicId) {
      return isSameId(topicId, chapterView.selectedTopicId);
    }
    if (chapterView.selectedSubtopicId && selectedSubtopicName) {
      if (
        subtopicText.includes(selectedSubtopicName) ||
        haystack.includes(selectedSubtopicName)
      )
        return true;
    }
    if (chapterView.selectedTopicId && selectedTopicName) {
      if (
        topicText.includes(selectedTopicName) ||
        haystack.includes(selectedTopicName)
      )
        return true;
    }

    // Keep chapter-level resources visible when no topic mapping exists.
    return !resourceHasTopicContext(item);
  };

  const filteredChapterVideos = chapterView.resources.videos.filter(
    resourceMatchesTopicContext,
  );
  const filteredChapterPdfs = chapterView.resources.pdfs.filter(
    resourceMatchesTopicContext,
  );
  const filteredChapterNotes = chapterView.resources.notes.filter(
    resourceMatchesTopicContext,
  );
  const filteredChapterTopicTests = chapterView.resources.topicTests.filter(
    resourceMatchesTopicContext,
  );
  const filteredChapterQuizzes = chapterView.resources.quizzes.filter(
    resourceMatchesTopicContext,
  );

  const chapterTestsAndQuizzes = [
    ...filteredChapterTopicTests.map((item) => ({
      ...item,
      __type: "topicTest",
    })),
    ...filteredChapterQuizzes.map((item) => ({ ...item, __type: "quiz" })),
  ];

  const chapterTabItems = {
    videos: filteredChapterVideos,
    pdfs: filteredChapterPdfs,
    notes: filteredChapterNotes,
    tests: chapterTestsAndQuizzes,
  };

  const chapterActiveItems = chapterTabItems[chapterView.activeTab] || [];
  const chapterActiveTabConfig =
    CHAPTER_CONTENT_TABS.find((tab) => tab.id === chapterView.activeTab) ||
    CHAPTER_CONTENT_TABS[0];

  const getChapterTabCount = (tabId) => {
    return (chapterTabItems[tabId] || []).length;
  };

  const getResourceTitle = (item, tabId) => {
    if (tabId === "tests" && item.__type === "topicTest") {
      return `Test Link #${item.testId || item.test_id || getEntityId(item)}`;
    }
    return item.title || item.name || item.slug || "Untitled";
  };

  const getResourceUrl = (item, tabId) => {
    if (tabId === "videos")
      return item.videoUrl || item.video_url || item.url || "";
    if (tabId === "pdfs" || tabId === "notes")
      return item.pdfUrl || item.pdf_url || item.url || "";
    return "";
  };

  const getResourceMeta = (item, tabId) => {
    const tags = [];
    if (tabId === "videos" && item.duration) tags.push(`${item.duration} min`);
    if ((tabId === "pdfs" || tabId === "notes") && item.pages)
      tags.push(`${item.pages} pages`);
    if ((tabId === "pdfs" || tabId === "notes") && item.fileSize)
      tags.push(`${item.fileSize} KB`);
    if (tabId === "tests" && item.__type === "topicTest") {
      if (item.testType || item.test_type)
        tags.push(`Type: ${item.testType || item.test_type}`);
      if (item.testId || item.test_id)
        tags.push(`Test ID: ${item.testId || item.test_id}`);
    }
    if (tabId === "tests" && item.__type === "quiz") {
      if (item.topic) tags.push(`Topic: ${item.topic}`);
      if (item.difficulty) tags.push(`Difficulty: ${item.difficulty}`);
      if (item.duration) tags.push(`${item.duration} min`);
    }
    if (item.isPro) tags.push("Pro");
    return tags;
  };

  const renderHierarchyView = () => {
    const exportJSON = () => {
      const dataToExport = {
        subject: selectedSubject,
        hierarchy: hierarchyTree,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedSubject?.slug || "hierarchy"}_curriculum.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const exportHTML = () => {
      const style = `
                body { font-family: sans-serif; padding: 40px; background: #f8fafc; color: #1e293b; line-height: 1.5; }
                .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                h1 { margin: 0 0 10px; color: #0f172a; }
                .node { margin-left: 20px; border-left: 2px solid #e2e8f0; padding-left: 20px; margin-top: 10px; }
                .node-title { font-weight: bold; color: #4f46e5; }
                .type { font-size: 0.7rem; text-transform: uppercase; color: #64748b; margin-right: 8px; font-weight: 800; }
                .meta { font-size: 0.8rem; color: #94a3b8; margin-top: 4px; }
            `;

      const renderNode = (type, item, children = "") => `
                <div class="node">
                    <div><span class="type">${type}</span><span class="node-title">${item.name || item.title}</span></div>
                    <div class="meta">ID: ${getEntityId(item)} | Slug: ${item.slug || "N/A"}</div>
                    ${children}
                </div>
            `;

      const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Curriculum Export - ${selectedSubject?.name}</title>
                    <style>${style}</style>
                </head>
                <body>
                    <div class="card">
                        <h1>${selectedSubject?.name}</h1>
                        <p>Hierarchy Export | Generated: ${new Date().toLocaleString()}</p>
                    </div>
                    ${hierarchyTree.units
                      .map((u) =>
                        renderNode(
                          "Unit",
                          u,
                          u.chapters
                            .map((c) =>
                              renderNode(
                                "Chapter",
                                c,
                                c.topics
                                  .map((t) =>
                                    renderNode(
                                      "Topic",
                                      t,
                                      t.subtopics
                                        .map((st) => renderNode("Subtopic", st))
                                        .join(""),
                                    ),
                                  )
                                  .join(""),
                              ),
                            )
                            .join(""),
                        ),
                      )
                      .join("")}
                    ${hierarchyTree.directChapters
                      .map((c) =>
                        renderNode(
                          "Chapter",
                          c,
                          c.topics
                            .map((t) =>
                              renderNode(
                                "Topic",
                                t,
                                t.subtopics
                                  .map((st) => renderNode("Subtopic", st))
                                  .join(""),
                              ),
                            )
                            .join(""),
                        ),
                      )
                      .join("")}
                </body>
                </html>
            `;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedSubject?.slug || "hierarchy"}_view.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    if (!selectedSubjectId) {
      return (
        <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
          <ListTree className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <h4 className="text-gray-700 dark:text-gray-300 font-medium">
            Select Target Subject
          </h4>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Choose a subject from the filter above to visualize parts, units,
            chapters, topics, and subtopics.
          </p>
        </div>
      );
    }

    const hasHierarchy =
      (hierarchyTree.units?.length || 0) > 0 ||
      (hierarchyTree.directChapters?.length || 0) > 0;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Curriculum Stats
            </h4>
            <div className="h-4 w-px bg-gray-200"></div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selectedSubject?.name} Structure
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-xs font-bold transition-all shadow-sm"
              title="Download raw curriculum data as JSON"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
            <button
              onClick={exportHTML}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold transition-all shadow-sm"
              title="Download formatted hierarchy view as HTML"
            >
              <Download className="w-3.5 h-3.5" /> Export View (HTML)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-400 font-semibold">
              Parts
            </div>
            <div className="text-xl font-bold text-indigo-900">
              {filteredParts.length}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold">
              Units
            </div>
            <div className="text-xl font-bold text-blue-900">
              {filteredUnits.length}
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold">
              Chapters
            </div>
            <div className="text-xl font-bold text-emerald-900">
              {filteredChapters.length}
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold">
              Topics
            </div>
            <div className="text-xl font-bold text-amber-900">
              {filteredTopics.length}
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-purple-700 dark:text-purple-400 font-semibold">
              Subtopics
            </div>
            <div className="text-xl font-bold text-purple-900">
              {filteredSubtopics.length}
            </div>
          </div>
        </div>

        {!hasHierarchy ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            <Folder className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <h4 className="text-gray-700 dark:text-gray-300 font-medium">
              No Hierarchy Data
            </h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              No linked parts/units/chapters/topics/subtopics were found for{" "}
              <span className="font-semibold">
                {selectedSubject?.name || "selected subject"}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(hierarchyTree.units || []).map((unit, uIdx) => {
              const unitId = getEntityId(unit);
              const isUnitOpen = !collapsedGroups[`unit-${unitId}`];
              const unitOrder = unit.orderIndex || unit.order_index || uIdx + 1;
              return (
                <div
                  key={unitId}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800"
                >
                  <div
                    className="cursor-pointer px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 flex items-center justify-between"
                    onClick={() =>
                      setCollapsedGroups((p) => ({
                        ...p,
                        [`unit-${unitId}`]: isUnitOpen,
                      }))
                    }
                  >
                    <div className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                      {isUnitOpen ? (
                        <ChevronDown className="w-4 h-4 text-blue-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-blue-500" />
                      )}
                      <span>{getLevelEmoji("units")}</span>
                      <span>
                        <strong className="text-blue-700 dark:text-blue-300">
                          Unit {unitOrder}:
                        </strong>{" "}
                        {unit.name || unit.title}
                      </span>
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-100 rounded-full px-2 py-0.5">
                      {unit.chapters.length} chapters
                    </div>
                  </div>
                  {isUnitOpen && (
                    <div className="p-3 space-y-2">
                      {unit.chapters.length === 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                          No chapters inside this unit.
                        </div>
                      )}

                      {unit.chapters.map((chapter, cIdx) => {
                        const chapId = getEntityId(chapter);
                        const isChapOpen = !collapsedGroups[`chap-${chapId}`];
                        const chapOrder =
                          chapter.orderIndex || chapter.order_index || cIdx + 1;
                        return (
                          <div
                            key={chapId}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                          >
                            <div
                              className="cursor-pointer px-3 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between"
                              onClick={() =>
                                setCollapsedGroups((p) => ({
                                  ...p,
                                  [`chap-${chapId}`]: isChapOpen,
                                }))
                              }
                            >
                              <div className="font-medium text-emerald-900 flex items-center gap-2">
                                {isChapOpen ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-emerald-500" />
                                )}
                                <span>{getLevelEmoji("chapters")}</span>
                                <span>
                                  <strong className="text-emerald-700 dark:text-emerald-300">
                                    Chapter {chapOrder}:
                                  </strong>{" "}
                                  {chapter.title || chapter.name}
                                </span>
                              </div>
                              <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-800 border border-emerald-100 rounded-full px-2 py-0.5">
                                {chapter.topics.length} topics
                              </div>
                            </div>
                            {isChapOpen && (
                              <div className="p-3 space-y-2 bg-white dark:bg-gray-800">
                                {chapter.topics.length === 0 && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                    No topics inside this chapter.
                                  </div>
                                )}

                                {chapter.topics.map((topic, tIdx) => {
                                  const topicId = getEntityId(topic);
                                  const isTopicOpen =
                                    !collapsedGroups[`topic-${topicId}`];
                                  const topicOrder =
                                    topic.orderIndex ||
                                    topic.order_index ||
                                    tIdx + 1;
                                  return (
                                    <div
                                      key={topicId}
                                      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                                    >
                                      <div
                                        className="cursor-pointer px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 flex items-center justify-between"
                                        onClick={() =>
                                          setCollapsedGroups((p) => ({
                                            ...p,
                                            [`topic-${topicId}`]: isTopicOpen,
                                          }))
                                        }
                                      >
                                        <div className="font-medium text-amber-900 flex items-center gap-2">
                                          {isTopicOpen ? (
                                            <ChevronDown className="w-4 h-4 text-amber-500" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-amber-500" />
                                          )}
                                          <span>{getLevelEmoji("topics")}</span>
                                          <span>
                                            <strong className="text-amber-700 dark:text-amber-300">
                                              Topic {topicOrder}:
                                            </strong>{" "}
                                            {topic.name || topic.title}
                                          </span>
                                        </div>
                                        <div className="text-xs text-amber-700 dark:text-amber-400 bg-white dark:bg-gray-800 border border-amber-100 rounded-full px-2 py-0.5">
                                          {topic.subtopics.length} subtopics
                                        </div>
                                      </div>
                                      {isTopicOpen && (
                                        <div className="p-2 space-y-1 bg-white dark:bg-gray-800">
                                          {topic.subtopics.length === 0 && (
                                            <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                              No subtopics inside this topic.
                                            </div>
                                          )}
                                          {topic.subtopics.map(
                                            (subtopic, stIdx) => {
                                              const subtopicOrder =
                                                subtopic.orderIndex ||
                                                subtopic.order_index ||
                                                stIdx + 1;
                                              return (
                                                <div
                                                  key={getEntityId(subtopic)}
                                                  className="px-3 py-2 rounded-md bg-purple-50 border border-purple-100 text-sm text-purple-900 flex items-center gap-2"
                                                >
                                                  <span>
                                                    {getLevelEmoji("subtopics")}
                                                  </span>
                                                  <span>
                                                    <strong className="text-purple-700 dark:text-purple-300">
                                                      Subtopic {subtopicOrder}:
                                                    </strong>{" "}
                                                    {subtopic.name ||
                                                      subtopic.title}
                                                  </span>
                                                </div>
                                              );
                                            },
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {hierarchyTree.directChapters.length > 0 &&
              (() => {
                const directId = "direct-chapters";
                const isDirectOpen = !collapsedGroups[directId];
                return (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                    <div
                      className="cursor-pointer px-4 py-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
                      onClick={() =>
                        setCollapsedGroups((p) => ({
                          ...p,
                          [directId]: isDirectOpen,
                        }))
                      }
                    >
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {isDirectOpen ? (
                          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        )}
                        <span>{getLevelEmoji("chapters")}</span>
                        <span>Direct / Unlinked Chapters</span>
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                        {hierarchyTree.directChapters.length} chapters
                      </div>
                    </div>
                    {isDirectOpen && (
                      <div className="p-3 space-y-2">
                        {hierarchyTree.directChapters.map((chapter) => (
                          <div
                            key={getEntityId(chapter)}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900"
                          >
                            <div className="font-medium text-gray-900 dark:text-white flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span>{getLevelEmoji("chapters")}</span>
                                <span>{chapter.title || chapter.name}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {chapter.topics.length} topics
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Global Subject Selector — one row on mobile */}
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-row items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
            Tiered Curriculum Builder
          </h2>
          <p className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-tight line-clamp-2 sm:line-clamp-none">
            Select a Subject to manage its internal hierarchy.
          </p>
        </div>

        {/* Target Subject — filter logo + name only on mobile (label hidden to save space) */}
        <div
          ref={subjectDropdownRef}
          className="flex relative items-center gap-1.5 md:gap-3 bg-white dark:bg-gray-800 pl-2 pr-2.5 md:pl-3 md:pr-4 py-1.5 md:py-2.5 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 max-w-[52vw] md:max-w-none md:w-[300px] hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all group"
        >
          <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 shadow-sm transition-all">
            <Filter className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-[11px] font-black tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 leading-none">
                Target Subject
              </span>
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 text-[10px] font-black leading-none">
                {data.subjects.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSubjectDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-1 md:-ml-1 md:mt-0.5 text-left group/btn outline-none focus:outline-none focus:ring-0"
            >
              <span className="text-xs md:text-[13px] font-bold text-gray-900 dark:text-white truncate pr-1">
                {selectedSubject ? selectedSubject.name : "All Subjects"}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 dark:text-gray-500 shrink-0 transition-transform duration-200 ${subjectDropdownOpen ? "rotate-180 text-gray-600 dark:text-gray-300" : "group-hover/btn:text-gray-600"}`}
              />
            </button>
          </div>

          {subjectDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 md:mt-3 w-[74vw] max-w-[300px] md:w-[320px] bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl shadow-gray-300/30 dark:shadow-black/30 overflow-hidden z-50 animate-fade-in">
              {/* List — compact, no search */}
              <div className="max-h-[52vh] md:max-h-[320px] overflow-y-auto p-1.5 md:p-2 space-y-0.5 md:space-y-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId("");
                    setSubjectDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-2 md:py-2.5 rounded-lg md:rounded-xl text-left transition border outline-none focus:outline-none focus:ring-0 ${!selectedSubjectId ? "bg-gray-100 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600" : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border-transparent hover:border-gray-100 dark:hover:border-gray-700"}`}
                >
                  <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Layers className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs md:text-sm font-bold truncate ${!selectedSubjectId ? "text-gray-900 dark:text-white" : "text-gray-900 dark:text-white"}`}
                    >
                      All Subjects
                    </div>
                    <div className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 truncate">
                      {data.subjects.length} subjects
                    </div>
                  </div>
                  {!selectedSubjectId && (
                    <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-700 dark:text-gray-300 shrink-0" />
                  )}
                </button>

                {filteredSubjectsForDropdown.map((sub) => {
                  const subId = String(getEntityId(sub));
                  const isSelected = subId === String(selectedSubjectId);
                  const accent = sub.color || paletteColorCB(sub.name);
                  return (
                    <button
                      key={subId}
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId(subId);
                        setSubjectDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-2 md:py-2.5 rounded-lg md:rounded-xl text-left transition border outline-none focus:outline-none focus:ring-0 ${isSelected ? "bg-gray-100 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600" : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border-transparent hover:border-gray-100 dark:hover:border-gray-700"}`}
                    >
                      <div
                        className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center text-[13px] md:text-[15px] shrink-0 border shadow-sm"
                        style={{
                          backgroundColor: `${accent}18`,
                          borderColor: `${accent}28`,
                        }}
                      >
                        {sub.icon || "📚"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs md:text-sm font-bold truncate ${isSelected ? "text-gray-900 dark:text-white" : "text-gray-900 dark:text-white"}`}
                        >
                          {sub.name}
                        </div>
                      </div>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-700 dark:text-gray-300 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                      )}
                    </button>
                  );
                })}

                {filteredSubjectsForDropdown.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-2">
                      <BookOpen className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      No subjects found
                    </p>
                    <p className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Create a subject first
                    </p>
                  </div>
                )}
              </div>

              <div className="p-1.5 md:p-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
                <span className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 px-1 font-medium">
                  {filteredSubjectsForDropdown.length} subjects
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId("");
                    setSubjectDropdownOpen(false);
                  }}
                  className="text-[11px] md:text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 md:px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition"
                >
                  Clear filter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hierarchy Tabs — pill with active background */}
      <div className="mx-3 sm:mx-4 mt-3 sm:mt-4 p-1 sm:p-1.5 bg-gray-100 dark:bg-gray-800/80 backdrop-blur rounded-2xl border border-gray-200/60 dark:border-gray-700/60 flex items-center gap-1 overflow-x-auto scrollbar-none shadow-sm">
        {HIERARCHY_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          // Count badge per tab — updates when Target Subject filter applied
          const countMap = {
            subjects: filteredSubjects.length,
            units: filteredUnits.length,
            chapters: filteredChapters.length,
            topics: filteredTopics.length,
            subtopics: filteredSubtopics.length,
            hierarchy: "-",
          };
          const count = countMap[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700/60"
              }`}
            >
              <span
                className={`${isActive ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
              >
                {tab.label}
              </span>
              {count !== "-" && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${isActive ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 sm:p-4 bg-white dark:bg-gray-800">
        <div className="flex flex-row justify-between items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white leading-tight truncate">
              {currentTabConfig.label}
            </h3>
            <p className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 leading-tight truncate">
              {currentTabConfig.desc}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeTab === "subjects" && (
              <button
                onClick={() => navigate("/admin/study-materials")}
                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 text-xs sm:text-sm font-medium whitespace-nowrap"
                title="Open full Study Materials page"
              >
                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />{" "}
                <span className="hidden sm:inline">Full Manager</span>
                <span className="sm:hidden">Full</span>
              </button>
            )}
            {["chapters", "topics", "subtopics"].includes(activeTab) &&
              selectedItemIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />{" "}
                  <span className="hidden sm:inline">
                    Trash Selected ({selectedItemIds.size})
                  </span>
                  <span className="sm:hidden">
                    Trash ({selectedItemIds.size})
                  </span>
                </button>
              )}
            {!["hierarchy"].includes(activeTab) && (
              <button
                onClick={() => handleAction(activeTab)}
                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm font-medium whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />{" "}
                <span className="hidden sm:inline">
                  Add {currentTabConfig.label.slice(0, -1)}
                </span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === "hierarchy" ? (
          renderHierarchyView()
        ) : activeData.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            <Folder className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <h4 className="text-gray-600 dark:text-gray-400 font-medium">
              No {currentTabConfig.label} Found
            </h4>
            {activeTab !== "subjects" && (
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                Click "Add" to create one.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(groupedData)
              .sort((a, b) => {
                // Sort groups by the parent entity's own orderIndex
                if (a.parentOrder !== b.parentOrder)
                  return a.parentOrder - b.parentOrder;
                // Tiebreak 1: natural sort by parent entity name ("Unit 1" < "Unit 2" < "Unit 10")
                const nameCmp = naturalCompare(
                  a.parentEntityName,
                  b.parentEntityName,
                );
                if (nameCmp !== 0) return nameCmp;
                // Tiebreak 2: numeric DB id
                return a.parentNumericId - b.parentNumericId;
              })
              .map((group) => {
                const isCollapsed =
                  forceInitialCollapse || collapsedGroups[group.id];
                return (
                  <div
                    key={group.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm"
                  >
                    {/* Group Header Toggle */}
                    <div
                      className={`px-3 md:px-4 py-2.5 md:py-3 font-semibold text-xs md:text-sm flex items-center justify-between gap-2 cursor-pointer transition-colors ${group.isOrphan ? "bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-100" : "bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                        )}
                        {["chapters", "topics", "subtopics"].includes(
                          activeTab,
                        ) && (
                          <input
                            type="checkbox"
                            checked={
                              group.items.length > 0 &&
                              group.items.every((item) =>
                                selectedItemIds.has(getEntityId(item)),
                              )
                            }
                            onChange={(e) => {
                              e.stopPropagation();
                              const next = new Set(selectedItemIds);
                              group.items.forEach((item) => {
                                const itemId = getEntityId(item);
                                if (e.target.checked) {
                                  next.add(itemId);
                                } else {
                                  next.delete(itemId);
                                }
                              });
                              setSelectedItemIds(next);
                            }}
                            className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                          />
                        )}
                        <span className="text-sm md:text-base leading-none shrink-0">
                          {group.isOrphan ? "⚠️" : getLevelEmoji(activeTab)}
                        </span>
                        <span className="truncate" title={group.name}>
                          {group.name}
                        </span>
                        {group.isOrphan && (
                          <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                            fix link
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] md:text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 border ${group.isOrphan ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800"}`}
                      >
                        {group.items.length} items
                      </span>
                    </div>

                    {/* Group Content (Rows) */}
                    {!isCollapsed && (
                      <div className="p-2 space-y-2 bg-white dark:bg-gray-800 flex flex-col">
                        {group.items.map((item) => (
                          <div
                            key={getEntityId(item)}
                            className="border border-gray-100 rounded-lg p-3 hover:shadow-md transition group/item flex justify-between items-center w-full bg-gray-50 dark:bg-gray-900/50"
                          >
                            <div className="flex items-center gap-4">
                              {["chapters", "topics", "subtopics"].includes(
                                activeTab,
                              ) && (
                                <input
                                  type="checkbox"
                                  checked={selectedItemIds.has(
                                    getEntityId(item),
                                  )}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const next = new Set(selectedItemIds);
                                    const itemId = getEntityId(item);
                                    if (e.target.checked) {
                                      next.add(itemId);
                                    } else {
                                      next.delete(itemId);
                                    }
                                    setSelectedItemIds(next);
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                                />
                              )}
                              <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 overflow-hidden">
                                {(() => {
                                  const iconValue = String(
                                    item.icon || item.thumbnail || "",
                                  ).trim();
                                  if (!iconValue) {
                                    return (
                                      <span className="text-xl">
                                        {getLevelEmoji(activeTab)}
                                      </span>
                                    );
                                  }
                                  if (
                                    iconValue.startsWith("http") ||
                                    iconValue.startsWith("/") ||
                                    iconValue.startsWith("data:")
                                  ) {
                                    return (
                                      <img
                                        loading="lazy"
                                        decoding="async"
                                        src={iconValue}
                                        alt="icon"
                                        className="w-full h-full object-cover"
                                      />
                                    );
                                  }
                                  const iconKey = iconValue.toLowerCase();
                                  const mappedEmoji =
                                    ICON_NAME_TO_EMOJI[iconKey];
                                  const looksLikeKeyword =
                                    /^[a-z0-9\-_ ]+$/i.test(iconValue);
                                  return (
                                    <span className="text-xl">
                                      {mappedEmoji ||
                                        (looksLikeKeyword
                                          ? getLevelEmoji(activeTab)
                                          : iconValue)}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                                  {item.name || item.title}
                                </h4>
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                                  {item.slug}
                                </p>
                              </div>
                            </div>

                            {/* Actions */}
                            {!["hierarchy"].includes(activeTab) && (
                              <div className="flex gap-2 opacity-0 group-hover/item:opacity-100 transition px-2">
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleAction(activeTab, item);
                                  }}
                                  className="p-2 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:text-indigo-400 rounded-lg"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDelete(activeTab, item);
                                  }}
                                  className="p-2 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:text-red-400 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Chapter Page Modal */}
      {chapterView.open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in"
            onClick={closeChapterView}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-indigo-50 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                    {chapterView.subject?.name || "Subject"}
                  </p>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-2">
                    <span>{getLevelEmoji("chapters")}</span>
                    <span>
                      {chapterView.chapter?.title ||
                        chapterView.chapter?.name ||
                        "Chapter"}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {(chapterView.topics || []).length} topics and{" "}
                    {(chapterView.topics || []).reduce(
                      (sum, topic) => sum + (topic.subtopics || []).length,
                      0,
                    )}{" "}
                    subtopics
                  </p>
                </div>
                <button
                  onClick={closeChapterView}
                  className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300 hover:bg-white dark:bg-gray-800 border border-transparent hover:border-gray-200 dark:border-gray-700 transition"
                  aria-label="Close chapter page"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4 overflow-y-auto">
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                    Topics
                  </h4>

                  {chapterView.topics.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                      No topics linked to this chapter yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chapterView.topics.map((topic) => {
                        const topicId = String(getEntityId(topic));
                        const isTopicSelected =
                          chapterView.selectedTopicId === topicId;
                        const subtopics = topic.subtopics || [];

                        return (
                          <div
                            key={getEntityId(topic)}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-2"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setChapterView((prev) => ({
                                  ...prev,
                                  selectedTopicId: topicId,
                                  selectedSubtopicId: "",
                                }))
                              }
                              className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center justify-between gap-2 ${isTopicSelected ? "bg-amber-50 text-amber-900 font-semibold" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"}`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span>{getLevelEmoji("topics")}</span>
                                <span className="truncate">
                                  {topic.name || topic.title}
                                </span>
                              </span>
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                {subtopics.length}
                              </span>
                            </button>

                            {isTopicSelected && (
                              <div className="mt-2 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-1">
                                {subtopics.length === 0 ? (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                                    No subtopics
                                  </div>
                                ) : (
                                  subtopics.map((subtopic) => {
                                    const subtopicId = String(
                                      getEntityId(subtopic),
                                    );
                                    const isSubtopicSelected =
                                      chapterView.selectedSubtopicId ===
                                      subtopicId;
                                    return (
                                      <button
                                        key={getEntityId(subtopic)}
                                        type="button"
                                        onClick={() =>
                                          setChapterView((prev) => ({
                                            ...prev,
                                            selectedTopicId: topicId,
                                            selectedSubtopicId:
                                              isSubtopicSelected
                                                ? ""
                                                : subtopicId,
                                          }))
                                        }
                                        className={`w-full text-left px-2 py-1 rounded-md text-xs flex items-center gap-2 ${isSubtopicSelected ? "bg-purple-50 text-purple-900 font-semibold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"}`}
                                      >
                                        <span>
                                          {getLevelEmoji("subtopics")}
                                        </span>
                                        <span className="truncate">
                                          {subtopic.name || subtopic.title}
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </aside>

                <section className="flex flex-col min-h-0">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800">
                        Chapter:{" "}
                        {chapterView.chapter?.title ||
                          chapterView.chapter?.name ||
                          "N/A"}
                      </span>
                      {selectedChapterTopic && (
                        <span className="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 text-amber-800">
                          Topic:{" "}
                          {selectedChapterTopic.name ||
                            selectedChapterTopic.title}
                        </span>
                      )}
                      {selectedChapterSubtopic && (
                        <span className="px-2 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-800">
                          Subtopic:{" "}
                          {selectedChapterSubtopic.name ||
                            selectedChapterSubtopic.title}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 overflow-x-auto">
                      {CHAPTER_CONTENT_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = chapterView.activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() =>
                              setChapterView((prev) => ({
                                ...prev,
                                activeTab: tab.id,
                              }))
                            }
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition ${isActive ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"}`}
                          >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                            <span
                              className={`text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white dark:bg-gray-800/20 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}
                            >
                              {getChapterTabCount(tab.id)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50">
                    {chapterView.loading ? (
                      <div className="h-full min-h-52 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                    ) : chapterActiveItems.length === 0 ? (
                      <div className="h-full min-h-52 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl mb-2">
                            {getLevelEmoji("chapters")}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {chapterActiveTabConfig.emptyText}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {chapterActiveItems.map((item, index) => {
                          const tabId = chapterView.activeTab;
                          const url = getResourceUrl(item, tabId);
                          const metaTags = getResourceMeta(item, tabId);
                          const title = getResourceTitle(item, tabId);
                          const itemId =
                            getEntityId(item) ||
                            item.testId ||
                            item.test_id ||
                            `${tabId}-${index}`;
                          const createdAt = item.createdAt || item.created_at;

                          return (
                            <div
                              key={`${tabId}-${item.__type || "resource"}-${itemId}-${index}`}
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-4"
                            >
                              {/* Reorder Controls */}
                              {["videos", "pdfs", "tests", "notes"].includes(
                                tabId,
                              ) &&
                                item.__type !== "quiz" && (
                                  <div className="flex flex-col gap-1 justify-center shrink-0 border-r border-gray-100 pr-3">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorderResource(
                                          "up",
                                          item,
                                          index,
                                        );
                                      }}
                                      disabled={index === 0}
                                      className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 transition-colors ${index === 0 ? "text-gray-200 cursor-not-allowed" : "text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400"}`}
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorderResource(
                                          "down",
                                          item,
                                          index,
                                        );
                                      }}
                                      disabled={
                                        index === chapterActiveItems.length - 1
                                      }
                                      className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 transition-colors ${index === chapterActiveItems.length - 1 ? "text-gray-200 cursor-not-allowed" : "text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400"}`}
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}

                              <div className="flex-1 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h5 className="font-semibold text-gray-900 dark:text-white truncate">
                                    {title}
                                  </h5>
                                  {item.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {tabId === "tests" && (
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full border ${item.__type === "quiz" ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 text-indigo-700 dark:text-indigo-400" : "bg-green-50 dark:bg-green-900/20 border-green-100 text-green-700 dark:text-green-400"}`}
                                      >
                                        {item.__type === "quiz"
                                          ? "Quiz"
                                          : "Topic Test"}
                                      </span>
                                    )}
                                    {metaTags.map((tag, tagIndex) => (
                                      <span
                                        key={`${itemId}-tag-${tagIndex}`}
                                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Open
                                  </a>
                                )}
                                {tabId === "tests" && (
                                  <button
                                    onClick={() => {
                                      const tId =
                                        item.testId ||
                                        item.test_id ||
                                        getEntityId(item);
                                      if (item.__type === "quiz") {
                                        navigate(
                                          `/admin/practice?testId=${tId}`,
                                        );
                                      } else {
                                        navigate(`/admin/tests?testId=${tId}`);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Manage Test
                                  </button>
                                )}
                              </div>

                              {createdAt && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                                  Added: {new Date(createdAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* General Modal */}
      {modalConfig &&
        !["subjects", "hierarchy"].includes(activeTab) &&
        typeof document !== "undefined" &&
        createPortal(
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
                      {(selectedSubjectId
                        ? filteredSubjects
                        : data.subjects
                      ).map((s) => (
                        <option key={getEntityId(s)} value={getEntityId(s)}>
                          {s.name}
                        </option>
                      ))}
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
                      {(selectedSubjectId
                        ? filteredSubjects
                        : data.subjects
                      ).map((s) => (
                        <option key={getEntityId(s)} value={getEntityId(s)}>
                          {s.name}
                        </option>
                      ))}
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
                        {(selectedSubjectId
                          ? filteredSubjects
                          : data.subjects
                        ).map((s) => (
                          <option key={getEntityId(s)} value={getEntityId(s)}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Inside a Unit">
                        {(selectedSubjectId ? filteredUnits : data.units).map(
                          (u) => (
                            <option key={getEntityId(u)} value={getEntityId(u)}>
                              {u.name}
                            </option>
                          ),
                        )}
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
                      {(selectedSubjectId
                        ? filteredChapters
                        : data.chapters
                      ).map((c) => (
                        <option key={getEntityId(c)} value={getEntityId(c)}>
                          {c.title || c.name}
                        </option>
                      ))}
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
                      {(selectedSubjectId ? filteredTopics : data.topics).map(
                        (t) => (
                          <option key={getEntityId(t)} value={getEntityId(t)}>
                            {t.name || t.title}
                          </option>
                        ),
                      )}
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
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-"),
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
        )}
    </div>
  );
}

export default memo(CurriculumBuilder);
