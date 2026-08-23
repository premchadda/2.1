import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FolderOpen,
  Tag,
  Layers,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { logger } from "../../../shared/lib/logger.js";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import {
  validateForm,
  topicSchema,
} from "../../../shared/lib/validationSchemas.js";

const LEVEL_LABELS = {
  subject: "Subject",
  topic: "Topic",
  subtopic: "Subtopic",
};

const LEVEL_ICONS = {
  subject: "📖",
  topic: "📚",
  subtopic: "📝",
};

export default function SubjectHierarchyManager() {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLevel, setFormLevel] = useState("subject");
  const [formParentId, setFormParentId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    order: 0,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, topicsRes, chaptersRes] = await Promise.allSettled([
        apiClient.get("/admin/subjects"),
        apiClient.get("/admin/topics"),
        apiClient.get("/admin/chapters"),
      ]);

      if (
        subjectsRes.status === "fulfilled" &&
        subjectsRes.value.data?.success
      ) {
        setSubjects(subjectsRes.value.data.data || []);
      }
      if (topicsRes.status === "fulfilled" && topicsRes.value.data?.success) {
        setTopics(topicsRes.value.data.data || []);
      }
      if (
        chaptersRes.status === "fulfilled" &&
        chaptersRes.value.data?.success
      ) {
        setChapters(chaptersRes.value.data.data || []);
      }
    } catch (error) {
      logger.error("Failed to fetch hierarchy data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const toggleExpand = (nodeId) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const openCreateForm = (level, parentId = null) => {
    setFormLevel(level);
    setFormParentId(parentId);
    setEditingItem(null);
    setFormData({ name: "", slug: "", description: "", icon: "", order: 0 });
    setShowForm(true);
  };

  const openEditForm = (item, level) => {
    setFormLevel(level);
    setEditingItem(item);
    setFormParentId(null);
    setFormData({
      name: item.name || "",
      slug: item.slug || "",
      description: item.description || "",
      icon: item.icon || "",
      order: item.order || item.displayOrder || 0,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormParentId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (formLevel !== "subject" && !formParentId && !editingItem?.subject && !editingItem?.subjectId && !editingItem?.parentTopic && !editingItem?.parentId) {
      toast.error(`Please select a parent ${formLevel === "subtopic" ? "topic" : "subject"}`);
      return;
    }

    const slug = formData.slug || generateSlug(formData.name);

    if (formLevel === "topic" || formLevel === "subtopic") {
      const effectiveSubjectId = formParentId || editingItem?.subjectId || editingItem?.subject || "";
      // Only validate subjectId for topic level; subtopic validates via parentTopic
      if (formLevel === "topic") {
        const validationData = {
          name: formData.name,
          slug,
          subjectId: effectiveSubjectId,
          description: formData.description,
          order: formData.order || 0,
          isActive: true,
        };
        const result = validateForm(topicSchema, validationData);
        if (!result.success) {
          const firstError = Object.values(result.errors)[0];
          toast.error(firstError);
          return;
        }
      }
    }

    try {
      if (formLevel === "subject") {
        const payload = {
          name: formData.name,
          slug,
          description: formData.description,
          icon: formData.icon,
          order: formData.order,
        };
        if (editingItem) {
          await apiClient.put(
            `/admin/subjects/${editingItem._id || editingItem.id}`,
            payload,
          );
          toast.success("Subject updated");
        } else {
          await apiClient.post("/admin/subjects", payload);
          toast.success("Subject created");
        }
      } else if (formLevel === "topic") {
        const payload = {
          name: formData.name,
          slug,
          description: formData.description,
          icon: formData.icon,
          order: Number(formData.order) || 0,
          subjectId:
            formParentId ||
            editingItem?.subjectId ||
            editingItem?.subject ||
            null,
          subject:
            formParentId ||
            editingItem?.subjectId ||
            editingItem?.subject ||
            null,
        };
        if (editingItem) {
          await apiClient.put(
            `/admin/topics/${editingItem._id || editingItem.id}`,
            payload,
          );
          toast.success("Topic updated");
        } else {
          await apiClient.post("/admin/topics", payload);
          toast.success("Topic created");
        }
      } else if (formLevel === "subtopic") {
        const payload = {
          name: formData.name,
          slug,
          description: formData.description,
          icon: formData.icon,
          order: Number(formData.order) || 0,
          parentTopic:
            formParentId ||
            editingItem?.parentTopic ||
            editingItem?.parentId ||
            null,
          topicId:
            formParentId ||
            editingItem?.parentTopic ||
            editingItem?.parentId ||
            null,
        };
        if (editingItem) {
          await apiClient.put(
            `/admin/topics/${editingItem._id || editingItem.id}`,
            payload,
          );
          toast.success("Subtopic updated");
        } else {
          await apiClient.post("/admin/topics", payload);
          toast.success("Subtopic created");
        }
      }

      closeForm();
      await fetchAllData();
    } catch (error) {
      logger.error("Failed to save:", error);
      toast.error(error.response?.data?.message || "Failed to save");
    }
  };

  const handleDelete = async (item, level) => {
    const confirmed = await confirmOnce({
      title: `Delete ${level}`,
      message: `Are you sure you want to delete "${item.name}"? This will also delete any nested items.`,
      confirmText: "Delete",
      confirmStyle: "danger",
    });
    if (!confirmed) return;

    try {
      if (level === "subject") {
        await apiClient.delete(`/admin/subjects/${item._id || item.id}`);
      } else {
        await apiClient.delete(`/admin/topics/${item._id || item.id}`);
      }
      toast.success(`${level} deleted`);
      await fetchAllData();
    } catch (error) {
      logger.error("Failed to delete:", error);
      toast.error(`Failed to delete ${level}`);
    }
  };

  const getTopicChildren = useCallback(
    (parentId) => {
      return topics.filter((t) => String(t.parentTopic) === String(parentId));
    },
    [topics],
  );

  const getSubjectTopics = useCallback(
    (subjectId) => {
      return topics.filter(
        (t) => String(t.subject) === String(subjectId) && !t.parentTopic,
      );
    },
    [topics],
  );

  const getSubjectChapters = useCallback(
    (subjectId) => {
      return chapters.filter(
        (c) => String(c.studyMaterialId || c.subject) === String(subjectId),
      );
    },
    [chapters],
  );

  const getSubjectName = useCallback(
    (subjectId) => {
      const subject = subjects.find(
        (s) => String(s.id || s._id) === String(subjectId),
      );
      return subject?.name || "";
    },
    [subjects],
  );

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return { subjects, topics };
    const q = searchQuery.toLowerCase();
    const matchingSubjects = subjects.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) || s.slug?.toLowerCase().includes(q),
    );
    const matchingTopics = topics.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) || t.slug?.toLowerCase().includes(q),
    );
    return { subjects: matchingSubjects, topics: matchingTopics };
  }, [searchQuery, subjects, topics]);

  // Revived: parentOptions was undefined crash - compute based on formLevel
  const parentOptions = useMemo(() => {
    if (formLevel === "topic") {
      return subjects.map((s) => ({
        id: String(s._id || s.id),
        label: s.name || s.title || "Unnamed Subject",
      }));
    }
    if (formLevel === "subtopic") {
      return topics.map((t) => ({
        id: String(t._id || t.id),
        label: t.name || t.title || "Unnamed Topic",
      }));
    }
    return [];
  }, [formLevel, subjects, topics]);

  const renderSubtopicTree = (subtopic, depth = 1, visited = new Set()) => {
    const subtopicId = subtopic.id || subtopic._id;
    if (depth > 20 || visited.has(subtopicId)) return null;
    const newVisited = new Set(visited).add(subtopicId);
    const children = getTopicChildren(subtopicId);
    const isExpanded = expandedNodes[subtopicId];

    return (
      <div key={subtopicId}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 group"
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          {children.length > 0 ? (
            <button
              onClick={() => toggleExpand(subtopicId)}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}
          <span className="text-sm">{subtopic.icon || "📝"}</span>
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
            {subtopic.name}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => openEditForm(subtopic, "subtopic")}
              className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-500"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDelete(subtopic, "subtopic")}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        {isExpanded &&
          children.map((child) =>
            renderSubtopicTree(child, depth + 1, newVisited),
          )}
      </div>
    );
  };

  const renderTopicRow = (topic, depth) => {
    const topicId = topic.id || topic._id;
    const subtopics = getTopicChildren(topicId);
    const isExpanded = expandedNodes[topicId];

    return (
      <div key={topicId}>
        <div
          className="flex items-center gap-2 py-2.5 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 group border-b border-gray-50"
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          {subtopics.length > 0 ? (
            <button
              onClick={() => toggleExpand(topicId)}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}
          <span>{topic.icon || "📚"}</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">
              {topic.name}
            </span>
            {topic.slug && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                {topic.slug}
              </span>
            )}
          </div>
          {subtopics.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full font-medium">
              {subtopics.length} sub
            </span>
          )}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => openCreateForm("subtopic", topicId)}
              className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-green-500"
              title="Add subtopic"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => openEditForm(topic, "topic")}
              className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-500"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(topic, "topic")}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {isExpanded && subtopics.map((st) => renderSubtopicTree(st, depth + 1))}
      </div>
    );
  };

  const renderSubjectCard = (subject) => {
    const subjectId = subject.id || subject._id;
    const subjectTopics = getSubjectTopics(subjectId);
    const subjectChapters = getSubjectChapters(subjectId);
    const isExpanded = expandedNodes[subjectId];
    const totalChildren = subjectTopics.length + subjectChapters.length;

    return (
      <div
        key={subjectId}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div
          className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group"
          onClick={() => toggleExpand(subjectId)}
        >
          {totalChildren > 0 ? (
            isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )
          ) : (
            <div className="w-5" />
          )}
          <span className="text-2xl">{subject.icon || "📖"}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {subject.name}
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-600">
                Subject
              </span>
              {subjectTopics.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 dark:bg-green-900/20 text-green-600">
                  {subjectTopics.length} topic
                  {subjectTopics.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {subject.slug && (
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {subject.slug}
              </p>
            )}
            {subject.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {subject.description}
              </p>
            )}
          </div>
          <div
            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => openCreateForm("topic", subjectId)}
              className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-green-500"
              title="Add topic"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => openEditForm(subject, "subject")}
              className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-500"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(subject, "subject")}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isExpanded && totalChildren > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            {subjectChapters.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Chapters (
                  {subjectChapters.length})
                </div>
                {subjectChapters.map((ch) => (
                  <div
                    key={ch.id || ch._id}
                    className="flex items-center gap-2 py-2 px-4 pl-12 hover:bg-gray-50 dark:hover:bg-gray-800 group border-b border-gray-50"
                  >
                    <span className="text-sm">📄</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                      {ch.name || ch.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {subjectTopics.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Topics ({subjectTopics.length})
                </div>
                {subjectTopics.map((topic) => renderTopicRow(topic, 2))}
              </div>
            )}
          </div>
        )}

        {isExpanded && totalChildren === 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-4 text-center text-sm text-gray-400 dark:text-gray-500">
            No topics or chapters yet. Click + to add a topic.
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const displaySubjects = filteredTree ? filteredTree.subjects : subjects;

  return (
    <div className="p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Subject Hierarchy
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage subjects, topics, and subtopics in a tree structure
          </p>
        </div>
        <button
          onClick={() => openCreateForm("subject")}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {subjects.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Subjects
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {topics.filter((t) => !t.parentTopic).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Topics</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {topics.filter((t) => t.parentTopic).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Subtopics
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search subjects and topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-2">
        {displaySubjects.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 dark:text-gray-400">
              No subjects found
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Create your first subject to get started
            </p>
          </div>
        ) : (
          displaySubjects.map((subject) => renderSubjectCard(subject))
        )}

        {filteredTree && filteredTree.topics.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Matching Topics
            </h3>
            {filteredTree.topics.map((topic) => (
              <div
                key={topic._id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3 mb-1"
              >
                <span>{topic.icon || "📚"}</span>
                <div className="flex-1">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {topic.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                    {getSubjectName(topic.subject)}
                  </span>
                </div>
                <button
                  onClick={() => openEditForm(topic, "topic")}
                  className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-500"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
              <div className="p-5 sm:p-6">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingItem
                      ? `Edit ${LEVEL_LABELS[formLevel]}`
                      : `Add ${LEVEL_LABELS[formLevel]}`}
                  </h2>
                  <button
                    onClick={closeForm}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          name,
                          slug: editingItem ? prev.slug : generateSlug(name),
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      placeholder={`e.g., ${formLevel === "subject" ? "Mathematics" : formLevel === "topic" ? "Algebra" : "Quadratic Equations"}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          slug: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="auto-generated-from-name"
                    />
                  </div>

                  {formLevel !== "subject" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Parent {formLevel === "subtopic" ? "Topic" : "Subject"}
                      </label>
                      <select
                        value={formParentId || formData.parentId || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setFormParentId(val);
                          setFormData((prev) => ({ ...prev, parentId: val }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                        aria-label="Parent selection"
                      >
                        <option value="">None (Top Level)</option>
                        {parentOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="Brief description..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Icon (Lucide name)
                      </label>
                      <input
                        type="text"
                        value={formData.icon}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            icon: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                        placeholder="e.g., BookOpen"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={formData.displayOrder}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            displayOrder: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="isActive"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Active
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-md shadow-indigo-500/20 transition"
                    >
                      <Save className="w-4 h-4" />
                      {editingItem ? "Update" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export { SubjectHierarchyManager as SubjectHierarchyView };
