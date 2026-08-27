import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import { useTheme } from "../../shared/context/ThemeContext";
import {
  getUserAnalytics,
  userAPI,
  getExams,
} from "../../shared/lib/dataService";
import { invalidateDashboardCache } from "../../shared/lib/enrollment";
import useProPass from "../../shared/hooks/useProPass";
import ImageCropperModal from "../../shared/components/common/ImageCropperModal";
import { toast } from "react-hot-toast";
import { X, Check, Trash2, Camera } from "lucide-react";
import ProfileHeader from "./profile/ProfileHeader";
import ProfileTabs from "./profile/ProfileTabs";
import ProfilePersonalTab from "./profile/ProfilePersonalTab";
import ProfileExamsTab from "./profile/ProfileExamsTab";
import ProfileFeaturesTab from "./profile/ProfileFeaturesTab";
import ProfileProTab from "./profile/ProfileProTab";
import useProfileForm from "./profile/useProfileForm";

const SettingsContentLazy = lazy(() => import("./SettingsContent"));

function Profile({ initialTab = "personal" }) {
  const {
    user,
    loading: authLoading,
    authResolved,
    refreshUser,
    logout,
  } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const proPass = useProPass();
  const fileInputRef = useRef(null);
  const bannerFileInputRef = useRef(null);

  const getInitialActiveTab = () => {
    const urlTab = searchParams.get("tab");
    if (urlTab) {
      if (["personal", "exams", "features", "pro", "settings"].includes(urlTab))
        return urlTab;
      if (
        ["security", "notifications", "privacy", "appearance"].includes(urlTab)
      )
        return "settings";
    }
    const saved = localStorage.getItem("trstprep_profileTab");
    if (
      saved &&
      ["personal", "exams", "features", "pro", "settings"].includes(saved)
    )
      return saved;
    return initialTab;
  };

  const getInitialSettingsTab = () => {
    const urlTab = searchParams.get("tab");
    const urlSubTab = searchParams.get("subtab") || searchParams.get("section");
    if (
      urlSubTab &&
      ["security", "notifications", "privacy", "appearance"].includes(urlSubTab)
    )
      return urlSubTab;
    if (
      urlTab &&
      ["security", "notifications", "privacy", "appearance"].includes(urlTab)
    )
      return urlTab;
    return "security";
  };

  const [activeTab, setActiveTab] = useState(getInitialActiveTab);
  const [settingsTab, setSettingsTab] = useState(getInitialSettingsTab);

  const handleTabChange = (tabId, subTabId = null) => {
    setActiveTab(tabId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tabId);
    if (tabId === "settings") {
      const activeSub = subTabId || settingsTab || "security";
      newParams.set("subtab", activeSub);
      setSettingsTab(activeSub);
    } else {
      newParams.delete("subtab");
      newParams.delete("section");
    }
    setSearchParams(newParams, { replace: true });
    localStorage.setItem("trstprep_profileTab", tabId);
  };

  const handleSettingsTabChange = (subTabId) => {
    setSettingsTab(subTabId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", "settings");
    newParams.set("subtab", subTabId);
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    const urlSubTab = searchParams.get("subtab") || searchParams.get("section");
    if (urlTab) {
      if (
        ["personal", "exams", "features", "pro", "settings"].includes(urlTab)
      ) {
        setActiveTab(urlTab);
        if (
          urlTab === "settings" &&
          urlSubTab &&
          ["security", "notifications", "privacy", "appearance"].includes(
            urlSubTab,
          )
        ) {
          setSettingsTab(urlSubTab);
        }
      } else if (
        ["security", "notifications", "privacy", "appearance"].includes(urlTab)
      ) {
        setActiveTab("settings");
        setSettingsTab(urlTab);
      }
    }
  }, [searchParams]);

  const [personalInfo, setPersonalInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    location: "",
    education: "",
    bio: "",
  });

  const {
    editForm,
    editErrors,
    editSuccess,
    saving: formSaving,
    isEditing,
    setIsEditing,
    handleEditChange,
    handleSaveProfile,
    syncFromUser,
  } = useProfileForm({ user, refreshUser, setPersonalInfo });

  const [_saving, setSaving] = useState(false);
  const [enrolledExams, setEnrolledExams] = useState([]);
  const [enrolledTestSeries, setEnrolledTestSeries] = useState([]);
  const [userStats, setUserStats] = useState({
    testsAttempted: 0,
    avgAccuracy: 0,
    rank: 0,
    timeSpent: 0,
    streak: 0,
    improvement: "",
  });
  const [cropperState, setCropperState] = useState({
    isOpen: false,
    src: null,
    type: null,
  });
  const [showPhotoOptionsModal, setShowPhotoOptionsModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [unenrollingId, setUnenrollingId] = useState(null);
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(null);
  const [expandedExam, setExpandedExam] = useState(null);
  const [attemptRows, setAttemptRows] = useState([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationTab, setLocationTab] = useState("state");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPincode, setSelectedPincode] = useState("");

  const statesAndCities = {
    Maharashtra: [
      { city: "Mumbai", pincode: "400001" },
      { city: "Pune", pincode: "411001" },
      { city: "Nagpur", pincode: "440001" },
    ],
    Delhi: [
      { city: "New Delhi", pincode: "110001" },
      { city: "South Delhi", pincode: "110017" },
      { city: "North Delhi", pincode: "110007" },
    ],
    Karnataka: [
      { city: "Bangalore", pincode: "560001" },
      { city: "Mysore", pincode: "570001" },
      { city: "Mangalore", pincode: "575001" },
    ],
    "Tamil Nadu": [
      { city: "Chennai", pincode: "600001" },
      { city: "Madurai", pincode: "625001" },
      { city: "Coimbatore", pincode: "641001" },
    ],
    Gujarat: [
      { city: "Ahmedabad", pincode: "380001" },
      { city: "Surat", pincode: "395001" },
      { city: "Vadodara", pincode: "390001" },
    ],
    Rajasthan: [
      { city: "Jaipur", pincode: "302001" },
      { city: "Jodhpur", pincode: "342001" },
      { city: "Udaipur", pincode: "313001" },
    ],
    "Uttar Pradesh": [
      { city: "Lucknow", pincode: "226001" },
      { city: "Kanpur", pincode: "208001" },
      { city: "Varanasi", pincode: "221001" },
    ],
    "West Bengal": [
      { city: "Kolkata", pincode: "700001" },
      { city: "Durgapur", pincode: "713201" },
      { city: "Siliguri", pincode: "734001" },
    ],
  };

  const getSeriesAttemptCount = (series, rows = attemptRows) => {
    if (!user || !series) return 0;
    const attemptCountFromRows = [
      series.dbId,
      series._id,
      series.id,
      String(series.dbId),
      String(series._id),
      String(series.id),
      series.slug,
      series.public_id,
    ]
      .filter(Boolean)
      .reduce((max, key) => {
        const count = rows
          .filter((attempt) =>
            [attempt.seriesId, attempt.seriesSlug]
              .filter(Boolean)
              .map(String)
              .includes(String(key)),
          )
          .reduce((tests, attempt) => {
            tests.add(
              String(attempt.testId || attempt.testSlug || attempt.id || ""),
            );
            return tests;
          }, new Set()).size;
        return Math.max(max, count);
      }, 0);
    const attemptCountFromUser =
      user.attemptedTests?.[series.dbId] ??
      user.attemptedTests?.[series._id] ??
      user.attemptedTests?.[series.id] ??
      user.attemptedTests?.[String(series.dbId)] ??
      user.attemptedTests?.[String(series._id)] ??
      user.attemptedTests?.[String(series.id)] ??
      user.attemptedTests?.[series.slug] ??
      user.attemptedTests?.[series.public_id] ??
      0;
    return Math.max(attemptCountFromRows, attemptCountFromUser);
  };

  const calculateProfileCompletion = () => {
    if (!user) return 0;
    const fields = [
      personalInfo.fullName,
      personalInfo.email,
      personalInfo.phone,
      personalInfo.dateOfBirth,
      personalInfo.location,
      personalInfo.education,
      user.avatar,
      user.banner,
      editForm.bio,
    ];
    const filled = fields.filter(
      (field) => field && String(field).trim() !== "",
    ).length;
    return Math.round((filled / fields.length) * 100);
  };

  useEffect(() => {
    if (authLoading || !authResolved) return;
    if (!user) {
      navigate("/login", { state: { from: "/profile" } });
      return;
    }
    const initialSource = user;
    setPersonalInfo({
      fullName: initialSource.name || "",
      email: initialSource.email || "",
      phone: initialSource.phone || initialSource.mobile || "",
      dateOfBirth:
        initialSource.dateOfBirth || initialSource.date_of_birth || "",
      location: initialSource.location || "",
      education: initialSource.education || "",
      bio: initialSource.bio || "",
    });
    syncFromUser(initialSource);

    const controller = new AbortController();
    const fetchUserData = async () => {
      try {
        const [
          profileResponse,
          analyticsResponse,
          examsResponse,
          enrolledSeriesResponse,
          attemptsResponse,
        ] = await Promise.all([
          userAPI.getProfile().catch(() => ({ data: { data: null } })),
          getUserAnalytics().catch(() => ({})),
          getExams().catch(() => []),
          userAPI.getEnrolledSeries().catch(() => ({ data: { data: [] } })),
          userAPI.getAttempts().catch(() => ({ data: { data: [] } })),
        ]);
        const freshProfile = profileResponse?.data?.data;
        if (freshProfile) {
          setPersonalInfo({
            fullName: freshProfile.name || "",
            email: freshProfile.email || "",
            phone: freshProfile.phone || freshProfile.mobile || "",
            dateOfBirth:
              freshProfile.dateOfBirth || freshProfile.date_of_birth || "",
            location: freshProfile.location || "",
            education: freshProfile.education || "",
            bio: freshProfile.bio || "",
          });
          syncFromUser(freshProfile);
        }
        const data = analyticsResponse || {};
        const attemptRowsData = attemptsResponse?.data?.data || [];
        setAttemptRows(attemptRowsData);
        setUserStats({
          testsAttempted: data.totalTests || user?.testsTaken || 0,
          avgAccuracy: data.avgAccuracy || user?.accuracy || 0,
          rank: data.rank || user?.bestRank || 0,
          timeSpent: data.totalHours || user?.hoursSpent || 0,
          streak: data.streak || user?.streak || 0,
          improvement: data.improvement || user?.improvement || "",
        });
        const enrolledSeries = enrolledSeriesResponse?.data?.data || [];
        const allExams = examsResponse || [];
        const enrichedSeries = enrolledSeries.map((series) => {
          const attemptedCount = getSeriesAttemptCount(series, attemptRowsData);
          const baseTotal = Number(
            series.totalTests ||
              series.total_tests ||
              series.testsCount ||
              (Array.isArray(series.tests) ? series.tests.length : 0) ||
              0,
          );
          const totalTests = Math.max(baseTotal, attemptedCount);
          return {
            ...series,
            done: attemptedCount,
            tests: totalTests,
            totalTests,
            completed: totalTests > 0 && attemptedCount >= totalTests,
          };
        });
        setEnrolledTestSeries(enrichedSeries);
        const enrolledExamsMap = new Map();

        // 1. Direct user enrolled exams from user profile / target exam
        const userEnrolled =
          user?.enrolledExams ||
          user?.enrolled_exams ||
          user?.targetExam ||
          user?.target_exam ||
          [];
        const userEnrolledList = Array.isArray(userEnrolled)
          ? userEnrolled
          : [userEnrolled].filter(Boolean);
        const userEnrolledIds = new Set(
          userEnrolledList
            .map((e) =>
              typeof e === "object" && e !== null
                ? e.id || e._id || e.exam_id || e.examId || e.slug
                : e,
            )
            .filter(Boolean)
            .map(String),
        );

        if (
          userEnrolledIds.size > 0 &&
          Array.isArray(allExams) &&
          allExams.length > 0
        ) {
          allExams.forEach((exam, index) => {
            const examKeys = [
              exam.id,
              exam._id,
              exam.exam_id,
              exam.examId,
              exam.slug,
            ]
              .filter(Boolean)
              .map(String);
            if (examKeys.some((k) => userEnrolledIds.has(k))) {
              const examKey = String(
                exam.id || exam._id || exam.exam_id || index,
              );
              const matchingSeries = enrichedSeries.filter((s) => {
                const sRef = String(
                  s.examId ||
                    s.exam_id ||
                    s.sub_category_id ||
                    s.category ||
                    s.exam ||
                    "",
                ).toLowerCase();
                return (
                  examKeys.some((k) => k.toLowerCase() === sRef) ||
                  (exam.title || exam.name || "").toLowerCase() ===
                    (s.category || s.exam || "").toLowerCase()
                );
              });
              const testsDone = matchingSeries.reduce(
                (a, s) => a + (s.done || 0),
                0,
              );
              const totalTests = matchingSeries.reduce(
                (a, s) => a + (s.totalTests || 0),
                0,
              );

              enrolledExamsMap.set(examKey, {
                ...exam,
                id: examKey,
                title: exam.title || exam.name,
                icon:
                  exam.icon || ["🎯", "🚂", "🏦", "🏛️", "🎓", "⚔️"][index % 6],
                series: matchingSeries,
                testsDone,
                totalTests,
              });
            }
          });
        }

        // 2. Derive exams from enrolled test series
        enrichedSeries.forEach((series, index) => {
          const examIdRef =
            series.examId || series.exam_id || series.sub_category_id;
          const category =
            series.category ||
            series.category_name ||
            series.exam ||
            series.exam_name;
          let matchedExam = null;

          if (Array.isArray(allExams) && allExams.length > 0) {
            if (examIdRef) {
              matchedExam = allExams.find(
                (exam) =>
                  String(exam.exam_id || exam.examId || exam.id || exam._id) ===
                    String(examIdRef) ||
                  String(exam.slug || "").toLowerCase() ===
                    String(examIdRef).toLowerCase(),
              );
            }
            if (!matchedExam && category) {
              matchedExam = allExams.find(
                (exam) =>
                  (exam.title || exam.name || "").toLowerCase() ===
                    category.toLowerCase() ||
                  String(exam.slug || "").toLowerCase() ===
                    category.toLowerCase(),
              );
            }
          }

          if (matchedExam) {
            const examKey = String(
              matchedExam.id ||
                matchedExam._id ||
                matchedExam.exam_id ||
                `exam-${index}`,
            );
            const existing = enrolledExamsMap.get(examKey);
            if (existing) {
              if (
                !existing.series.some(
                  (s) => (s.id || s._id) === (series.id || series._id),
                )
              ) {
                existing.series.push(series);
                existing.testsDone =
                  (existing.testsDone || 0) + (series.done || 0);
                existing.totalTests =
                  (existing.totalTests || 0) + (series.totalTests || 0);
              }
            } else {
              enrolledExamsMap.set(examKey, {
                ...matchedExam,
                id: examKey,
                title: matchedExam.title || matchedExam.name,
                icon:
                  matchedExam.icon ||
                  ["🎯", "🚂", "🏦", "🏛️", "🎓", "⚔️"][index % 6],
                enrolledSeriesId: series.id || series._id,
                enrolledSeriesTitle: series.title,
                testsDone: series.done || 0,
                totalTests: series.totalTests || 0,
                series: [series],
              });
            }
          } else if (category) {
            const catKey = `cat-${category.toLowerCase().replace(/\s+/g, "-")}`;
            const existing = enrolledExamsMap.get(catKey);
            if (existing) {
              if (
                !existing.series.some(
                  (s) => (s.id || s._id) === (series.id || series._id),
                )
              ) {
                existing.series.push(series);
                existing.testsDone =
                  (existing.testsDone || 0) + (series.done || 0);
                existing.totalTests =
                  (existing.totalTests || 0) + (series.totalTests || 0);
              }
            } else {
              enrolledExamsMap.set(catKey, {
                id: catKey,
                title: category,
                name: category,
                icon:
                  series.icon ||
                  ["🎯", "🚂", "🏦", "🏛️", "🎓", "⚔️"][index % 6],
                enrolledSeriesId: series.id || series._id,
                enrolledSeriesTitle: series.title,
                testsDone: series.done || 0,
                totalTests: series.totalTests || 0,
                series: [series],
              });
            }
          }
        });

        setEnrolledExams(Array.from(enrolledExamsMap.values()));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch user stats:", error);
      }
    };
    fetchUserData();
    return () => controller.abort();
  }, [user, authLoading, authResolved, navigate, syncFromUser]);

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) logout();
  };

  const handlePhotoClick = () => {
    if (user?.avatar) setShowPhotoOptionsModal(true);
    else fileInputRef.current?.click();
  };

  const handleRemovePhoto = async () => {
    try {
      setSaving(true);
      const response = await userAPI.updateProfile({ avatar: "" });
      if (response.data?.success) {
        refreshUser();
        setShowPhotoOptionsModal(false);
      }
    } catch (error) {
      console.error("Failed to remove photo:", error);
      toast.error("Failed to remove photo.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperState({ isOpen: true, src: reader.result, type: "avatar" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowPhotoOptionsModal(false);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover photo must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperState({ isOpen: true, src: reader.result, type: "banner" });
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBase64) => {
    try {
      setSaving(true);
      const field = cropperState.type === "avatar" ? "avatar" : "banner";
      const response = await userAPI.updateProfile({ [field]: croppedBase64 });
      if (response.data?.success) await refreshUser();
    } catch (error) {
      console.error("Failed to update photo:", error);
      toast.error("Failed to update photo.");
    } finally {
      setSaving(false);
      setCropperState({ isOpen: false, src: null, type: null });
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [activeMenuId]);

  const handleUnenrollExam = async (exam) => {
    try {
      setUnenrollingId(exam.id || exam._id);
      await userAPI.unenrollFromSeries(exam.enrolledSeriesId || exam.id);
      setEnrolledExams((prev) =>
        prev.filter((e) => (e.id || e._id) !== (exam.id || exam._id)),
      );
      await refreshUser?.();
      invalidateDashboardCache();
      setShowUnenrollConfirm(null);
      setActiveMenuId(null);
      toast.success("Successfully unenrolled from exam!");
    } catch (error) {
      console.error("Failed to unenroll from exam:", error);
      toast.error("Failed to unenroll. Please try again.");
    } finally {
      setUnenrollingId(null);
    }
  };

  const handleUnenrollSeries = async (series) => {
    try {
      setUnenrollingId(series.id || series._id);
      await userAPI.unenrollFromSeries(series.id || series._id);
      setEnrolledTestSeries((prev) =>
        prev.filter((s) => (s.id || s._id) !== (series.id || series._id)),
      );
      await refreshUser?.();
      invalidateDashboardCache();
      setShowUnenrollConfirm(null);
      setActiveMenuId(null);
      toast.success(
        "Successfully unenrolled! All previous attempt history has been deleted.",
      );
    } catch (error) {
      console.error("Failed to unenroll from series:", error);
      toast.error("Failed to unenroll. Please try again.");
    } finally {
      setUnenrollingId(null);
    }
  };

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Profile | Trstprep</title>
        <meta
          name="description"
          content="Manage your Trstprep profile - update personal information, view stats, and manage settings."
        />
      </Helmet>
      <div className="bg-gray-50 dark:bg-gray-900 pb-4 md:pb-8">
        <ProfileHeader
          user={user}
          personalInfo={personalInfo}
          userStats={userStats}
          fileInputRef={fileInputRef}
          bannerFileInputRef={bannerFileInputRef}
          handlePhotoClick={handlePhotoClick}
          handlePhotoChange={handlePhotoChange}
          handleBannerChange={handleBannerChange}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-6">
        <ProfileTabs
          activeTab={activeTab}
          settingsTab={settingsTab}
          onTabChange={handleTabChange}
          onSettingsTabChange={handleSettingsTabChange}
          onLogout={handleLogout}
        />

        <div className="space-y-6">
          {activeTab === "personal" && (
            <ProfilePersonalTab
              user={user}
              personalInfo={personalInfo}
              calculateProfileCompletion={calculateProfileCompletion}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              editForm={editForm}
              editErrors={editErrors}
              editSuccess={editSuccess}
              saving={formSaving}
              handleEditChange={handleEditChange}
              handleSaveProfile={handleSaveProfile}
              setShowLocationModal={setShowLocationModal}
              setLocationTab={setLocationTab}
              setSelectedState={setSelectedState}
              setSelectedCity={setSelectedCity}
              setSelectedPincode={setSelectedPincode}
              logout={logout}
            />
          )}

          {activeTab === "exams" && (
            <ProfileExamsTab
              enrolledExams={enrolledExams}
              enrolledTestSeries={enrolledTestSeries}
              expandedExam={expandedExam}
              setExpandedExam={setExpandedExam}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
              setShowUnenrollConfirm={setShowUnenrollConfirm}
              unenrollingId={unenrollingId}
            />
          )}

          {activeTab === "features" && (
            <ProfileFeaturesTab userStats={userStats} user={user} />
          )}

          {activeTab === "pro" && (
            <ProfileProTab proPass={proPass} user={user} />
          )}

          {activeTab === "settings" && (
            <div style={{ animation: "fadeIn 0.35s ease both" }}>
              <Suspense
                fallback={
                  <div className="p-8 text-center text-sm text-gray-500">
                    Loading settings…
                  </div>
                }
              >
                <SettingsContentLazy
                  user={user}
                  refreshUser={refreshUser}
                  logout={logout}
                  proPass={proPass}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                  navigate={navigate}
                  settingsTab={settingsTab}
                  setSettingsTab={handleSettingsTabChange}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {showPhotoOptionsModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl">
              <div className="p-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-gray-100 dark:border-gray-700 p-1 flex items-center justify-center overflow-hidden">
                  {user.avatar ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={user.avatar}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        if (e.currentTarget.nextSibling) {
                          e.currentTarget.nextSibling.style.display = "flex";
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className={`${user.avatar ? "hidden" : "flex"} w-full h-full rounded-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xl font-bold`}
                  >
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                </div>
                <h3 className="text-center font-bold text-gray-900 dark:text-white mb-6">
                  Profile Picture
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowPhotoOptionsModal(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                  >
                    <Camera className="w-4 h-4" /> Upload New Photo
                  </button>
                  <button
                    onClick={handleRemovePhoto}
                    className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Remove Photo
                  </button>
                  <button
                    onClick={() => setShowPhotoOptionsModal(false)}
                    className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showUnenrollConfirm &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Unenroll from {showUnenrollConfirm.type}?
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  {showUnenrollConfirm.type === "exam"
                    ? `You will be unenrolled from "${showUnenrollConfirm.item.title || showUnenrollConfirm.item.name}".`
                    : `You will be unenrolled from "${showUnenrollConfirm.item.title}". All your previous attempt history will be deleted.`}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (showUnenrollConfirm.type === "exam")
                      handleUnenrollExam(showUnenrollConfirm.item);
                    else handleUnenrollSeries(showUnenrollConfirm.item);
                  }}
                  disabled={
                    unenrollingId ===
                    (showUnenrollConfirm.item.id ||
                      showUnenrollConfirm.item._id)
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {unenrollingId ===
                  (showUnenrollConfirm.item.id ||
                    showUnenrollConfirm.item._id) ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Unenrolling...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Unenroll
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowUnenrollConfirm(null)}
                  disabled={
                    unenrollingId ===
                    (showUnenrollConfirm.item.id ||
                      showUnenrollConfirm.item._id)
                  }
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showLocationModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
            onClick={() => setShowLocationModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Select Location
                </h3>
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => {
                    setLocationTab("state");
                    setSelectedCity("");
                  }}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${locationTab === "state" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {selectedState || "Select State"}
                </button>
                <button
                  onClick={() => selectedState && setLocationTab("city")}
                  disabled={!selectedState}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${locationTab === "city" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : selectedState ? "text-gray-500 hover:text-gray-700" : "text-gray-300 cursor-not-allowed"}`}
                >
                  {selectedCity || "Select City"}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {locationTab === "state" &&
                  Object.keys(statesAndCities).map((state) => (
                    <button
                      key={state}
                      onClick={() => {
                        setSelectedState(state);
                        setSelectedCity("");
                        setLocationTab("city");
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-all font-medium ${selectedState === state ? "bg-indigo-600 text-white" : "bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"}`}
                    >
                      {state}
                    </button>
                  ))}
                {locationTab === "city" &&
                  selectedState &&
                  statesAndCities[selectedState]?.map(({ city, pincode }) => (
                    <button
                      key={city}
                      onClick={() => {
                        setSelectedCity(city);
                        setSelectedPincode(pincode);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-all ${selectedCity === city ? "bg-indigo-600 text-white" : "bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"}`}
                    >
                      <div className="font-medium">{city}</div>
                      <div
                        className={`text-xs ${selectedCity === city ? "text-indigo-100" : "text-gray-500"}`}
                      >
                        PIN: {pincode}
                      </div>
                    </button>
                  ))}
              </div>
              {selectedState && selectedCity && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Selected Location:
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedCity}, {selectedState} - {selectedPincode}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      handleEditChange(
                        "location",
                        `${selectedCity}, ${selectedState} - ${selectedPincode}`,
                      );
                      setShowLocationModal(false);
                      setSelectedState("");
                      setSelectedCity("");
                      setSelectedPincode("");
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Check className="w-4 h-4" /> Select Location
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      <ImageCropperModal
        isOpen={cropperState.isOpen}
        imageSrc={cropperState.src}
        onClose={() =>
          setCropperState({ isOpen: false, src: null, type: null })
        }
        onCropComplete={handleCropComplete}
        aspect={cropperState.type === "avatar" ? 1 : 3}
        cropShape={cropperState.type === "avatar" ? "round" : "rect"}
        title={
          cropperState.type === "avatar"
            ? "Adjust Profile Photo"
            : "Adjust Cover Photo"
        }
      />
    </>
  );
}

export default Profile;
