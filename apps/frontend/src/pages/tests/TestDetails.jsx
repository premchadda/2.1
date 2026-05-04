import { useParams, Link, useNavigate } from 'react-router-dom'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Star, Users, Clock, FileText, Trophy, Lock,
  Crown, ChevronDown, ArrowRight, Radio, Package,
  ChevronRight, TrendingUp, Medal, Flame,
  Target, Award, BarChartBig, MoreVertical, Trash2
} from 'lucide-react'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { TestCard } from '../../shared/components'
import { useAuth } from '../../shared/providers/AuthContext.jsx'
import {
  getTestSeriesById,
  getTestsBySeriesId,
  getTestSeries,
  getTopPerformers,
  getExamCategories,
  getExams,
  getTestCategories,
  getUserAnalytics,
  adminAPI
} from '../../shared/lib/dataService'
import api from '../../shared/lib/api'
import ComingSoon from './ComingSoon'

import { useStages } from '../../shared/hooks/useStages'
import { hasLegacyEnrolledSeriesIds, isSeriesEnrolled } from '../../shared/lib/enrollment.js'

function TestDetails() {
  const { seriesId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()

  const { stages: allStages, loading: stagesLoading } = useStages()
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [showDropdownMenu, setShowDropdownMenu] = useState(false)

  // Enhanced state for two-level navigation
  const [activeMainCategory, setActiveMainCategory] = useState(null)
  const [activeSubCategory, setActiveSubCategory] = useState(null)
  const [activeThirdCategory, setActiveThirdCategory] = useState(null)
  const [activeFourthCategory, setActiveFourthCategory] = useState(null)
  const [activeStage, setActiveStage] = useState('all') // 'all' or stage-slug
  const [series, setSeries] = useState(null)
  const [tests, setTests] = useState([])
  const [suggestedSeries, setSuggestedSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [animateKey, setAnimateKey] = useState(0)
  const [categoryCounts, setCategoryCounts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTestCategories, setAllTestCategories] = useState([])
  const [exams, setExams] = useState([])
  const [userStats, setUserStats] = useState(null)
  const [rankings, setRankings] = useState([])
  const [rankingsLoading, setRankingsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    // Only refresh once on mount if user has legacy enrolled series format
    if (hasLegacyEnrolledSeriesIds(user.enrolledSeries)) {
      refreshUser()
    }
  }, [])

  // Get stages linked to this test series

  // Get stages linked to this test series
  const seriesStages = useMemo(() => {
    if (!series || !allStages.length) return []

    // First check if series has stages array (contains stage IDs)
    if (Array.isArray(series.stages) && series.stages.length > 0) {
      return allStages.filter(s =>
        series.stages.includes(s._id) ||
        series.stages.includes(s.id) ||
        series.stages.includes(String(s._id)) ||
        series.stages.includes(String(s.id))
      )
    }

    // Fallback: filter by exam ID
    const examId = series.subcategory
    return allStages.filter(s =>
      Array.isArray(s.examIds) && (s.examIds.includes(examId) || s.examIds.includes(String(examId)))
    )
  }, [series, allStages])

  // Calculate dynamic stage options based on the series exam
  const stageOptions = useMemo(() => {
    if (!series || !allStages.length) return [
      { key: 'all', label: 'All Stages', icon: Target }
    ]

    const examId = series.subcategory // ID of the exam (sub_category_id)

    // Filter stages that are linked to this exam, or show all if none are linked specifically
    const linkedStages = allStages.filter(s =>
      Array.isArray(s.examIds) && (s.examIds.includes(examId) || s.examIds.includes(String(examId)))
    )

    const baseOptions = [{ key: 'all', label: 'All Stages', icon: Target }]

    // Use seriesStages if available, otherwise use linked or all stages
    const stagesToUse = seriesStages.length > 0 ? seriesStages : (linkedStages.length > 0 ? linkedStages : allStages)

    const dynamicOptions = stagesToUse
      .filter(s => s.isActive !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(s => ({
        key: s.slug,
        label: s.name,
        icon: s.icon ? () => <span>{s.icon}</span> : BarChartBig
      }))

    return [...baseOptions, ...dynamicOptions]
  }, [series, allStages, seriesStages])

  // Horizontal scroll refs for sub-tabs
  const subTabsRef = useRef(null)
  const categoryTabsRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)



  const handleEnroll = async () => {
    if (!user) {
      window.location.href = '/login'
      return
    }

    // Use slug for API call (backend supports both slug and numeric ID)
    const seriesIdentifier = series?.slug || series?._id || series?.id
    if (!seriesIdentifier) {
      alert('Unable to enroll: Series identifier not found')
      return
    }

    // Check if already enrolled BEFORE making API call
    if (isEnrolled) {
      // Already enrolled, no need to call API
      return
    }

    // Prevent duplicate requests
    if (isEnrolling) return

    setIsEnrolling(true)
    try {
      const response = await api.post(`/api/users/enroll/${seriesIdentifier}`)
      if (response.data.success) {
        await refreshUser()
        if (!response.data.alreadyEnrolled) {
          alert('Successfully enrolled in this test series!')
        }
      }
    } catch (err) {
      console.error('Enrollment error:', err)
      const message = err.response?.data?.message || ''
      if (message.includes('Already enrolled') || message.includes('already enrolled')) {
        alert('You are already enrolled in this test series')
      } else {
        alert(`Failed to enroll: ${message || 'Please try again.'}`)
      }
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleUnenroll = async () => {
    if (!user) return

    const seriesIdentifier = series?.slug || series?._id || series?.id
    if (!seriesIdentifier) {
      alert('Unable to unenroll: Series identifier not found')
      return
    }

    if (!window.confirm('Are you sure you want to unenroll from this test series? Your progress will be lost.')) {
      return
    }

    try {
      const response = await api.delete(`/api/users/unenroll/${seriesIdentifier}`)
      if (response.data.success) {
        await refreshUser()
        alert('Successfully unenrolled from this test series!')
      }
    } catch (err) {
      console.error('Unenroll error:', err)
      const message = err.response?.data?.message || ''
      alert(`Failed to unenroll: ${message || 'Please try again.'}`)
    }
  }

  const handleManageClick = () => {
    // For admin users - navigate to admin panel for this series
    const seriesId = series?._id || series?.id
    if (seriesId) {
      navigate(`/admin/test-series/${seriesId}`)
    }
  }

  // Horizontal scroll handlers for touch and mouse drag
  const handleMouseDown = (e) => {
    if (!subTabsRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - subTabsRef.current.offsetLeft)
    setScrollLeft(subTabsRef.current.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !subTabsRef.current) return
    e.preventDefault()
    const x = e.pageX - subTabsRef.current.offsetLeft
    const walk = (x - startX) * 2
    subTabsRef.current.scrollLeft = scrollLeft - walk
  }

  // Horizontal scroll handlers for category tabs
  const handleCategoryMouseDown = (e) => {
    if (!categoryTabsRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - categoryTabsRef.current.offsetLeft)
    setScrollLeft(categoryTabsRef.current.scrollLeft)
  }

  const handleCategoryMouseLeave = () => {
    setIsDragging(false)
  }

  const handleCategoryMouseUp = () => {
    setIsDragging(false)
  }

  const handleCategoryMouseMove = (e) => {
    if (!isDragging || !categoryTabsRef.current) return
    e.preventDefault()
    const x = e.pageX - categoryTabsRef.current.offsetLeft
    const walk = (x - startX) * 2
    categoryTabsRef.current.scrollLeft = scrollLeft - walk
  }

  // First, filter tests by stage only (this will be used for category computation)
  const stageFilteredTests = useMemo(() => {
    if (!activeStage || activeStage === 'all') {
      return tests;
    }

    const stage = allStages.find(s => s.slug === activeStage);
    if (!stage) return tests;

    const targetId = String(stage.id || stage._id);
    const stageName = stage.name;

    // Filter tests by stageId OR tier field matching stage name (same logic as backend)
    return tests.filter(test => {
      const testStageId = String(test.stageId || test.stage_id || '');
      const testTier = String(test.tier || '');

      return testStageId === targetId ||
        testStageId === String(stage._id) ||
        testTier === stageName ||
        testTier.toLowerCase() === stageName.toLowerCase();
    });
  }, [tests, activeStage, allStages]);

  // Calculate dynamic progress percentage for this series
  const progressPercentage = useMemo(() => {
    if (!series || !user) return 0;
    const sid = series._id || series.id;
    const done = user.attemptedTests?.[sid] ||
      user.attemptedTests?.[String(sid)] ||
      user.attemptedTests?.[series.slug] || 0;
    const total = series.totalTests || tests.length || 0;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [series, user, tests]);

  // Dynamic categories computed from stage-filtered tests and metadata
  const computedCategories = useMemo(() => {
    if (!allTestCategories.length) return {};

    // 1. Build the recursive tree
    const buildNode = (parentId, currentLevel = 1) => {
      if (currentLevel > 4) return [];

      return allTestCategories
        .filter(cat => {
          const pid = cat.parentId || cat.parent_id;
          return parentId === null ? (!pid) : (String(pid) === String(parentId));
        })
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map(cat => ({
          id: String(cat._id || cat.id),
          key: cat.slug || String(cat._id || cat.id),
          label: cat.name,
          level: currentLevel,
          children: buildNode(cat._id || cat.id, currentLevel + 1),
          count: 0,
          free: 0,
          live: cat.slug?.includes('live') || cat.name?.toLowerCase().includes('live')
        }));
    };

    const tree = buildNode(null);
    const categoryMap = {};

    // Add "All" to children if they have at least one child
    const addAllOption = (nodes) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          node.children.unshift({
            id: 'all',
            key: 'all',
            label: 'All',
            level: node.level + 1,
            children: [],
            count: 0,
            free: 0
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
        const cat = allTestCategories.find(c => String(c._id || c.id) === String(currentId));
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
    const incrementCount = (nodes, path, isFree, isLive) => {
      nodes.forEach(node => {
        if (path.includes(node.id) || node.id === 'all') {
          node.count++;
          if (isFree) node.free++;
          if (isLive) node.live = true;
          if (node.children.length > 0) {
            incrementCount(node.children, path, isFree, isLive);
          }
        }
      });
    };

    // Use stageFilteredTests instead of all tests
    stageFilteredTests.forEach(test => {
      const isFree = test.type === 'Free' || !test.isPro;
      const isLive = test.isLive;

      // Collect all IDs the test belongs to
      const testCategoryIds = new Set();
      if (test.category) testCategoryIds.add(String(test.category).toLowerCase());
      if (test.subCategory) testCategoryIds.add(String(test.subCategory).toLowerCase());
      if (test.examId) testCategoryIds.add(String(test.examId).toLowerCase());
      if (test.testCategoryId) testCategoryIds.add(String(test.testCategoryId).toLowerCase());
      if (test.test_category_id) testCategoryIds.add(String(test.test_category_id).toLowerCase());
      if (test.categoryPathIds && Array.isArray(test.categoryPathIds)) {
        test.categoryPathIds.forEach(pid => testCategoryIds.add(String(pid).toLowerCase()));
      }
      if (test.categoryPathNames && Array.isArray(test.categoryPathNames)) {
        test.categoryPathNames.forEach(name => testCategoryIds.add(String(name).toLowerCase()));
      }

      // Find all categories in allTestCategories that match any of these IDs/Slugs
      const matchedCats = allTestCategories.filter(c =>
        testCategoryIds.has(String(c._id || c.id).toLowerCase()) ||
        testCategoryIds.has(String(c.slug || '').toLowerCase()) ||
        testCategoryIds.has(String(c.name || '').toLowerCase())
      );

      const matchedCatIds = new Set(matchedCats.map(c => String(c._id || c.id)));
      // For each matched category, find the path and increment counts
      // To avoid double-counting parents, only increment for leaf categories in the match set
      const matchedCatList = Array.from(matchedCatIds);
      const leafMatchIds = matchedCatList.filter(id => {
        // A category is a leaf if no other matched category is its child/descendant
        return !matchedCatList.some(otherId => {
          if (id === otherId) return false;
          const otherPath = getPath(otherId);
          return otherPath.includes(id);
        });
      });

      leafMatchIds.forEach(catId => {
        const path = getPath(catId);
        incrementCount(tree, path, isFree, isLive);
      });
    });

    // Convert back to requested Map-like structure for the UI
    tree.forEach(root => {
      categoryMap[root.key] = root;
    });

    return categoryMap;
  }, [stageFilteredTests, allTestCategories]);

  // Handle category changes with reset for deeper levels
  const handleMainCategoryChange = (key) => {
    setActiveMainCategory(key);
    setActiveSubCategory('all');
    setActiveThirdCategory('all');
    setActiveFourthCategory('all');
    setAnimateKey(prev => prev + 1);
  };

  const handleSubCategoryChange = (key) => {
    setActiveSubCategory(key);
    setActiveThirdCategory('all');
    setActiveFourthCategory('all');
    setAnimateKey(prev => prev + 1);
  };

  const handleThirdCategoryChange = (key) => {
    setActiveThirdCategory(key);
    setActiveFourthCategory('all');
    setAnimateKey(prev => prev + 1);
  };

  const handleFourthCategoryChange = (key) => {
    setActiveFourthCategory(key);
    setAnimateKey(prev => prev + 1);
  };

  // Set initial active category when data loads
  useEffect(() => {
    const keys = Object.keys(computedCategories);
    if (keys.length > 0 && !keys.includes(activeMainCategory)) {
      setActiveMainCategory(keys[0]);
    }
  }, [computedCategories]);

  // Use computed categories for navigation
  const categoriesData = computedCategories;

  // Enhanced category synchronization useEffect
  useEffect(() => {
    if (Object.keys(computedCategories).length > 0) {
      // 1. Set initial Main Category if none selected
      if (!activeMainCategory || !computedCategories[activeMainCategory]) {
        const firstKey = Object.keys(computedCategories)[0];
        setActiveMainCategory(firstKey);
        setActiveSubCategory('all');
        setActiveThirdCategory('all');
        setActiveFourthCategory('all');
        return;
      }

      const mainNode = computedCategories[activeMainCategory];

      // 2. Validate SubCategory
      if (activeSubCategory !== 'all') {
        const subNode = mainNode.children?.find(c => c.key === activeSubCategory);
        if (!subNode) {
          setActiveSubCategory('all');
          setActiveThirdCategory('all');
          setActiveFourthCategory('all');
        } else {
          // 3. Validate Third Category
          if (activeThirdCategory !== 'all') {
            const thirdNode = subNode.children?.find(c => c.key === activeThirdCategory);
            if (!thirdNode) {
              setActiveThirdCategory('all');
              setActiveFourthCategory('all');
            } else {
              // 4. Validate Fourth Category
              if (activeFourthCategory !== 'all') {
                const fourthNode = thirdNode.children?.find(c => c.key === activeFourthCategory);
                if (!fourthNode) {
                  setActiveFourthCategory('all');
                }
              }
            }
          }
        }
      }

      // Update category counts for the header chips (sorted by displayOrder)
      const counts = Object.keys(computedCategories)
        .map(key => ({
          name: computedCategories[key].label,
          count: computedCategories[key].count || 0,
          displayOrder: allTestCategories.find(c => c.slug === key || String(c._id || c.id) === key)?.displayOrder || 0
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);
      setCategoryCounts(counts);
    }
  }, [computedCategories, activeMainCategory, activeSubCategory, activeThirdCategory, activeFourthCategory]);

  // Fetch series, tests, and metadata from API
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catsData, examsData, testCatsData] = await Promise.all([
          getExamCategories(),
          getExams(),
          getTestCategories()
        ])
        setCategories(catsData)
        setExams(examsData)
        if (testCatsData) {
          setAllTestCategories(testCatsData)
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err)
      }
    }

    const fetchData = async () => {
      try {
        const seriesData = await getTestSeriesById(seriesId)
        setSeries(seriesData)

        if (seriesData) {
          const sid = seriesData._id || seriesData.id || seriesId
          const testsData = await getTestsBySeriesId(sid)

          // De-duplicate tests by ID to avoid double-counting in UI
          const uniqueTests = [];
          const seenIds = new Set();
          if (Array.isArray(testsData)) {
            testsData.forEach(test => {
              const tid = String(test._id || test.id);
              if (!seenIds.has(tid)) {
                seenIds.add(tid);
                uniqueTests.push(test);
              }
            });
          }

          setTests(uniqueTests)
        }

        // Fetch suggested series (sorted by admin order, respecting pinning)
        const allSeries = await getTestSeries()
        const related = allSeries
          .filter(s => s._id !== seriesId && s.id !== seriesId)
          .filter(s => seriesData?.category && s.category === seriesData.category)
          .sort((a, b) => {
            // Pinned items always first
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            // Sort by admin order
            return (a.order || 0) - (b.order || 0);
          })
          .slice(0, 5)

        if (related.length < 5) {
          const popular = allSeries
            .filter(s => s._id !== seriesId && s.id !== seriesId && !related.find(r => r._id === s._id))
            .sort((a, b) => {
              // Pinned items always first
              if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
              // Sort by admin order first
              const orderDiff = (a.order || 0) - (b.order || 0);
              if (orderDiff !== 0) return orderDiff;
              // If same order, sort by popularity
              return (b.users || 0) - (a.users || 0);
            })
            .slice(0, 5 - related.length)
          related.push(...popular)
        }

        setSuggestedSeries(related)

        // Fetch Rankings for this specific series
        try {
          setRankingsLoading(true)
          const sid = seriesData?._id || seriesData?.id
          const rankingsResp = await getTopPerformers(5, sid)
          const rankingList = rankingsResp.data?.data || rankingsResp.data || rankingsResp || []
          setRankings(Array.isArray(rankingList) ? rankingList : [])
        } catch (rankErr) {
          console.error('Failed to fetch rankings:', rankErr)
          setRankings([])
        } finally {
          setRankingsLoading(false)
        }

        // Fetch User Analytics if logged in
        if (user) {
          try {
            const analytics = await getUserAnalytics()
            if (analytics && analytics.success) {
              setUserStats(analytics.data?.summary || analytics.data)
            }
          } catch (analyticsErr) {
            console.error('Failed to fetch user analytics:', analyticsErr)
          }
        }
      } catch (error) {
        console.error('Failed to fetch series:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetadata()
    fetchData()
  }, [seriesId])

  // Get dynamic labels for category and exam
  const categoryLabel = useMemo(() => {
    if (!series || !categories.length) return series?.category || 'Test Series'
    const cat = categories.find(c =>
      c.category_id === series.category ||
      c.slug === series.category ||
      String(c.id) === String(series.category)
    )
    return cat?.label || series.category
  }, [series, categories])

  const examLabel = useMemo(() => {
    if (!series?.subcategory) return ''
    if (exams.length) {
      const exam = exams.find(e =>
        e.exam_id === series.subcategory ||
        e.slug === series.subcategory ||
        String(e.id) === String(series.subcategory)
      )
      if (exam?.title) return exam.title
    }
    // Format slug to title: "ssc-cgl" → "SSC CGL"
    return series.subcategory.replace(/-/g, ' ').toUpperCase()
  }, [series, exams])



  // Updated recursive filtering logic for 4 layers (using stage-filtered tests as base)
  const filteredTests = useMemo(() => {
    // Start with stage-filtered tests (stage filtering already applied)
    let result = [...stageFilteredTests];

    // Multi-level Category Filter
    if (activeMainCategory && computedCategories[activeMainCategory]) {
      // Find the bottom-most active node
      let currentNode = computedCategories[activeMainCategory];
      const path = [activeSubCategory, activeThirdCategory, activeFourthCategory];

      for (const key of path) {
        if (!key || key === 'all') break;
        const next = currentNode.children?.find(c => c.key === key);
        if (next) currentNode = next;
        else break;
      }

      // Get all valid category IDs/Slugs under this node
      const getAllIdsRecursive = (node) => {
        // Collect ID, Key, and Label (as fallback)
        const ids = [node.id, node.key, node.label.toLowerCase()];
        if (node.children) {
          node.children.forEach(child => {
            if (child.key !== 'all') {
              ids.push(...getAllIdsRecursive(child));
            }
          });
        }
        return ids;
      };

      const allowedIds = getAllIdsRecursive(currentNode);

      result = result.filter(test => {
        // Check all possible category fields on the test
        const testCat = String(test.category || '').toLowerCase();
        const testSubCat = String(test.subCategory || '').toLowerCase();
        const testCategoryId = String(test.testCategoryId || test.test_category_id || '');
        const testExamId = String(test.examId || test.exam_id || '');

        // Match against any allowed ID/Key/Label
        const matches = allowedIds.includes(testCat) ||
          allowedIds.includes(testSubCat) ||
          allowedIds.includes(testCategoryId) ||
          allowedIds.includes(testExamId);

        // Also check if any of the test's category path IDs match our current selected branch
        const pathMatches = test.categoryPathIds && Array.isArray(test.categoryPathIds) &&
          test.categoryPathIds.some(pid => allowedIds.includes(String(pid).toLowerCase()));

        // Also check against slug/public_id formats
        const testCatSlug = String(test.categorySlug || test.category_slug || '').toLowerCase();
        const testSubCatSlug = String(test.subCategorySlug || test.sub_category_slug || '').toLowerCase();
        const slugMatches = allowedIds.includes(testCatSlug) ||
          allowedIds.includes(testSubCatSlug);

        // Also check if test's categoryId matches the category node key/id
        const categoryIdMatch = testCategoryId && allowedIds.includes(testCategoryId);

        // Check categoryPathNames as well
        const pathNamesMatch = test.categoryPathNames && Array.isArray(test.categoryPathNames) &&
          test.categoryPathNames.some(name => allowedIds.includes(String(name).toLowerCase()));

        return matches || pathMatches || slugMatches || categoryIdMatch || pathNamesMatch;
      });
    }

    return result;
  }, [stageFilteredTests, activeMainCategory, activeSubCategory, activeThirdCategory, activeFourthCategory, computedCategories]);

  const isEnrolled = isSeriesEnrolled(user, series, [seriesId])
  const hasProPass = user?.hasProPass || false
  const isAdmin = user?.role === 'admin'

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading test series...</p>
        </div>
      </div>
    )
  }

  // Show 404 Not Found if series doesn't exist
  if (!series) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Series Not Found</h1>
          <p className="text-gray-600 mb-2">The test series you're looking for doesn't exist in our system.</p>
          <p className="text-gray-500 mb-6">Please check the URL or browse our available test series.</p>
          <Link to="/test-series" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
            Browse All Series
          </Link>
        </div>
      </div>
    )
  }

  // Show Coming Soon banner if series exists but has no tests yet
  const showComingSoonBanner = series && (series.isComingSoon || tests.length === 0)


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto px-0 sm:px-4 lg:px-8 pb-6">
        <Breadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: examLabel, to: `/exams/category/${series.category}/exam/${series.subcategory}` },
            { label: series.title },
          ]}
        />

        {/* Coming Soon Banner */}
        {showComingSoonBanner && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">
                  Coming Soon - Tests Under Preparation
                </h3>
                <p className="text-sm text-amber-700">
                  This test series is being prepared and tests will be available shortly.
                  We're creating comprehensive mock tests, previous year papers, and practice tests for this series.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="px-3 py-1.5 bg-white/50 hover:bg-white text-amber-800 text-xs font-semibold rounded-lg transition-all border border-amber-200"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    alert('You will be notified when tests are available!')
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
        <div className="bg-white rounded-none md:rounded-2xl shadow-card border border-gray-100 p-4 md:p-8 mb-4 md:mb-6 mt-2 md:mt-0 -mx-0 sm:-mx-0 lg:-mx-0 xl:-mx-0">
          <div className="flex flex-col md:flex-row md:items-stretch md:justify-between gap-2 md:gap-6 relative">
            {/* Left - Info */}
            <div className="flex-1">
              {/* First Row: Name & Options */}
              <div className="flex justify-between items-start gap-4 mb-3">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {series.title}
                </h1>

                {/* Triple Dot / Manage Options (Mobile Only) */}
                {(isEnrolled || isAdmin) && (
                  <div className="relative flex-shrink-0 md:hidden">
                    <button
                      onClick={() => setShowDropdownMenu(!showDropdownMenu)}
                      className="p-1.5 md:p-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {showDropdownMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowDropdownMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-2 flex flex-col transform origin-top-right">
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                setShowDropdownMenu(false);
                                handleManageClick(e);
                              }}
                              className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 w-full text-left transition-colors"
                            >
                              <ArrowRight className="w-4 h-4" />
                              Manage Series
                            </button>
                          )}
                          {(!isAdmin && isEnrolled) && (
                            <button
                              onClick={() => {
                                handleUnenroll();
                                setShowDropdownMenu(false);
                              }}
                              className={`px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 w-full text-left transition-colors ${isAdmin ? 'border-t border-gray-100' : ''}`}
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
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium text-gray-700">{series.totalTests || 0}</span> Tests
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{series.users || '0'} Users</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="font-medium text-gray-700">{series.rating || 4.5}</span>
                </div>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                  {series.freeTests || 0} Free Tests
                </span>
              </div>

              {/* Description */}
              {series.description && (
                <p className="text-gray-600 text-sm mb-4">{series.description}</p>
              )}

              {/* Stages & Types - Compact Section */}
              <div className="flex justify-between items-start gap-2 mb-4">
                {/* Left Side: Covers and Types */}
                <div className="flex flex-col gap-3">
                  {/* Row 1: Covers */}
                  {seriesStages.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span className="text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">Covers:</span>
                      {seriesStages.map(stage => (
                        <span
                          key={stage._id || stage.id}
                          className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-indigo-50 text-indigo-700 text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap"
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
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{cat.name}</span>
                          <span className="bg-slate-200 text-slate-700 px-1 rounded-md font-black text-[11px]">{cat.count}</span>
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
                      className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-start focus:border-transparent cursor-pointer shadow-sm"
                    >
                      {stageOptions.map(option => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Stage Menu & CTA */}
            <div className={`${isEnrolled ? 'hidden md:flex' : 'flex'} flex-col justify-center relative md:w-auto md:items-end md:min-w-[180px]`}>
              {/* Desktop Triple Dot / Manage Options */}
              {(isEnrolled || isAdmin) && (
                <div className="hidden md:block absolute -top-2 right-0">
                  <button
                    onClick={() => setShowDropdownMenu(!showDropdownMenu)}
                    className="p-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {showDropdownMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdownMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-2 flex flex-col transform origin-top-right">
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              setShowDropdownMenu(false);
                              handleManageClick(e);
                            }}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 w-full text-left transition-colors"
                          >
                            <ArrowRight className="w-4 h-4" />
                            Manage Series
                          </button>
                        )}
                        {(!isAdmin && isEnrolled) && (
                          <button
                            onClick={() => {
                              handleUnenroll();
                              setShowDropdownMenu(false);
                            }}
                            className={`px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 w-full text-left transition-colors ${isAdmin ? 'border-t border-gray-100' : ''}`}
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 md:text-left">
                  Stage
                </label>
                <div className="relative inline-block min-w-[160px]">
                  <select
                    value={activeStage}
                    onChange={(e) => setActiveStage(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-start focus:border-transparent cursor-pointer transition-all hover:border-brand-start shadow-sm"
                  >
                    {stageOptions.map(option => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* CTA Button */}
              {!isEnrolled && (
                <div className="flex justify-end">
                  {showComingSoonBanner ? (
                    <button
                      disabled
                      className="px-3 md:px-4 py-2 bg-gray-400 text-white font-semibold md:font-bold rounded-lg cursor-not-allowed flex items-center gap-1.5 md:gap-2 text-xs md:text-sm h-[34px] md:h-auto"
                    >
                      Coming Soon
                    </button>
                  ) : (
                    <button
                      onClick={handleEnroll}
                      disabled={isEnrolling}
                      className="px-3 md:px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold md:font-bold rounded-lg hover:shadow-lg transition-all flex items-center gap-1.5 md:gap-2 text-xs md:text-sm h-[34px] md:h-auto disabled:opacity-50"
                    >
                      {isEnrolling ? 'Adding...' : (
                        <>
                          Add
                          <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Desktop: Show progress card if enrolled (only on desktop) */}
              {isEnrolled && !isAdmin && (
                <div className="hidden md:block mt-4 w-full">
                  <div className="bg-gray-50 rounded-xl p-3 md:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-600">Your Progress</span>
                      <span className="text-sm font-bold text-brand-start">{progressPercentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-start to-brand-end rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Desktop: Show Get Pro Pass button */}
              {!isEnrolled && !isAdmin && !hasProPass && (
                <div className="hidden md:block mt-3">
                  <Link
                    to="/pass"
                    className="w-full py-2 md:py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold md:font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Crown className="w-4 h-4" />
                    Get Pro Pass
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Layout: Tests + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tests List */}
          <div className="flex-1 min-w-0">
            {/* Combined Tabs and Tests Section with Background */}
            <div className="bg-white rounded-none md:rounded-xl border border-gray-100 p-2 md:p-4">
              {/* Main Category Tabs - Compact Segmented Control */}
              <div className="flex mb-4">
                <div
                  className="inline-flex bg-gray-100 p-1 rounded-xl overflow-x-auto scrollbar-hide"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {Object.keys(computedCategories)
                    .sort((a, b) => {
                      const catA = allTestCategories.find(c => c.slug === a || String(c._id || c.id) === a);
                      const catB = allTestCategories.find(c => c.slug === b || String(c._id || c.id) === b);
                      return (catA?.displayOrder || 0) - (catB?.displayOrder || 0);
                    })
                    .map((catKey) => (
                      <button
                        key={catKey}
                        onClick={() => handleMainCategoryChange(catKey)}
                        className={`px-4 md:px-6 py-1.5 rounded-lg transition-all flex-shrink-0 flex items-center justify-center gap-3 ${activeMainCategory === catKey
                          ? 'bg-white text-brand-start shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                          }`}
                      >
                        <span className="text-[13px] md:text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                          {computedCategories[catKey].label}
                        </span>
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-md ${activeMainCategory === catKey
                          ? 'bg-brand-start/10 text-brand-start'
                          : 'bg-gray-200/50 text-gray-500'
                          }`}>
                          {computedCategories[catKey].count || 0}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              <div className="border-t border-gray-200 my-1"></div>

              {/* Layer 2 - Sub-Category Tabs */}
              {computedCategories[activeMainCategory]?.children?.length > 0 && (
                <>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1 border-t border-gray-200 mt-1">
                    {computedCategories[activeMainCategory].children.map((subcat) => (
                      <button
                        key={subcat.key}
                        onClick={() => handleSubCategoryChange(subcat.key)}
                        className={`px-2.5 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeSubCategory === subcat.key
                          ? 'bg-brand-start text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {subcat.label}
                        {subcat.count > 0 && <span className="ml-0.5 text-[12px]">({subcat.count})</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Layer 3 - Third Category Tabs */}
              {computedCategories[activeMainCategory]?.children?.find(s => s.key === activeSubCategory)?.children?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 border-t border-gray-100">
                  {computedCategories[activeMainCategory].children.find(s => s.key === activeSubCategory).children.map((third) => (
                    <button
                      key={third.key}
                      onClick={() => handleThirdCategoryChange(third.key)}
                      className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeThirdCategory === third.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                      {third.label}
                      {third.count > 0 && <span className="ml-1">({third.count})</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Layer 4 - Fourth Category Tabs */}
              {computedCategories[activeMainCategory]?.children?.find(s => s.key === activeSubCategory)?.children?.find(t => t.key === activeThirdCategory)?.children?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 border-t border-gray-50">
                  {computedCategories[activeMainCategory].children.find(s => s.key === activeSubCategory).children.find(t => t.key === activeThirdCategory).children.map((fourth) => (
                    <button
                      key={fourth.key}
                      onClick={() => handleFourthCategoryChange(fourth.key)}
                      className={`px-2 py-0.5 rounded-lg text-[13px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${activeFourthCategory === fourth.key
                        ? 'bg-gray-800 text-white shadow-sm'
                        : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300'
                        }`}
                    >
                      {fourth.label}
                      {fourth.count > 0 && <span className="ml-1 opacity-60">{fourth.count}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-200"></div>

              {/* Tests - Single Column Layout with Animation */}
              <div className="mt-4">
                {filteredTests.length > 0 ? (
                  <div key={animateKey} className="space-y-3 animate-fadeIn">
                    {filteredTests.map((test, index) => (
                      <div
                        key={test._id}
                        className="animate-slideUp"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <TestCard test={test} seriesId={series.slug || series._id || seriesId} user={user} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-gray-500 mb-2">No tests found in this category</p>
                    <p className="text-sm text-gray-400">Try selecting a different category or stage</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Hidden on Mobile */}
          <div className="hidden lg:block w-80 flex-shrink-0 space-y-6">
            {/* User Ranking Section */}
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5" />
                  <h3 className="font-bold">Top Performers</h3>
                </div>
                <p className="text-amber-100 text-xs mt-1">Based on tests attempted</p>
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
                        <p className="font-semibold text-gray-800 dark:text-white text-sm">Your Status</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {userStats?.testCount || 0} tests attempted
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">
                          {userStats?.rank ? `#${userStats.rank}` : 'Unranked'}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">overall</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rankings List */}
                <div className="space-y-2">
                  {rankingsLoading ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-2">
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
                        className={`flex items-center gap-3 p-2 rounded-lg transition ${index === 0 ? 'bg-amber-50 dark:bg-amber-900/10' :
                          index === 1 ? 'bg-gray-50 dark:bg-gray-700/30' :
                            index === 2 ? 'bg-orange-50 dark:bg-orange-900/10' :
                              'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                        {/* Rank Number */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${index === 0
                          ? 'bg-amber-400 text-white'
                          : index === 1
                            ? 'bg-gray-300 text-gray-700'
                            : index === 2
                              ? 'bg-orange-400 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                          {index + 1}
                        </div>

                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-medium text-sm">
                          {rank.avatar || rank.name?.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 dark:text-white text-sm truncate">{rank.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{rank.testsAttempted || 0} tests</p>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <p className="font-bold text-gray-800 dark:text-white text-sm">{rank.avgScore || 0}%</p>
                          <p className="text-xs text-gray-400">avg</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-3xl mb-2 grayscale opacity-50">🏆</div>
                      <p className="text-xs text-gray-500">No performances in this series yet</p>
                    </div>
                  )}
                </div>

                {/* View Full Leaderboard */}
                <Link
                  to="/leaderboard"
                  className="mt-4 w-full py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 transition text-sm"
                >
                  View Full Leaderboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Suggested Test Series */}
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-gray-900">Suggested Series</h3>
                </div>
                <p className="text-gray-500 text-xs mt-1">Based on your preparation</p>
              </div>

              <div className="p-4 space-y-3">
                {suggestedSeries.length > 0 ? (
                  suggestedSeries.map((suggested) => (
                    <Link
                      key={suggested._id || suggested.id}
                      to={`/test-series/${suggested.slug || suggested._id || suggested.id}`}
                      className="block p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{suggested.icon || '📝'}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-800 text-sm line-clamp-2 group-hover:text-brand-start transition">
                            {suggested.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{suggested.totalTests || 0} Tests</span>
                            <span>•</span>
                            <span>{suggested.users || '1K+'} users</span>
                          </div>
                          {suggested.rating && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-xs font-medium text-gray-600">{suggested.rating}</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-brand-start transition flex-shrink-0" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500 text-sm">
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
                  <span className="font-bold">{series.totalTests || tests.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Free Tests</span>
                  <span className="font-bold text-green-300">{series.freeTests || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Total Questions</span>
                  <span className="font-bold">{tests.reduce((acc, t) => acc + (t.totalQuestions || t.questions || 0), 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Total Marks</span>
                  <span className="font-bold">{tests.reduce((acc, t) => acc + (t.totalMarks || t.marks || 100), 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestDetails
