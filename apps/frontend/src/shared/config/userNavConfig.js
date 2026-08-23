import {
  Home,
  LayoutDashboard,
  BookOpen,
  Radio,
  FileText,
  Target,
  HelpCircle,
  ClipboardCheck,
  GraduationCap,
  Library,
  Video,
  Bookmark,
  BarChart2,
  Trophy,
  Users,
  Crown,
} from "lucide-react";

/**
 * Single source of truth for user-facing navigation links.
 * Sidebar and LeftSidebar both import from here to avoid duplication.
 * Add `aria-current` handling via isActive helper in consumers.
 */

export const userNavSections = [
  {
    title: "Learning & Tests",
    items: [
      {
        label: "Test Series",
        path: "/test-series",
        Icon: BookOpen,
        color: "text-blue-500",
      },
      {
        label: "Live Tests",
        path: "/live-tests",
        Icon: Radio,
        color: "text-red-500",
        hasLiveDot: true,
      },
      {
        label: "PYQ Papers",
        path: "/pyps",
        Icon: FileText,
        color: "text-green-500",
      },
      {
        label: "Practice",
        path: "/practice",
        Icon: Target,
        color: "text-purple-500",
      },
      {
        label: "Quizzes",
        path: "/quizzes",
        Icon: HelpCircle,
        color: "text-yellow-500",
      },
      {
        label: "Attempted Tests",
        path: "/attempted-tests",
        Icon: ClipboardCheck,
        color: "text-sky-500",
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        label: "All Exams",
        path: "/exams",
        Icon: GraduationCap,
        color: "text-indigo-500",
      },
      {
        label: "Study Materials",
        path: "/study",
        Icon: Library,
        color: "text-teal-500",
      },
      { label: "Videos", path: "/videos", Icon: Video, color: "text-pink-500" },
      {
        label: "Saved Questions",
        path: "/bookmarks",
        Icon: Bookmark,
        color: "text-amber-500",
      },
      {
        label: "Analysis",
        path: "/analysis",
        Icon: BarChart2,
        color: "text-orange-500",
      },
      {
        label: "Leaderboard",
        path: "/leaderboard",
        Icon: Trophy,
        color: "text-yellow-500",
      },
      {
        label: "Community",
        path: "/community",
        Icon: Users,
        color: "text-violet-500",
      },
    ],
  },
];

export const premiumNavItem = {
  label: "Pass Pro",
  path: "/pass",
  Icon: Crown,
  color: "text-amber-500",
};

export function getDashboardLink(isAuthenticated) {
  return isAuthenticated
    ? { label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard }
    : { label: "Home", path: "/", Icon: Home };
}
