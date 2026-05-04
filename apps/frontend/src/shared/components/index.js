// Shared Components Index
// This file exports all reusable components for easy importing

// Layout Components
export { default as Layout } from './layout/Layout.jsx';
export { default as Navbar } from './layout/Navbar.jsx';
export { default as Sidebar } from './layout/Sidebar.jsx';
export { default as BottomNav } from './layout/BottomNav.jsx';

// Common Components
export { default as ComingSoon } from './common/ComingSoon.jsx';
export { default as Logo } from './common/Logo.jsx';
export { default as Breadcrumb } from './common/Breadcrumb.jsx';
export { default as AnimatedHero } from './common/AnimatedHero.jsx';
export { default as ContentReader } from './common/ContentReader.jsx';
export { default as HorizontalScroll } from './common/HorizontalScroll.jsx';
export { default as PDFViewer } from './common/PDFViewer.jsx';
export { default as VideoPlayer } from './common/VideoPlayer.jsx';

// Auth Components
export { default as ProtectedRoute } from './auth/ProtectedRoute.jsx';

// Test Components
export { default as TestSeriesCard } from './test/TestSeriesCard.jsx';
export { default as TestCard } from './test/TestCard.jsx';

// Admin Components
export { default as AdminLayout } from './admin/AdminLayout.jsx';

// Utility Components
export { default as CompactStatsCards } from './common/CompactStatsCards.jsx';
export { default as LoadingSpinner } from './common/LoadingSpinner.jsx';
export { default as ErrorMessage } from './common/ErrorMessage.jsx';
export { default as SuccessMessage } from './common/SuccessMessage.jsx';

// Loading Skeleton Components
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
