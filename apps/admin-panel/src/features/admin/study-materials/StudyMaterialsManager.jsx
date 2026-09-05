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
  Sparkles,
  ArrowUpDown,
  Palette,
  Hash,
  Type,
  AlignLeft,
  Eye,
  EyeOff,
  Minus,
} from "lucide-react";
import { apiClient } from "../../../shared/api/adminApi";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import CurriculumBuilder from "./CurriculumBuilder";
import SubjectRelationsManager from "./SubjectRelationsManager";

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
  const subjectId = getSubjectId(subject);
  const isExpanded = expandedNodes.has(subjectId);

  const children = useMemo(() => {
    if (level > 20) return [];
    return sortSubjects(
      allSubjects.filter((s) => getSubjectParentId(s) === subjectId),
    );
  }, [allSubjects, subjectId, level]);

  if (level > 20) return null;

  const hasChildren = children.length > 0;
  const orderNum = getSubjectOrder(subject);

  return (
    <div className="relative">
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600/50 transition-all duration-200 group mb-2 sm:mb-3`}
        style={{ marginLeft: `${level * 12}px` }}
      >
        <div className="p-2.5 sm:p-5 flex flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
            <button
              onClick={() => toggleExpand(subjectId)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                hasChildren
                  ? "hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                  : "opacity-0 cursor-default hidden sm:flex"
              }`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              disabled={!hasChildren}
            >
              {hasChildren &&
                (isExpanded ? (
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                ))}
            </button>

            <div
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-2xl shadow-inner shrink-0 transition-transform group-hover:scale-105"
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
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <h3
                  className="font-bold text-gray-900 dark:text-white text-sm sm:text-base tracking-tight truncate"
                  title={subject.name}
                >
                  {subject.name}
                </h3>

                {/* Order Badge */}
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 rounded-full font-mono font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                  <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                  #{orderNum}
                </span>

                {/* Sub-subjects Badge */}
                {hasChildren ? (
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1">
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    {children.length}
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400">
                    Root Direct
                  </span>
                )}

                {/* Active Status Badge */}
                {subject.isActive !== false ? (
                  <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                    Active
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                    Disabled
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                <span
                  className="font-mono bg-gray-100 dark:bg-gray-700/50 px-1.5 sm:px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 truncate max-w-[28vw] sm:max-w-none"
                  title={subject.slug}
                >
                  {subject.slug}
                </span>
                {subject.description && (
                  <span
                    className="truncate hidden md:inline text-gray-500 dark:text-gray-400"
                    title={subject.description}
                  >
                    {subject.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              onClick={() => onEdit(subject)}
              className="p-1.5 sm:p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 cursor-pointer"
              title={`Edit ${subject.name}`}
              aria-label={`Edit subject ${subject.name}`}
            >
              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => onAddChild(subject)}
              className="p-1.5 sm:p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 cursor-pointer"
              title={`Add child to ${subject.name}`}
              aria-label={`Add child to ${subject.name}`}
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => onDelete(subjectId)}
              className="p-1.5 sm:p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition border border-transparent hover:border-red-200 dark:hover:border-red-800 cursor-pointer"
              title={`Delete ${subject.name}`}
              aria-label={`Delete subject ${subject.name}`}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {subject.description && (
          <div className="px-3 sm:px-5 pb-2.5 sm:pb-4 pt-0 md:hidden">
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 p-2 sm:p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 line-clamp-2">
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
    parentId: null,
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
        name: formData.name?.trim(),
        slug: formData.slug?.trim(),
        icon: formData.icon,
        color: formData.color,
        description: formData.description?.trim(),
        order: formData.order,
        parentId: formData.parentId || null,
        isActive: formData.isActive,
        sort_order: formData.order,
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
      parentId: getSubjectParentId(subject),
    });
    setShowForm(true);
  };

  const handleAddChild = (parentSubject) => {
    const parentId = getSubjectId(parentSubject);
    setEditingSubject(null);
    setFormData({
      name: "",
      slug: "",
      icon: "📚",
      color: "#667eea",
      description: "",
      order: 0,
      isActive: true,
      parentId,
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
      parentId: null,
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
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 leading-tight truncate">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
            <span className="truncate">Subjects Tree Hierarchy</span>
          </h2>
          <p className="text-[11px] sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 leading-tight line-clamp-2 sm:line-clamp-none">
            Root subjects and nested sub-subjects strictly ordered by Display
            Order
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-xs sm:text-sm rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">Add Subject</span>
          <span className="sm:hidden">Add</span>
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-2 sm:p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-[18px] sm:rounded-[24px] max-w-[520px] w-full max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] overflow-y-auto overscroll-contain border border-white/20 dark:border-gray-700 my-auto animate-scale-in">
              {/* Header intentionally stays in normal flow; it scrolls with the form. */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_50%)]" />
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
                    backgroundSize: "24px 24px",
                  }}
                />
                <div className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-5">
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex gap-3 sm:gap-4 min-w-0 flex-1">
                      <div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-[26px] shadow-lg shrink-0 border backdrop-blur-md"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.15)",
                          borderColor: "rgba(255,255,255,0.22)",
                        }}
                      >
                        <span className="drop-shadow-sm">
                          {formData.icon || "📚"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <h3 className="text-[17px] sm:text-[19px] font-black text-white tracking-tight leading-none">
                          {editingSubject ? "Edit Subject" : "New Subject"}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-indigo-100/90 font-medium mt-1.5 leading-tight">
                          {editingSubject
                            ? "Update subject details and appearance"
                            : "Create a new subject for your curriculum"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetForm}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition shrink-0"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                  {formData.name && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full pl-1.5 pr-3 py-1 max-w-full">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[13px] shrink-0 border bg-white shadow-sm"
                        style={{ borderColor: `${formData.color}30` }}
                      >
                        {formData.icon}
                      </span>
                      <span className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-[160px]">
                        {formData.name}
                      </span>
                      <span className="hidden sm:inline text-[11px] font-mono text-indigo-100/70 truncate">
                        /{formData.slug || generateSlug(formData.name)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5"
              >
                {/* Subject Name */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.1em] uppercase text-gray-500 dark:text-gray-400">
                    <Type className="w-3 h-3 text-indigo-500" />
                    Subject Name{" "}
                    <span className="text-red-500 normal-case tracking-normal">
                      *
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleNameChange}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold placeholder:text-gray-400 placeholder:font-medium transition-all outline-none"
                      placeholder="e.g., Quantitative Aptitude"
                    />
                  </div>
                </div>

                {/* Slug */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.1em] uppercase text-gray-500 dark:text-gray-400">
                    <Hash className="w-3 h-3 text-indigo-500" />
                    Slug <span className="text-red-500">*</span>
                    <span className="ml-auto text-[10px] font-bold normal-case tracking-normal text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                      auto
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs select-none">
                      /
                    </span>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value })
                      }
                      className="w-full pl-7 pr-4 py-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-mono font-medium placeholder:text-gray-400 transition-all outline-none"
                      placeholder="quantitative-aptitude"
                    />
                  </div>
                </div>

                {/* Icon + Color */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.1em] uppercase text-gray-500 dark:text-gray-400">
                      <Sparkles className="w-3 h-3 text-indigo-500" /> Icon
                    </label>
                    <div className="relative flex items-center">
                      <div
                        className="absolute left-1.5 w-9 h-9 rounded-xl flex items-center justify-center text-xl border shadow-sm pointer-events-none"
                        style={{
                          backgroundColor: `${formData.color}14`,
                          borderColor: `${formData.color}28`,
                        }}
                      >
                        {formData.icon || "📚"}
                      </div>
                      <input
                        type="text"
                        value={formData.icon}
                        onChange={(e) =>
                          setFormData({ ...formData, icon: e.target.value })
                        }
                        maxLength={2}
                        className="w-full pl-[52px] pr-3 py-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-center text-xl transition-all outline-none"
                        placeholder="📚"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.1em] uppercase text-gray-500 dark:text-gray-400">
                      <Palette className="w-3 h-3 text-indigo-500" /> Theme
                    </label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-xl p-1.5 pr-3 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-gray-900 transition-all">
                      <div
                        className="relative w-9 h-9 rounded-lg border shadow-sm shrink-0 overflow-hidden"
                        style={{
                          backgroundColor: formData.color,
                          borderColor: `${formData.color}40`,
                        }}
                      >
                        <input
                          type="color"
                          value={formData.color}
                          onChange={(e) =>
                            setFormData({ ...formData, color: e.target.value })
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <span className="flex-1 font-mono text-xs font-bold text-gray-700 dark:text-gray-300 tracking-wide truncate">
                        {formData.color.toUpperCase()}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0">
                        <Palette className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.1em] uppercase text-gray-500 dark:text-gray-400">
                    <AlignLeft className="w-3 h-3 text-indigo-500" />{" "}
                    Description
                    <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-gray-400">
                      optional
                    </span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm placeholder:text-gray-400 resize-none transition-all outline-none"
                    placeholder="Brief description of this subject..."
                  />
                </div>

                {/* Order + Active */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.1em] uppercase text-gray-500 dark:text-gray-400">
                      <ArrowUpDown className="w-3 h-3 text-indigo-500" /> Order
                    </label>
                    <div className="flex items-center bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-xl p-1 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-gray-900 transition-all">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            order: Math.max(0, (p.order || 0) - 1),
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-indigo-200 hover:text-indigo-600 transition shrink-0"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={formData.order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            order: parseInt(e.target.value) || 0,
                          })
                        }
                        className="flex-1 min-w-0 bg-transparent text-center text-sm font-mono font-bold outline-none py-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            order: (p.order || 0) + 1,
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-indigo-200 hover:text-indigo-600 transition shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.1em] uppercase text-gray-500 dark:text-gray-400">
                      {formData.isActive ? (
                        <Eye className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-gray-400" />
                      )}{" "}
                      Visibility
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({ ...p, isActive: !p.isActive }))
                      }
                      className={`w-full flex items-center justify-between gap-2 px-3 py-[9px] rounded-xl border-2 font-bold text-xs sm:text-sm transition-all ${
                        formData.isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                          : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${formData.isActive ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`}
                        />
                        {formData.isActive ? "Active" : "Hidden"}
                      </span>
                      <span
                        className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-all ${formData.isActive ? "bg-emerald-500 justify-end" : "bg-gray-300 dark:bg-gray-600 justify-start"}`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2.5 sm:gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 sm:flex-none px-5 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {editingSubject ? "Save Changes" : "Create Subject"}
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
