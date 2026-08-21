import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Video,
  FileText,
  TestTube2,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Upload,
  Calendar,
  Book,
  Layers,
  X,
  ChevronRight,
  Link2,
  FolderOpen,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { apiClient as api } from "../../../shared/lib/dataService";

// Auto-generate a URL-safe slug from a title string
const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function ContentManagement() {
  const [loading, setLoading] = useState(true);
  const [studyMaterials, setStudyMaterials] = useState([]); // replaces "subjects" (wrong table)
  const [chapters, setChapters] = useState([]); // loaded lazily per study material

  // Hierarchy selection — stored as IDs
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [sidebarTopics, setSidebarTopics] = useState([]);
  const [sidebarTopicsLoading, setSidebarTopicsLoading] = useState(false);

  // Content Type Tab
  const [activeTab, setActiveTab] = useState("videos"); // videos, pdfs, notes, tests

  // Content from API
  const [contentItems, setContentItems] = useState([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit/Delete modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    studyMaterialId: "",
    chapterId: "",
    topicId: "",
  });
  const [saving, setSaving] = useState(false);
  // cascading dropdowns for edit modal
  const [editChapters, setEditChapters] = useState([]);
  const [editChaptersLoading, setEditChaptersLoading] = useState(false);
  const [editTopics, setEditTopics] = useState([]);
  const [editTopicsLoading, setEditTopicsLoading] = useState(false);

  // Add modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({});
  const [availableTests, setAvailableTests] = useState([]); // for tests tab picker
  const [testsLoading, setTestsLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null); // 'videoUrl' | 'pdfUrl' | 'thumbnail'
  const [modalChapters, setModalChapters] = useState([]); // chapters for the study material picked inside the add modal
  const [modalChaptersLoading, setModalChaptersLoading] = useState(false);
  const [modalTopics, setModalTopics] = useState([]); // topics for the chapter picked inside the add modal
  const [modalTopicsLoading, setModalTopicsLoading] = useState(false);

  // ── Generic file uploader: POST multipart to /admin/upload, return public URL ──
  const handleFileUpload = async (file, fieldKey, category) => {
    if (!file) return;
    try {
      setUploadingField(fieldKey);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      fd.append("name", file.name);
      const res = await api.post("/admin/assets/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.data?.url;
      if (!url) throw new Error("No URL returned from server");
      setAdd(fieldKey, url);
      toast.success("File uploaded successfully");
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error(err?.response?.data?.message || "Upload failed");
    } finally {
      setUploadingField(null);
    }
  };

  const tabs = [
    {
      id: "videos",
      label: "Videos",
      icon: Video,
      color: "text-red-500 bg-red-50 dark:bg-red-900/20",
    },
    {
      id: "pdfs",
      label: "PDFs",
      icon: FileText,
      color: "text-blue-500 bg-blue-50",
    },
    {
      id: "notes",
      label: "Study Materials",
      icon: BookOpen,
      color: "text-yellow-500 bg-yellow-50",
    },
    {
      id: "tests",
      label: "Tests/Quizzes",
      icon: TestTube2,
      color: "text-green-500 bg-green-50 dark:bg-green-900/20",
    },
  ];

  // API endpoint map for each content type
  const getEndpoint = useCallback(() => {
    switch (activeTab) {
      case "videos":
        return "/admin/subject-videos";
      case "pdfs":
        return "/admin/subject-pdfs";
      case "notes":
        return "/admin/study-materials";
      case "tests":
        return "/admin/topic-tests";
      default:
        return "/admin/subject-videos";
    }
  }, [activeTab]);

  // ── Initial load: fetch study materials (the "subject" layer for content) ──
  useEffect(() => {
    const fetchStudyMaterials = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/subjects-list");
        if (res.data.success) {
          setStudyMaterials(res.data.data || []);
        }
      } catch (err) {
        console.error("Failed to load study materials:", err);
        toast.error("Failed to load study materials");
      } finally {
        setLoading(false);
      }
    };
    fetchStudyMaterials();
  }, []);

  // ── Load chapters when study material changes ──
  useEffect(() => {
    setSelectedChapterId("");
    setSelectedTopicId("");
    setChapters([]);
    setSidebarTopics([]);
    if (!selectedMaterialId) return;
    const fetchChapters = async () => {
      try {
        const res = await api.get(
          `/admin/chapters?studyMaterialId=${selectedMaterialId}`,
        );
        if (res.data.success) setChapters(res.data.data || []);
      } catch (err) {
        console.error("Failed to load chapters:", err);
        toast.error("Failed to load chapters");
      }
    };
    fetchChapters();
  }, [selectedMaterialId]);

  // ── Load topics when chapter changes ──
  useEffect(() => {
    setSelectedTopicId("");
    setSidebarTopics([]);
    if (!selectedChapterId) return;
    const fetchTopics = async () => {
      try {
        setSidebarTopicsLoading(true);
        const res = await api.get(
          `/admin/topics?chapterId=${selectedChapterId}`,
        );
        if (res.data.success) setSidebarTopics(res.data.data || []);
      } catch (err) {
        console.error("Failed to load topics:", err);
      } finally {
        setSidebarTopicsLoading(false);
      }
    };
    fetchTopics();
  }, [selectedChapterId]);

  // ── Fetch content items whenever filters or tab changes ──
  const fetchContentItems = useCallback(async () => {
    try {
      setContentLoading(true);
      const endpoint = getEndpoint();

      const params = new URLSearchParams();
      if (selectedMaterialId)
        params.append("studyMaterialId", selectedMaterialId);
      if (selectedChapterId) params.append("chapterId", selectedChapterId);
      if (selectedTopicId) params.append("topicId", selectedTopicId);

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const response = await api.get(`${endpoint}${queryStr}`);

      if (response.data.success) {
        setContentItems(response.data.data || []);
      } else {
        setContentItems([]);
      }
    } catch (err) {
      console.error("Failed to load content items:", err);
      setContentItems([]);
    } finally {
      setContentLoading(false);
    }
  }, [
    activeTab,
    selectedMaterialId,
    selectedChapterId,
    selectedTopicId,
    getEndpoint,
  ]);

  useEffect(() => {
    fetchContentItems();
  }, [fetchContentItems]);

  // ── When the Add modal's study material changes, load chapters ──
  useEffect(() => {
    const smId = addForm.studyMaterialId;
    if (!smId) {
      setModalChapters([]);
      return;
    }
    // Reuse sidebar chapters if same material — keep chapter/topic as-is
    if (smId === selectedMaterialId && chapters.length > 0) {
      setModalChapters(chapters);
      return;
    }
    // Different material: reset downstream and fetch
    setAddForm((prev) => ({ ...prev, chapterId: "", topicId: "" }));
    setModalTopics([]);
    const fetchModalChapters = async () => {
      try {
        setModalChaptersLoading(true);
        const res = await api.get(`/admin/chapters?studyMaterialId=${smId}`);
        if (res.data.success) setModalChapters(res.data.data || []);
      } catch (err) {
        console.error("Failed to load chapters for modal:", err);
      } finally {
        setModalChaptersLoading(false);
      }
    };
    fetchModalChapters();
  }, [addForm.studyMaterialId]);

  // ── When the Add modal's chapter changes, load topics ──
  useEffect(() => {
    const cId = addForm.chapterId;
    if (!cId) {
      setModalTopics([]);
      setAddForm((prev) => ({ ...prev, topicId: "" }));
      return;
    }
    // Reuse sidebar topics if same chapter
    if (cId === selectedChapterId && sidebarTopics.length > 0) {
      setModalTopics(sidebarTopics);
      return;
    }
    // Different chapter: reset topic and fetch
    setAddForm((prev) => ({ ...prev, topicId: "" }));
    const fetchModalTopics = async () => {
      try {
        setModalTopicsLoading(true);
        const res = await api.get(`/admin/topics?chapterId=${cId}`);
        if (res.data.success) setModalTopics(res.data.data || []);
      } catch (err) {
        console.error("Failed to load topics for modal:", err);
      } finally {
        setModalTopicsLoading(false);
      }
    };
    fetchModalTopics();
  }, [addForm.chapterId]);

  // ── Edit handlers ──
  const handleEdit = (item) => {
    setEditingItem(item);
    const smId = String(item.studyMaterialId || item.study_material_id || "");
    const cId = String(item.chapterId || item.chapter_id || "");
    const tId = String(item.topicId || item.topic_id || "");
    setEditForm({
      title: item.title || item.name || "",
      description: item.description || "",
      studyMaterialId: smId,
      chapterId: cId,
      topicId: tId,
    });
    // Pre-load chapters for the item's study material
    if (smId) {
      setEditChaptersLoading(true);
      api
        .get(`/admin/chapters?studyMaterialId=${smId}`)
        .then((r) => setEditChapters(r.data?.data || []))
        .catch(() => toast.error("Failed to load related data"))
        .finally(() => setEditChaptersLoading(false));
    } else {
      setEditChapters([]);
    }
    // Pre-load topics for the item's chapter
    if (cId) {
      setEditTopicsLoading(true);
      api
        .get(`/admin/topics?chapterId=${cId}`)
        .then((r) => setEditTopics(r.data?.data || []))
        .catch(() => toast.error("Failed to load related data"))
        .finally(() => setEditTopicsLoading(false));
    } else {
      setEditTopics([]);
    }
    setShowEditModal(true);
  };

  // When edit-modal study material changes, reload chapters
  useEffect(() => {
    const smId = editForm.studyMaterialId;
    if (!showEditModal || !smId) {
      setEditChapters([]);
      return;
    }
    setEditChaptersLoading(true);
    api
      .get(`/admin/chapters?studyMaterialId=${smId}`)
      .then((r) => setEditChapters(r.data?.data || []))
      .catch(() => toast.error("Failed to load related data"))
      .finally(() => setEditChaptersLoading(false));
  }, [editForm.studyMaterialId, showEditModal]);

  // When edit-modal chapter changes, reload topics
  useEffect(() => {
    const cId = editForm.chapterId;
    if (!showEditModal || !cId) {
      setEditTopics([]);
      return;
    }
    setEditTopicsLoading(true);
    api
      .get(`/admin/topics?chapterId=${cId}`)
      .then((r) => setEditTopics(r.data?.data || []))
      .catch(() => toast.error("Failed to load related data"))
      .finally(() => setEditTopicsLoading(false));
  }, [editForm.chapterId, showEditModal]);

  const handleEditSubmit = async () => {
    if (!editingItem) return;
    try {
      setSaving(true);
      const endpoint = getEndpoint();
      const itemId = editingItem._id || editingItem.id;
      await api.put(`${endpoint}/${itemId}`, {
        title: editForm.title,
        description: editForm.description,
        studyMaterialId: editForm.studyMaterialId || null,
        chapterId: editForm.chapterId || null,
        topicId: editForm.topicId || null,
      });
      toast.success("Content updated successfully");
      setShowEditModal(false);
      setEditingItem(null);
      fetchContentItems();
    } catch (err) {
      console.error("Failed to update content:", err);
      toast.error("Failed to update content");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete handlers ──
  const handleDelete = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      setSaving(true);
      const endpoint = getEndpoint();
      const itemId = deletingItem._id || deletingItem.id;
      await api.delete(`${endpoint}/${itemId}`);
      toast.success("Content deleted successfully");
      setShowDeleteModal(false);
      setDeletingItem(null);
      fetchContentItems();
    } catch (err) {
      console.error("Failed to delete content:", err);
      toast.error("Failed to delete content");
    } finally {
      setSaving(false);
    }
  };

  // ── Add modal ──
  const openAddModal = () => {
    // Seed the form with current sidebar selections so user doesn't have to re-pick
    setAddForm({
      studyMaterialId: selectedMaterialId,
      chapterId: selectedChapterId,
      topicId: selectedTopicId,
      title: "",
      slug: "",
      description: "",
      // video-specific
      videoUrl: "",
      thumbnail: "",
      duration: "",
      // pdf-specific
      pdfUrl: "",
      fileSize: "",
      pages: "",
      // shared
      isPro: false,
      // tests-specific
      testId: "",
      testType: "practice",
      // study-material-specific
      name: "",
      icon: "book-open",
      order: "",
    });
    if (activeTab === "tests" && availableTests.length === 0) {
      setTestsLoading(true);
      api
        .get("/admin/tests")
        .then((r) => setAvailableTests(r.data?.data || []))
        .catch(() => toast.error("Failed to load tests list"))
        .finally(() => setTestsLoading(false));
    }
    setShowAddModal(true);
  };

  const setAdd = (key, value) =>
    setAddForm((prev) => ({ ...prev, [key]: value }));

  const handleAddSubmit = async () => {
    try {
      setSaving(true);
      const endpoint = getEndpoint();

      let payload = {};

      if (activeTab === "videos") {
        if (!addForm.title || !addForm.videoUrl || !addForm.studyMaterialId)
          return toast.error(
            "Study Material, Title and Video URL are required",
          );
        payload = {
          studyMaterialId: addForm.studyMaterialId,
          chapterId: addForm.chapterId || null,
          topicId: addForm.topicId || null,
          title: addForm.title,
          slug: addForm.slug || toSlug(addForm.title),
          description: addForm.description,
          videoUrl: addForm.videoUrl,
          thumbnail: addForm.thumbnail || "",
          duration: Number(addForm.duration) || 0,
          isPro: addForm.isPro,
        };
      } else if (activeTab === "pdfs") {
        if (!addForm.title || !addForm.pdfUrl || !addForm.studyMaterialId)
          return toast.error("Study Material, Title and PDF URL are required");
        payload = {
          studyMaterialId: addForm.studyMaterialId,
          chapterId: addForm.chapterId || null,
          topicId: addForm.topicId || null,
          title: addForm.title,
          slug: addForm.slug || toSlug(addForm.title),
          description: addForm.description,
          pdfUrl: addForm.pdfUrl,
          fileSize: Number(addForm.fileSize) || 0,
          pages: Number(addForm.pages) || 0,
          isPro: addForm.isPro,
        };
      } else if (activeTab === "tests") {
        if (!addForm.studyMaterialId || !addForm.testId)
          return toast.error("Study Material and Test are required");
        payload = {
          studyMaterialId: addForm.studyMaterialId,
          chapterId: addForm.chapterId || null,
          topicId: addForm.topicId || null,
          testId: addForm.testId,
          testType: addForm.testType || "practice",
        };
      } else if (activeTab === "notes") {
        if (!addForm.title) return toast.error("Title is required");
        payload = {
          title: addForm.title,
          name: addForm.name || addForm.title,
          slug: addForm.slug || toSlug(addForm.title),
          description: addForm.description,
          icon: addForm.icon || "book-open",
          order: Number(addForm.order) || 0,
        };
      }

      await api.post(endpoint, payload);
      toast.success(
        `${tabs.find((t) => t.id === activeTab)?.label} added successfully`,
      );
      setShowAddModal(false);
      fetchContentItems();
    } catch (err) {
      console.error("Failed to add content:", err);
      toast.error(err?.response?.data?.message || "Failed to add content");
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered list ──
  const filteredContent = contentItems.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  // ── Derived display labels ──
  const selectedMaterial = studyMaterials.find(
    (m) => String(m._id || m.id) === selectedMaterialId,
  );
  const selectedChapter = chapters.find(
    (c) => String(c._id || c.id) === selectedChapterId,
  );
  const selectedTopic = sidebarTopics.find(
    (t) => String(t._id || t.id) === selectedTopicId,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Content Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Upload and organize PDFs, Videos, Notes &amp; Tests across your
            curriculum
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          Add {tabs.find((t) => t.id === activeTab)?.label}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* ── Left Sidebar: Hierarchy Selectors ── */}
        <div className="xl:w-80 flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Book className="w-4 h-4 text-indigo-500" />
              Content Context
            </h3>

            {/* Study Material */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                1. Subject
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— All Subjects —</option>
                {studyMaterials.map((m) => (
                  <option key={m._id || m.id} value={String(m._id || m.id)}>
                    {m.title || m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                2. Chapter
                {!selectedMaterialId && (
                  <span className="ml-1 text-gray-300 font-normal normal-case">
                    (pick subject first)
                  </span>
                )}
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                disabled={!selectedMaterialId}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:opacity-40 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— All Chapters —</option>
                {chapters.map((c) => (
                  <option key={c._id || c.id} value={String(c._id || c.id)}>
                    {c.title || c.name}
                  </option>
                ))}
              </select>
              {selectedMaterialId && chapters.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  No chapters for this subject.
                </p>
              )}
            </div>

            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                3. Topic
                {sidebarTopicsLoading && (
                  <span className="ml-1 text-indigo-400 dark:text-indigo-500 font-normal normal-case">
                    Loading…
                  </span>
                )}
                {!selectedChapterId && (
                  <span className="ml-1 text-gray-300 font-normal normal-case">
                    (pick chapter first)
                  </span>
                )}
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={!selectedChapterId || sidebarTopicsLoading}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:opacity-40 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— All Topics —</option>
                {sidebarTopics.map((t) => (
                  <option key={t._id || t.id} value={String(t._id || t.id)}>
                    {t.title || t.name}
                  </option>
                ))}
              </select>
              {selectedChapterId &&
                !sidebarTopicsLoading &&
                sidebarTopics.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    No topics in this chapter.
                  </p>
                )}
            </div>
          </div>

          {/* Active Filter breadcrumb */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-4">
            <h4 className="font-semibold text-indigo-900 mb-2 text-xs uppercase tracking-wider">
              Active Filter
            </h4>
            <div className="flex flex-col gap-1 text-sm text-indigo-700 dark:text-indigo-400">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-semibold">
                  {selectedMaterial
                    ? selectedMaterial.title || selectedMaterial.name
                    : "All Subjects"}
                </span>
                {selectedChapter && (
                  <>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    <span className="font-semibold">
                      {selectedChapter.title || selectedChapter.name}
                    </span>
                  </>
                )}
                {selectedTopic && (
                  <>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    <span className="font-semibold text-indigo-500">
                      {selectedTopic.title || selectedTopic.name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2">
              {filteredContent.length} item
              {filteredContent.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        {/* ── Right Main Area ── */}
        <div className="flex-1 min-w-0">
          {/* Content Type Tabs */}
          <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto pb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors rounded-t-lg whitespace-nowrap ${
                    isActive
                      ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-b-0 border-gray-200 dark:border-gray-700 border-b-white relative top-px"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"}`}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Toolbar */}
            <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder={`Search ${tabs.find((t) => t.id === activeTab)?.label.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                {filteredContent.length} item
                {filteredContent.length !== 1 ? "s" : ""} found
              </div>
            </div>

            {/* Content List */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {contentLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-900/50">
                  {(() => {
                    const activeTabData = tabs.find((t) => t.id === activeTab);
                    const Icon = activeTabData?.icon || Layers;
                    return (
                      <>
                        <div
                          className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${activeTabData?.color}`}
                        >
                          <Icon className="w-8 h-8 opacity-75" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                          No {activeTabData?.label} Found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto mb-6">
                          {selectedMaterialId
                            ? "No content of this type exists for the selected filter."
                            : "Select a study material to filter, or all content is shown here."}
                        </p>
                        <button
                          onClick={openAddModal}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-medium rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30 transition cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Add{" "}
                          {activeTabData?.label}
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-transparent bg-gray-50 dark:bg-gray-900 p-4">
                  {filteredContent.map((item) => {
                    const activeTabData = tabs.find((t) => t.id === activeTab);
                    const Icon = activeTabData?.icon || Layers;
                    const colorClass =
                      activeTabData?.color ||
                      "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
                    return (
                      <div
                        key={item._id || item.id}
                        className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 m-2 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-2 rounded-lg ${colorClass}`}>
                            <Icon className="w-5 h-5 flex-shrink-0" />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/20 rounded-md transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-md transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1 line-clamp-1">
                          {item.title || item.name || "Untitled Document"}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 h-8">
                          {item.description || "No description provided."}
                        </p>
                        <div className="flex items-center justify-between text-xs font-medium text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-100">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString()
                              : "N/A"}
                          </span>
                          <span
                            className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                            onClick={() => handleEdit(item)}
                          >
                            <Eye className="w-3 h-3" /> View
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {showEditModal &&
        editingItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center z-[9999] p-4 pt-14 overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl my-4 border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/75 dark:bg-gray-800/75">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-indigo-500" />
                    Edit {tabs.find((t) => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Update content details and curriculum linking
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* ── Content Details ── */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                    Content Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Curriculum Linking (not for study-material notes tab) ── */}
                {activeTab !== "notes" && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> Curriculum Link
                    </h3>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-xl p-4 space-y-3">
                      {/* Subject */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Subject
                        </label>
                        <select
                          value={editForm.studyMaterialId || ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              studyMaterialId: e.target.value,
                              chapterId: "",
                              topicId: "",
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— Unlinked —</option>
                          {studyMaterials.map((m) => (
                            <option
                              key={m._id || m.id}
                              value={String(m._id || m.id)}
                            >
                              {m.title || m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Chapter */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Chapter
                          {editChaptersLoading && (
                            <span className="ml-1 text-indigo-400 dark:text-indigo-500 font-normal">
                              Loading…
                            </span>
                          )}
                        </label>
                        <select
                          value={editForm.chapterId || ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              chapterId: e.target.value,
                              topicId: "",
                            }))
                          }
                          disabled={
                            !editForm.studyMaterialId || editChaptersLoading
                          }
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm disabled:opacity-40 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— No Chapter —</option>
                          {editChapters.map((c) => (
                            <option
                              key={c._id || c.id}
                              value={String(c._id || c.id)}
                            >
                              {c.title || c.name}
                            </option>
                          ))}
                        </select>
                        {editForm.studyMaterialId &&
                          !editChaptersLoading &&
                          editChapters.length === 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              No chapters for this subject.
                            </p>
                          )}
                      </div>

                      {/* Topic */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Topic
                          {editTopicsLoading && (
                            <span className="ml-1 text-indigo-400 dark:text-indigo-500 font-normal">
                              Loading…
                            </span>
                          )}
                        </label>
                        <select
                          value={editForm.topicId || ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              topicId: e.target.value,
                            }))
                          }
                          disabled={!editForm.chapterId || editTopicsLoading}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm disabled:opacity-40 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— No Topic —</option>
                          {editTopics.map((t) => (
                            <option
                              key={t._id || t.id}
                              value={String(t._id || t.id)}
                            >
                              {t.title || t.name}
                            </option>
                          ))}
                        </select>
                        {editForm.chapterId &&
                          !editTopicsLoading &&
                          editTopics.length === 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              No topics in this chapter.
                            </p>
                          )}
                      </div>

                      {/* Current link breadcrumb */}
                      <div className="pt-1 flex items-center gap-1 text-xs text-indigo-500 flex-wrap">
                        <span>
                          {studyMaterials.find(
                            (m) =>
                              String(m._id || m.id) ===
                              editForm.studyMaterialId,
                          )?.title || "—"}
                        </span>
                        {editForm.chapterId && (
                          <>
                            <ChevronRight className="w-3 h-3 opacity-50" />
                            <span>
                              {editChapters.find(
                                (c) =>
                                  String(c._id || c.id) === editForm.chapterId,
                              )?.title || "…"}
                            </span>
                          </>
                        )}
                        {editForm.topicId && (
                          <>
                            <ChevronRight className="w-3 h-3 opacity-50" />
                            <span className="text-indigo-400 dark:text-indigo-500">
                              {editTopics.find(
                                (t) =>
                                  String(t._id || t.id) === editForm.topicId,
                              )?.title || "…"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition text-sm"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60 text-sm font-medium"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal &&
        deletingItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Delete Content?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <strong>
                    {deletingItem.title || deletingItem.name || "Untitled"}
                  </strong>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingItem(null);
                  }}
                  disabled={saving}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={saving}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-60 text-sm font-semibold shadow-md shadow-red-500/20"
                >
                  {saving ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Add Content Modal ── */}
      {showAddModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl my-4 border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/75 dark:bg-gray-800/75">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Add {tabs.find((t) => t.id === activeTab)?.label}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* ── Shared: Study Material picker (always shown) ── */}
                {activeTab !== "notes" && (
                  <div className="space-y-3">
                    {/* Row 1: Study Material */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Study Material <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={addForm.studyMaterialId || ""}
                        onChange={(e) =>
                          setAdd("studyMaterialId", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— Select —</option>
                        {studyMaterials.map((m) => (
                          <option
                            key={m._id || m.id}
                            value={String(m._id || m.id)}
                          >
                            {m.title || m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Row 2: Chapter + Topic */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Chapter
                          {modalChaptersLoading && (
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                              Loading…
                            </span>
                          )}
                        </label>
                        <select
                          value={addForm.chapterId || ""}
                          onChange={(e) => setAdd("chapterId", e.target.value)}
                          disabled={
                            !addForm.studyMaterialId || modalChaptersLoading
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— None —</option>
                          {modalChapters.map((c) => (
                            <option
                              key={c._id || c.id}
                              value={String(c._id || c.id)}
                            >
                              {c.title || c.name}
                            </option>
                          ))}
                        </select>
                        {addForm.studyMaterialId &&
                          !modalChaptersLoading &&
                          modalChapters.length === 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              No chapters found.
                            </p>
                          )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Topic
                          {modalTopicsLoading && (
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                              Loading…
                            </span>
                          )}
                        </label>
                        <select
                          value={addForm.topicId || ""}
                          onChange={(e) => setAdd("topicId", e.target.value)}
                          disabled={!addForm.chapterId || modalTopicsLoading}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— None —</option>
                          {modalTopics.map((t) => (
                            <option
                              key={t._id || t.id}
                              value={String(t._id || t.id)}
                            >
                              {t.title || t.name}
                            </option>
                          ))}
                        </select>
                        {addForm.chapterId &&
                          !modalTopicsLoading &&
                          modalTopics.length === 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              No topics in this chapter.
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Videos & PDFs: title / slug / description ── */}
                {(activeTab === "videos" ||
                  activeTab === "pdfs" ||
                  activeTab === "notes") && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addForm.title}
                        onChange={(e) => {
                          setAdd("title", e.target.value);
                          setAdd("slug", toSlug(e.target.value));
                        }}
                        placeholder="e.g. Introduction to Algebra"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Slug (auto-filled)
                      </label>
                      <input
                        type="text"
                        value={addForm.slug}
                        onChange={(e) => setAdd("slug", e.target.value)}
                        placeholder="url-safe-slug"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={addForm.description}
                        onChange={(e) => setAdd("description", e.target.value)}
                        rows={2}
                        placeholder="Optional description…"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                {/* ── Videos specific ── */}
                {activeTab === "videos" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Video File / URL <span className="text-red-500">*</span>
                      </label>
                      {/* Drop zone */}
                      <label
                        className="flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:bg-indigo-900/30 cursor-pointer transition mb-2"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleFileUpload(
                            e.dataTransfer.files[0],
                            "videoUrl",
                            "video",
                          );
                        }}
                      >
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) =>
                            handleFileUpload(
                              e.target.files[0],
                              "videoUrl",
                              "video",
                            )
                          }
                        />
                        {uploadingField === "videoUrl" ? (
                          <>
                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                            <span className="text-xs text-indigo-600 dark:text-indigo-400">
                              Uploading…
                            </span>
                          </>
                        ) : addForm.videoUrl ? (
                          <>
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              File uploaded — or paste a new URL below
                            </span>
                          </>
                        ) : (
                          <>
                            <FolderOpen className="w-6 h-6 text-indigo-400 dark:text-indigo-500" />
                            <span className="text-xs text-indigo-500">
                              Click or drag &amp; drop a video file
                            </span>
                          </>
                        )}
                      </label>
                      {/* URL fallback */}
                      <div className="relative">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="url"
                          value={addForm.videoUrl}
                          onChange={(e) => setAdd("videoUrl", e.target.value)}
                          placeholder="…or paste a YouTube / direct URL"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Thumbnail File / URL
                        </label>
                        <label
                          className="flex flex-col items-center justify-center gap-2 w-full h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 cursor-pointer transition mb-2"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleFileUpload(
                              e.dataTransfer.files[0],
                              "thumbnail",
                              "image",
                            );
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleFileUpload(
                                e.target.files[0],
                                "thumbnail",
                                "image",
                              )
                            }
                          />
                          {uploadingField === "thumbnail" ? (
                            <>
                              <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Uploading…
                              </span>
                            </>
                          ) : addForm.thumbnail ? (
                            <>
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                Thumbnail ready
                              </span>
                            </>
                          ) : (
                            <>
                              <FolderOpen className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Drop thumbnail image
                              </span>
                            </>
                          )}
                        </label>
                        <input
                          type="url"
                          value={addForm.thumbnail}
                          onChange={(e) => setAdd("thumbnail", e.target.value)}
                          placeholder="…or paste image URL"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Duration (seconds)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={addForm.duration}
                          onChange={(e) => setAdd("duration", e.target.value)}
                          placeholder="e.g. 600"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={addForm.isPro}
                        onChange={(e) => setAdd("isPro", e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Pro content only
                      </span>
                    </label>
                  </>
                )}

                {/* ── PDFs specific ── */}
                {activeTab === "pdfs" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        PDF File / URL <span className="text-red-500">*</span>
                      </label>
                      {/* Drop zone */}
                      <label
                        className="flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 cursor-pointer transition mb-2"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleFileUpload(
                            e.dataTransfer.files[0],
                            "pdfUrl",
                            "pdf",
                          );
                        }}
                      >
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) =>
                            handleFileUpload(e.target.files[0], "pdfUrl", "pdf")
                          }
                        />
                        {uploadingField === "pdfUrl" ? (
                          <>
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              Uploading…
                            </span>
                          </>
                        ) : addForm.pdfUrl ? (
                          <>
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              File uploaded — or paste a new URL below
                            </span>
                          </>
                        ) : (
                          <>
                            <FolderOpen className="w-6 h-6 text-blue-400 dark:text-blue-500" />
                            <span className="text-xs text-blue-500">
                              Click or drag &amp; drop a PDF file
                            </span>
                          </>
                        )}
                      </label>
                      {/* URL fallback */}
                      <div className="relative">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="url"
                          value={addForm.pdfUrl}
                          onChange={(e) => setAdd("pdfUrl", e.target.value)}
                          placeholder="…or paste a direct PDF URL"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          File Size (KB)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={addForm.fileSize}
                          onChange={(e) => setAdd("fileSize", e.target.value)}
                          placeholder="e.g. 2048"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Pages
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={addForm.pages}
                          onChange={(e) => setAdd("pages", e.target.value)}
                          placeholder="e.g. 24"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={addForm.isPro}
                        onChange={(e) => setAdd("isPro", e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Pro content only
                      </span>
                    </label>
                  </>
                )}

                {/* ── Tests specific ── */}
                {activeTab === "tests" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Link Test <span className="text-red-500">*</span>
                      </label>
                      {testsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
                          Loading tests…
                        </div>
                      ) : (
                        <select
                          value={addForm.testId}
                          onChange={(e) => setAdd("testId", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— Select a test —</option>
                          {availableTests.map((t) => (
                            <option
                              key={t._id || t.id}
                              value={String(t._id || t.id)}
                            >
                              {t.title} {t.seriesId ? "" : "(unlinked)"}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Test Type
                      </label>
                      <select
                        value={addForm.testType}
                        onChange={(e) => setAdd("testType", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="practice">Practice</option>
                        <option value="mock">Mock</option>
                        <option value="quiz">Quiz</option>
                        <option value="pyq">Previous Year</option>
                      </select>
                    </div>
                  </>
                )}

                {/* ── Study Materials (notes tab) specific ── */}
                {activeTab === "notes" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Icon
                      </label>
                      <input
                        type="text"
                        value={addForm.icon}
                        onChange={(e) => setAdd("icon", e.target.value)}
                        placeholder="book-open"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={addForm.order}
                        onChange={(e) => setAdd("order", e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSubmit}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60 text-sm font-medium"
                >
                  {saving
                    ? "Saving…"
                    : `Add ${tabs.find((t) => t.id === activeTab)?.label}`}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
