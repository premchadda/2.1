import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  MessageCircle,
  Search,
  Plus,
  CheckCircle2,
  Eye,
  ChevronRight,
  X,
  Users,
  Lock as LockIcon,
  Globe,
  Crown,
  MessageSquare,
  ArrowLeft,
  Trash2,
  Send,
  FileText,
  Pin,
  Heart,
  AlertCircle,
  Loader2,
  ThumbsUp,
  HelpCircle,
  Check,
  LogOut,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../../shared/providers/AuthContext";
import { apiClient } from "../../shared/lib/dataService";
import { toast } from "react-hot-toast";
import { useConfirm } from "../../shared/components/common/ConfirmModal.jsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Breadcrumb from "../../shared/components/common/Breadcrumb";

// Avatar Gradient generator
const AVATAR_GRADIENTS = [
  "from-indigo-600 to-purple-600",
  "from-blue-600 to-cyan-600",
  "from-emerald-600 to-teal-600",
  "from-amber-600 to-orange-600",
  "from-rose-600 to-pink-600",
  "from-violet-600 to-fuchsia-600",
];

const getAvatarGradient = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  const sum = String(name)
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
};

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

/* =========================================================================
   COMMUNITY HUB (DOUBTS & STUDY GROUPS)
   ========================================================================= */

function CommunityHubView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState("doubts"); // 'doubts' | 'groups' | 'my-groups'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'unsolved' | 'answered'
  const [showAskForm, setShowAskForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDoubt, setSelectedDoubt] = useState(null);

  // Forms
  const [newDoubt, setNewDoubt] = useState({
    title: "",
    description: "",
    category: "general",
    tags: "",
  });
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    category: "general",
    isPrivate: false,
    maxMembers: 50,
  });

  const buildQueryStr = useCallback((category, search) => {
    const params = new URLSearchParams();
    if (category && category !== "all") params.append("category", category);
    if (search) params.append("search", search);
    return params.toString();
  }, []);

  // Doubts Query
  const {
    data: doubtsData = [],
    isLoading: loadingDoubts,
    refetch: refetchDoubts,
  } = useQuery({
    queryKey: ["doubts", selectedCategory, searchQuery],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/doubts?${buildQueryStr(selectedCategory, searchQuery)}`,
      );
      return res.data?.data || [];
    },
    enabled: activeTab === "doubts",
    staleTime: 1000 * 60 * 2,
  });

  // Doubt Categories
  const { data: doubtCategories = [] } = useQuery({
    queryKey: ["doubt-categories"],
    queryFn: async () => {
      const res = await apiClient.get("/api/doubts/categories");
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Groups Query
  const {
    data: groupsData = [],
    isLoading: loadingGroups,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ["study-groups", selectedCategory, searchQuery],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/study-groups?${buildQueryStr(selectedCategory, searchQuery)}`,
      );
      return res.data?.data || [];
    },
    enabled: activeTab === "groups" || activeTab === "my-groups",
    staleTime: 1000 * 60 * 2,
  });

  // Group Categories
  const { data: groupCategories = [] } = useQuery({
    queryKey: ["group-categories"],
    queryFn: async () => {
      const res = await apiClient.get("/api/study-groups/categories");
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  // My Groups Query
  const { data: myGroups = [], isLoading: loadingMyGroups } = useQuery({
    queryKey: ["my-study-groups"],
    queryFn: async () => {
      const res = await apiClient.get("/api/study-groups/my");
      return res.data?.data || [];
    },
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 2,
  });

  // Mutations
  const askDoubtMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags
          ? data.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };
      const res = await apiClient.post("/api/doubts", payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doubts"] });
      setShowAskForm(false);
      setNewDoubt({
        title: "",
        description: "",
        category: "general",
        tags: "",
      });
      toast.success("Your question has been posted to the community!");
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Failed to post your question",
      );
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/api/study-groups", data);
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["study-groups"] });
      queryClient.invalidateQueries({ queryKey: ["my-study-groups"] });
      setShowCreateForm(false);
      setNewGroup({
        name: "",
        description: "",
        category: "general",
        isPrivate: false,
        maxMembers: 50,
      });
      toast.success("Study circle created successfully!");
      if (data?._id || data?.id) {
        navigate(`/community/groups/${data._id || data.id}`);
      }
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Failed to create study group",
      );
    },
  });

  const handleAskDoubt = (e) => {
    e.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: "/community" } });
      return;
    }
    if (!newDoubt.title.trim() || !newDoubt.description.trim()) {
      toast.error("Please provide a title and question details");
      return;
    }
    askDoubtMutation.mutate(newDoubt);
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: "/community" } });
      return;
    }
    if (!newGroup.name.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    createGroupMutation.mutate(newGroup);
  };

  // Filtered Doubts — virtualized: only render 20 at a time (was 100+ DOM nodes)
  const filteredDoubts = useMemo(() => {
    return doubtsData.filter((doubt) => {
      if (statusFilter === "answered" && !doubt.isAnswered) return false;
      if (statusFilter === "unsolved" && doubt.isAnswered) return false;
      return true;
    });
  }, [doubtsData, statusFilter]);
  const [doubtsVisible, setDoubtsVisible] = useState(20);
  const visibleDoubts = useMemo(
    () => filteredDoubts.slice(0, doubtsVisible),
    [filteredDoubts, doubtsVisible],
  );
  useEffect(() => {
    setDoubtsVisible(20);
  }, [filteredDoubts]);

  const categories = activeTab === "doubts" ? doubtCategories : groupCategories;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-16">
      <Helmet>
        <title>Community Hub & Study Circles | Trstprep</title>
        <meta
          name="description"
          content="Collaborate with fellow aspirants. Ask subject doubts, get verified solutions, and join active peer study circles on Trstprep."
        />
      </Helmet>

      {/* Breadcrumb Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Community & Peer Hub" },
            ]}
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Executive Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                <Users className="w-4 h-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Community & Study Circles
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                Live
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Ask doubts, discuss complex problem approaches, and prepare
              together in focused study circles.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {activeTab === "doubts" ? (
              <button
                onClick={() => {
                  if (!user) {
                    navigate("/login", { state: { from: "/community" } });
                    return;
                  }
                  setShowAskForm(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Ask Question</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!user) {
                    navigate("/login", { state: { from: "/community" } });
                    return;
                  }
                  setShowCreateForm(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Study Circle</span>
              </button>
            )}
          </div>
        </div>

        {/* Executive Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/50">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Active Doubts
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                {doubtsData.length}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Peer & faculty Q&A
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/50">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Verified Solutions
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                {doubtsData.filter((d) => d.isAnswered).length}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Accepted answers
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200/50 dark:border-purple-800/50">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Study Circles
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                {groupsData.length}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Subject-wise rooms
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-800/50">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                My Circles
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                {myGroups.length}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Joined groups
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Tab Switcher */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm mb-6 space-y-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Main Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
              {[
                {
                  id: "doubts",
                  label: "Doubt Q&A",
                  icon: MessageCircle,
                  count: doubtsData.length,
                },
                {
                  id: "groups",
                  label: "Study Circles",
                  icon: Users,
                  count: groupsData.length,
                },
                {
                  id: "my-groups",
                  label: "My Circles",
                  icon: Crown,
                  count: myGroups.length,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSelectedCategory("all");
                      setSearchQuery("");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                      isActive
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.25 rounded-md text-[10px] sm:text-xs font-bold ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === "doubts"
                    ? "Search questions, formulas, topics..."
                    : "Search study circles by exam/subject..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Filter Row: Category pills & status filter */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Category:
              </span>

              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </option>
                ))}
              </select>

              {/* Doubts Status Filter */}
              {activeTab === "doubts" && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                  {[
                    { id: "all", label: "All" },
                    { id: "unsolved", label: "Unsolved" },
                    { id: "answered", label: "Verified Answer" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setStatusFilter(st.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        statusFilter === st.id
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs sm:text-sm font-bold text-slate-400">
              Showing{" "}
              <span className="text-slate-900 dark:text-white font-black">
                {activeTab === "doubts"
                  ? filteredDoubts.length
                  : activeTab === "groups"
                    ? groupsData.length
                    : myGroups.length}
              </span>{" "}
              {activeTab === "doubts" ? "questions" : "circles"}
            </div>
          </div>
        </div>

        {/* TAB 1: DOUBTS (Q&A) */}
        {activeTab === "doubts" && (
          <>
            {loadingDoubts ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-44 bg-slate-200 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800"
                  ></div>
                ))}
              </div>
            ) : filteredDoubts.length === 0 ? (
              <div className="text-center py-14 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-200/60 dark:border-indigo-800/60">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                  No Questions Found
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5 max-w-xs mx-auto">
                  {searchQuery ||
                  selectedCategory !== "all" ||
                  statusFilter !== "all"
                    ? "No questions match your current search and filters. Try resetting filters."
                    : "Be the first to post a question or doubt in the community!"}
                </p>
                <button
                  onClick={() =>
                    user ? setShowAskForm(true) : navigate("/login")
                  }
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Ask a Question
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {visibleDoubts.map((doubt) => {
                    const catObj = doubtCategories.find(
                      (c) => c.id === doubt.category,
                    );
                    return (
                      <div
                        key={doubt._id || doubt.id}
                        onClick={() => setSelectedDoubt(doubt)}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-indigo-500/50 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          {/* Author & Header */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                                  doubt.userName,
                                )} flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm`}
                              >
                                {(doubt.userName || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {doubt.userName || "Aspirant"}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {formatTime(doubt.createdAt)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {doubt.isAnswered ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" /> Solved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  <HelpCircle className="w-3 h-3" /> Unsolved
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Category Pill */}
                          <div className="mb-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {catObj?.icon || "💬"}{" "}
                              {catObj?.name || doubt.category || "General"}
                            </span>
                          </div>

                          {/* Title & Description */}
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {doubt.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                            {doubt.description}
                          </p>
                        </div>

                        {/* Footer Metrics */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              <span>{doubt.views || 0}</span>
                            </span>
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{doubt.replyCount || 0} answers</span>
                            </span>
                          </div>

                          <span className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                            <span>Discuss</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {visibleDoubts.length < filteredDoubts.length && (
                  <div className="text-center mt-6">
                    <button
                      onClick={() => setDoubtsVisible((v) => v + 20)}
                      className="px-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Load More ({filteredDoubts.length - visibleDoubts.length}{" "}
                      remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* TAB 2: STUDY GROUPS */}
        {activeTab === "groups" && (
          <>
            {loadingGroups ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-44 bg-slate-200 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800"
                  ></div>
                ))}
              </div>
            ) : groupsData.length === 0 ? (
              <div className="text-center py-14 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-200/60 dark:border-indigo-800/60">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                  No Study Circles Found
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5 max-w-xs mx-auto">
                  Create the first study circle for your target examination or
                  topic!
                </p>
                <button
                  onClick={() =>
                    user ? setShowCreateForm(true) : navigate("/login")
                  }
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Create Study Circle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {groupsData.map((group) => {
                  const isUserMember = myGroups.some(
                    (g) => (g._id || g.id) === (group._id || group.id),
                  );
                  const catObj = groupCategories.find(
                    (c) => c.id === group.category,
                  );

                  return (
                    <div
                      key={group._id || group.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-indigo-500/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group"
                    >
                      <div>
                        {/* Top Badge Row */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div
                            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                              group.name,
                            )} flex items-center justify-center font-black text-white text-sm shadow-md shrink-0`}
                          >
                            {(group.name || "G").charAt(0).toUpperCase()}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {group.isPrivate ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <LockIcon className="w-2.5 h-2.5" /> Private
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <Globe className="w-2.5 h-2.5" /> Public
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Category & Title */}
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                          {catObj?.icon || "📚"}{" "}
                          {catObj?.name || group.category || "General"}
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1 mb-1.5">
                          {group.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                          {group.description ||
                            "Join this study circle to discuss strategies and collaborate with fellow aspirants."}
                        </p>

                        {/* Member Progress Bar */}
                        <div className="space-y-1 mb-4">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{group.memberCount || 0} Members</span>
                            </span>
                            <span>Limit: {group.maxMembers || 50}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((group.memberCount || 1) /
                                    (group.maxMembers || 50)) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Action CTA */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <Link
                          to={`/community/groups/${group._id || group.id}`}
                          className={`w-full py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                            isUserMember
                              ? "bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-800 hover:border-indigo-600"
                              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-95"
                          }`}
                        >
                          {isUserMember ? (
                            <>
                              <MessageSquare className="w-4 h-4" />
                              <span>Open Circle Room</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              <span>Join Study Circle</span>
                            </>
                          )}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 3: MY GROUPS */}
        {activeTab === "my-groups" && (
          <>
            {!user ? (
              <div className="text-center py-14 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-200/60 dark:border-indigo-800/60">
                  <Crown className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                  Sign In to View Your Groups
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5 max-w-xs mx-auto">
                  Log in with your Trstprep account to access your active study
                  groups and discussions.
                </p>
                <Link
                  to="/login"
                  state={{ from: "/community" }}
                  className="inline-flex px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Log In Now
                </Link>
              </div>
            ) : loadingMyGroups ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-44 bg-slate-200 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800"
                  ></div>
                ))}
              </div>
            ) : myGroups.length === 0 ? (
              <div className="text-center py-14 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-200/60 dark:border-indigo-800/60">
                  <Crown className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                  No Enrolled Circles
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5 max-w-xs mx-auto">
                  You have not joined any study groups yet. Discover groups or
                  create your own!
                </p>
                <button
                  onClick={() => setActiveTab("groups")}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Explore Study Circles
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {myGroups.map((group) => (
                  <Link
                    key={group._id || group.id}
                    to={`/community/groups/${group._id || group.id}`}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-indigo-500/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                            group.name,
                          )} flex items-center justify-center font-black text-white text-sm shadow-md shrink-0`}
                        >
                          {(group.name || "G").charAt(0).toUpperCase()}
                        </div>

                        {group.role === "admin" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Crown className="w-2.5 h-2.5" /> Group Admin
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1 mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {group.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                        {group.description ||
                          "Active study group with ongoing chats and discussions."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{group.memberCount || 1} Members</span>
                      </span>

                      <span className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                        <span>Enter Room</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ASK DOUBT MODAL */}
      {showAskForm && (
        <Modal
          title="Ask a Community Doubt"
          onClose={() => setShowAskForm(false)}
          wide
        >
          <form onSubmit={handleAskDoubt} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Question Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newDoubt.title}
                onChange={(e) =>
                  setNewDoubt({ ...newDoubt, title: e.target.value })
                }
                placeholder="e.g., How to solve trigonometric identities with rapid elimination?"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Subject Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newDoubt.category}
                  onChange={(e) =>
                    setNewDoubt({ ...newDoubt, category: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {doubtCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ""}
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={newDoubt.tags}
                  onChange={(e) =>
                    setNewDoubt({ ...newDoubt, tags: e.target.value })
                  }
                  placeholder="e.g., SSC CGL, Algebra, Speed Maths"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Detailed Problem Description{" "}
                <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={newDoubt.description}
                onChange={(e) =>
                  setNewDoubt({ ...newDoubt, description: e.target.value })
                }
                placeholder="Include formulas, steps you have tried, or context regarding where you got stuck..."
                required
                rows={5}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAskForm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={askDoubtMutation.isPending}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {askDoubtMutation.isPending ? "Posting..." : "Post Question"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE STUDY GROUP MODAL */}
      {showCreateForm && (
        <Modal
          title="Create Study Circle"
          onClose={() => setShowCreateForm(false)}
        >
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Circle Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newGroup.name}
                onChange={(e) =>
                  setNewGroup({ ...newGroup, name: e.target.value })
                }
                placeholder="e.g., SSC CGL 2026 Daily Target Circle"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={newGroup.category}
                onChange={(e) =>
                  setNewGroup({ ...newGroup, category: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                {groupCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Description & Goal
              </label>
              <textarea
                value={newGroup.description}
                onChange={(e) =>
                  setNewGroup({ ...newGroup, description: e.target.value })
                }
                placeholder="What exams are members preparing for? What is the study schedule?"
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Private Circle
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Only invited or approved members can view chats
                </div>
              </div>
              <input
                type="checkbox"
                checked={newGroup.isPrivate}
                onChange={(e) =>
                  setNewGroup({ ...newGroup, isPrivate: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {createGroupMutation.isPending
                  ? "Creating..."
                  : "Create Circle"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DOUBT DETAIL & REPLIES MODAL */}
      {selectedDoubt && (
        <DoubtDetailModal
          doubt={selectedDoubt}
          onClose={() => setSelectedDoubt(null)}
          categories={doubtCategories}
        />
      )}
    </div>
  );
}

/* =========================================================================
   DOUBT DETAIL & REPLIES MODAL COMPONENT
   ========================================================================= */

function DoubtDetailModal({ doubt, onClose, categories }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");

  // Query doubt details and replies
  const { data: detailData, isLoading } = useQuery({
    queryKey: ["doubt-detail", doubt._id || doubt.id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/doubts/${doubt._id || doubt.id}`);
      return res.data?.data || {};
    },
    staleTime: 1000 * 30,
  });

  const currentDoubt = detailData?.title ? detailData : doubt;
  const replies = detailData?.replies || [];

  // Add reply mutation
  const replyMutation = useMutation({
    mutationFn: async (content) => {
      const res = await apiClient.post(
        `/api/doubts/${doubt._id || doubt.id}/reply`,
        { content },
      );
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["doubt-detail", doubt._id || doubt.id],
      });
      queryClient.invalidateQueries({ queryKey: ["doubts"] });
      setReplyText("");
      toast.success("Your answer has been submitted!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit answer");
    },
  });

  // Accept solution mutation
  const acceptMutation = useMutation({
    mutationFn: async (replyId) => {
      const res = await apiClient.put(
        `/api/doubts/${doubt._id || doubt.id}/reply/${replyId}/accept`,
      );
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["doubt-detail", doubt._id || doubt.id],
      });
      queryClient.invalidateQueries({ queryKey: ["doubts"] });
      toast.success("Answer marked as accepted solution!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to mark as accepted");
    },
  });

  // Upvote reply mutation
  const upvoteMutation = useMutation({
    mutationFn: async (replyId) => {
      const res = await apiClient.put(
        `/api/doubts/${doubt._id || doubt.id}/reply/${replyId}/upvote`,
      );
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["doubt-detail", doubt._id || doubt.id],
      });
      toast.success("Upvoted!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Already upvoted or failed");
    },
  });

  const handlePostReply = (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in to post an answer");
      return;
    }
    if (!replyText.trim()) return;
    replyMutation.mutate(replyText.trim());
  };

  const isDoubtAuthor = String(currentDoubt.userId) === String(user?.id);
  const catObj = categories?.find((c) => c.id === currentDoubt.category);

  return (
    <Modal title="Question & Peer Discussions" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Author Bar */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                currentDoubt.userName,
              )} flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm`}
            >
              {(currentDoubt.userName || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {currentDoubt.userName || "Aspirant"}
              </div>
              <div className="text-[10px] text-slate-400">
                Posted {formatTime(currentDoubt.createdAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {catObj?.icon || "💬"}{" "}
              {catObj?.name || currentDoubt.category || "General"}
            </span>
            {currentDoubt.isAnswered && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Solved
              </span>
            )}
          </div>
        </div>

        {/* Question Title & Content */}
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug mb-2">
            {currentDoubt.title}
          </h2>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200/60 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {currentDoubt.description}
          </div>
        </div>

        {/* Answers Header */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>{replies.length} Community Solutions</span>
            </h3>
          </div>

          {/* Replies List */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          ) : replies.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-400">
              No solutions submitted yet. Be the first to answer this doubt!
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {replies.map((reply) => {
                const isAccepted = reply.isAccepted;
                return (
                  <div
                    key={reply._id || reply.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isAccepted
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(
                            reply.userName,
                          )} flex items-center justify-center font-bold text-white text-[10px] shrink-0`}
                        >
                          {(reply.userName || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {reply.userName || "Aspirant"}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {formatTime(reply.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAccepted && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />{" "}
                            Accepted Solution
                          </span>
                        )}

                        {isDoubtAuthor && !isAccepted && (
                          <button
                            onClick={() =>
                              acceptMutation.mutate(reply._id || reply.id)
                            }
                            disabled={acceptMutation.isPending}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-colors"
                          >
                            Mark Accepted
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-2.5">
                      {reply.content}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        onClick={() =>
                          upvoteMutation.mutate(reply._id || reply.id)
                        }
                        disabled={upvoteMutation.isPending}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{reply.upvotes || 0} Upvotes</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Answer Composer */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
          {user ? (
            <form onSubmit={handlePostReply} className="space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your step-by-step solution or helpful hint..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!replyText.trim() || replyMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-40"
                >
                  {replyMutation.isPending ? "Submitting..." : "Post Solution"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-3 bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500">
              <Link
                to="/login"
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Log in
              </Link>{" "}
              to post an answer.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* =========================================================================
   GROUP DETAIL VIEW (/community/groups/:id)
   ========================================================================= */

function GroupDetailView({ groupId, onBack }) {
  const { user, socket } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' | 'discussions' | 'members'

  // Query Group Info
  const { data: group, isLoading } = useQuery({
    queryKey: ["study-group", groupId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/study-groups/${groupId}`);
      return res.data?.data;
    },
    staleTime: 1000 * 30,
  });

  // Mutations
  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/study-groups/${groupId}/join`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["my-study-groups"] });
      toast.success("Joined study circle!");
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || "Failed to join group"),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/study-groups/${groupId}/leave`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["my-study-groups"] });
      toast.success("Left study circle");
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || "Failed to leave group"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete(`/api/study-groups/${groupId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-groups"] });
      queryClient.invalidateQueries({ queryKey: ["my-study-groups"] });
      navigate("/community");
      toast.success("Study circle deleted");
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || "Failed to delete group"),
  });

  const handleJoin = () => {
    if (!user) {
      navigate("/login", { state: { from: `/community/groups/${groupId}` } });
      return;
    }
    joinMutation.mutate();
  };

  const handleLeave = async () => {
    const ok = await confirmDialog({
      title: "Leave Study Circle?",
      message:
        "Are you sure you want to leave this circle? You will no longer receive live group messages.",
      confirmLabel: "Leave",
      danger: true,
    });
    if (!ok) return;
    leaveMutation.mutate();
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: "Delete Study Circle?",
      message:
        "Permanently delete this study group and all discussion history? This action cannot be undone.",
      confirmLabel: "Delete Permanently",
      danger: true,
    });
    if (!ok) return;
    deleteMutation.mutate();
  };

  const isMember = group?.members?.some(
    (m) => String(m.userId) === String(user?.id),
  );
  const isAdmin = group?.members?.some(
    (m) => String(m.userId) === String(user?.id) && m.role === "admin",
  );
  const isOwner = String(group?.userId) === String(user?.id);

  const tabs = [
    { id: "chat", label: "Realtime Chat", icon: MessageSquare },
    { id: "discussions", label: "Discussions & Notes", icon: FileText },
    {
      id: "members",
      label: "Members",
      icon: Users,
      count: group?.memberCount || 0,
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-slate-500 text-xs">Loading study circle...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
            Group Not Found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            This study group does not exist or has been removed.
          </p>
          <button
            onClick={onBack}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            Back to Community
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-16">
      {ConfirmDialog}
      <Helmet>
        <title>{group.name} | Trstprep Study Circle</title>
      </Helmet>

      {/* Header Banner */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition shrink-0"
              title="Back to Community"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                group.name,
              )} flex items-center justify-center font-black text-white text-sm shadow-md shrink-0`}
            >
              {(group.name || "G").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                {group.name}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>{group.memberCount || 0} members</span>
                <span>•</span>
                <span>
                  {group.isPrivate ? "Private Circle" : "Public Circle"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isMember ? (
              isOwner ? (
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Circle</span>
                </button>
              ) : (
                <button
                  onClick={handleLeave}
                  disabled={leaveMutation.isPending}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Leave</span>
                </button>
              )
            ) : (
              <button
                onClick={handleJoin}
                disabled={joinMutation.isPending}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all"
              >
                {joinMutation.isPending ? "Joining..." : "Join Circle"}
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex border-t border-slate-100 dark:border-slate-800/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold transition-all border-b-2 ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400"
                    : "text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        {activeTab === "chat" &&
          (isMember ? (
            <ChatTab groupId={groupId} socket={socket} user={user} />
          ) : (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm max-w-md mx-auto">
              <LockIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                Members-Only Chat
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Join this study circle to participate in the live chat with
                other aspirants.
              </p>
              <button
                onClick={handleJoin}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              >
                Join Circle Now
              </button>
            </div>
          ))}

        {activeTab === "discussions" &&
          (isMember ? (
            <DiscussionsTab groupId={groupId} user={user} isAdmin={isAdmin} />
          ) : (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm max-w-md mx-auto">
              <LockIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                Members-Only Discussions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Join this circle to view and post discussion threads.
              </p>
              <button
                onClick={handleJoin}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              >
                Join Circle Now
              </button>
            </div>
          ))}

        {activeTab === "members" && <MembersTab group={group} />}
      </div>
    </div>
  );
}

/* =========================================================================
   GROUP CHAT TAB (LIVE SOCKET.IO INTEGRATED)
   ========================================================================= */

function ChatTab({ groupId, socket, user }) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Query Messages
  const { data: messages = [], isLoading: loading } = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/study-groups/${groupId}/messages?limit=50`,
      );
      return res.data?.data || [];
    },
    staleTime: 1000 * 30,
  });

  const [realtimeMessages, setRealtimeMessages] = useState([]);

  useEffect(() => {
    setRealtimeMessages([]);
  }, [groupId]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("study-groups:join", { groupId });
    const handler = (data) => {
      if (data?.message) {
        setRealtimeMessages((prev) => {
          if (
            prev.some(
              (m) => (m.id || m._id) === (data.message.id || data.message._id),
            )
          )
            return prev;
          return [...prev, data.message];
        });
      }
    };
    socket.on("group:message:new", handler);
    return () => {
      socket.off("group:message:new", handler);
      socket.emit("study-groups:leave", { groupId });
    };
  }, [socket, groupId]);

  const allMessages = useMemo(() => {
    return [...messages, ...realtimeMessages];
  }, [messages, realtimeMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    try {
      setSending(true);
      const res = await apiClient.post(
        `/api/study-groups/${groupId}/messages`,
        {
          content: newMessage.trim(),
          messageType: "text",
        },
      );
      if (res.data?.success) {
        setNewMessage("");
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allMessages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          allMessages.map((msg, idx) => {
            const isMe = String(msg.userId) === String(user?.id);
            return (
              <div
                key={`${msg._id || msg.id || idx}-${idx}`}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${isMe ? "order-1" : ""}`}
                >
                  {!isMe && (
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 ml-1">
                      {msg.userName || "Aspirant"}
                    </p>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMe
                        ? "bg-indigo-600 text-white rounded-br-sm shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p
                    className={`text-[9px] text-slate-400 mt-0.5 ${
                      isMe ? "text-right mr-1" : "ml-1"
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                    {msg.isEdited && " (edited)"}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message to circle members..."
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   GROUP DISCUSSIONS TAB
   ========================================================================= */

function DiscussionsTab({ groupId, user, isAdmin }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [selectedPost, setSelectedPost] = useState(null);
  const [newComment, setNewComment] = useState("");

  // Query Posts
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["group-posts", groupId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/study-groups/${groupId}/posts`);
      return res.data?.data || [];
    },
    staleTime: 1000 * 60,
  });

  // Post Detail with comments
  const { data: postDetail } = useQuery({
    queryKey: [
      "group-post-detail",
      groupId,
      selectedPost?._id || selectedPost?.id,
    ],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/study-groups/${groupId}/posts/${selectedPost._id || selectedPost.id}`,
      );
      return res.data?.data || {};
    },
    enabled: Boolean(selectedPost),
    staleTime: 1000 * 30,
  });

  const comments = postDetail?.comments || [];

  // Mutations
  const createPostMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post(`/api/study-groups/${groupId}/posts`, {
        ...data,
        postType: "discussion",
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-posts", groupId] });
      setNewPost({ title: "", content: "" });
      setShowCreate(false);
      toast.success("Discussion thread posted!");
    },
    onError: () => toast.error("Failed to create post"),
  });

  const likeMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await apiClient.post(
        `/api/study-groups/${groupId}/posts/${postId}/like`,
      );
      return res.data?.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["group-posts", groupId] }),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }) => {
      const res = await apiClient.post(
        `/api/study-groups/${groupId}/posts/${postId}/comments`,
        {
          content,
        },
      );
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "group-post-detail",
          groupId,
          selectedPost?._id || selectedPost?.id,
        ],
      });
      setNewComment("");
      toast.success("Comment added!");
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await apiClient.put(
        `/api/study-groups/${groupId}/posts/${postId}/pin`,
      );
      return res.data?.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["group-posts", groupId] }),
  });

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPost.title.trim()) return;
    createPostMutation.mutate({
      title: newPost.title.trim(),
      content: newPost.content.trim(),
    });
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedPost) return;
    commentMutation.mutate({
      postId: selectedPost._id || selectedPost.id,
      content: newComment.trim(),
    });
  };

  if (selectedPost) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setSelectedPost(null);
            setNewComment("");
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to discussions
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {selectedPost.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-6 h-6 rounded-lg bg-gradient-to-br ${getAvatarGradient(
                    selectedPost.userName,
                  )} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
                >
                  {(selectedPost.userName || "U").charAt(0)}
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {selectedPost.userName || "Aspirant"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatTime(selectedPost.createdAt)}
                </span>
                {selectedPost.isPinned && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded-md font-bold">
                    <Pin className="w-2.5 h-2.5" /> Pinned
                  </span>
                )}
              </div>
            </div>
          </div>

          {selectedPost.content && (
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-4">
              {selectedPost.content}
            </p>
          )}

          <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() =>
                likeMutation.mutate(selectedPost._id || selectedPost.id)
              }
              className={`flex items-center gap-1.5 text-xs font-bold transition ${
                selectedPost.isLiked
                  ? "text-rose-500"
                  : "text-slate-500 hover:text-rose-500"
              }`}
            >
              <Heart
                className={`w-4 h-4 ${selectedPost.isLiked ? "fill-current" : ""}`}
              />
              <span>{selectedPost.likeCount || 0} Likes</span>
            </button>
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <MessageCircle className="w-4 h-4" />
              <span>{comments.length} Comments</span>
            </span>
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-2.5">
          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
            Comments & Thoughts
          </h4>
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">
              No comments yet. Share your thoughts!
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c._id || c.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 flex gap-2.5"
              >
                <div
                  className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(
                    c.userName,
                  )} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
                >
                  {(c.userName || "U").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {c.userName}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {formatTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Composer */}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || commentMutation.isPending}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 shrink-0"
          >
            Reply
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-slate-900 dark:text-white text-base">
          Discussion Threads
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" /> Start Discussion
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <form onSubmit={handleCreatePost} className="space-y-3">
            <input
              type="text"
              value={newPost.title}
              onChange={(e) =>
                setNewPost({ ...newPost, title: e.target.value })
              }
              placeholder="Topic or question title..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
            <textarea
              value={newPost.content}
              onChange={(e) =>
                setNewPost({ ...newPost, content: e.target.value })
              }
              placeholder="Share notes, resources, or ask a question..."
              rows={3}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPostMutation.isPending}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-40"
              >
                Post Thread
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              No discussions yet. Start one for your group!
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post._id || post.id}
              onClick={() => setSelectedPost(post)}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 hover:shadow-md transition cursor-pointer ${
                post.isPinned
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20"
                  : "border-slate-200/80 dark:border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {post.isPinned && (
                      <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {post.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded bg-gradient-to-br ${getAvatarGradient(
                        post.userName,
                      )} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}
                    >
                      {(post.userName || "U").charAt(0)}
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {post.userName || "Aspirant"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatTime(post.createdAt)}
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pinMutation.mutate(post._id || post.id);
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-500 shrink-0"
                    title={post.isPinned ? "Unpin thread" : "Pin thread"}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {post.content && (
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                  {post.content}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" /> {post.likeCount || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />{" "}
                  {post.commentCount || 0}
                </span>
                <span className="ml-auto text-[10px]">
                  {post.viewCount || 0} views
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   GROUP MEMBERS TAB
   ========================================================================= */

function MembersTab({ group }) {
  const members = [...(group?.members || [])].sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (b.role === "admin" && a.role !== "admin") return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-600" />
        <h3 className="font-black text-slate-900 dark:text-white text-base">
          Circle Members
        </h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
          {members.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {members.map((member) => (
          <div
            key={member._id || member.id}
            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm"
          >
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                member.userName,
              )} flex items-center justify-center font-bold text-xs text-white shrink-0`}
            >
              {(member.userName || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {member.userName || "Aspirant"}
              </div>
              <div className="text-[10px] text-slate-400">
                Joined{" "}
                {member.joinedAt
                  ? new Date(member.joinedAt).toLocaleDateString()
                  : "Recently"}
              </div>
            </div>
            {member.role === "admin" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                <Crown className="w-2.5 h-2.5" /> Admin
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   GENERIC MODAL COMPONENT
   ========================================================================= */

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 ${
          wide ? "max-w-[95vw] sm:max-w-2xl" : "max-w-lg"
        } w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate pr-2">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN EXPORT
   ========================================================================= */

export default function Community() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (id) {
    return (
      <GroupDetailView groupId={id} onBack={() => navigate("/community")} />
    );
  }

  return <CommunityHubView />;
}
