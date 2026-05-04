import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
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
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { useNavigate } from "react-router-dom";

// Toast notification component
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all animate-slide-in ${type === "success"
        ? "bg-green-500 text-white"
        : type === "error"
          ? "bg-red-500 text-white"
          : "bg-blue-500 text-white"
        }`}
    >
      {type === "success" ? (
        <CheckCircle className="w-5 h-5" />
      ) : type === "error" ? (
        <AlertCircle className="w-5 h-5" />
      ) : (
        <AlertCircle className="w-5 h-5" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const HIERARCHY_TABS = [
  { id: "subjects", label: "Subjects", desc: "Root subjects for curriculum hierarchy" },
  { id: "parts", label: "Parts", desc: "Optional main divisions of a subject" },
  {
    id: "units",
    label: "Units",
    desc: "Sub-divisions within parts or subjects",
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
  return normalizeId(entity.id) === strParentId ||
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
    normalizeId(entity.topic_id) === strParentId;
};
const toSet = (items, mapper) => new Set(items.map(mapper).filter(Boolean));

const getPartSubjectId = (part) => part?.subjectId ?? part?.subject_id;
const getUnitPartId = (unit) => unit?.partId ?? unit?.part_id;
const getChapterUnitId = (chapter) => chapter?.unitId ?? chapter?.unit_id;
const getChapterSubjectId = (chapter) =>
  chapter?.studyMaterialId ?? chapter?.study_material_id;
const getTopicChapterId = (topic) => topic?.chapterId ?? topic?.chapter_id;
const getSubtopicTopicId = (subtopic) =>
  subtopic?.topicId ?? subtopic?.topic_id;
const getOrderIndex = (item) => item?.orderIndex ?? item?.order_index ?? 0;

// Natural sort comparator: handles embedded numbers correctly ("Unit 2" < "Unit 10")
const naturalCompare = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });

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

export default function CurriculumBuilder() {
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

  // Toast state (CU-03 fix)
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);
  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  // Slug validation state (CU-04 fix)
  const [slugError, setSlugError] = useState("");

  // Reorder state (CB2 fix)
  const [reorderLoading, setReorderLoading] = useState(new Set());

  // Global filter - curriculum builder revolves around a specific subject, '' means All Subjects
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  // Collapse state for grouping headers
  // FIX BUG [CURR-LOW]: Persist expanded/collapsed state across re-renders using localStorage
  // FIX BUG [CURR-LOW]: Persist expanded/collapsed state across re-renders using localStorage
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('curriculum-collapsed-groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist collapsed state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('curriculum-collapsed-groups', JSON.stringify(collapsedGroups));
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
  // match regardless of whether parts stored the numeric id or the public_id.
  const selectedSubjectIdSet = useMemo(() => {
    if (!selectedSubjectId) return new Set();
    const subject = data.subjects.find((s) => entityMatchesParentId(s, selectedSubjectId));
    const ids = [
      selectedSubjectId,
      subject?.id,
      subject?._id,
      subject?.public_id,
    ].filter(Boolean).map(normalizeId);
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
    // Build multi-id set for each matched part
    const partIdSet = new Set();
    filteredParts.forEach((p) => {
      [p.id, p._id, p.public_id].filter(Boolean).forEach((v) => partIdSet.add(normalizeId(v)));
    });
    return data.units.filter((u) => partIdSet.has(normalizeId(getUnitPartId(u))));
  }, [data.units, filteredParts, selectedSubjectId]);

  const filteredChapters = useMemo(() => {
    if (!selectedSubjectId) return data.chapters;
    const unitIdSet = new Set();
    filteredUnits.forEach((u) => {
      [u.id, u._id, u.public_id].filter(Boolean).forEach((v) => unitIdSet.add(normalizeId(v)));
    });
    return data.chapters.filter((c) => {
      const byUnit = unitIdSet.has(normalizeId(getChapterUnitId(c)));
      const byDirectSubject = selectedSubjectIdSet.has(normalizeId(getChapterSubjectId(c)));
      return byUnit || byDirectSubject;
    });
  }, [data.chapters, filteredUnits, selectedSubjectId, selectedSubjectIdSet]);

  const filteredTopics = useMemo(() => {
    if (!selectedSubjectId) return data.topics;
    const chapterIdSet = new Set();
    filteredChapters.forEach((c) => {
      [c.id, c._id, c.public_id].filter(Boolean).forEach((v) => chapterIdSet.add(normalizeId(v)));
    });
    return data.topics.filter((t) =>
      chapterIdSet.has(normalizeId(getTopicChapterId(t))),
    );
  }, [data.topics, filteredChapters, selectedSubjectId]);

  const filteredSubtopics = useMemo(() => {
    if (!selectedSubjectId) return data.subtopics;
    const topicIdSet = new Set();
    filteredTopics.forEach((t) => {
      [t.id, t._id, t.public_id].filter(Boolean).forEach((v) => topicIdSet.add(normalizeId(v)));
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

    const unitsByPart = new Map();
    sortedUnits.forEach((unit) => {
      const partId = normalizeId(getUnitPartId(unit));
      if (!unitsByPart.has(partId)) unitsByPart.set(partId, []);
      unitsByPart.get(partId).push(unit);
    });

    const parts = sortedParts.map((part) => {
      const partId = normalizeId(getEntityId(part));
      const units = (unitsByPart.get(partId) || []).map((unit) => {
        const unitId = normalizeId(getEntityId(unit));
        const chapters = (chaptersByUnit.get(unitId) || []).map((chapter) => {
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
        return { ...unit, chapters };
      });
      return { ...part, units };
    });

    const directChapters = sortedChapters
      .filter((chapter) => !normalizeId(getChapterUnitId(chapter)))
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

    return { parts, directChapters };
  }, [
    selectedSubjectId,
    filteredParts,
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
      const pdfType = (pdf.type || pdf.pdfType || pdf.fileType || "").toLowerCase();
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
      tests: "topicTests"
    };

    // Quizzes are not reorderable via this endpoint
    if (tabId === "tests" && item.__type === "quiz") {
      showToast("Quizzes cannot be reordered here", "info");
      return;
    }

    const resourceKey = resourceKeyMapping[tabId];
    const fullItems = [...chapterView.resources[resourceKey]];

    // Find absolute index in the full list
    const actualIndex = fullItems.findIndex(i => {
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
    if (direction === "down" && visibleIndex === chapterActiveItems.length - 1) return;

    const neighborVisibleItem = chapterActiveItems[direction === "up" ? visibleIndex - 1 : visibleIndex + 1];
    if (!neighborVisibleItem) return;

    const neighborActualIndex = fullItems.findIndex(i => {
      const id1 = getEntityId(i) || i.testId || i.test_id;
      const id2 = getEntityId(neighborVisibleItem) || neighborVisibleItem.testId || neighborVisibleItem.test_id;
      return id1 === id2;
    });

    if (neighborActualIndex === -1) return;

    // Optimistic Swap in fullItems
    const newFullItems = [...fullItems];
    [newFullItems[actualIndex], newFullItems[neighborActualIndex]] = [newFullItems[neighborActualIndex], newFullItems[actualIndex]];

    // Recalculate derived notes if needed
    let newNotes = chapterView.resources.notes;
    if (resourceKey === "pdfs") {
      const noteKeywords = ["note", "notes", "handout", "class note", "lecture note"];
      newNotes = newFullItems.filter(pdf => {
        const pdfType = (pdf.type || pdf.pdfType || pdf.fileType || "").toLowerCase();
        if (pdfType === "note" || pdfType === "notes" || pdfType === "handout") return true;
        const hay = normalizeText(`${pdf.title || ""} ${pdf.description || ""} ${pdf.slug || ""}`);
        return includesAny(hay, noteKeywords);
      });
    }

    setChapterView(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        [resourceKey]: newFullItems,
        notes: newNotes
      }
    }));

    try {
      const endpointMapping = {
        videos: "subject-videos",
        pdfs: "subject-pdfs",
        notes: "subject-pdfs",
        tests: "topic-tests"
      };
      const endpoint = endpointMapping[tabId];
      const movedItemId = getEntityId(item) || item.id || item._id;
      const neighborItemId = getEntityId(neighborVisibleItem) || neighborVisibleItem.id || neighborVisibleItem.id;

      // Swap their display_order values in backend
      // Note: Backend handles the conversion from camelCase displayOrder to snake_case display_order
      await Promise.all([
        apiClient.put(`/admin/${endpoint}/${movedItemId}/reorder`, { order: neighborActualIndex }),
        apiClient.put(`/admin/${endpoint}/${neighborItemId}/reorder`, { order: actualIndex })
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
      if (tabId === "units") defaultParent = getUnitPartId(existingItem);
      if (tabId === "chapters")
        defaultParent =
          getChapterUnitId(existingItem) || getChapterSubjectId(existingItem);
      if (tabId === "topics") defaultParent = getTopicChapterId(existingItem);
      if (tabId === "subtopics")
        defaultParent = getSubtopicTopicId(existingItem);
    } else {
      // New item, set default parent if applicable
      if (selectedSubjectId) {
        if (tabId === "parts") defaultParent = selectedSubjectId;
        if (tabId === "chapters") defaultParent = selectedSubjectId; // default to the subject
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
      payload.partId = formData.parentId;
      if (!payload.partId) {
        showToast("Please select a Part.", "error");
        return;
      }
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
          showToast("The unit's parent part is not linked to a subject.", "error");
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
      const units = data.units.filter((u) => partIdSet.has(String(getUnitPartId(u))));
      const unitIdSet = new Set(units.map((u) => String(getEntityId(u))));
      const directChapters = data.chapters.filter((ch) => isSameId(getChapterSubjectId(ch), id));
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
      ? `Delete "${label}"?\n\nLoaded data shows dependents: ${summary}\n\nContinue?`
      : `Are you sure you want to delete "${label}"?`;
    if (!confirm(msg)) return;

    let url = "";
    if (tabId === "subjects") url = "/admin/subjects";
    if (tabId === "parts") url = "/admin/subject-parts";
    if (tabId === "units") url = "/admin/units";
    if (tabId === "chapters") url = "/admin/chapters";
    if (tabId === "topics") url = "/admin/topics";
    if (tabId === "subtopics") url = "/admin/subtopics";

    try {
      await apiClient.delete(`${url}/${getEntityId(item)}`);
      showToast(`${label} deleted successfully!`);
      loadData(true); // silent — no full-page spinner
    } catch (error) {
      console.error("Error deleting:", error);
      showToast("Failed to delete item.", "error");
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

  if (loading)
    return (
      <div className="p-12 text-center text-gray-500">
        Loading curriculum builder...
      </div>
    );

  // Which data is currently active? Sort by orderIndex so list views respect ordering.
  let activeData = [];
  if (activeTab === "subjects") activeData = sortByOrderAndId(filteredSubjects);
  if (activeTab === "parts") activeData = sortByOrderAndId(filteredParts);
  if (activeTab === "units") activeData = sortByOrderAndId(filteredUnits);
  if (activeTab === "chapters") activeData = sortByOrderAndId(filteredChapters);
  if (activeTab === "topics") activeData = sortByOrderAndId(filteredTopics);
  if (activeTab === "subtopics") activeData = sortByOrderAndId(filteredSubtopics);

  const currentTabConfig = HIERARCHY_TABS.find((t) => t.id === activeTab);

  // Render grouped lists!
  const groupItemsByParent = () => {
    const groups = {};

    // Helper: resolve parent entity and its orderIndex for a given tab + parentId
    const resolveParentOrder = (tab, pid) => {
      let entity = null;
      if (tab === "parts") entity = data.subjects.find((s) => entityMatchesParentId(s, pid));
      else if (tab === "units") entity = data.parts.find((p) => entityMatchesParentId(p, pid));
      else if (tab === "chapters") {
        entity = data.units.find((u) => entityMatchesParentId(u, pid));
        if (!entity) entity = data.subjects.find((s) => entityMatchesParentId(s, pid));
      }
      else if (tab === "topics") entity = data.chapters.find((c) => entityMatchesParentId(c, pid));
      else if (tab === "subtopics") entity = data.topics.find((t) => entityMatchesParentId(t, pid));
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
          data.subjects.find((s) => entityMatchesParentId(s, parentId))?.name || "Unknown Subject";
      } else if (activeTab === "units" && getUnitPartId(item)) {
        parentId = getUnitPartId(item);
        parentName =
          data.parts.find((p) => entityMatchesParentId(p, parentId))?.name || "Unknown Part";
      } else if (activeTab === "chapters") {
        if (getChapterUnitId(item)) {
          parentId = getChapterUnitId(item);
          parentName =
            data.units.find((u) => entityMatchesParentId(u, parentId))?.name || "Unknown Unit";
        } else if (getChapterSubjectId(item)) {
          parentId = getChapterSubjectId(item);
          parentName =
            data.subjects.find((s) => entityMatchesParentId(s, parentId))?.name || "Directly under Subject";
        }
      } else if (activeTab === "topics" && getTopicChapterId(item)) {
        parentId = getTopicChapterId(item);
        parentName =
          data.chapters.find((c) => entityMatchesParentId(c, parentId))?.title || "Unknown Chapter";
      } else if (activeTab === "subtopics" && getSubtopicTopicId(item)) {
        parentId = getSubtopicTopicId(item);
        parentName =
          data.topics.find((t) => entityMatchesParentId(t, parentId))?.name || "Unknown Topic";
      }

      const groupKey = `${parentName}-${parentId}`;
      if (!groups[groupKey]) {
        const { parentOrder, parentNumericId, parentEntityName } = resolveParentOrder(activeTab, parentId);
        groups[groupKey] = { id: groupKey, name: parentName, items: [], parentOrder, parentNumericId, parentEntityName };
      }
      groups[groupKey].items.push(item);
    });

    return groups;
  };

  const groupedData = activeTab === "hierarchy" ? {} : groupItemsByParent();

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
                    ${hierarchyTree.parts
          .map((p) =>
            renderNode(
              "Part",
              p,
              p.units
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
                                  .map((st) =>
                                    renderNode("Subtopic", st),
                                  )
                                  .join(""),
                              ),
                            )
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
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <ListTree className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <h4 className="text-gray-700 font-medium">Select Target Subject</h4>
          <p className="text-gray-500 text-sm mt-1">
            Choose a subject from the filter above to visualize parts, units,
            chapters, topics, and subtopics.
          </p>
        </div>
      );
    }

    const hasHierarchy =
      hierarchyTree.parts.length > 0 || hierarchyTree.directChapters.length > 0;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Curriculum Stats
            </h4>
            <div className="h-4 w-px bg-gray-200"></div>
            <span className="text-xs text-gray-500">
              {selectedSubject?.name} Structure
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition-all shadow-sm"
              title="Download raw curriculum data as JSON"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
            <button
              onClick={exportHTML}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-100 text-xs font-bold transition-all shadow-sm"
              title="Download formatted hierarchy view as HTML"
            >
              <Download className="w-3.5 h-3.5" /> Export View (HTML)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">
              Parts
            </div>
            <div className="text-xl font-bold text-indigo-900">
              {filteredParts.length}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-blue-700 font-semibold">
              Units
            </div>
            <div className="text-xl font-bold text-blue-900">
              {filteredUnits.length}
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
              Chapters
            </div>
            <div className="text-xl font-bold text-emerald-900">
              {filteredChapters.length}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-amber-700 font-semibold">
              Topics
            </div>
            <div className="text-xl font-bold text-amber-900">
              {filteredTopics.length}
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-purple-700 font-semibold">
              Subtopics
            </div>
            <div className="text-xl font-bold text-purple-900">
              {filteredSubtopics.length}
            </div>
          </div>
        </div>

        {!hasHierarchy ? (
          <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <Folder className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <h4 className="text-gray-700 font-medium">No Hierarchy Data</h4>
            <p className="text-gray-500 text-sm mt-1">
              No linked parts/units/chapters/topics/subtopics were found for{" "}
              <span className="font-semibold">
                {selectedSubject?.name || "selected subject"}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {hierarchyTree.parts.map((part) => {
              const partId = getEntityId(part);
              const isPartOpen = !collapsedGroups[`part-${partId}`];
              return (
                <div
                  key={partId}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                >
                  <div
                    className="cursor-pointer px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between"
                    onClick={() => setCollapsedGroups(p => ({ ...p, [`part-${partId}`]: isPartOpen }))}
                  >
                    <div className="font-semibold text-indigo-900 flex items-center gap-2">
                      {isPartOpen ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-indigo-500" />}
                      <span>{getLevelEmoji("parts")}</span>
                      <span>{part.name || part.title}</span>
                    </div>
                    <div className="text-xs text-indigo-700 bg-white border border-indigo-100 rounded-full px-2 py-0.5">
                      {part.units.length} units
                    </div>
                  </div>
                  {isPartOpen && (
                    <div className="p-3 space-y-2">
                      {part.units.length === 0 && (
                        <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                          No units inside this part.
                        </div>
                      )}

                      {part.units.map((unit) => {
                        const unitId = getEntityId(unit);
                        const isUnitOpen = !collapsedGroups[`unit-${unitId}`];
                        return (
                          <div
                            key={unitId}
                            className="border border-gray-200 rounded-lg overflow-hidden"
                          >
                            <div
                              className="cursor-pointer px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between"
                              onClick={() => setCollapsedGroups(p => ({ ...p, [`unit-${unitId}`]: isUnitOpen }))}
                            >
                              <div className="font-medium text-blue-900 flex items-center gap-2">
                                {isUnitOpen ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-blue-500" />}
                                <span>{getLevelEmoji("units")}</span>
                                <span>{unit.name || unit.title}</span>
                              </div>
                              <div className="text-xs text-blue-700 bg-white border border-blue-100 rounded-full px-2 py-0.5">
                                {unit.chapters.length} chapters
                              </div>
                            </div>
                            {isUnitOpen && (
                              <div className="p-3 space-y-2 bg-white">
                                {unit.chapters.length === 0 && (
                                  <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                                    No chapters inside this unit.
                                  </div>
                                )}

                                {unit.chapters.map((chapter) => {
                                  const chapId = getEntityId(chapter);
                                  const isChapOpen = !collapsedGroups[`chap-${chapId}`];
                                  return (
                                    <div
                                      key={chapId}
                                      className="border border-gray-200 rounded-lg overflow-hidden"
                                    >
                                      <div
                                        className="cursor-pointer px-3 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between"
                                        onClick={() => setCollapsedGroups(p => ({ ...p, [`chap-${chapId}`]: isChapOpen }))}
                                      >
                                        <div className="font-medium text-emerald-900 flex items-center gap-2">
                                          {isChapOpen ? <ChevronDown className="w-4 h-4 text-emerald-500" /> : <ChevronRight className="w-4 h-4 text-emerald-500" />}
                                          <span>{getLevelEmoji("chapters")}</span>
                                          <span>{chapter.title || chapter.name}</span>
                                        </div>
                                        <div className="text-xs text-emerald-700 bg-white border border-emerald-100 rounded-full px-2 py-0.5">
                                          {chapter.topics.length} topics
                                        </div>
                                      </div>
                                      {isChapOpen && (
                                        <div className="p-3 space-y-2 bg-white">
                                          {chapter.topics.length === 0 && (
                                            <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                                              No topics inside this chapter.
                                            </div>
                                          )}

                                          {chapter.topics.map((topic) => {
                                            const topicId = getEntityId(topic);
                                            const isTopicOpen = !collapsedGroups[`topic-${topicId}`];
                                            return (
                                              <div
                                                key={topicId}
                                                className="border border-gray-200 rounded-lg overflow-hidden"
                                              >
                                                <div
                                                  className="cursor-pointer px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between"
                                                  onClick={() => setCollapsedGroups(p => ({ ...p, [`topic-${topicId}`]: isTopicOpen }))}
                                                >
                                                  <div className="font-medium text-amber-900 flex items-center gap-2">
                                                    {isTopicOpen ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-amber-500" />}
                                                    <span>{getLevelEmoji("topics")}</span>
                                                    <span>{topic.name || topic.title}</span>
                                                  </div>
                                                  <div className="text-xs text-amber-700 bg-white border border-amber-100 rounded-full px-2 py-0.5">
                                                    {topic.subtopics.length} subtopics
                                                  </div>
                                                </div>
                                                {isTopicOpen && (
                                                  <div className="p-2 space-y-1 bg-white">
                                                    {topic.subtopics.length === 0 && (
                                                      <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                                                        No subtopics inside this topic.
                                                      </div>
                                                    )}
                                                    {topic.subtopics.map((subtopic) => (
                                                      <div
                                                        key={getEntityId(subtopic)}
                                                        className="px-3 py-2 rounded-md bg-purple-50 border border-purple-100 text-sm text-purple-900 flex items-center gap-2"
                                                      >
                                                        <span>
                                                          {getLevelEmoji("subtopics")}
                                                        </span>
                                                        <span>
                                                          {subtopic.name || subtopic.title}
                                                        </span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {hierarchyTree.directChapters.length > 0 && (() => {
              const directId = "direct-chapters";
              const isDirectOpen = !collapsedGroups[directId];
              return (
                <div
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                >
                  <div
                    className="cursor-pointer px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between"
                    onClick={() => setCollapsedGroups(p => ({ ...p, [directId]: isDirectOpen }))}
                  >
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {isDirectOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span>{getLevelEmoji("chapters")}</span>
                      <span>Direct Chapters Under Subject</span>
                    </div>
                    <div className="text-xs text-gray-700 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                      {hierarchyTree.directChapters.length} chapters
                    </div>
                  </div>
                  {isDirectOpen && (
                    <div className="p-3 space-y-2">
                      {hierarchyTree.directChapters.map((chapter) => (
                        <div
                          key={getEntityId(chapter)}
                          className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                        >
                          <div className="font-medium text-gray-900 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span>{getLevelEmoji("chapters")}</span>
                              <span>{chapter.title || chapter.name}</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Global Subject Selector */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Tiered Curriculum Builder
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Select a Subject to manage its internal hierarchy.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 border border-indigo-100 rounded-lg">
          <Filter className="w-5 h-5 text-indigo-600" />
          <div>
            <label className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
              Target Subject
            </label>
            <select
              className="bg-transparent text-sm font-bold text-gray-900 outline-none w-full md:w-56 cursor-pointer"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              <option value="">All Subjects</option>
              {data.subjects.map((sub) => (
                <option key={getEntityId(sub)} value={getEntityId(sub)}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex px-4 pt-4 space-x-2 border-b border-gray-100 bg-white overflow-x-auto">
        {HIERARCHY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === tab.id
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              {currentTabConfig.label}
            </h3>
            <p className="text-sm text-gray-500">{currentTabConfig.desc}</p>
          </div>
          <div className="flex gap-2">
            {activeTab === "subjects" && (
              <button
                onClick={() => navigate("/admin/subjects")}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium"
                title="Open full Subjects Manager page"
              >
                <ExternalLink className="w-4 h-4" /> Full Manager
              </button>
            )}
            {!["hierarchy"].includes(activeTab) && (
              <button
                onClick={() => handleAction(activeTab)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add{" "}
                {currentTabConfig.label.slice(0, -1)}
              </button>
            )}
          </div>
        </div>

        {activeTab === "hierarchy" ? (
          renderHierarchyView()
        ) : activeData.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <Folder className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <h4 className="text-gray-600 font-medium">
              No {currentTabConfig.label} Found
            </h4>
            {activeTab !== "subjects" && (
              <p className="text-gray-400 text-sm mt-1">
                Click "Add" to create one.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(groupedData)
              .sort((a, b) => {
                // Sort groups by the parent entity's own orderIndex
                if (a.parentOrder !== b.parentOrder) return a.parentOrder - b.parentOrder;
                // Tiebreak 1: natural sort by parent entity name ("Unit 1" < "Unit 2" < "Unit 10")
                const nameCmp = naturalCompare(a.parentEntityName, b.parentEntityName);
                if (nameCmp !== 0) return nameCmp;
                // Tiebreak 2: numeric DB id
                return a.parentNumericId - b.parentNumericId;
              })
              .map((group) => {
              const isCollapsed = collapsedGroups[group.id];
              return (
                <div
                  key={group.id}
                  className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                >
                  {/* Group Header Toggle */}
                  <div
                    className="bg-gray-50 px-4 py-3 font-semibold text-gray-800 text-sm flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-base leading-none">
                        {getLevelEmoji(activeTab)}
                      </span>
                      {group.name}
                    </div>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {group.items.length} items
                    </span>
                  </div>

                  {/* Group Content (Rows) */}
                  {!isCollapsed && (
                    <div className="p-2 space-y-2 bg-white flex flex-col">
                      {group.items.map((item) => (
                        <div
                          key={getEntityId(item)}
                          className="border border-gray-100 rounded-lg p-3 hover:shadow-md transition group/item flex justify-between items-center w-full bg-gray-50/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center text-indigo-600 shrink-0 overflow-hidden">
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
                                      src={iconValue}
                                      alt="icon"
                                      className="w-full h-full object-cover"
                                    />
                                  );
                                }
                                const iconKey = iconValue.toLowerCase();
                                const mappedEmoji = ICON_NAME_TO_EMOJI[iconKey];
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
                              <h4 className="font-bold text-gray-900 text-base leading-tight">
                                {item.name || item.title}
                              </h4>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">
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
                                className="p-2 bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-indigo-600 rounded-lg"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(activeTab, item);
                                }}
                                className="p-2 bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-red-600 rounded-lg"
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
      {chapterView.open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
          onClick={closeChapterView}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-indigo-50 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  {chapterView.subject?.name || "Subject"}
                </p>
                <h3 className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                  <span>{getLevelEmoji("chapters")}</span>
                  <span>
                    {chapterView.chapter?.title ||
                      chapterView.chapter?.name ||
                      "Chapter"}
                  </span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
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
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white border border-transparent hover:border-gray-200 transition"
                aria-label="Close chapter page"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="border-r border-gray-200 bg-gray-50/70 p-4 overflow-y-auto">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Topics
                </h4>

                {chapterView.topics.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-lg px-3 py-2">
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
                          className="border border-gray-200 rounded-lg bg-white p-2"
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
                            className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center justify-between gap-2 ${isTopicSelected ? "bg-amber-50 text-amber-900 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span>{getLevelEmoji("topics")}</span>
                              <span className="truncate">
                                {topic.name || topic.title}
                              </span>
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                              {subtopics.length}
                            </span>
                          </button>

                          {isTopicSelected && (
                            <div className="mt-2 pl-3 border-l border-gray-200 space-y-1">
                              {subtopics.length === 0 ? (
                                <div className="text-xs text-gray-500 px-2 py-1">
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
                                          selectedSubtopicId: isSubtopicSelected
                                            ? ""
                                            : subtopicId,
                                        }))
                                      }
                                      className={`w-full text-left px-2 py-1 rounded-md text-xs flex items-center gap-2 ${isSubtopicSelected ? "bg-purple-50 text-purple-900 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                                    >
                                      <span>{getLevelEmoji("subtopics")}</span>
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
                <div className="px-4 py-3 border-b border-gray-200 bg-white">
                  <div className="flex flex-wrap gap-2 text-xs mb-3">
                    <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800">
                      Chapter:{" "}
                      {chapterView.chapter?.title ||
                        chapterView.chapter?.name ||
                        "N/A"}
                    </span>
                    {selectedChapterTopic && (
                      <span className="px-2 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-800">
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
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition ${isActive ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                        >
                          <Icon className="w-4 h-4" />
                          {tab.label}
                          <span
                            className={`text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}
                          >
                            {getChapterTabCount(tab.id)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
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
                        <p className="text-sm text-gray-600">
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
                            className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4"
                          >
                            {/* Reorder Controls */}
                            {["videos", "pdfs", "tests", "notes"].includes(tabId) && (item.__type !== "quiz") && (
                              <div className="flex flex-col gap-1 justify-center shrink-0 border-r border-gray-100 pr-3">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleReorderResource("up", item, index); }}
                                  disabled={index === 0}
                                  className={`p-1 rounded hover:bg-gray-100 transition-colors ${index === 0 ? "text-gray-200 cursor-not-allowed" : "text-gray-400 hover:text-indigo-600"}`}
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleReorderResource("down", item, index); }}
                                  disabled={index === chapterActiveItems.length - 1}
                                  className={`p-1 rounded hover:bg-gray-100 transition-colors ${index === chapterActiveItems.length - 1 ? "text-gray-200 cursor-not-allowed" : "text-gray-400 hover:text-indigo-600"}`}
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            <div className="flex-1 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h5 className="font-semibold text-gray-900 truncate">
                                  {title}
                                </h5>
                                {item.description && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {item.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {tabId === "tests" && (
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full border ${item.__type === "quiz" ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-green-50 border-green-100 text-green-700"}`}
                                    >
                                      {item.__type === "quiz"
                                        ? "Quiz"
                                        : "Topic Test"}
                                    </span>
                                  )}
                                  {metaTags.map((tag, tagIndex) => (
                                    <span
                                      key={`${itemId}-tag-${tagIndex}`}
                                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-100"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Open
                                </a>
                              )}
                              {tabId === "tests" && (
                                <button
                                  onClick={() => {
                                    const tId = item.testId || item.test_id || getEntityId(item);
                                    if (item.__type === "quiz") {
                                      navigate(`/admin/practice?testId=${tId}`);
                                    } else {
                                      navigate(`/admin/tests?testId=${tId}`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-100"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Manage Test
                                </button>
                              )}
                            </div>

                            {createdAt && (
                              <p className="text-xs text-gray-400 mt-3">
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
        </div>
      )}

      {/* General Modal */}
      {modalConfig && !["subjects", "hierarchy"].includes(activeTab) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 capitalize flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                {modalConfig.item ? "Edit" : "Add"}{" "}
                {HIERARCHY_TABS.find(
                  (t) => t.id === modalConfig.tabId,
                )?.label.slice(0, -1)}
              </h3>
              <button
                onClick={() => setModalConfig(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Parent Dropdowns based on activeTab */}

              {modalConfig.tabId === "parts" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Subject *
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, parentId: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Part *
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, parentId: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">-- Select Part --</option>
                    {(selectedSubjectId ? filteredParts : data.parts).map(
                      (p) => (
                        <option key={getEntityId(p)} value={getEntityId(p)}>
                          {p.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}

              {modalConfig.tabId === "chapters" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to (Subject or Unit) *
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, parentId: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Chapter *
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, parentId: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Topic *
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, parentId: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, slug: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, description: e.target.value }))
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
                  className="px-5 py-2 text-gray-600 border rounded-lg font-medium hover:bg-gray-50 transition"
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
        </div>
      )}
      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
}
