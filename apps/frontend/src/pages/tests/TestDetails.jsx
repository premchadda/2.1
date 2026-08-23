import { useParams, Link, useNavigate, useLocation } from "react-router-dom";

import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Users,
  Clock,
  FileText,
  Trophy,
  Crown,
  ChevronDown,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Medal,
  Flame,
  Target,
  BarChartBig,
  MoreVertical,
  Trash2,
  RotateCcw,
  Radio,
} from "lucide-react";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { useConfirm } from "../../shared/components/common/ConfirmModal";
import { TestCard } from "../../shared/components";
import EmptyState from "../../shared/components/ui/EmptyState";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  getTestSeriesById,
  getTestsBySeriesId,
  getTestSeries,
  getTopPerformers,
  getExamCategories,
  getExams,
  getTestCategories,
  getUserAnalytics,
  userAPI,
} from "../../shared/lib/dataService";
import api from "../../shared/lib/api";
import { toast } from "react-hot-toast";

import { useStages } from "../../shared/hooks/useStages";
import {
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
  invalidateDashboardCache,
} from "../../shared/lib/enrollment.js";
import {
  checkIsArchivedLive,
  checkIsLive,
  checkIsQuiz,
  checkIsPermanentTest,
} from "../../shared/utils/testClassification";

function TestDetails() {
  const routeParams = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { seriesId, examSlug } = routeParams;
  const isMyView = seriesId === "my" || location.pathname.endsWith("/my");

  const { user, refreshUser } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();

  const { stages: hookStages, loading: _stagesLoading } = useStages();
  const [directStages, setDirectStages] = useState([]);
  const allStages = useMemo(() => {
    return directStages && directStages.length > 0
      ? directStages
      : hookStages || [];
  }, [directStages, hookStages]);
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Query to fetch user attempts
  const { data: attemptRows = [] } = useQuery({
    queryKey: ["user-attempts", user?.id],
    queryFn: async () => {
      const response = await userAPI.getAttempts();
      return response.data?.data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // Query to fetch incomplete attempts
  const { data: incompleteAttempts = [] } = useQuery({
    queryKey: ["user-incomplete-attempts", user?.id],
    queryFn: async () => {
      const response = await userAPI.getIncompleteAttempts();
      return response.data?.data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  const [showDropdownMenu, setShowDropdownMenu] = useState(false);

  // Enhanced state for two-level navigation
  const [activeMainCategory, setActiveMainCategory] = useState(null);
  const [activeSubCategory, setActiveSubCategory] = useState(null);
  const [activeThirdCategory, setActiveThirdCategory] = useState(null);
  const [activeFourthCategory, setActiveFourthCategory] = useState(null);
  const [activeStage, setActiveStage] = useState("all"); // 'all' or stage-slug
  const [series, setSeries] = useState(null);
  const [tests, setTests] = useState([]);
  const [suggestedSeries, setSuggestedSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animateKey, setAnimateKey] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allTestCategories, setAllTestCategories] = useState([]);
  const [exams, setExams] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!user) return;

    // Only refresh once on mount if user has legacy enrolled series format
    if (hasLegacyEnrolledSeriesIds(user.enrolledSeries)) {
      refreshUser();
    }
  }, []);

  // Get stages linked to this test series

  // Get stages linked to this test series
  const seriesStages = useMemo(() => {
    if (!allStages || !allStages.length) return [];

    // Normalize series.stages (could be array of numbers, strings, or object IDs)
    let rawStages =
      series?.stages ?? series?.stageIds ?? series?.stage_ids ?? [];
    if (typeof rawStages === "string") {
      try {
        rawStages = JSON.parse(rawStages);
      } catch {
        rawStages = rawStages
          .replace(/[{}]/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (!Array.isArray(rawStages)) {
      rawStages = [rawStages].filter(Boolean);
    }

    if (series?.stage_id) rawStages.push(series.stage_id);
    if (series?.stageId) rawStages.push(series.stageId);

    const stageIdSet = new Set(rawStages.map(String));

    // 1. Try matching with series stages array
    if (stageIdSet.size > 0) {
      const matched = allStages.filter(
        (s) =>
          stageIdSet.has(String(s._id)) ||
          stageIdSet.has(String(s.id)) ||
          stageIdSet.has(String(s.order)) ||
          stageIdSet.has(String(s.slug)) ||
          (s.public_id && stageIdSet.has(String(s.public_id))) ||
          (s.publicId && stageIdSet.has(String(s.publicId))),
      );
      if (matched.length > 0) return matched;
    }

    // 2. Extract stages present from tests array of this series
    if (Array.isArray(tests) && tests.length > 0) {
      const presentStageIds = new Set();
      tests.forEach((t) => {
        if (t.stageId) presentStageIds.add(String(t.stageId));
        if (t.stage_id) presentStageIds.add(String(t.stage_id));
        if (t.stage) presentStageIds.add(String(t.stage));
        if (Array.isArray(t.stageIds))
          t.stageIds.forEach((id) => presentStageIds.add(String(id)));
        if (Array.isArray(t.stage_ids))
          t.stage_ids.forEach((id) => presentStageIds.add(String(id)));
      });
      if (presentStageIds.size > 0) {
        const matched = allStages.filter(
          (s) =>
            presentStageIds.has(String(s._id)) ||
            presentStageIds.has(String(s.id)) ||
            presentStageIds.has(String(s.slug)),
        );
        if (matched.length > 0) return matched;
      }
    }

    // 3. Fallback: filter by exam / category
    if (series) {
      const examIdentifier = String(
        series.examId || series.exam_id || series.category || "",
      ).toLowerCase();
      const linked = allStages.filter((s) => {
        if (Array.isArray(s.examIds)) {
          return s.examIds.some(
            (eid) =>
              String(eid).toLowerCase() === examIdentifier ||
              examIdentifier.includes(String(eid).toLowerCase()),
          );
        }
        return false;
      });
      if (linked.length > 0) return linked;
    }

    // 4. Default: return all active stages
    return allStages.filter(
      (s) => s.isActive !== false && s.is_active !== false,
    );
  }, [series, allStages, tests]);

  // Calculate dynamic stage options based on the series exam/stages
  const stageOptions = useMemo(() => {
    const baseOptions = [{ key: "all", label: "All Stages", icon: Target }];
    if (!allStages || !allStages.length) return baseOptions;

    const stagesToUse =
      seriesStages && seriesStages.length > 0 ? seriesStages : allStages;

    const dynamicOptions = stagesToUse
      .filter((s) => s.isActive !== false && s.is_active !== false)
      .sort(
        (a, b) =>
          (a.order || a.displayOrder || 0) - (b.order || b.displayOrder || 0),
      )
      .map((s) => ({
        key: s.slug || String(s.id || s._id),
        label: s.name,
        icon: s.icon ? () => <span>{s.icon}</span> : BarChartBig,
      }));

    return [...baseOptions, ...dynamicOptions];
  }, [allStages, seriesStages]);

  // Horizontal scroll refs for sub-tabs
  const subTabsRef = useRef(null);
  const categoryTabsRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const isUserPro = Boolean(
    user?.isProUser ||
    user?.isPro ||
    user?.role === "admin" ||
    (user?.passType && user.passType !== "free"),
  );
  const isSeriesPro = Boolean(series?.isPro || series?.is_pro);

  const isEnrolled = useMemo(() => {
    if (!user || !series) return false;
    return isSeriesEnrolled(user, series, [seriesId]);
  }, [user, series, seriesId]);

  const handleEnroll = async () => {
    if (!user) {
      navigate("/login", { state: { backgroundLocation: location } });
      return;
    }

    if (isSeriesPro && !isUserPro) {
      navigate("/pass");
      return;
    }

    // Use slug for API call (backend supports both slug and numeric ID)
    const seriesIdentifier = series?.slug || series?._id || series?.id;
    if (!seriesIdentifier) {
      toast.error("Unable to enroll: Series identifier not found");
      return;
    }

    // Check if already enrolled BEFORE making API call
    if (isEnrolled) {
      // Already enrolled, no need to call API
      return;
    }

    // Prevent duplicate requests
    if (isEnrolling) return;

    setIsEnrolling(true);
    try {
      const response = await api.post(`/api/users/enroll/${seriesIdentifier}`);
      if (response.data.success) {
        await refreshUser();
        invalidateDashboardCache();
        if (!response.data.alreadyEnrolled) {
          toast.success("Successfully enrolled in this test series!");
        }
      }
    } catch (err) {
      console.error("Enrollment error:", err);
      if (
        err.response?.data?.requiresPro ||
        err.response?.data?.code === "PRO_REQUIRED"
      ) {
        navigate("/pass");
        return;
      }
      const message = err.response?.data?.message || "";
      if (
        message.includes("Already enrolled") ||
        message.includes("already enrolled")
      ) {
        toast("You are already enrolled in this test series");
      } else {
        toast.error(`Failed to enroll: ${message || "Please try again."}`);
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleUnenroll = async () => {
    if (!user) return;

    const seriesIdentifier = series?.slug || series?._id || series?.id;
    if (!seriesIdentifier) {
      toast.error("Unable to unenroll: Series identifier not found");
      return;
    }

    const ok = await confirm({
      title: "Unenroll from Test Series",
      message:
        "Are you sure you want to unenroll from this test series? All your previous attempt history and progress for this series will be completely deleted.",
      danger: true,
      confirmLabel: "Unenroll & Reset Progress",
    });
    if (!ok) return;

    try {
      const response = await api.delete(
        `/api/users/unenroll/${seriesIdentifier}`,
      );
      if (response.data.success) {
        await refreshUser();
        invalidateDashboardCache();
        setUserStats(null);
        setSeries((prev) => (prev ? { ...prev, isEnrolled: false } : prev));
        toast.success(
          "Successfully unenrolled! All previous attempt history has been deleted.",
        );
      }
    } catch (err) {
      console.error("Unenroll error:", err);
      const message = err.response?.data?.message || "";
      toast.error(`Failed to unenroll: ${message || "Please try again."}`);
    }
  };

  const handleManageClick = () => {
    // For admin users - navigate to admin panel for this series
    const seriesId = series?._id || series?.id;
    if (seriesId) {
      navigate(`/admin/test-series/${seriesId}`);
    }
  };

  // Horizontal scroll handlers for touch and mouse drag
  const _handleMouseDown = (e) => {
    if (!subTabsRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - subTabsRef.current.offsetLeft);
    setScrollLeft(subTabsRef.current.scrollLeft);
  };

  const _handleMouseLeave = () => {
    setIsDragging(false);
  };

  const _handleMouseUp = () => {
    setIsDragging(false);
  };

  const _handleMouseMove = (e) => {
    if (!isDragging || !subTabsRef.current) return;
    e.preventDefault();
    const x = e.pageX - subTabsRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    subTabsRef.current.scrollLeft = scrollLeft - walk;
  };

  // Horizontal scroll handlers for category tabs
  const _handleCategoryMouseDown = (e) => {
    if (!categoryTabsRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - categoryTabsRef.current.offsetLeft);
    setScrollLeft(categoryTabsRef.current.scrollLeft);
  };

  const _handleCategoryMouseLeave = () => {
    setIsDragging(false);
  };

  const _handleCategoryMouseUp = () => {
    setIsDragging(false);
  };

  const _handleCategoryMouseMove = (e) => {
    if (!isDragging || !categoryTabsRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoryTabsRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    categoryTabsRef.current.scrollLeft = scrollLeft - walk;
  };

  // First, filter tests by stage only (this will be used for category computation)
  // Only show published/active tests to users (never draft/archived)
  const visibleTests = useMemo(() => {
    return tests.filter((t) => {
      if (!t) return false;
      const status = String(t.status || "").toLowerCase();
      if (
        status === "draft" ||
        status === "archived" ||
        status === "disabled" ||
        status === "inactive"
      )
        return false;
      if (checkIsArchivedLive(t)) return false; // Fully archived live test (> 7 days past expiry)
      return (
        status === "published" ||
        status === "active" ||
        status === "" ||
        t.isActive !== false
      );
    });
  }, [tests]);

  const stageFilteredTests = useMemo(() => {
    if (!activeStage || activeStage === "all") {
      return visibleTests;
    }

    const stage = allStages.find(
      (s) =>
        s.slug === activeStage ||
        String(s.id) === activeStage ||
        String(s._id) === activeStage,
    );
    if (!stage) return visibleTests;

    const targetId = String(stage.id || stage._id);
    const targetDbId = String(stage._id || stage.id);
    const stageName = String(stage.name || "").toLowerCase();
    const stageSlug = String(stage.slug || "").toLowerCase();

    return visibleTests.filter((test) => {
      const testStageId = String(test.stageId ?? test.stage_id ?? "");
      const testStageIds = (
        Array.isArray(test.stageIds)
          ? test.stageIds
          : Array.isArray(test.stage_ids)
            ? test.stage_ids
            : []
      ).map(String);
      const testTier = String(test.tier || "").toLowerCase();
      const testTitle = String(test.title || "").toLowerCase();
      const testCategory = String(test.category || "").toLowerCase();
      const testSubCategory = String(
        test.subCategory || test.subcategory || "",
      ).toLowerCase();
      const testTags = (Array.isArray(test.tags) ? test.tags : []).map((t) =>
        String(t).toLowerCase(),
      );

      // Direct stage ID matching
      if (
        testStageId &&
        (testStageId === targetId || testStageId === targetDbId)
      )
        return true;
      if (testStageIds.includes(targetId) || testStageIds.includes(targetDbId))
        return true;
      if (testTier && (testTier === stageName || testTier === stageSlug))
        return true;

      // Stage semantic matching (Tier 1 / Tier 2 / CBT 1 / CBT 2)
      if (
        stageSlug.includes("tier-1") ||
        stageSlug.includes("tier-i") ||
        stageName.includes("tier 1") ||
        stageName.includes("tier i")
      ) {
        if (
          testTags.includes("tier-1") ||
          testTags.includes("tier-i") ||
          testTags.includes("tier1")
        )
          return true;
        if (
          /\btier[- ]?(1|i)\b/i.test(testTitle) ||
          /\btier[- ]?(1|i)\b/i.test(testCategory) ||
          /\btier[- ]?(1|i)\b/i.test(testSubCategory)
        )
          return true;
      }

      if (
        stageSlug.includes("tier-2") ||
        stageSlug.includes("tier-ii") ||
        stageName.includes("tier 2") ||
        stageName.includes("tier ii")
      ) {
        if (
          testTags.includes("tier-2") ||
          testTags.includes("tier-ii") ||
          testTags.includes("tier2")
        )
          return true;
        if (
          /\btier[- ]?(2|ii)\b/i.test(testTitle) ||
          /\btier[- ]?(2|ii)\b/i.test(testCategory) ||
          /\btier[- ]?(2|ii)\b/i.test(testSubCategory)
        )
          return true;
      }

      if (
        stageSlug.includes("cbt-1") ||
        stageName.includes("cbt 1") ||
        stageName.includes("cbt-1")
      ) {
        if (testTags.includes("cbt-1") || testTags.includes("cbt1"))
          return true;
        if (/\bcbt[- ]?1\b/i.test(testTitle)) return true;
      }

      if (
        stageSlug.includes("cbt-2") ||
        stageName.includes("cbt 2") ||
        stageName.includes("cbt-2")
      ) {
        if (testTags.includes("cbt-2") || testTags.includes("cbt2"))
          return true;
        if (/\bcbt[- ]?2\b/i.test(testTitle)) return true;
      }

      return false;
    });
  }, [visibleTests, activeStage, allStages]);

  // Permanent tests count excludes transient Live Tests / Live Quizzes
  const permanentTests = useMemo(() => {
    return visibleTests.filter(checkIsPermanentTest);
  }, [visibleTests]);

  const liveTestsCount = useMemo(() => {
    return visibleTests.filter((t) => !checkIsPermanentTest(t)).length;
  }, [visibleTests]);

  const permanentFreeTestsCount = useMemo(() => {
    return permanentTests.filter((t) => t.type === "Free" || !t.isPro).length;
  }, [permanentTests]);

  const totalPermanentTests =
    permanentTests.length ||
    Number(series?.total_tests ?? series?.totalTests ?? 0);

  // Calculate dynamic progress percentage for this series (against permanent tests)
  const progressPercentage = useMemo(() => {
    if (!series || !user) return 0;
    const sid = series._id || series.id;
    const done =
      user.attemptedTests?.[sid] ||
      user.attemptedTests?.[String(sid)] ||
      user.attemptedTests?.[series.slug] ||
      0;
    const total = totalPermanentTests || series.totalTests || 0;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [series, user, totalPermanentTests]);

  // Dynamic categories computed from stage-filtered tests and metadata
  const computedCategories = useMemo(() => {
    if (!allTestCategories.length) return {};

    // 1. Build the recursive tree
    const buildNode = (parentId, currentLevel = 1) => {
      if (currentLevel > 4) return [];

      return allTestCategories
        .filter((cat) => {
          const pid = cat.parentId || cat.parent_id;
          return parentId === null ? !pid : String(pid) === String(parentId);
        })
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map((cat) => ({
          id: String(cat._id || cat.id),
          key: cat.slug || String(cat._id || cat.id),
          label: cat.name,
          level: currentLevel,
          children: buildNode(cat._id || cat.id, currentLevel + 1),
          count: 0,
          free: 0,
          live:
            cat.slug?.includes("live") ||
            cat.name?.toLowerCase().includes("live"),
        }));
    };

    const tree = buildNode(null);
    const categoryMap = {};

    // Add "All" to children if they have at least one child
    const addAllOption = (nodes) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          node.children.unshift({
            id: "all",
            key: "all",
            label: "All",
            level: node.level + 1,
            children: [],
            count: 0,
            free: 0,
          });
          addAllOption(node.children.slice(1));
        }
      });
    };

    addAllOption(tree);

    // 2. Count tests in categories (using stage-filtered tests)
    // Helper to find all parent IDs for a category
    const getPath = (catId) => {
      const path = [];
      let currentId = catId;
      while (currentId) {
        const cat = allTestCategories.find(
          (c) => String(c._id || c.id) === String(currentId),
        );
        if (cat) {
          path.push(String(cat._id || cat.id));
          currentId = cat.parentId || cat.parent_id;
        } else {
          currentId = null;
        }
      }
      return path;
    };

    // Helper to increment counts in the tree
    const incrementCount = (nodes, path, isFree, isLiveItem) => {
      nodes.forEach((node) => {
        // If node.id is 'all', only count permanent tests (excludes transient Live Tests / Live Quizzes)
        if (node.id === "all") {
          if (!isLiveItem) {
            node.count++;
            if (isFree) node.free++;
          }
          if (node.children.length > 0) {
            incrementCount(node.children, path, isFree, isLiveItem);
          }
        } else if (path.includes(node.id)) {
          node.count++;
          if (isFree) node.free++;
          if (isLiveItem) node.live = true;
          if (node.children.length > 0) {
            incrementCount(node.children, path, isFree, isLiveItem);
          }
        }
      });
    };

    // Use stageFilteredTests instead of all tests
    stageFilteredTests.forEach((test) => {
      const isFree = test.type === "Free" || !test.isPro;
      const isLiveItem = !checkIsPermanentTest(test);

      // Collect all IDs, Slugs, and Names the test belongs to
      const testCategoryIds = new Set();
      const addField = (val) => {
        if (val !== undefined && val !== null && val !== "") {
          testCategoryIds.add(String(val).toLowerCase());
        }
      };

      addField(test.category);
      addField(test.subCategory);
      addField(test.subcategory);
      addField(test.sub_category);
      addField(test.testCategoryId);
      addField(test.test_category_id);
      addField(test.categoryId);
      addField(test.category_id);
      addField(test.subCategoryId);
      addField(test.sub_category_id);
      addField(test.categorySlug);
      addField(test.category_slug);
      addField(test.subCategorySlug);
      addField(test.sub_category_slug);

      addField(test.year);
      addField(test.pyqYear);
      addField(test.pyq_year);

      if (Array.isArray(test.tags)) test.tags.forEach(addField);
      if (Array.isArray(test.categoryPathIds))
        test.categoryPathIds.forEach(addField);
      if (Array.isArray(test.category_path_ids))
        test.category_path_ids.forEach(addField);
      if (Array.isArray(test.categoryPathNames))
        test.categoryPathNames.forEach(addField);
      if (Array.isArray(test.category_path_names))
        test.category_path_names.forEach(addField);

      // Extract 4-digit years from title/slug for year-based matching ONLY for PYP tests
      const isPypTest =
        test.category === "PYPs" ||
        test.isPyq ||
        test.is_pyq ||
        (Array.isArray(test.tags) &&
          test.tags.some((t) => /pyp|previous/i.test(String(t))));
      if (isPypTest) {
        const titleYears = String(test.title || "").match(
          /\b(19\d\d|20\d\d)\b/g,
        );
        if (titleYears) titleYears.forEach(addField);
        const slugYears = String(test.slug || "").match(/\b(19\d\d|20\d\d)\b/g);
        if (slugYears) slugYears.forEach(addField);
      }

      // Find all categories in allTestCategories that match any of these IDs/Slugs/Names or year numbers
      const matchedCats = allTestCategories.filter((c) => {
        const catIdStr = String(c._id || c.id).toLowerCase();
        const catSlugStr = String(c.slug || "").toLowerCase();
        const catNameStr = String(c.name || "").toLowerCase();

        if (
          testCategoryIds.has(catIdStr) ||
          testCategoryIds.has(catSlugStr) ||
          testCategoryIds.has(catNameStr)
        ) {
          return true;
        }

        // Fuzzy/partial match for year category names/slugs (e.g., catName "2025" or "2024" or slug "year-2025")
        for (const tid of testCategoryIds) {
          if (/\b(19\d\d|20\d\d)\b/.test(tid)) {
            if (
              catNameStr === tid ||
              catSlugStr === tid ||
              catNameStr.includes(tid) ||
              catSlugStr.includes(tid)
            ) {
              return true;
            }
          }
        }
        return false;
      });

      const matchedCatIds = new Set(
        matchedCats.map((c) => String(c._id || c.id)),
      );
      const matchedCatList = Array.from(matchedCatIds);

      const leafMatchIds = matchedCatList.filter((id) => {
        return !matchedCatList.some((otherId) => {
          if (id === otherId) return false;
          const otherPath = getPath(otherId);
          return otherPath.includes(id);
        });
      });

      // Only count the test if it matched a specific leaf category
      if (leafMatchIds.length > 0) {
        leafMatchIds.forEach((catId) => {
          const path = getPath(catId);
          incrementCount(tree, path, isFree, isLiveItem);
        });
      }
    });

    // Convert back to requested Map-like structure for the UI
    tree.forEach((root) => {
      categoryMap[root.key] = root;
    });

    return categoryMap;
  }, [stageFilteredTests, allTestCategories]);

  // Aggregate available 3rd-level subcategories for display across all levels
  const availableThirdCategories = useMemo(() => {
    if (!activeMainCategory || !computedCategories[activeMainCategory])
      return [];
    const mainNode = computedCategories[activeMainCategory];
    const subChildren = mainNode.children || [];

    if (activeSubCategory !== "all") {
      const selectedSub = subChildren.find((s) => s.key === activeSubCategory);
      return selectedSub?.children || [];
    }

    // When activeSubCategory is 'all', aggregate all 3rd-level children across all subcategories
    const aggregated = [];
    const seenKeys = new Set();

    subChildren.forEach((sub) => {
      if (Array.isArray(sub.children)) {
        sub.children.forEach((third) => {
          if (third.key !== "all" && !seenKeys.has(third.key)) {
            seenKeys.add(third.key);
            aggregated.push(third);
          }
        });
      }
    });

    return aggregated;
  }, [computedCategories, activeMainCategory, activeSubCategory]);

  // Aggregate available 4th-level subcategories for display across all levels
  const availableFourthCategories = useMemo(() => {
    if (!activeMainCategory || !computedCategories[activeMainCategory])
      return [];
    const mainNode = computedCategories[activeMainCategory];
    const subChildren = mainNode.children || [];

    if (activeThirdCategory !== "all") {
      let targetThird = null;
      for (const sub of subChildren) {
        if (Array.isArray(sub.children)) {
          const found = sub.children.find((t) => t.key === activeThirdCategory);
          if (found) {
            targetThird = found;
            break;
          }
        }
      }
      return targetThird?.children || [];
    }

    // When activeThirdCategory is 'all', aggregate all 4th-level children under activeSubCategory or activeMainCategory
    const aggregated = [];
    const seenKeys = new Set();

    const targetSubList =
      activeSubCategory !== "all"
        ? subChildren.filter((s) => s.key === activeSubCategory)
        : subChildren;

    targetSubList.forEach((sub) => {
      if (Array.isArray(sub.children)) {
        sub.children.forEach((third) => {
          if (Array.isArray(third.children)) {
            third.children.forEach((fourth) => {
              if (fourth.key !== "all" && !seenKeys.has(fourth.key)) {
                seenKeys.add(fourth.key);
                aggregated.push(fourth);
              }
            });
          }
        });
      }
    });

    return aggregated;
  }, [
    computedCategories,
    activeMainCategory,
    activeSubCategory,
    activeThirdCategory,
  ]);

  // Helper to resolve all allowed category IDs recursively under the active navigation path
  const activeAllowedCategoryIds = useMemo(() => {
    if (!activeMainCategory || !computedCategories[activeMainCategory])
      return [];

    let currentNode = computedCategories[activeMainCategory];
    const path = [activeSubCategory, activeThirdCategory, activeFourthCategory];

    for (const key of path) {
      if (!key || key === "all") break;
      const next = currentNode.children?.find((c) => c.key === key);
      if (next) currentNode = next;
      else break;
    }

    const getAllIdsRecursive = (node) => {
      const ids = [
        String(node.id || "").toLowerCase(),
        String(node.key || "").toLowerCase(),
        String(node.label || "").toLowerCase(),
      ].filter(Boolean);

      if (node.children) {
        node.children.forEach((child) => {
          if (child.key !== "all") {
            ids.push(...getAllIdsRecursive(child));
          }
        });
      }
      return ids;
    };

    return getAllIdsRecursive(currentNode);
  }, [
    computedCategories,
    activeMainCategory,
    activeSubCategory,
    activeThirdCategory,
    activeFourthCategory,
  ]);

  const testBelongsToActiveCategory = useCallback(
    (test) => {
      if (!test) return false;
      if (!activeAllowedCategoryIds || activeAllowedCategoryIds.length === 0)
        return true;

      const testCategoryIds = new Set();
      const addField = (val) => {
        if (val !== undefined && val !== null && val !== "") {
          testCategoryIds.add(String(val).toLowerCase());
        }
      };

      addField(test.category);
      addField(test.subCategory);
      addField(test.subcategory);
      addField(test.sub_category);
      addField(test.testCategoryId);
      addField(test.test_category_id);
      addField(test.categoryId);
      addField(test.category_id);
      addField(test.subCategoryId);
      addField(test.sub_category_id);
      addField(test.categorySlug);
      addField(test.category_slug);
      addField(test.subCategorySlug);
      addField(test.sub_category_slug);
      addField(test.type);
      addField(test.testType);
      addField(test.test_type);

      addField(test.year);
      addField(test.pyqYear);
      addField(test.pyq_year);

      if (Array.isArray(test.tags)) test.tags.forEach(addField);
      if (Array.isArray(test.categoryPathIds))
        test.categoryPathIds.forEach(addField);
      if (Array.isArray(test.category_path_ids))
        test.category_path_ids.forEach(addField);
      if (Array.isArray(test.categoryPathNames))
        test.categoryPathNames.forEach(addField);
      if (Array.isArray(test.category_path_names))
        test.category_path_names.forEach(addField);

      const isPypTest =
        test.category === "PYPs" ||
        test.isPyq ||
        test.is_pyq ||
        (Array.isArray(test.tags) &&
          test.tags.some((t) => /pyp|previous/i.test(String(t))));
      if (isPypTest) {
        addField("pyp");
        addField("pyps");
        addField("previous-year-papers");
        addField("previous year papers");
        const titleYears = String(test.title || "").match(
          /\b(19\d\d|20\d\d)\b/g,
        );
        if (titleYears) titleYears.forEach(addField);
        const slugYears = String(test.slug || "").match(/\b(19\d\d|20\d\d)\b/g);
        if (slugYears) slugYears.forEach(addField);
      }

      // Climb up parent hierarchy for any matched category in allTestCategories
      if (Array.isArray(allTestCategories) && allTestCategories.length > 0) {
        const directCatId =
          test.testCategoryId ??
          test.test_category_id ??
          test.categoryId ??
          test.category_id;
        if (directCatId) {
          let curId = String(directCatId);
          while (curId) {
            const found = allTestCategories.find(
              (c) => String(c._id || c.id) === curId,
            );
            if (found) {
              addField(found._id || found.id);
              addField(found.slug);
              addField(found.name);
              curId =
                found.parentId || found.parent_id
                  ? String(found.parentId || found.parent_id)
                  : null;
            } else {
              curId = null;
            }
          }
        }
      }

      return Array.from(testCategoryIds).some((id) => {
        if (activeAllowedCategoryIds.includes(id)) return true;
        if (/\b(19\d\d|20\d\d)\b/.test(id)) {
          return activeAllowedCategoryIds.some((allowed) =>
            allowed.includes(id),
          );
        }
        return false;
      });
    },
    [activeAllowedCategoryIds, allTestCategories],
  );

  // Most recently active paused / in-progress attempt for THIS specific series and active category
  const categoryResumeTest = useMemo(() => {
    if (
      !user ||
      incompleteAttempts.length === 0 ||
      !series ||
      tests.length === 0
    )
      return null;
    const currentSeriesId = String(series._id || series.id);
    const currentSeriesSlug = series.slug;

    // Set of test IDs that the user has already completed
    const completedTestIds = new Set(
      attemptRows
        .filter(
          (a) =>
            String(a.status).toLowerCase() === "completed" ||
            a.isCompleted ||
            a.is_completed,
        )
        .map((a) => String(a.testId || a.test_id)),
    );

    const seriesIncomplete = incompleteAttempts.filter((attempt) => {
      const matchSeries =
        String(attempt.seriesId) === currentSeriesId ||
        (attempt.seriesSlug && attempt.seriesSlug === currentSeriesSlug);
      const isPausedOrInProgress =
        attempt.status === "PAUSED" ||
        attempt.status === "IN_PROGRESS" ||
        attempt.status === "in_progress" ||
        attempt.status === "paused" ||
        !attempt.status;

      const testId = String(attempt.testId);
      const isCompletedTest = completedTestIds.has(testId);
      const hasAnsweredQs = (attempt.answeredQuestions || 0) > 0;

      // If user completed this test and the incomplete draft has 0 answered questions, ignore it
      if (isCompletedTest && !hasAnsweredQs) {
        return false;
      }

      return matchSeries && isPausedOrInProgress;
    });

    for (const attempt of seriesIncomplete) {
      const matchedTest = tests.find(
        (t) =>
          String(t._id || t.id) === String(attempt.testId) ||
          (attempt.testSlug && t.slug === attempt.testSlug),
      );
      if (matchedTest && testBelongsToActiveCategory(matchedTest)) {
        return {
          ...attempt,
          testDetails: matchedTest,
          title: attempt.testTitle || matchedTest.title,
        };
      }
    }
    return null;
  }, [
    user,
    incompleteAttempts,
    series,
    tests,
    testBelongsToActiveCategory,
    attemptRows,
  ]);

  // Next test recommendation for THIS specific series and active category (only shown if NO paused test exists AND user HAS ATTEMPTED AT LEAST ONE TEST in this series)
  const categoryNextTest = useMemo(() => {
    if (categoryResumeTest) return null;
    if (!user || !series || tests.length === 0) return null;

    const currentSeriesId = String(series._id || series.id);
    const currentSeriesSlug = series.slug;

    // Filter attempts to find tests the user has actually attempted in this series
    const seriesAttemptRows = attemptRows.filter(
      (a) =>
        String(a.seriesId) === currentSeriesId ||
        (a.seriesSlug && a.seriesSlug === currentSeriesSlug),
    );

    // REAL RECOMMENDATION: Only show "Next Recommended Test" if user HAS ATTEMPTED at least one test in this series
    if (seriesAttemptRows.length === 0) return null;

    const attemptedTestIds = new Set(
      seriesAttemptRows.map((a) => String(a.testId)).filter(Boolean),
    );

    const isAvailable = (t) =>
      t.status !== "archived" && !t.isComingSoon && t.isActive !== false;

    const next = tests
      .filter(isAvailable)
      .filter((t) => testBelongsToActiveCategory(t))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .find((t) => !attemptedTestIds.has(String(t._id || t.id)));

    if (next) {
      return { test: next, series, isQuiz: false };
    }
    return null;
  }, [
    user,
    attemptRows,
    series,
    tests,
    testBelongsToActiveCategory,
    categoryResumeTest,
  ]);

  // Handle category changes with reset for deeper levels
  const handleMainCategoryChange = (key) => {
    setActiveMainCategory(key);
    setActiveSubCategory("all");
    setActiveThirdCategory("all");
    setActiveFourthCategory("all");
    setAnimateKey((prev) => prev + 1);
  };

  const handleSubCategoryChange = (key) => {
    setActiveSubCategory(key);
    setActiveThirdCategory("all");
    setActiveFourthCategory("all");
    setAnimateKey((prev) => prev + 1);
  };

  const handleThirdCategoryChange = (key) => {
    setActiveThirdCategory(key);
    setActiveFourthCategory("all");
    setAnimateKey((prev) => prev + 1);
  };

  const handleFourthCategoryChange = (key) => {
    setActiveFourthCategory(key);
    setAnimateKey((prev) => prev + 1);
  };

  // Set initial active category when data loads
  useEffect(() => {
    const keys = Object.keys(computedCategories);
    if (keys.length > 0 && !keys.includes(activeMainCategory)) {
      setActiveMainCategory(keys[0]);
    }
  }, [computedCategories]);

  // Use computed categories for navigation
  const _categoriesData = computedCategories;

  // Enhanced category synchronization useEffect
  useEffect(() => {
    if (Object.keys(computedCategories).length > 0) {
      // 1. Set initial Main Category if none selected
      if (!activeMainCategory || !computedCategories[activeMainCategory]) {
        const firstKey = Object.keys(computedCategories)[0];
        setActiveMainCategory(firstKey);
        setActiveSubCategory("all");
        setActiveThirdCategory("all");
        setActiveFourthCategory("all");
        return;
      }

      const mainNode = computedCategories[activeMainCategory];

      // 2. Validate SubCategory
      if (activeSubCategory !== "all") {
        const subNode = mainNode.children?.find(
          (c) => c.key === activeSubCategory,
        );
        if (!subNode) {
          setActiveSubCategory("all");
          setActiveThirdCategory("all");
          setActiveFourthCategory("all");
        } else {
          // 3. Validate Third Category
          if (activeThirdCategory !== "all") {
            const thirdNode = subNode.children?.find(
              (c) => c.key === activeThirdCategory,
            );
            if (!thirdNode) {
              setActiveThirdCategory("all");
              setActiveFourthCategory("all");
            } else {
              // 4. Validate Fourth Category
              if (activeFourthCategory !== "all") {
                const fourthNode = thirdNode.children?.find(
                  (c) => c.key === activeFourthCategory,
                );
                if (!fourthNode) {
                  setActiveFourthCategory("all");
                }
              }
            }
          }
        }
      }

      // Update category counts for the header pills using exclusive per-root counts.
      // Each test is counted in exactly ONE root based on its testCategoryId/categoryId,
      // preventing PYPs from also inflating Mock Tests counts.
      const rootKeys = Object.keys(computedCategories);
      const exclusiveCounts = {};
      rootKeys.forEach((k) => {
        exclusiveCounts[k] = 0;
      });

      stageFilteredTests.forEach((test) => {
        const rawCatId =
          test.testCategoryId ??
          test.test_category_id ??
          test.categoryId ??
          test.category_id ??
          "";
        let matchedCat = null;
        if (rawCatId) {
          const catIdStr = String(rawCatId).toLowerCase();
          matchedCat = allTestCategories.find(
            (c) =>
              String(c._id || c.id).toLowerCase() === catIdStr ||
              (c.slug || "").toLowerCase() === catIdStr,
          );
        }
        if (!matchedCat && test.category) {
          const catNameStr = String(test.category).toLowerCase();
          matchedCat = allTestCategories.find(
            (c) =>
              (c.name || "").toLowerCase() === catNameStr ||
              (c.slug || "").toLowerCase() === catNameStr,
          );
        }
        if (!matchedCat) return;
        // Walk up ancestors to find the root this test belongs to
        let currentId = String(matchedCat._id || matchedCat.id);
        let foundRoot = null;
        while (currentId) {
          const rk = rootKeys.find(
            (k) =>
              String(computedCategories[k]?.id) === currentId ||
              k === currentId,
          );
          if (rk) {
            foundRoot = rk;
            break;
          }
          const ancestor = allTestCategories.find(
            (c) => String(c._id || c.id) === currentId,
          );
          currentId = ancestor
            ? String(ancestor.parentId || ancestor.parent_id || "")
            : "";
        }
        if (foundRoot) exclusiveCounts[foundRoot]++;
      });

      const counts = rootKeys
        .map((key) => ({
          name: computedCategories[key].label,
          count: exclusiveCounts[key] || 0,
          displayOrder:
            allTestCategories.find(
              (c) => c.slug === key || String(c._id || c.id) === key,
            )?.displayOrder || 0,
        }))
        .filter((cat) => cat.count > 0)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      setCategoryCounts(counts);
    }
  }, [
    computedCategories,
    stageFilteredTests,
    allTestCategories,
    activeMainCategory,
    activeSubCategory,
    activeThirdCategory,
    activeFourthCategory,
  ]);

  // Fetch series, tests, and metadata from API
  useEffect(() => {
    const controller = new AbortController();
    const fetchMetadata = async () => {
      try {
        const [catsData, examsData, testCatsData, stagesRes] =
          await Promise.all([
            getExamCategories(),
            getExams(),
            getTestCategories(),
            api.get("/api/stages").catch(() => null),
          ]);
        setCategories(catsData);
        setExams(examsData);
        if (testCatsData) {
          setAllTestCategories(testCatsData);
        }
        if (stagesRes?.data?.data && Array.isArray(stagesRes.data.data)) {
          setDirectStages(stagesRes.data.data);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch metadata:", err);
      }
    };

    const fetchData = async () => {
      try {
        let seriesData = null;
        let lookupId = seriesId;

        if (isMyView || !lookupId || lookupId === "my") {
          // Resolve series for 'my' route or examSlug
          const allSeries = await getTestSeries();
          let matched = null;
          if (examSlug) {
            const slugLower = String(examSlug).toLowerCase();
            matched = allSeries.find(
              (s) =>
                (String(s.slug || "").toLowerCase() === slugLower ||
                  String(s.examId || s.exam_id || "").toLowerCase() ===
                    slugLower ||
                  String(s.category || "").toLowerCase() === slugLower) &&
                isSeriesEnrolled(user, s, [s._id, s.id]),
            );
            if (!matched) {
              matched = allSeries.find(
                (s) =>
                  String(s.slug || "").toLowerCase() === slugLower ||
                  String(s.examId || s.exam_id || "").toLowerCase() ===
                    slugLower ||
                  String(s.category || "").toLowerCase() === slugLower,
              );
            }
          }
          if (!matched && user) {
            matched = allSeries.find((s) =>
              isSeriesEnrolled(user, s, [s._id, s.id]),
            );
          }
          if (!matched && allSeries.length > 0) {
            matched = allSeries[0];
          }
          seriesData = matched;
          lookupId = matched
            ? matched.slug || matched._id || matched.id
            : lookupId;
        } else {
          seriesData = await getTestSeriesById(lookupId);
          if (!seriesData) {
            try {
              const res = await seriesAPI.getById(lookupId);
              const raw = res.data?.data || res.data;
              if (raw) seriesData = mapTestSeriesToFrontend(raw);
            } catch {
              // Not found
            }
          }
        }

        setSeries(seriesData);

        if (seriesData) {
          const sid = seriesData._id || seriesData.id || lookupId;
          const testsData = await getTestsBySeriesId(sid);

          // De-duplicate tests by ID to avoid double-counting in UI
          const uniqueTests = [];
          const seenIds = new Set();
          if (Array.isArray(testsData)) {
            testsData.forEach((test) => {
              const tid = String(
                test.id ??
                  test._id ??
                  test.public_id ??
                  test.slug ??
                  Math.random(),
              );
              if (!seenIds.has(tid)) {
                seenIds.add(tid);
                uniqueTests.push(test);
              }
            });
          }

          setTests(uniqueTests);
        }

        // Fetch suggested series (sorted by admin order, respecting pinning)
        const targetSid = seriesData?._id || seriesData?.id || lookupId;
        const related = allSeries
          .filter(
            (s) =>
              s._id !== targetSid && s.id !== targetSid && s.slug !== targetSid,
          )
          .filter(
            (s) => seriesData?.category && s.category === seriesData.category,
          )
          .sort((a, b) => {
            // Pinned items always first
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            // Sort by admin order
            return (a.order || 0) - (b.order || 0);
          })
          .slice(0, 5);

        if (related.length < 5) {
          const popular = allSeries
            .filter(
              (s) =>
                s._id !== seriesId &&
                s.id !== seriesId &&
                !related.find((r) => r._id === s._id),
            )
            .sort((a, b) => {
              // Pinned items always first
              if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
              // Sort by admin order first
              const orderDiff = (a.order || 0) - (b.order || 0);
              if (orderDiff !== 0) return orderDiff;
              // If same order, sort by popularity
              return (b.users || 0) - (a.users || 0);
            })
            .slice(0, 5 - related.length);
          related.push(...popular);
        }

        setSuggestedSeries(related);

        // Fetch Rankings for this specific series
        try {
          setRankingsLoading(true);
          const sid = seriesData?._id || seriesData?.id;
          const rankingsResp = await getTopPerformers(5, sid);
          const rankingList =
            rankingsResp.data?.data || rankingsResp.data || rankingsResp || [];
          setRankings(Array.isArray(rankingList) ? rankingList : []);
        } catch (rankErr) {
          console.error("Failed to fetch rankings:", rankErr);
          setRankings([]);
        } finally {
          setRankingsLoading(false);
        }

        // Fetch User Analytics if logged in
        if (user) {
          try {
            const analytics = await getUserAnalytics();
            if (analytics && Object.keys(analytics).length) {
              setUserStats(analytics.summary || analytics);
            }
          } catch (analyticsErr) {
            console.error("Failed to fetch user analytics:", analyticsErr);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch series:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
    fetchData();
    return () => controller.abort();
  }, [seriesId, examSlug, location.pathname, user?.id]);

  // Normalize URL to /:examSlug/test-series/my when logged-in enrolled user views series
  useEffect(() => {
    if (!series || loading) return;
    const enrolledSeries = user?.enrolledSeries || [];
    const isEnrolled = isSeriesEnrolled(enrolledSeries, series);
    if (user && isEnrolled) {
      const catSlug = (
        series.examId ||
        series.exam_id ||
        series.category ||
        "ssc-cgl"
      )
        .toLowerCase()
        .replace(/\s+/g, "-");
      const expectedPath = `/${catSlug}/test-series/my`;
      if (
        location.pathname !== expectedPath &&
        !location.pathname.endsWith("/my")
      ) {
        navigate(expectedPath, { replace: true });
      }
    }
  }, [series, user, location.pathname, navigate, loading]);

  // Get dynamic labels for category and exam
  const _categoryLabel = useMemo(() => {
    if (!series || !categories.length) return series?.category || "Test Series";
    const cat = categories.find(
      (c) =>
        c.category_id === series.category ||
        c.slug === series.category ||
        String(c.id) === String(series.category),
    );
    return cat?.label || series.category;
  }, [series, categories]);

  const examLabel = useMemo(() => {
    const examRef = series?.examId || series?.exam_id;
    if (!examRef) return "";
    if (exams.length) {
      const exam = exams.find(
        (e) =>
          e.exam_id === examRef ||
          e.slug === examRef ||
          String(e.id) === String(examRef),
      );
      if (exam?.title) return exam.title;
    }
    // Format slug to title: "ssc-cgl" → "SSC CGL"
    return String(examRef).replace(/-/g, " ").toUpperCase();
  }, [series, exams]);

  // Unified recursive filtering logic for 4 layers (using stage-filtered tests as base)
  const filteredTests = useMemo(() => {
    return stageFilteredTests.filter((test) =>
      testBelongsToActiveCategory(test),
    );
  }, [stageFilteredTests, testBelongsToActiveCategory]);

  // Pagination limit of 5 tests per page
  const TESTS_PER_PAGE = 5;
  const totalTestPages = Math.ceil(filteredTests.length / TESTS_PER_PAGE);

  const paginatedTests = useMemo(() => {
    const start = (currentPage - 1) * TESTS_PER_PAGE;
    return filteredTests.slice(start, start + TESTS_PER_PAGE);
  }, [filteredTests, currentPage]);

  // Reset to page 1 whenever filters or the series itself change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeMainCategory,
    activeSubCategory,
    activeThirdCategory,
    activeFourthCategory,
    activeStage,
    seriesId,
    series?.id,
    series?._id,
  ]);

  const hasProPass = user?.hasProPass || false;
  const isAdmin = user?.role === "admin";

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-transparent">
        <Helmet>
          <title>
            {series?.title
              ? `${series.title} | Trstprep`
              : "Test Series | Trstprep"}
          </title>
          <meta
            name="description"
            content="View test details, enroll, and start practicing on Trstprep."
          />
        </Helmet>
        <div className="flex flex-col items-center justify-center p-8 max-w-md w-full animate-fade-in text-center space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-600 animate-spin"></div>
            <div className="absolute w-8 h-8 rounded-full bg-indigo-500/20 animate-ping"></div>
            <div className="absolute w-3.5 h-3.5 rounded-full bg-indigo-600"></div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-wide">
              Loading Test Series...
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Preparing tests, categories & performance insights
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show 404 Not Found if series doesn't exist
  if (!series) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <Helmet>
          <title>Test Series Not Found | Trstprep</title>
          <meta
            name="description"
            content="The requested test series was not found."
          />
        </Helmet>
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Test Series Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            The test series you're looking for doesn't exist in our system.
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Please check the URL or browse our available test series.
          </p>
          <Link
            to="/test-series"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Browse All Series
          </Link>
        </div>
      </div>
    );
  }

  // Show Coming Soon banner if series exists but has no tests yet
  const showComingSoonBanner =
    series && (series.isComingSoon || tests.length === 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {ConfirmDialog}
      <Helmet>
        <title>{series?.title || "Test Details"} | Trstprep</title>
        <meta
          name="description"
          content={
            series?.description ||
            "View test details, enroll, and start practicing on Trstprep."
          }
        />
        <meta
          property="og:title"
          content={`${series?.title || "Test Details"} | Trstprep`}
        />
        <meta
          property="og:description"
          content={
            series?.description ||
            "View test details, enroll, and start practicing on Trstprep."
          }
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      <div className="mx-auto px-0 sm:px-4 lg:px-8 pb-6">
        <Breadcrumb
          items={[
            { label: "Home", to: "/" },
            {
              label: examLabel,
              to: `/exams/category/${series.category}/exam/${series.examId || series.exam_id}`,
            },
            { label: series.title },
          ]}
        />

        {/* Coming Soon Banner */}
        {showComingSoonBanner && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  Coming Soon - Tests Under Preparation
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This test series is being prepared and tests will be available
                  shortly. We're creating comprehensive mock tests, previous
                  year papers, and practice tests for this series.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="px-3 py-1.5 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-lg transition-all border border-amber-200 dark:border-amber-800"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    toast("You will be notified when tests are available!");
                  }}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                >
                  Notify Me
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULL WIDTH HERO SECTION */}
        <div className="relative bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950 rounded-none md:rounded-3xl border border-indigo-100 dark:border-indigo-950/40 p-5 md:p-8 mb-6 mt-2 md:mt-0 -mx-0 overflow-hidden shadow-card dark:shadow-2xl transition-all duration-300">
          {/* Animated Glow Background Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-500/15 rounded-full blur-3xl animate-pulse duration-[8000ms]" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-400/10 dark:bg-indigo-600/15 rounded-full blur-3xl animate-pulse duration-[6000ms]" />
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>

          <div className="flex flex-col md:flex-row md:items-stretch md:justify-between gap-2 md:gap-6 relative z-10">
            {/* Left - Info */}
            <div className="flex-1">
              {/* First Row: Name & Options */}
              <div className="flex justify-between items-start gap-4 mb-3">
                <h1 className="text-2xl md:text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {series.title}
                </h1>

                {/* Triple Dot / Manage Options (Mobile Only) */}
                {(isEnrolled || isAdmin) && (
                  <div className="relative flex-shrink-0 md:hidden">
                    <button
                      onClick={() => setShowDropdownMenu(!showDropdownMenu)}
                      className="p-1.5 bg-white/80 hover:bg-white text-slate-600 border border-slate-200 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/10 rounded-lg transition-all shadow-sm"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {showDropdownMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowDropdownMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 py-2 flex flex-col transform origin-top-right">
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                setShowDropdownMenu(false);
                                handleManageClick(e);
                              }}
                              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 flex items-center gap-2.5 w-full text-left transition-colors"
                            >
                              <ArrowRight className="w-4 h-4" />
                              Manage Series
                            </button>
                          )}
                          {isEnrolled && (
                            <button
                              onClick={() => {
                                handleUnenroll();
                                setShowDropdownMenu(false);
                              }}
                              className={`px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 w-full text-left transition-colors ${isAdmin ? "border-t border-gray-100 dark:border-gray-700" : ""}`}
                            >
                              <Trash2 className="w-4 h-4" />
                              Unenroll
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Second Row: Other Details (excluding exam name/category) */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-indigo-200/80 mb-4">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    {totalPermanentTests}
                  </span>{" "}
                  Tests
                </div>
                {liveTestsCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      {liveTestsCount}
                    </span>{" "}
                    Live Tests
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    {series.usersCount ??
                      series.enrollmentCount ??
                      series.users_count ??
                      (typeof series.users === "number"
                        ? series.users
                        : parseInt(series.users) || 0)}{" "}
                    Users
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    {series.rating || 4.8}
                  </span>
                </div>
                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  {permanentFreeTestsCount ||
                    series.free_tests ||
                    series.freeTests ||
                    0}{" "}
                  Free Tests
                </span>
              </div>

              {/* Description */}
              {series.description && (
                <p className="text-slate-700 dark:text-indigo-100/90 text-sm mb-4 leading-relaxed font-medium">
                  {series.description}
                </p>
              )}

              {/* Stages & Types - Compact Section */}
              <div className="flex justify-between items-start gap-2 mb-4">
                {/* Left Side: Covers and Types */}
                <div className="flex flex-col gap-3">
                  {/* Row 1: Covers */}
                  {seriesStages.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-550 dark:text-indigo-200/60 whitespace-nowrap">
                        Covers:
                      </span>
                      {seriesStages.map((stage) => (
                        <span
                          key={stage._id || stage.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50/50 text-indigo-700 border border-indigo-100 dark:bg-white/5 dark:text-indigo-200 dark:border-white/10 text-[10px] sm:text-xs font-semibold rounded-full"
                        >
                          {stage.icon && <span>{stage.icon}</span>}
                          {stage.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Row 2: Test Types - Compact Pills */}
                  {categoryCounts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {categoryCounts.map((cat, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/70 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg"
                        >
                          <span className="text-[10px] font-black text-slate-550 dark:text-indigo-200/60 uppercase tracking-widest">
                            {cat.name}
                          </span>
                          <span className="bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white px-1.5 py-0.5 rounded-md font-black text-[11px]">
                            {cat.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Side: Stage Dropdown (Mobile Only) */}
                <div className="block md:hidden flex-shrink-0 w-[100px]">
                  <div className="relative mt-1">
                    <select
                      value={activeStage}
                      onChange={(e) => setActiveStage(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 text-slate-700 dark:bg-white/10 dark:border-white/10 dark:text-white rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent cursor-pointer shadow-sm"
                    >
                      {stageOptions.map((option) => (
                        <option
                          key={option.key}
                          value={option.key}
                          className="bg-white text-gray-900 dark:bg-slate-900 dark:text-white"
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-indigo-300 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Stage Menu & CTA */}
            <div className="flex flex-col justify-center relative md:w-auto md:items-end md:min-w-[190px]">
              {/* Desktop Triple Dot / Manage Options */}
              {(isEnrolled || isAdmin) && (
                <div className="hidden md:block absolute -top-2 right-0">
                  <button
                    onClick={() => setShowDropdownMenu(!showDropdownMenu)}
                    className="p-2 bg-white/80 hover:bg-white text-slate-600 border border-slate-200 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/10 rounded-lg transition-all shadow-sm"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {showDropdownMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdownMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 py-2 flex flex-col transform origin-top-right">
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              setShowDropdownMenu(false);
                              handleManageClick(e);
                            }}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 flex items-center gap-2.5 w-full text-left transition-colors"
                          >
                            <ArrowRight className="w-4 h-4" />
                            Manage Series
                          </button>
                        )}
                        {isEnrolled && (
                          <button
                            onClick={() => {
                              handleUnenroll();
                              setShowDropdownMenu(false);
                            }}
                            className={`px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 w-full text-left transition-colors ${isAdmin ? "border-t border-gray-100 dark:border-gray-700" : ""}`}
                          >
                            <Trash2 className="w-4 h-4" />
                            Unenroll
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Desktop: Stage Selection */}
              <div className="hidden md:block mb-3 mt-6">
                <label className="block text-[10px] font-black text-slate-500 dark:text-indigo-200/60 uppercase tracking-widest mb-1.5 md:text-left">
                  Stage
                </label>
                <div className="relative inline-block min-w-[160px]">
                  <select
                    value={activeStage}
                    onChange={(e) => setActiveStage(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 dark:bg-white/10 dark:border-white/20 dark:text-white rounded-xl px-4 py-2.5 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer transition-all hover:border-indigo-450 dark:hover:border-indigo-400 shadow-sm"
                  >
                    {stageOptions.map((option) => (
                      <option
                        key={option.key}
                        value={option.key}
                        className="bg-white text-gray-900 dark:bg-slate-900 dark:text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-indigo-300 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons Section */}
              <div className="flex flex-col gap-2.5 w-full md:w-auto items-stretch md:items-end">
                {showComingSoonBanner ? (
                  <button
                    disabled
                    className="px-4 py-2 bg-gray-400 dark:bg-gray-600 text-white font-semibold md:font-bold rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm h-[38px]"
                  >
                    Coming Soon
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {/* Free Series: Add button for unenrolled users */}
                    {!isSeriesPro && !isEnrolled && (
                      <button
                        onClick={handleEnroll}
                        disabled={isEnrolling}
                        className="px-3 md:px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold md:font-bold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm h-[36px] md:h-[38px] disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        {isEnrolling ? (
                          "Adding..."
                        ) : (
                          <>
                            Add
                            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </>
                        )}
                      </button>
                    )}

                    {/* Pro Series: Add button ONLY for already-Pro / Admin users who are not yet enrolled */}
                    {isSeriesPro && (isUserPro || isAdmin) && !isEnrolled && (
                      <button
                        onClick={handleEnroll}
                        disabled={isEnrolling}
                        className="px-3 md:px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold md:font-bold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm h-[36px] md:h-[38px] disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        {isEnrolling ? (
                          "Adding..."
                        ) : (
                          <>
                            Add
                            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </>
                        )}
                      </button>
                    )}

                    {/* Get Pro Pass Button (shown for free / non-pro users) */}
                    {!isUserPro && !isAdmin && (
                      <Link
                        to="/pass"
                        className="px-3 md:px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold md:font-bold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm h-[36px] md:h-[38px] shadow-sm cursor-pointer whitespace-nowrap"
                      >
                        <Crown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Get Pro Pass
                      </Link>
                    )}
                  </div>
                )}

                {/* Progress Card (if enrolled on desktop) */}
                {isEnrolled && !isAdmin && (
                  <div className="hidden md:block w-full min-w-[200px] mt-1">
                    <div className="bg-slate-100/50 border border-slate-150 dark:bg-white/5 dark:border-white/10 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-600 dark:text-indigo-200">
                          Your Progress
                        </span>
                        <span className="text-xs font-black text-slate-950 dark:text-indigo-300">
                          {progressPercentage}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout: Tests + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tests List */}
          <div className="flex-1 min-w-0">
            {/* LOGGED-IN USER: Resume + Next Test recommendations for this series and active category */}
            {user && (categoryResumeTest || categoryNextTest) && (
              <section className="fade-in mb-6">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl">🚀</span>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Up Next
                  </h2>
                </div>
                <div className="space-y-4">
                  {/* Resume paused / in-progress test */}
                  {categoryResumeTest && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl transition-all duration-200 overflow-hidden shadow-sm border-2 border-amber-300 dark:border-amber-700 hover:border-amber-400 hover:shadow-md">
                      {/* Main Content */}
                      <div className="px-3.5 py-2.5">
                        {/* Badges Row */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-amber-500 text-white">
                            <RotateCcw className="w-3 h-3" />
                            {categoryResumeTest.status === "PAUSED"
                              ? "PAUSED"
                              : "IN PROGRESS"}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                            RESUME RECOMMENDED
                          </span>
                        </div>

                        {/* Title + CTA Row */}
                        <div className="flex justify-between items-start gap-2.5">
                          <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">
                            {categoryResumeTest.title}
                          </h3>
                          <Link
                            to={(() => {
                              const resumeTestId =
                                categoryResumeTest.public_id_uuid ||
                                categoryResumeTest.public_id ||
                                categoryResumeTest.testDetails?.public_id ||
                                categoryResumeTest.testId ||
                                categoryResumeTest.testDetails?.id ||
                                categoryResumeTest.testDetails?._id ||
                                categoryResumeTest.slug;
                              const resumeSlug =
                                categoryResumeTest.seriesSlug || series?.slug;
                              const attemptNo =
                                categoryResumeTest.attemptNo ||
                                categoryResumeTest.attemptNumber ||
                                1;
                              return resumeSlug
                                ? `/${resumeSlug}/tests/${resumeTestId}?attemptNo=${attemptNo}`
                                : `/test/${seriesId || "all"}/${resumeTestId}?attemptNo=${attemptNo}`;
                            })()}
                            className="flex-shrink-0 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-150 shadow-sm"
                          >
                            Resume
                          </Link>
                        </div>

                        {/* Meta Info Row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <span className="text-sm">❓</span>
                            {categoryResumeTest.answeredQuestions || 0}/
                            {categoryResumeTest.totalQuestions || 0} Qs Answered
                          </span>
                          <span className="text-gray-300 dark:text-gray-500">
                            |
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-sm">📄</span>
                            {categoryResumeTest.testDetails?.totalMarks ||
                              categoryResumeTest.testDetails?.marks ||
                              200}{" "}
                            Marks
                          </span>
                          <span className="text-gray-300 dark:text-gray-500">
                            |
                          </span>
                          {categoryResumeTest.remainingTimeSeconds > 0 ? (
                            <span className="flex items-center gap-1">
                              <span className="text-sm">🕒</span>
                              {Math.round(
                                categoryResumeTest.remainingTimeSeconds / 60,
                              )}{" "}
                              Mins Left
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="text-sm">🕒</span>
                              {categoryResumeTest.testDetails?.duration ||
                                60}{" "}
                              Mins Total
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{categoryResumeTest.progressPct || 0}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${categoryResumeTest.progressPct || 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 px-3.5 py-2">
                        <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <span className="text-sm">🌐</span>
                            {categoryResumeTest.seriesTitle || series.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Next test in this series */}
                  {categoryNextTest && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm">
                          NEXT RECOMMENDED TEST
                        </span>
                      </div>
                      <TestCard
                        test={categoryNextTest.test}
                        seriesId={series.slug || series._id || seriesId}
                        series={series}
                        user={user}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Combined Tabs and Tests Section with Background */}
            <div className="bg-white dark:bg-gray-800 rounded-none md:rounded-xl border border-gray-100 dark:border-gray-700 p-2 md:p-4">
              {/* Main Category Tabs - Compact Segmented Control */}
              <div className="flex mb-4">
                <div
                  className="inline-flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl overflow-x-auto scrollbar-hide"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {Object.keys(computedCategories)
                    .sort((a, b) => {
                      const catA = allTestCategories.find(
                        (c) => c.slug === a || String(c._id || c.id) === a,
                      );
                      const catB = allTestCategories.find(
                        (c) => c.slug === b || String(c._id || c.id) === b,
                      );
                      return (
                        (catA?.displayOrder || 0) - (catB?.displayOrder || 0)
                      );
                    })
                    .map((catKey) => (
                      <button
                        key={catKey}
                        onClick={() => handleMainCategoryChange(catKey)}
                        className={`px-4 md:px-6 py-1.5 rounded-lg transition-all flex-shrink-0 flex items-center justify-center gap-3 ${
                          activeMainCategory === catKey
                            ? "bg-white dark:bg-gray-800 text-brand-start shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
                        }`}
                      >
                        <span className="text-[13px] md:text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                          {computedCategories[catKey].label}
                        </span>
                        <span
                          className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-md ${
                            activeMainCategory === catKey
                              ? "bg-brand-start/10 text-brand-start"
                              : "bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {computedCategories[catKey].count || 0}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

              {/* Layer 2 - Sub-Category Tabs */}
              {computedCategories[activeMainCategory]?.children?.length > 0 && (
                <>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1 px-1 pr-6 border-t border-gray-200 dark:border-gray-700 mt-1">
                    {computedCategories[activeMainCategory].children.map(
                      (subcat) => (
                        <button
                          key={subcat.key}
                          onClick={() => handleSubCategoryChange(subcat.key)}
                          className={`px-2.5 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                            activeSubCategory === subcat.key
                              ? "bg-brand-start text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {subcat.label}
                          {subcat.count > 0 && (
                            <span className="ml-0.5 text-[12px]">
                              ({subcat.count})
                            </span>
                          )}
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}

              {/* Layer 3 - Third Category Tabs */}
              {availableThirdCategories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-1 pr-6 border-t border-gray-100 dark:border-gray-700">
                  {availableThirdCategories.map((third) => (
                    <button
                      key={third.key}
                      onClick={() => handleThirdCategoryChange(third.key)}
                      className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                        activeThirdCategory === third.key
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {third.label}
                      {third.count > 0 && (
                        <span className="ml-1">({third.count})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Layer 4 - Fourth Category Tabs */}
              {availableFourthCategories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-1 pr-6 border-t border-gray-50 dark:border-gray-700">
                  {availableFourthCategories.map((fourth) => (
                    <button
                      key={fourth.key}
                      onClick={() => handleFourthCategoryChange(fourth.key)}
                      className={`px-2 py-0.5 rounded-lg text-[13px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                        activeFourthCategory === fourth.key
                          ? "bg-gray-800 text-white shadow-xs"
                          : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      {fourth.label}
                      {fourth.count > 0 && (
                        <span className="ml-1 opacity-60">{fourth.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700"></div>

              {/* Tests - Single Column Layout with Animation (Limit 5 per page) */}
              <div className="mt-4">
                {paginatedTests.length > 0 ? (
                  <>
                    <div
                      key={`${animateKey}-${currentPage}`}
                      className="space-y-3 animate-fadeIn"
                    >
                      {paginatedTests.map((test, index) => (
                        <div
                          key={test._id || test.id}
                          className="animate-slideUp"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <TestCard
                            test={test}
                            seriesId={series.slug || series._id || seriesId}
                            series={series}
                            user={user}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls (Show at most 3 page numbers at a time) */}
                    {totalTestPages > 1 &&
                      (() => {
                        // Calculate 3-page window around currentPage
                        let startPage = Math.max(1, currentPage - 1);
                        let endPage = Math.min(totalTestPages, startPage + 2);
                        if (endPage - startPage < 2) {
                          startPage = Math.max(1, endPage - 2);
                        }
                        const visiblePages = [];
                        for (let p = startPage; p <= endPage; p++) {
                          visiblePages.push(p);
                        }

                        return (
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700/60">
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                              }
                              disabled={currentPage === 1}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              <span>Previous</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              {/* Jump to first page if window starts after page 1 */}
                              {startPage > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setCurrentPage(1)}
                                    className="w-7 h-7 md:w-8 md:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  >
                                    1
                                  </button>
                                  {startPage > 2 && (
                                    <span className="text-gray-400 dark:text-gray-500 text-xs px-0.5">
                                      ...
                                    </span>
                                  )}
                                </>
                              )}

                              {/* 3 Visible Pages */}
                              {visiblePages.map((page) => (
                                <button
                                  key={page}
                                  type="button"
                                  onClick={() => setCurrentPage(page)}
                                  className={`w-7 h-7 md:w-8 md:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    currentPage === page
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}

                              {/* Jump to last page if window ends before totalTestPages */}
                              {endPage < totalTestPages && (
                                <>
                                  {endPage < totalTestPages - 1 && (
                                    <span className="text-gray-400 dark:text-gray-500 text-xs px-0.5">
                                      ...
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCurrentPage(totalTestPages)
                                    }
                                    className="w-7 h-7 md:w-8 md:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  >
                                    {totalTestPages}
                                  </button>
                                </>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setCurrentPage((p) =>
                                  Math.min(totalTestPages, p + 1),
                                )
                              }
                              disabled={currentPage === totalTestPages}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })()}
                  </>
                ) : (
                  <EmptyState
                    illustration="search"
                    title="No tests found in this category"
                    description="Try selecting a different test category, tier, or stage to explore available practice tests."
                    className="py-12"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Hidden on Mobile */}
          <div className="hidden lg:block w-80 flex-shrink-0 space-y-6">
            {/* User Ranking Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5" />
                  <h3 className="font-bold">Top Performers</h3>
                </div>
                <p className="text-amber-100 text-xs mt-1">
                  Based on tests attempted
                </p>
              </div>

              <div className="p-4">
                {/* Current User Rank (if logged in) */}
                {user && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-3 mb-4 border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm">
                          Your Status
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {userStats?.totalTests ?? userStats?.testCount ?? 0}{" "}
                          tests attempted
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">
                          {userStats?.rank ? `#${userStats.rank}` : "Unranked"}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          overall
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rankings List */}
                <div className="space-y-2">
                  {rankingsLoading ? (
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse flex items-center gap-3 p-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded" />
                        <div className="w-10 h-6 bg-gray-100 dark:bg-gray-800 rounded" />
                      </div>
                    ))
                  ) : rankings.length > 0 ? (
                    rankings.slice(0, 5).map((rank, index) => (
                      <div
                        key={rank.id || index}
                        className={`flex items-center gap-3 p-2 rounded-lg transition ${
                          index === 0
                            ? "bg-amber-50 dark:bg-amber-900/10"
                            : index === 1
                              ? "bg-gray-50 dark:bg-gray-700/30"
                              : index === 2
                                ? "bg-orange-50 dark:bg-orange-900/10"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {/* Rank Number */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            index === 0
                              ? "bg-amber-400 text-white"
                              : index === 1
                                ? "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                                : index === 2
                                  ? "bg-orange-400 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {index + 1}
                        </div>

                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-medium text-sm">
                          {rank.avatar || rank.name?.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 dark:text-white text-sm truncate">
                            {rank.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {rank.testsAttempted || 0} tests
                          </p>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <p className="font-bold text-gray-800 dark:text-white text-sm">
                            {rank.avgScore || 0}%
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            avg
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-xl sm:text-2xl lg:text-3xl mb-2 grayscale opacity-50">
                        🏆
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No performances in this series yet
                      </p>
                    </div>
                  )}
                </div>

                {/* View Full Leaderboard */}
                <Link
                  to="/leaderboard"
                  className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
                >
                  View Full Leaderboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Suggested Test Series */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Suggested Series
                  </h3>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Based on your preparation
                </p>
              </div>

              <div className="p-4 space-y-3">
                {suggestedSeries.length > 0 ? (
                  suggestedSeries.map((suggested) => (
                    <Link
                      key={suggested._id || suggested.id}
                      to={`/test-series/${suggested.slug || suggested._id || suggested.id}`}
                      className="block p-3 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{suggested.icon || "📝"}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm line-clamp-2 group-hover:text-brand-start transition">
                            {suggested.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>{suggested.totalTests || 0} Tests</span>
                            <span>•</span>
                            <span>
                              {suggested.usersCount ??
                                suggested.enrollmentCount ??
                                (typeof suggested.users === "number"
                                  ? suggested.users
                                  : parseInt(suggested.users) || 0)}{" "}
                              users
                            </span>
                          </div>
                          {suggested.rating && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                {suggested.rating}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-start transition flex-shrink-0" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                    No suggestions available
                  </div>
                )}

                <Link
                  to="/test-series"
                  className="block w-full py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white font-medium rounded-lg text-center hover:shadow-glow transition text-sm"
                >
                  Browse All Series
                </Link>
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-card p-5 text-white">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5" />
                Series Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Total Tests</span>
                  <span className="font-bold">{totalPermanentTests}</span>
                </div>
                {liveTestsCount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-100 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
                      Live Tests
                    </span>
                    <span className="font-bold text-rose-200">
                      {liveTestsCount}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Free Tests</span>
                  <span className="font-bold text-green-300">
                    {permanentFreeTestsCount || series.freeTests || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Total Questions</span>
                  <span className="font-bold">
                    {permanentTests.reduce(
                      (acc, t) => acc + (t.totalQuestions || t.questions || 0),
                      0,
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Total Marks</span>
                  <span className="font-bold">
                    {permanentTests.reduce(
                      (acc, t) => acc + (t.totalMarks || t.marks || 100),
                      0,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TestDetails);
