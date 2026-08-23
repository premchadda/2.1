import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  ChevronDown,
  Link2,
  FolderOpen,
  Loader2,
  CheckCircle2,
  LayoutGrid,
  LayoutList,
  BarChart3,
  Filter,
  ArrowUpDown,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Archive,
  Clock,
  BadgeCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { apiClient as api } from "../../../shared/lib/dataService";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

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

  // ── Enhanced UI states ──
  const [viewMode, setViewMode] = useState("grid"); // grid | table
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [sortBy, setSortBy] = useState("newest"); // newest | oldest | title | duration
  const [filterPro, setFilterPro] = useState("all"); // all | pro | free
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef(null);

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
        // Robust fetch: handle pagination and fallback to ensure ALL subjects show
        // 1) Try paginated fetch with large limit and follow hasMore
        let allMaterials = [];
        let offset = 0;
        const limit = 200; // max allowed by backend
        let hasMore = true;
        let firstRes = null;
        while (hasMore) {
          const res = await api.get(
            `/admin/subjects-list?limit=${limit}&offset=${offset}`,
          );
          firstRes = res;
          const pageData = res.data?.data || [];
          const pagination = res.data?.pagination;
          // Handle both paginated and non-paginated shapes
          if (Array.isArray(pageData)) {
            allMaterials = allMaterials.concat(pageData);
          } else if (Array.isArray(res.data?.data?.data)) {
            allMaterials = allMaterials.concat(res.data.data.data);
          }
          // Check hasMore from pagination
          if (pagination) {
            hasMore = !!pagination.hasMore && pageData.length === limit;
            offset += limit;
            // Safety: prevent infinite loop
            if (offset > 2000) break;
          } else {
            hasMore = false;
          }
          // If no pagination info, assume single page
          if (!pagination) break;
          // If page returned less than limit, no more
          if (pageData.length < limit) hasMore = false;
        }

        // 2) Always merge fallback sources to show ALL subjects (study_materials 4 + subjects 13)
        {
          try {
            const altRes = await api.get("/admin/study-materials");
            const altData = altRes.data?.data || [];
            if (Array.isArray(altData) && altData.length) {
              const seen = new Set(
                allMaterials.map((m) => String(m._id || m.id)),
              );
              altData.forEach((m) => {
                const id = String(m._id || m.id);
                if (!seen.has(id) && (m.title || m.name)) {
                  allMaterials.push(m);
                  seen.add(id);
                }
              });
            }
          } catch (_e) {
            // ignore fallback fetch error
          }
        }
        // Always merge subjects table as well (13 subjects vs 4 studyMaterials)
        {
          try {
            const subRes = await api.get("/admin/subjects");
            const subData = subRes.data?.data || [];
            if (Array.isArray(subData) && subData.length) {
              const mapped = subData.map((s) => ({
                _id: s._id || s.id,
                id: s._id || s.id,
                title: s.title || s.name,
                name: s.name || s.title,
                slug: s.slug,
                isActive: s.isActive,
              }));
              const seen = new Set(
                allMaterials.map((m) => String(m._id || m.id)),
              );
              mapped.forEach((m) => {
                const idStr = String(m._id || m.id);
                if (!seen.has(idStr) && (m.title || m.name)) {
                  allMaterials.push(m);
                  seen.add(idStr);
                }
              });
            }
          } catch (_e) {
            // ignore fallback fetch error
          }
        }

        // 3) Deduplicate by id and sort by title
        const seenIds = new Set();
        const deduped = [];
        for (const m of allMaterials) {
          const id = String(m._id || m.id || m.slug);
          if (!seenIds.has(id) && (m.title || m.name)) {
            seenIds.add(id);
            deduped.push(m);
          }
        }
        deduped.sort((a, b) =>
          (a.title || a.name || "").localeCompare(b.title || b.name || ""),
        );

        setStudyMaterials(deduped);
        if (deduped.length === 0) {
          console.warn("No study materials found — check DB seeding");
        } else if (deduped.length > 4) {
          console.log(
            `Loaded ${deduped.length} study materials (was showing 4)`,
          );
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
      const endpoint = getEndpoint();

      let payload = {};

      if (activeTab === "videos") {
        if (!addForm.title || !addForm.videoUrl || !addForm.studyMaterialId) {
          toast.error("Study Material, Title and Video URL are required");
          return;
        }
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
        if (!addForm.title) {
          toast.error("Title is required");
          return;
        }
        payload = {
          title: addForm.title,
          name: addForm.name || addForm.title,
          slug: addForm.slug || toSlug(addForm.title),
          description: addForm.description,
          icon: addForm.icon || "book-open",
          order: Number(addForm.order) || 0,
        };
      } else {
        toast.error("Invalid content type");
        return;
      }

      if (!payload || Object.keys(payload).length === 0) {
        toast.error("Invalid payload");
        return;
      }
      setSaving(true);
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

  // ── Debounced search ──
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 280);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Reset page when tab/filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedItemIds(new Set());
  }, [
    activeTab,
    selectedMaterialId,
    selectedChapterId,
    selectedTopicId,
    filterPro,
    sortBy,
  ]);

  // ── Filtered + Sorted list ──
  const filteredContent = useMemo(() => {
    let list = [...contentItems];
    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (item) =>
          (item.title && item.title.toLowerCase().includes(q)) ||
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.slug && item.slug.toLowerCase().includes(q)),
      );
    }
    // Pro filter
    if (filterPro === "pro") list = list.filter((i) => i.isPro === true);
    else if (filterPro === "free") list = list.filter((i) => !i.isPro);
    // Sort
    if (sortBy === "newest")
      list.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    else if (sortBy === "oldest")
      list.sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      );
    else if (sortBy === "title")
      list.sort((a, b) =>
        (a.title || a.name || "").localeCompare(b.title || b.name || ""),
      );
    else if (sortBy === "duration")
      list.sort(
        (a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0),
      );
    return list;
  }, [contentItems, debouncedSearch, filterPro, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredContent.length / pageSize));
  const paginatedContent = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContent.slice(start, start + pageSize);
  }, [filteredContent, currentPage, pageSize]);

  // Clamp currentPage when filteredContent shrinks (delete/filter)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const contentStats = useMemo(() => {
    const total = contentItems.length;
    const pro = contentItems.filter((i) => i.isPro).length;
    const free = total - pro;
    return { total, pro, free, filtered: filteredContent.length };
  }, [contentItems, filteredContent]);

  // Dead code removed: filterSubjects + 3 filtered* memos were no-op (filter with "") - kept for future search wiring

  const toggleSelectAll = useCallback(() => {
    const pageIds = paginatedContent.map((it) => String(it._id || it.id));
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedItemIds.has(id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }, [paginatedContent, selectedItemIds]);

  const toggleSelectOne = useCallback((id) => {
    const sid = String(id);
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return;
    const ok = await confirmOnce({
      title: "Delete selected items",
      message: `Delete ${selectedItemIds.size} selected items? This cannot be undone.`,
      confirmText: "Delete",
      confirmStyle: "danger",
    });
    if (!ok) return;
    try {
      setSaving(true);
      const endpoint = getEndpoint();
      const ids = Array.from(selectedItemIds);
      await Promise.all(ids.map((id) => api.delete(`${endpoint}/${id}`)));
      toast.success(`Deleted ${ids.length} items`);
      setSelectedItemIds(new Set());
      fetchContentItems();
    } catch (e) {
      toast.error("Bulk delete failed");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text) => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(text));
      } else {
        // Fallback for http or old browsers
        const ta = document.createElement("textarea");
        ta.value = String(text);
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — please copy manually");
    }
  };

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
      <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 animate-pulse">
        <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl"
            />
          ))}
        </div>
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="xl:w-80 h-[400px] bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          <div className="flex-1 h-[500px] bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto space-y-3">
      {/* Header — compact */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
              <span className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-sm">
                <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </span>
              <span className="truncate">Content Manager</span>
              <span className="hidden md:inline-flex items-center gap-1 ml-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-[11px] font-bold border border-indigo-200 dark:border-indigo-800 shrink-0">
                <Sparkles className="w-3 h-3" />{" "}
                {tabs.find((t) => t.id === activeTab)?.label}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1 sm:line-clamp-none">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Videos, PDFs, Notes & Tests
              </span>
              <span className="hidden sm:inline">
                {" "}
                — filter by Subject → Chapter → Topic
              </span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={fetchContentItems}
              disabled={contentLoading}
              className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition text-gray-600 dark:text-gray-400"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${contentLoading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={openAddModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add {tabs.find((t) => t.id === activeTab)?.label}</span>
            </button>
          </div>
        </div>

        {/* KPI Stats — compact, 2x2 mobile, 4 col desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
                Total
              </span>
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </span>
            </div>
            <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white mt-1 leading-none">
              {contentStats.total}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
              {contentStats.filtered} filtered
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
                Pro
              </span>
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <BadgeCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </span>
            </div>
            <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-1 leading-none">
              {contentStats.pro}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
              {contentStats.pro
                ? Math.round(
                    (contentStats.pro / Math.max(1, contentStats.total)) * 100,
                  )
                : 0}
              % • {contentStats.free} free
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
                Active
              </span>
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shrink-0">
                <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </span>
            </div>
            <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 truncate leading-none">
              {tabs.find((t) => t.id === activeTab)?.label}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
              {selectedMaterial
                ? selectedMaterial.title || selectedMaterial.name
                : "All subjects"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-white shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider">
                Quick
              </span>
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-200" />
            </div>
            <p className="text-xs sm:text-sm font-bold mt-1 leading-none">
              Bulk upload?
            </p>
            <button
              onClick={openAddModal}
              className="mt-2 text-[11px] bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg font-semibold transition w-fit"
            >
              Upload →
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3">
        {/* ── Left Sidebar: Hierarchy Selectors ── */}
        <div className="xl:w-72 flex flex-col gap-3 xl:sticky xl:top-3 xl:self-start">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-3">
            <h3 className="text-xs font-black text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
              <Book className="w-3.5 h-3.5 text-indigo-500" />
              Context
              <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                {studyMaterials.length}
              </span>
            </h3>

            {/* Study Material — enhanced dropdown, no search bar */}
            <div className="mb-2.5">
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>1. Subject</span>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                  {studyMaterials.length}
                </span>
              </label>
              <div className="relative">
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 truncate shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition"
                >
                  <option value="">
                    — All Subjects ({studyMaterials.length}) —
                  </option>
                  {studyMaterials.map((m) => (
                    <option key={m._id || m.id} value={String(m._id || m.id)}>
                      {m.title || m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Chapter */}
            <div className="mb-2.5">
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                2. Chapter
                {!selectedMaterialId && (
                  <span className="ml-1 text-gray-300 font-normal normal-case hidden sm:inline">
                    (pick subject)
                  </span>
                )}
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                disabled={!selectedMaterialId}
                className="w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm disabled:opacity-40 focus:ring-2 focus:ring-indigo-500 truncate"
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
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                3. Topic
                {sidebarTopicsLoading && (
                  <span className="ml-1 text-indigo-400 font-normal normal-case">
                    …
                  </span>
                )}
                {!selectedChapterId && (
                  <span className="ml-1 text-gray-300 font-normal normal-case hidden sm:inline">
                    (pick chapter)
                  </span>
                )}
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={!selectedChapterId || sidebarTopicsLoading}
                className="w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm disabled:opacity-40 focus:ring-2 focus:ring-indigo-500 truncate"
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
                  <p className="text-[11px] text-gray-400 mt-1">No topics.</p>
                )}
            </div>
          </div>

          {/* Active Filter breadcrumb — compact */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-black text-indigo-900 dark:text-indigo-300 text-[11px] uppercase tracking-wider">
                Filter
              </h4>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded-full border">
                {filteredContent.length}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap text-xs font-semibold text-indigo-700 dark:text-indigo-300 leading-tight">
              <span className="truncate max-w-[120px]">
                {selectedMaterial
                  ? selectedMaterial.title || selectedMaterial.name
                  : "All"}
              </span>
              {selectedChapter && (
                <>
                  <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
                  <span className="truncate max-w-[100px]">
                    {selectedChapter.title || selectedChapter.name}
                  </span>
                </>
              )}
              {selectedTopic && (
                <>
                  <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
                  <span className="truncate max-w-[80px] text-indigo-500">
                    {selectedTopic.title || selectedTopic.name}
                  </span>
                </>
              )}
            </div>
            {(selectedMaterialId || selectedChapterId || selectedTopicId) && (
              <button
                onClick={() => {
                  setSelectedMaterialId("");
                  setSelectedChapterId("");
                  setSelectedTopicId("");
                }}
                className="mt-2 w-full text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-lg py-1.5 hover:bg-indigo-50 transition"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* ── Right Main Area ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Content Type Pill Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-1.5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-1 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-gray-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-400"}`}
                  />
                  {tab.label}
                  {isActive && contentStats.filtered > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-black">
                      {contentStats.filtered}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="ml-auto hidden sm:flex items-center gap-1 pl-2 border-l border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-400 font-medium hidden lg:inline">
                View:
              </span>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition ${viewMode === "grid" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition ${viewMode === "table" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                title="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Enhanced Toolbar */}
            <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={`Search ${tabs.find((t) => t.id === activeTab)?.label.toLowerCase()} by title, slug...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-900 transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    <select
                      value={filterPro}
                      onChange={(e) => setFilterPro(e.target.value)}
                      className="px-3 py-2.5 text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All</option>
                      <option value="pro">Pro only</option>
                      <option value="free">Free only</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2.5 text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="title">Title A-Z</option>
                      <option value="duration">Duration</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedItemIds.size > 0 && (
                    <>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                        {selectedItemIds.size} selected
                      </span>
                      <button
                        onClick={handleBulkDelete}
                        disabled={saving}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <button
                        onClick={() => setSelectedItemIds(new Set())}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-xl text-xs font-semibold"
                      >
                        Clear
                      </button>
                    </>
                  )}
                  <span className="hidden sm:inline text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2.5 py-2 rounded-xl border">
                    {filteredContent.length} items • Page {currentPage}/
                    {totalPages}
                  </span>
                  <div className="flex sm:hidden items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-white dark:bg-gray-700 shadow text-indigo-600" : "text-gray-400"}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`p-2 rounded-lg ${viewMode === "table" ? "bg-white dark:bg-gray-700 shadow text-indigo-600" : "text-gray-400"}`}
                    >
                      <LayoutList className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              {/* Mobile filters */}
              <div className="flex sm:hidden items-center gap-2">
                <select
                  value={filterPro}
                  onChange={(e) => setFilterPro(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl"
                >
                  <option value="all">All content</option>
                  <option value="pro">Pro</option>
                  <option value="free">Free</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="title">Title</option>
                </select>
              </div>
              {/* Select all bar */}
              {paginatedContent.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/50">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        paginatedContent.length > 0 &&
                        paginatedContent.every((it) =>
                          selectedItemIds.has(String(it._id || it.id)),
                        )
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Select all on page ({paginatedContent.length})
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Content List */}
            <div>
              {contentLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 animate-pulse"
                    >
                      <div className="flex gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded" />
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-5/6" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-8 sm:py-12 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl px-4">
                  {(() => {
                    const activeTabData = tabs.find((t) => t.id === activeTab);
                    const Icon = activeTabData?.icon || Layers;
                    return (
                      <>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                          <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-400" />
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white mb-1">
                          No {activeTabData?.label} Found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-md mx-auto mb-1 line-clamp-2">
                          {selectedMaterialId || selectedChapterId
                            ? "No matches for current filters. Try broader scope."
                            : "Add your first item. Choose a subject to organize it."}
                        </p>
                        <p className="text-[11px] text-gray-400 mb-4 hidden sm:block">
                          Tip: Filter by Subject → Chapter → Topic
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                          <button
                            onClick={openAddModal}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-md text-sm"
                          >
                            <Plus className="w-4 h-4" /> Add{" "}
                            {activeTabData?.label}
                          </button>
                          {(selectedMaterialId || searchQuery) && (
                            <button
                              onClick={() => {
                                setSelectedMaterialId("");
                                setSelectedChapterId("");
                                setSelectedTopicId("");
                                setSearchQuery("");
                                setFilterPro("all");
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : viewMode === "grid" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-900/30">
                    {paginatedContent.map((item) => {
                      const activeTabData = tabs.find(
                        (t) => t.id === activeTab,
                      );
                      const Icon = activeTabData?.icon || Layers;
                      const idStr = String(item._id || item.id);
                      const isSelected = selectedItemIds.has(idStr);
                      const isPro = !!item.isPro;
                      return (
                        <div
                          key={idStr}
                          className={`group bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-sm border-2 transition-all hover:shadow-md flex flex-col ${isSelected ? "border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10" : "border-gray-100 dark:border-gray-700 hover:border-indigo-200"}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectOne(idStr)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 sm:w-4 sm:h-4"
                                />
                              </label>
                              <div
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${isPro ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"} `}
                              >
                                <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              {isPro && (
                                <span className="hidden sm:inline px-1.5 sm:px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-[10px] font-black border border-amber-200">
                                  PRO
                                </span>
                              )}
                              {isPro && (
                                <span
                                  className="sm:hidden w-2 h-2 bg-amber-500 rounded-full"
                                  title="Pro"
                                />
                              )}
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    item.videoUrl || item.pdfUrl || item.title,
                                  )
                                }
                                className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                title="Copy"
                              >
                                <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-1 sm:p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit"
                              >
                                <Edit className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                            </div>
                          </div>
                          {activeTab === "videos" && item.thumbnail && (
                            <div className="w-full h-20 sm:h-24 rounded-lg sm:rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 mb-2 border">
                              <img
                                loading="lazy"
                                decoding="async"
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                onError={(e) =>
                                  (e.currentTarget.style.display = "none")
                                }
                              />
                            </div>
                          )}
                          <h4
                            className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm mb-0.5 line-clamp-1 leading-tight"
                            title={item.title || item.name}
                          >
                            {item.title || item.name || "Untitled"}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2 min-h-[28px] sm:min-h-[32px] leading-snug">
                            {item.description || "No description."}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {item.duration > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-[10px] sm:text-[11px] font-semibold border border-blue-100">
                                <Clock className="w-3 h-3" />{" "}
                                {Math.floor(item.duration / 60)}m
                              </span>
                            )}
                            {item.pages > 0 && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] sm:text-[11px] font-semibold border border-emerald-100">
                                {" "}
                                {item.pages}p
                              </span>
                            )}
                            {item.fileSize > 0 && (
                              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-[10px] font-medium hidden sm:inline">
                                {(item.fileSize / 1024).toFixed(1)} MB
                              </span>
                            )}
                            {activeTab === "tests" && item.testType && (
                              <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 rounded-full text-[10px] font-semibold capitalize hidden sm:inline">
                                {item.testType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700 mt-auto gap-2">
                            <span className="flex items-center gap-1 truncate">
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleDateString(
                                      "en-IN",
                                      { day: "2-digit", month: "short" },
                                    )
                                  : "N/A"}
                              </span>
                            </span>
                            <span
                              className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${isPro ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                            >
                              {isPro ? "Pro" : "Free"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 sm:p-3 border-t bg-white dark:bg-gray-800">
                      <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 order-2 sm:order-1">
                        {(currentPage - 1) * pageSize + 1}-
                        {Math.min(
                          currentPage * pageSize,
                          filteredContent.length,
                        )}{" "}
                        of {filteredContent.length}
                      </span>
                      <div className="flex items-center gap-1.5 order-1 sm:order-2">
                        <button
                          disabled={currentPage <= 1}
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className="px-2.5 sm:px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-gray-50 text-xs"
                        >
                          Prev
                        </button>
                        <span className="text-xs font-black text-gray-900 dark:text-white px-1.5 sm:px-2">
                          {currentPage}/{totalPages}
                        </span>
                        <button
                          disabled={currentPage >= totalPages}
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className="px-2.5 sm:px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-gray-50 text-xs"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Table View */
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                      <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="px-4 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              paginatedContent.length > 0 &&
                              paginatedContent.every((it) =>
                                selectedItemIds.has(String(it._id || it.id)),
                              )
                            }
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-indigo-600"
                          />
                        </th>
                        <th className="px-3 py-3">Content</th>
                        <th className="px-3 py-3 hidden md:table-cell">
                          Hierarchy
                        </th>
                        <th className="px-3 py-3 hidden lg:table-cell">Meta</th>
                        <th className="px-3 py-3">Access</th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {paginatedContent.map((item) => {
                        const idStr = String(item._id || item.id);
                        const isSelected = selectedItemIds.has(idStr);
                        return (
                          <tr
                            key={idStr}
                            className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition ${isSelected ? "bg-indigo-50/60 dark:bg-indigo-900/20" : ""}`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(idStr)}
                                className="rounded border-gray-300 text-indigo-600"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 border flex items-center justify-center shrink-0">
                                  {activeTab === "videos" && item.thumbnail ? (
                                    <img
                                      loading="lazy"
                                      decoding="async"
                                      src={item.thumbnail}
                                      alt=""
                                      className="w-full h-full object-cover rounded-xl"
                                    />
                                  ) : (
                                    <FileText className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[220px]"
                                    title={item.title || item.name}
                                  >
                                    {item.title || item.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                                    {item.description || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {[
                                  selectedMaterial?.title,
                                  selectedChapter?.title,
                                  selectedTopic?.title,
                                ]
                                  .filter(Boolean)
                                  .join(" › ") || "Unlinked"}
                              </span>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {item.duration ? (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-medium">
                                    {item.duration}s
                                  </span>
                                ) : null}
                                {item.pages ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px]">
                                    {item.pages}p
                                  </span>
                                ) : null}
                                {item.testType ? (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[11px] capitalize">
                                    {item.testType}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`px-2 py-1 rounded-full text-[11px] font-bold border ${item.isPro ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                              >
                                {item.isPro ? "Pro" : "Free"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      item.videoUrl ||
                                        item.pdfUrl ||
                                        item.title,
                                    )
                                  }
                                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                  title="Copy"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t bg-gray-50 dark:bg-gray-900/50">
                      <span className="text-xs text-gray-500">
                        {filteredContent.length} items • Page {currentPage}/
                        {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={currentPage <= 1}
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className="px-3 py-1.5 border rounded-xl text-xs font-bold disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          disabled={currentPage >= totalPages}
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className="px-3 py-1.5 border rounded-xl text-xs font-bold disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
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
                      {/* Subject — enhanced dropdown, no search bar */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center justify-between">
                          <span>Subject</span>
                          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-1.5 py-0.5 rounded-full border">
                            {studyMaterials.length}
                          </span>
                        </label>
                        <div className="relative">
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
                            className="w-full appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 truncate shadow-sm"
                          >
                            <option value="">
                              — Unlinked — ({studyMaterials.length})
                            </option>
                            {studyMaterials.map((m) => (
                              <option
                                key={m._id || m.id}
                                value={String(m._id || m.id)}
                              >
                                {m.title || m.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
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
                    {/* Row 1: Study Material — enhanced dropdown, no search bar */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>
                          Study Material <span className="text-red-500">*</span>
                        </span>
                        <span className="text-[11px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-1.5 py-0.5 rounded-full border">
                          {studyMaterials.length}
                        </span>
                      </label>
                      <div className="relative">
                        <select
                          value={addForm.studyMaterialId || ""}
                          onChange={(e) =>
                            setAdd("studyMaterialId", e.target.value)
                          }
                          className="w-full appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 truncate shadow-sm hover:border-indigo-300 transition"
                        >
                          <option value="">
                            — Select — ({studyMaterials.length})
                          </option>
                          {studyMaterials.map((m) => (
                            <option
                              key={m._id || m.id}
                              value={String(m._id || m.id)}
                            >
                              {m.title || m.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
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
