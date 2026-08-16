export { default as Layout } from './layout/Layout.jsx';
export { default as Navbar } from './layout/Navbar.jsx';
export { default as Sidebar } from './layout/Sidebar.jsx';
export { default as BottomNav } from './layout/BottomNav.jsx';

export { default as ComingSoon } from './common/ComingSoon.jsx';
export { default as Logo } from './common/Logo.jsx';
export { default as DifficultyBadge } from './common/DifficultyBadge.jsx';
export { default as Breadcrumb } from './common/Breadcrumb.jsx';
export { default as AnimatedHero } from './common/AnimatedHero.jsx';
export { default as ContentReader } from './common/ContentReader.jsx';
export { default as HorizontalScroll } from './common/HorizontalScroll.jsx';
export { default as PDFViewer } from './common/PDFViewer.jsx';
export { default as VideoPlayer } from './common/VideoPlayer.jsx';

export { default as ProtectedRoute } from './auth/ProtectedRoute.jsx';

export { default as TestSeriesCard } from './test/TestSeriesCard.jsx';
export { default as TestCard } from './test/TestCard.jsx';

export { default as AdminLayout } from './admin/AdminLayout.jsx';

export { default as CompactStatsCards } from './common/CompactStatsCards.jsx';
export { default as LoadingSpinner } from './common/LoadingSpinner.jsx';
export { default as ErrorMessage } from './common/ErrorMessage.jsx';
export { default as SuccessMessage } from './common/SuccessMessage.jsx';

export {
  Skeleton,
  CardSkeleton,
  TestSeriesCardSkeleton,
  StatsCardSkeleton,
  ListItemSkeleton,
  TableRowSkeleton,
  ContentPlaceholder,
  LoadingDots,
  FullPageLoading,
  DashboardSkeleton,
  HomepageSkeleton,
  ProgressBarSkeleton,
  AnimatedCounter,
  PageSkeleton
} from './common/LoadingSkeleton.jsx';

// UI Design System Components
export { Card, CardHeader, CardBody, CardFooter } from './ui/Card.jsx';
export { Button } from './ui/Button.jsx';
export { Modal } from './ui/Modal.jsx';
export { Input } from './ui/Input.jsx';
export { Badge } from './ui/Badge.jsx';
export { ProgressRing } from './ui/ProgressRing.jsx';

// Animation Components
export { PageTransition } from './animations/PageTransition.jsx';
export { ScrollReveal } from './animations/ScrollReveal.jsx';

export { default as SEO } from './SEO.jsx';

// Question Features
export { default as QuestionNotes } from './QuestionNotes.jsx';
export { default as QuestionDiscussions } from './QuestionDiscussions.jsx';
export { default as PassageGroup } from './PassageGroup.jsx';
export { groupQuestionsByPassage } from '../utils/passageUtils';
