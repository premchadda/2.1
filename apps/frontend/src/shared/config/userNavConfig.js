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
  Award,
  Gift,
  Newspaper,
  Sparkles,
  TrendingUp,
  Brain,
  Info,
  Shield,
  Mail,
} from "lucide-react";

/**
 * Single source of truth for user-facing navigation links.
 * userNavSections: All primary and resource links established in the sidebar.
 * moreNavItems: Additional platform pages that do not have dedicated visible sidebar links.
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
      {
        label: "Videos",
        path: "/videos",
        Icon: Video,
        color: "text-pink-500",
      },
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

export const moreNavItems = [
  {
    label: "AI Study Planner",
    path: "/dashboard/ai-planner",
    Icon: Sparkles,
    color: "text-purple-500",
  },
  {
    label: "Performance Insights",
    path: "/dashboard/insights",
    Icon: TrendingUp,
    color: "text-indigo-500",
  },
  {
    label: "Spaced Repetition",
    path: "/spaced-repetition",
    Icon: Brain,
    color: "text-violet-500",
  },
  {
    label: "Achievements",
    path: "/achievements",
    Icon: Award,
    color: "text-amber-500",
  },
  {
    label: "Refer & Earn",
    path: "/refer-and-earn",
    Icon: Gift,
    color: "text-emerald-500",
  },
  {
    label: "Current Affairs",
    path: "/current-affairs",
    Icon: Newspaper,
    color: "text-cyan-500",
  },
  {
    label: "Blog & Articles",
    path: "/blog",
    Icon: FileText,
    color: "text-rose-500",
  },
  {
    label: "FAQ & Help",
    path: "/faq",
    Icon: Info,
    color: "text-teal-500",
  },
  {
    label: "About Trstprep",
    path: "/about",
    Icon: Shield,
    color: "text-gray-400",
  },
  {
    label: "Contact Support",
    path: "/contact",
    Icon: Mail,
    color: "text-slate-400",
  },
];

export const topBarNavCategories = [
  {
    title: "Tests & Practice",
    items: [
      {
        label: "Live Tests",
        path: "/live-tests",
        Icon: Radio,
        color: "text-red-500",
        hasLiveDot: true,
      },
      {
        label: "Practice",
        path: "/practice",
        Icon: Target,
        color: "text-purple-500",
      },
      {
        label: "PYQ Papers",
        path: "/pyps",
        Icon: FileText,
        color: "text-green-500",
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
    title: "AI & Insights",
    items: [
      {
        label: "AI Study Planner",
        path: "/dashboard/ai-planner",
        Icon: Sparkles,
        color: "text-purple-500",
      },
      {
        label: "Performance Insights",
        path: "/dashboard/insights",
        Icon: TrendingUp,
        color: "text-indigo-500",
      },
      {
        label: "Spaced Repetition",
        path: "/spaced-repetition",
        Icon: Brain,
        color: "text-violet-500",
      },
      {
        label: "Analysis",
        path: "/analysis",
        Icon: BarChart2,
        color: "text-orange-500",
      },
      {
        label: "Saved Questions",
        path: "/bookmarks",
        Icon: Bookmark,
        color: "text-amber-500",
      },
    ],
  },
  {
    title: "Rewards & Community",
    items: [
      {
        label: "Leaderboard",
        path: "/leaderboard",
        Icon: Trophy,
        color: "text-yellow-500",
      },
      {
        label: "Achievements",
        path: "/achievements",
        Icon: Award,
        color: "text-amber-500",
      },
      {
        label: "Videos",
        path: "/videos",
        Icon: Video,
        color: "text-pink-500",
      },
      {
        label: "Community",
        path: "/community",
        Icon: Users,
        color: "text-violet-500",
      },
      {
        label: "Pass Pro",
        path: "/pass",
        Icon: Crown,
        color: "text-amber-500",
        badge: "PRO",
      },
    ],
  },
];

export const topBarMoreItems = topBarNavCategories.flatMap(
  (category) => category.items,
);

export const topBarSecondaryItems = [
  {
    label: "Refer & Earn",
    path: "/refer-and-earn",
    Icon: Gift,
    color: "text-emerald-500",
  },
  {
    label: "Current Affairs",
    path: "/current-affairs",
    Icon: Newspaper,
    color: "text-cyan-500",
  },
  {
    label: "Blog",
    path: "/blog",
    Icon: FileText,
    color: "text-rose-500",
  },
  {
    label: "FAQ",
    path: "/faq",
    Icon: Info,
    color: "text-teal-500",
  },
  {
    label: "About",
    path: "/about",
    Icon: Shield,
    color: "text-blue-500",
  },
  {
    label: "Contact",
    path: "/contact",
    Icon: Mail,
    color: "text-indigo-500",
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
