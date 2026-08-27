import {
  Routes,
  Route,
  useLocation,
  useParams,
  Navigate,
} from "react-router-dom";
import { Suspense } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

import { lazyWithRetry as lazy } from "./shared/utils/lazyWithRetry";

// Layout Components (kept eager — used on nearly every route)
import Layout from "./shared/components/layout/Layout";
import ScrollToTop from "./shared/components/common/ScrollToTop";
import ErrorBoundary from "./shared/components/common/ErrorBoundary";
import MaintenanceMode from "./shared/components/common/MaintenanceMode";
import PwaUpdatePrompt from "./shared/components/pwa/PwaUpdatePrompt";
import { PageSkeleton } from "./shared/components/common/LoadingSkeleton.jsx";
import { createRoute, wrapElement } from "./app/routes.jsx";

// PERF-03: Route-level code splitting via React.lazy with automatic retries.
// Reduces initial JS bundle by 30-50% — each page is loaded on demand.

const LegacyPypsExamRedirect = () => {
  const { examSlug } = useParams();
  const location = useLocation();
  return <Navigate to={`/pyps/${examSlug}${location.search || ""}`} replace />;
};

// --- Core Entry Pages ---
// Home and Dashboard are lazy-loaded to reduce initial bundle size; they are
// heavy pages (Home ~ catalog queries, Dashboard ~ analytics + series cards)
// that should not block the initial chunk. Login stays eager as it is a tiny
// modal and beneficial for LCP when unauthenticated users land on /.
import Login from "./features/auth/Login";
const Home = lazy(() => import("./pages/public/Home"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));

// --- Public Pages (lazy) ---
const About = lazy(() => import("./pages/public/About"));
const Contact = lazy(() => import("./pages/public/Contact"));
const Terms = lazy(() => import("./pages/public/Terms"));
const Privacy = lazy(() => import("./pages/public/Privacy"));
const Refund = lazy(() => import("./pages/public/Refund"));
const Faq = lazy(() => import("./pages/public/Faq"));
const Pass = lazy(() => import("./pages/public/Pass"));
const SearchPage = lazy(() => import("./pages/public/SearchPage"));
const Blog = lazy(() => import("./pages/public/Blog"));
const BlogDetail = lazy(() => import("./pages/public/BlogDetail"));
const TagPage = lazy(() => import("./pages/public/TagPage"));
const CurrentAffairsDetail = lazy(
  () => import("./pages/public/CurrentAffairsDetail"),
);

// --- Auth Pages (lazy) ---
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const EmailVerification = lazy(() => import("./pages/auth/EmailVerification"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Signup = lazy(() => import("./features/auth/Signup"));

// --- Dashboard Pages (lazy) ---
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const Analysis = lazy(() => import("./pages/dashboard/Analysis"));
const Bookmarks = lazy(() => import("./pages/dashboard/Bookmarks"));
const AttemptedTests = lazy(() => import("./pages/dashboard/AttemptedTests"));
const Notifications = lazy(() => import("./pages/dashboard/Notifications"));
const Achievements = lazy(() => import("./pages/dashboard/Achievements"));
const ReferAndEarn = lazy(() => import("./pages/dashboard/ReferAndEarn"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const AIStudyPlanner = lazy(() => import("./pages/dashboard/AIStudyPlanner"));
const PerformanceInsights = lazy(
  () => import("./pages/dashboard/PerformanceInsights"),
);

// --- Exam Pages (lazy) ---
const Exams = lazy(() => import("./pages/exams/Exams"));
const ExamInfoNew = lazy(() => import("./pages/exams/ExamInfoNew"));
const ExamCategory = lazy(() => import("./pages/exams/ExamCategory"));
const ExamYear = lazy(() => import("./pages/exams/ExamYear"));
const ExamCompare = lazy(() => import("./pages/exams/ExamCompare"));
const ExamUpdates = lazy(() => import("./pages/exams/ExamUpdates"));

// --- Test Pages (lazy) ---
const TestSeries = lazy(() => import("./pages/tests/TestSeries"));
const TestDetails = lazy(() => import("./pages/tests/TestDetails"));
const TestInterface = lazy(() => import("./pages/tests/TestInterface"));
const TestResult = lazy(() => import("./pages/tests/TestResult"));
const TestInstructions = lazy(() => import("./pages/tests/TestInstructions"));
const SeriesLeaderboard = lazy(() => import("./pages/tests/SeriesLeaderboard"));
const LiveTests = lazy(() => import("./pages/tests/LiveTests"));
const PracticeLab = lazy(() => import("./pages/tests/PracticeLab"));
const PreviousYearPapers = lazy(
  () => import("./pages/tests/PreviousYearPapers"),
);
const Leaderboard = lazy(() => import("./pages/tests/Leaderboard"));
const PYPTest = lazy(() => import("./pages/tests/PYPTest"));
const PypsLanding = lazy(() => import("./pages/pyps/PypsLanding"));
const LiveTestInterface = lazy(() => import("./pages/tests/LiveTestInterface"));
const LiveTestResults = lazy(() => import("./pages/tests/LiveTestResults"));
const LiveTestLeaderboard = lazy(
  () => import("./pages/tests/LiveTestLeaderboard"),
);
const LiveTestReview = lazy(() => import("./pages/tests/LiveTestReview"));

// --- Study Pages (lazy) ---
const StudyMaterial = lazy(() => import("./pages/study/StudyMaterial"));
const StudyMaterialDetail = lazy(
  () => import("./pages/study/StudyMaterialDetail"),
);
const StudyMaterialChapter = lazy(
  () => import("./pages/study/StudyMaterialChapter"),
);
const Videos = lazy(() => import("./pages/study/Videos"));
const VideoDetail = lazy(() => import("./pages/study/VideoDetail"));
const CurrentAffairs = lazy(() => import("./pages/study/CurrentAffairs"));
const SpacedRepetition = lazy(() => import("./pages/study/SpacedRepetition"));

// --- Community Pages (lazy) ---
const Community = lazy(() => import("./pages/community/Community"));

// --- Error Pages (lazy) ---
const NotFound = lazy(() => import("./pages/errors/NotFound"));
const ServerError = lazy(() => import("./pages/errors/ServerError"));

function LegacyExamRedirect() {
  const { examId } = useParams();
  return <Navigate to={`/exam/${examId}`} replace />;
}

function ConditionalGoogleProvider({ children }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return <>{children}</>;
  return (
    <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
  );
}

// Route configs — de-duplicated via createRoute helper (see src/app/routes.jsx)
// Each entry is `{ path, element }` where element is already wrapped with
// <RouteErrorBoundary> + optional <ProtectedRoute>/<FeatureGate>.
const standaloneRoutes = [
  createRoute("/verify-email", <EmailVerification />),
  createRoute("/:seriesSlug/tests/:testId/instructions", <TestInstructions />, {
    protected: true,
  }),
  createRoute("/:seriesSlug/tests/:testId/result", <TestResult />, {
    protected: true,
  }),
  createRoute("/:seriesSlug/tests/:testId/review", <TestInterface />, {
    protected: true,
  }),
  createRoute("/:seriesSlug/tests/:testId", <TestInterface />, {
    protected: true,
  }),
  createRoute("/test/:seriesId/:testId/instructions", <TestInstructions />, {
    protected: true,
  }),
  createRoute("/test/:seriesId/:testId", <TestInterface />, {
    protected: true,
  }),
  createRoute("/test-result/:seriesId/:testId", <TestResult />, {
    protected: true,
  }),
  createRoute("/test-review/:seriesId/:testId", <TestInterface />, {
    protected: true,
  }),
];

const layoutRoutes = [
  createRoute("/", <Home />),
  createRoute(
    "/login",
    <>
      <Home />
      <Login />
    </>,
  ),
  createRoute(
    "/signup",
    <>
      <Home />
      <Signup />
    </>,
  ),
  createRoute("/dashboard", <Dashboard />, { protected: true }),
  createRoute("/dashboard/ai-planner", <AIStudyPlanner />, { protected: true }),
  createRoute("/ai-tutor", <AIStudyPlanner />, { protected: true }),
  createRoute("/dashboard/insights", <PerformanceInsights />, {
    protected: true,
    featureKey: "analytics",
  }),
  createRoute("/dashboard/rankings", <Navigate to="/leaderboard" replace />),
  createRoute("/test-series", <TestSeries />),
  createRoute("/tests", <TestSeries />),
  createRoute("/live-tests", <LiveTests />),
  createRoute("/live", <Navigate to="/live-tests" replace />),
  createRoute("/pricing", <Navigate to="/pass" replace />),
  createRoute("/results", <Navigate to="/attempted-tests" replace />),
  createRoute("/test-series/:seriesId", <TestDetails />),
  createRoute("/test-series/:seriesId/my", <TestDetails />),
  createRoute("/:examSlug/test-series/my", <TestDetails />),
  createRoute("/:examSlug/test-series/:seriesId", <TestDetails />),
  createRoute("/test-series/:id/leaderboard", <SeriesLeaderboard />),
  createRoute("/study", <StudyMaterial />),
  createRoute("/study/:subjectId", <StudyMaterialDetail />),
  createRoute("/study/:subjectId/:chapterId", <StudyMaterialChapter />),
  createRoute("/exams", <Exams />),
  createRoute("/exams-old", <Navigate to="/exams" replace />),
  createRoute("/exams/category/:categoryId", <ExamCategory />),
  createRoute("/exams/category/:categoryId/exam/:examId", <ExamInfoNew />),
  createRoute(
    "/exams/category/:categoryId/exam/:examId/year/:year",
    <ExamYear />,
  ),
  createRoute("/exam/:examId", <ExamInfoNew />),
  createRoute("/exam-old/:examId", <LegacyExamRedirect />),
  createRoute("/exam/:examId/updates", <ExamUpdates />),
  createRoute("/exam/:examId/year/:year", <ExamYear />),
  createRoute("/exam/:examId/compare", <ExamCompare />),
  createRoute("/tag/:tag", <TagPage />),
  createRoute("/videos", <Videos />, { pageKey: "videos" }),
  createRoute("/videos/:subjectSlug/:chapterSlug/:videoId", <VideoDetail />),
  createRoute("/videos/:id", <VideoDetail />),
  createRoute("/analysis", <Analysis />, {
    protected: true,
    featureKey: "analytics",
  }),
  createRoute("/attempted-tests", <AttemptedTests />, { protected: true }),
  createRoute("/pass", <Pass />),
  createRoute("/profile", <Profile />, { protected: true }),
  createRoute("/settings", <Settings />, { protected: true }),
  createRoute("/about", <About />),
  createRoute("/contact", <Contact />),
  createRoute("/terms", <Terms />),
  createRoute("/privacy", <Privacy />),
  createRoute("/refund", <Refund />),
  createRoute("/faq", <Faq />),
  createRoute("/search", <SearchPage />),
  createRoute("/forgot-password", <ForgotPassword />),
  createRoute("/reset-password", <ResetPassword />),
  createRoute("/live-test-results/:liveTestId", <LiveTestResults />, {
    protected: true,
  }),
  createRoute("/live-tests/:liveTestId/leaderboard", <LiveTestLeaderboard />, {
    protected: true,
  }),
  createRoute("/live-tests/:liveTestId", <LiveTestInterface />, {
    protected: true,
  }),
  createRoute("/live-tests/:liveTestId/review", <LiveTestReview />, {
    protected: true,
  }),
  createRoute("/spaced-repetition", <SpacedRepetition />, { protected: true }),
  createRoute("/current-affairs", <CurrentAffairs />, {
    pageKey: "currentAffairs",
  }),
  createRoute("/current-affairs/:caId", <CurrentAffairsDetail />),
  createRoute("/previous-year-papers", <PreviousYearPapers />),
  createRoute("/pyps", <PypsLanding />),
  createRoute("/pyps/:examCategory/:examSlug", <LegacyPypsExamRedirect />),
  createRoute("/pyps/:examCategory", <PypsLanding />),
  createRoute("/tag/pyps", <Navigate to="/pyps" replace />),
  createRoute("/tag/pyq", <Navigate to="/pyps" replace />),
  createRoute("/tag/previous-year-papers", <Navigate to="/pyps" replace />),
  createRoute("/pyp/:pypId/test", <PYPTest />, { protected: true }),
  createRoute("/leaderboard", <Leaderboard />),
  createRoute("/refer-and-earn", <ReferAndEarn />, { pageKey: "referAndEarn" }),
  createRoute("/practice", <PracticeLab />, { protected: true }),
  createRoute("/quizzes", <TagPage tagProp="quizzes" />),
  createRoute("/blog", <Blog />),
  createRoute("/blog/:id", <BlogDetail />),
  createRoute("/community", <Community />, { pageKey: "doubtForum" }),
  createRoute("/community/groups/:id", <Community />, {
    pageKey: "studyGroups",
  }),
  createRoute("/notifications", <Notifications />, { protected: true }),
  createRoute("/bookmarks", <Bookmarks />, { protected: true }),
  createRoute("/achievements", <Achievements />, {
    protected: true,
    pageKey: "achievements",
  }),
  createRoute("/error-500", <ServerError />),
];

function App() {
  const location = useLocation();
  const background = ["/login", "/signup"].includes(location.pathname)
    ? location.state?.backgroundLocation
    : null;

  return (
    <ConditionalGoogleProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none font-medium"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
        <MaintenanceMode>
          <ScrollToTop />
          <PwaUpdatePrompt />
          <Suspense fallback={<PageSkeleton />}>
            <Routes location={background || location}>
              {standaloneRoutes.map(({ path, element }) => (
                <Route key={path} path={path} element={element} />
              ))}
              <Route element={<Layout />}>
                {layoutRoutes.map(({ path, element }) => (
                  <Route key={path} path={path} element={element} />
                ))}
              </Route>
              <Route path="*" element={wrapElement(<NotFound />)} />
            </Routes>

            {/* Render auth popup modal over background page when navigating with state */}
            {background && (
              <Routes>
                <Route path="/login" element={wrapElement(<Login />)} />
                <Route path="/signup" element={wrapElement(<Signup />)} />
              </Routes>
            )}
          </Suspense>
        </MaintenanceMode>
      </ErrorBoundary>
    </ConditionalGoogleProvider>
  );
}

export default App;
