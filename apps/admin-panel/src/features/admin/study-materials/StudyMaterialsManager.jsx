import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  ChevronRight,
  ChevronDown,
  GitBranch,
  ListChecks,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import apiClient from "../../../shared/api/adminApi";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import CurriculumBuilder from "./CurriculumBuilder";
import SubjectRelationsManager from "./SubjectRelationsManager";
import TopicsManager from "./TopicsManager";

// Robust ID, ParentID, and Order extractors
const getSubjectId = (s) => String(s?._id ?? s?.id ?? "");

const getSubjectParentId = (s) => {
  const p = s?.parentId ?? s?.parent_id;
  return p !== null && p !== undefined && p !== "" ? String(p) : null;
};

const getSubjectOrder = (s) => {
  const ord = s?.order ?? s?.sort_order ?? s?.sortOrder;
  if (ord !== undefined && ord !== null && ord !== "") {
    const num = Number(ord);
    if (!isNaN(num)) return num;
  }
  return 0;
};

const sortSubjects = (list) => {
  return [...list].sort((a, b) => {
    const orderA = getSubjectOrder(a);
    const orderB = getSubjectOrder(b);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const nameA = a?.name || "";
    const nameB = b?.name || "";
    return nameA.localeCompare(nameB);
  });
};

const SUBJECT_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#ef4444",
];

const paletteColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return SUBJECT_PALETTE[Math.abs(hash) % SUBJECT_PALETTE.length];
};

const SubjectTreeNode = ({
  subject,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
  expandedNodes,
  toggleExpand,
  allSubjects,
}) => {
  if (level > 20) return null;
  const subjectId = getSubjectId(subject);
  const isExpanded = expandedNodes.has(subjectId);

  const children = useMemo(() => {
    return sortSubjects(
      allSubjects.filter((s) => getSubjectParentId(s) === subjectId),
    );
  }, [allSubjects, subjectId]);

  const hasChildren = children.length > 0;
  const orderNum = getSubjectOrder(subject);

  return (
    <div className="relative">
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600/50 transition-all duration-200 group mb-3`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <div className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <button
              onClick={() => toggleExpand(subjectId)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                hasChildren
                  ? "hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                  : "opacity-0 cursor-default"
              }`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              disabled={!hasChildren}
            >
              {hasChildren &&
                (isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                ))}
            </button>

            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner shrink-0 transition-transform group-hover:scale-105"
              style={{
                backgroundColor:
                  (subject.color || paletteColor(subject.name)) + "18",
                borderColor:
                  (subject.color || paletteColor(subject.name)) + "30",
                borderWidth: "1px",
              }}
            >
              {subject.icon || "📚"}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 dark:text-white text-base tracking-tight truncate">
                  {subject.name}
                </h3>

                {/* Order Badge */}
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  Order #{orderNum}
                </span>

                {/* Sub-subjects Badge */}
                {hasChildren ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    {children.length}{" "}
                    {children.length === 1 ? "sub-subject" : "sub-subjects"}
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400">
                    Root Direct
                  </span>
                )}

                {/* Active Status Badge */}
                {subject.isActive !== false ? (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                    Disabled
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-mono bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                  slug: {subject.slug}
                </span>
                {subject.description && (
                  <span className="truncate hidden md:inline text-gray-500 dark:text-gray-400">
                    {subject.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onEdit(subject)}
              className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 cursor-pointer"
              title="Edit subject"
              aria-label="Edit subject"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(subjectId)}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition border border-transparent hover:border-red-200 dark:hover:border-red-800 cursor-pointer"
              title="Delete subject"
              aria-label="Delete subject"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {subject.description && (
          <div className="px-5 pb-4 pt-0 md:hidden">
            <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
              {subject.description}
            </p>
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="border-l-2 border-indigo-100 dark:border-indigo-900/40 space-y-1 my-1">
          {children.map((child) => (
            <SubjectTreeNode
              key={getSubjectId(child)}
              subject={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              allSubjects={allSubjects}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function SubjectsPanel() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    icon: "📚",
    color: "#667eea",
    description: "",
    order: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/admin/subjects");
      if (response.data?.success) {
        setSubjects(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
      toast.error("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = useCallback((id) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        sort_order: formData.order,
        sortOrder: formData.order,
      };

      if (editingSubject) {
        const subId = getSubjectId(editingSubject);
        await apiClient.put(`/admin/subjects/${subId}`, payload);
        toast.success("Subject updated successfully");
      } else {
        await apiClient.post("/admin/subjects", payload);
        toast.success("Subject created successfully");
      }
      fetchSubjects();
      resetForm();
    } catch (error) {
      console.error("Failed to save subject:", error);
      toast.error("Failed to save subject");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Subject",
      message:
        "Are you sure you want to delete this subject? ALL CHILD SUBJECTS WILL ALSO BE DELETED RECURSIVELY!",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/admin/subjects/${id}`);
      toast.success("Subject deleted successfully");
      fetchSubjects();
    } catch (error) {
      console.error("Failed to delete subject:", error);
      toast.error("Failed to delete subject");
    }
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      slug: subject.slug,
      icon: subject.icon || "📚",
      color: subject.color || "#667eea",
      description: subject.description || "",
      order: getSubjectOrder(subject),
      isActive: subject.isActive !== false,
    });
    setShowForm(true);
  };

  const handleAddChild = (parentSubject) => {
    setEditingSubject(null);
    setFormData({
      name: "",
      slug: "",
      icon: "📚",
      color: "#667eea",
      description: "",
      order: 0,
      isActive: true,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingSubject(null);
    setFormData({
      name: "",
      slug: "",
      icon: "📚",
      color: "#667eea",
      description: "",
      order: 0,
      isActive: true,
    });
    setShowForm(false);
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingSubject ? prev.slug : generateSlug(name),
    }));
  };

  const rootSubjects = useMemo(() => {
    return sortSubjects(subjects.filter((s) => !getSubjectParentId(s)));
  }, [subjects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Subjects Tree Hierarchy
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Root subjects and nested sub-subjects strictly ordered by Display
            Order
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-sm rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>

      <div className="space-y-3">
        {rootSubjects.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              No Subjects Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Add subjects to build your curriculum hierarchy
            </p>
          </div>
        ) : (
          rootSubjects.map((subject) => (
            <SubjectTreeNode
              key={getSubjectId(subject)}
              subject={subject}
              level={0}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              allSubjects={subjects}
            />
          ))
        )}
      </div>

      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    {editingSubject ? "Edit Subject" : "Add New Subject"}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Subject Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleNameChange}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder="e.g., Quantitative Aptitude"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Slug *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Icon Emoji
                      </label>
                      <input
                        type="text"
                        value={formData.icon}
                        onChange={(e) =>
                          setFormData({ ...formData, icon: e.target.value })
                        }
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Theme Color
                      </label>
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        className="w-full h-11 px-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer"
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
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder="Brief description of this subject..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Order #
                      </label>
                      <input
                        type="number"
                        value={formData.order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            order: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                      />
                    </div>

                    <div className="flex items-center pt-6">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                        id="isActive"
                      />
                      <label
                        htmlFor="isActive"
                        className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        Active Status
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Save Subject
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

export default function StudyMaterialsManager() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = [
    {
      id: "subjects",
      label: "Subjects",
      icon: BookOpen,
      Component: SubjectsPanel,
      description: "Manage root subjects",
    },
    {
      id: "curriculum",
      label: "Curriculum Builder",
      icon: Layers,
      Component: CurriculumBuilder,
      description: "Build deeply nested topic hierarchy",
    },
    {
      id: "subject-relations",
      label: "Subject Relations",
      icon: GitBranch,
      Component: SubjectRelationsManager,
      description: "View subject-chapter-topic-test relations",
    },
    {
      id: "topics",
      label: "Topics",
      icon: ListChecks,
      Component: TopicsManager,
      description: "Manage topics within chapters",
    },
  ];

  const tabParam = searchParams.get("tab");
  const activeTab = tabs.some((t) => t.id === tabParam) ? tabParam : "subjects";

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.Component;

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3.5 sm:space-y-4">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3.5">
          <div>
            <h1 className="text-base sm:text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shadow-xs border border-indigo-100 dark:border-indigo-900/50">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              Study Materials & Curriculum Hub
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl font-medium">
              Build your curriculum hierarchy here. Start by creating a Subject,
              then add nested Chapters and Topics.
            </p>
          </div>
        </div>

        {/* Highlighted Pill Tab Navigation */}
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-1 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap tap-feedback ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white shadow-sm shadow-indigo-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isActive ? "text-white scale-110" : "text-gray-400 dark:text-gray-500"}`}
                />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Component View */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs min-h-[400px] animate-page-transit overflow-hidden">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
