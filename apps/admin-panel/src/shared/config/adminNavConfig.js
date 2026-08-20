/**
 * Admin Navigation Configuration
 * Data-driven navigation structure for Trstprep V2.0 Admin Panel
 * Aligned with docs/ADMIN_PANEL_CATEGORIZATION_ANALYSIS.html
 */

import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Video,
  Users,
  Settings,
  FolderTree,
  Tag,
  Navigation,
  Layers,
  Layers2,
  Trash2,
  Ticket,
  Bell,
  Star,
  BarChart3,
  Trophy,
  Clock,
  HelpCircle,
  Database,
  Activity,
  Gift,
  Brain,
  Image,
  FileQuestion,
  UserCheck,
  CreditCard,
  AlertTriangle,
  List,
  Hash,
  CheckSquare,
  History,
  Newspaper,
  Info,
  Archive,
  GitBranch,
  Mail,
  Shield,
  FileSearch,
  TrendingUp,
  Monitor,
  Radio,
} from "lucide-react";

/**
 * Navigation Categories aligned with Master Specification
 * 8 Domain-Oriented Categories
 */
export const adminNavConfig = {
  version: "2.0.0",
  lastUpdated: "2026-03-01",

  categories: [
    {
      id: "dashboard-main",
      name: "Dashboard",
      icon: LayoutDashboard,
      description: "Overview metrics and quick actions",
      color: "#00d4ff",
      isTopLevel: true,
      items: [
        {
          id: "dashboard",
          name: "Dashboard",
          path: "/admin/",
          icon: LayoutDashboard,
          description: "Overview metrics and quick actions",
          badge: null,
        },
      ],
    },
    {
      id: "analytics-insights",
      name: "Analytics & Insights",
      icon: BarChart3,
      description: "Dashboards, metrics, and performance data",
      color: "#818cf8",
      items: [
        {
          id: "analytics",
          name: "Analytics Dashboard",
          path: "/admin/analytics",
          icon: BarChart3,
          description: "Unified metrics, activity tracking, and growth reports",
          badge: "UNIFIED",
        },
        {
          id: "leaderboards",
          name: "Leaderboards & Results",
          path: "/admin/leaderboards",
          icon: Trophy,
          description: "Test rankings and performance data",
          badge: null,
        },
        {
          id: "deep-analytics",
          name: "Deep Analytics",
          path: "/admin/deep-analytics",
          icon: TrendingUp,
          description: "User funnel, cohort analysis, and engagement metrics",
          badge: "NEW",
        },
      ],
    },
    {
      id: "exams-categories",
      name: "Exams & Categories",
      icon: Layers,
      description: "Exam taxonomy and metadata management",
      color: "#7c3aed",
      items: [
        {
          id: "exam-categories",
          name: "Exam Categories",
          path: "/admin/exam-categories",
          icon: Layers,
          description: "SSC, Railway, Banking umbrellas",
          badge: null,
        },
        {
          id: "exam-info",
          name: "Exam Manager",
          path: "/admin/exam-info",
          icon: Info,
          description:
            "Dedicated exam management with editor, details, and syllabus configuration",
          badge: null,
        },
        {
          id: "stages",
          name: "Stages",
          path: "/admin/stages",
          icon: Layers2,
          description: "Exam stages & tier management",
          badge: null,
        },
        {
          id: "categories",
          name: "Test Categories",
          path: "/admin/categories",
          icon: Tag,
          description: "Test categorization system",
          badge: null,
        },
        {
          id: "sections",
          name: "Sections",
          path: "/admin/sections",
          icon: List,
          description: "Test sections with timing",
          badge: null,
        },
        {
          id: "tag-configs",
          name: "Tag Configs",
          path: "/admin/tag-configs",
          icon: Hash,
          description: "Searchable tags",
          badge: null,
        },
      ],
    },
    {
      id: "assessments-quizzes",
      name: "Assessments",
      icon: FileText,
      description:
        "Tests, quizzes, questions, test series, and student results",
      color: "#f472b6",
      items: [
        {
          id: "test-series",
          name: "Test Series",
          path: "/admin/test-series",
          icon: FolderTree,
          description: "Group tests into packages",
          badge: null,
        },
        {
          id: "tests",
          name: "Tests",
          path: "/admin/tests",
          icon: CheckSquare,
          description: "Build full assessments",
          badge: null,
        },
        {
          id: "questions",
          name: "Questions",
          path: "/admin/questions",
          icon: FileQuestion,
          description: "Question bank management",
          badge: null,
        },
        {
          id: "quizzes",
          name: "Quizzes",
          path: "/admin/quizzes",
          icon: Brain,
          description: "Manage subject-wise quizzes and topic tests",
          badge: null,
        },
        {
          id: "practice-questions",
          name: "Practice Questions",
          path: "/admin/practice-questions",
          icon: Brain,
          description: "Manage practice question sets",
          badge: null,
        },
        {
          id: "results",
          name: "Test Results",
          path: "/admin/results",
          icon: CheckSquare,
          description: "Student test attempts, score breakdown, and CSV export",
          badge: null,
        },
      ],
    },
    {
      id: "study-materials",
      name: "Study Materials",
      icon: BookOpen,
      description: "Content assets, taxonomy, and lifecycle",
      color: "#10b981",
      items: [
        {
          id: "study-materials-manager",
          name: "Study Materials",
          path: "/admin/study-materials",
          icon: BookOpen,
          description: "Manage Subjects, Chapters, Topics & Curriculum",
          badge: null,
        },
        {
          id: "current-affairs",
          name: "Current Affairs",
          path: "/admin/current-affairs",
          icon: Newspaper,
          description: "Manage current affairs content",
          badge: null,
        },
        {
          id: "content-management",
          name: "Content Manager",
          path: "/admin/content-management",
          icon: Archive,
          description: "Manage Media, PDFs & Notes",
          badge: null,
        },
        {
          id: "curriculum",
          name: "Curriculum Builder",
          path: "/admin/curriculum",
          icon: GitBranch,
          description: "Build curriculum hierarchies, subjects, and chapters",
          badge: "NEW",
        },
      ],
    },
    {
      id: "notifications-comms",
      name: "Notifications & Comms",
      icon: Bell,
      description: "Alerts, announcements, and support content",
      color: "#f59e0b",
      items: [
        {
          id: "email-templates",
          name: "Email Templates",
          path: "/admin/email-templates",
          icon: Mail,
          description: "Manage transactional and marketing email templates",
          badge: "NEW",
        },
        {
          id: "notifications",
          name: "Notifications",
          path: "/admin/notifications",
          icon: Bell,
          description: "Bulk notifications",
          badge: null,
        },
        {
          id: "banners",
          name: "Banners",
          path: "/admin/banners",
          icon: AlertTriangle,
          description: "Site banners and alerts",
          badge: null,
        },
        {
          id: "faq",
          name: "FAQ Manager",
          path: "/admin/faqs",
          icon: HelpCircle,
          description: "Support content",
          badge: null,
        },
      ],
    },
    {
      id: "subscriptions-monetization",
      name: "Subscriptions & Monetization",
      icon: CreditCard,
      description: "Passes, coupons, promotions, and revenue",
      color: "#ef4444",
      items: [
        {
          id: "subscription-plans",
          name: "Subscription Plans",
          path: "/admin/subscription-plans",
          icon: Star,
          description: "Free/Pro tier features",
          badge: null,
        },
        {
          id: "coupons",
          name: "Coupons",
          path: "/admin/coupons",
          icon: Ticket,
          description: "Discount codes",
          badge: null,
        },
        {
          id: "promotions",
          name: "Promotions",
          path: "/admin/promotions",
          icon: Gift,
          description: "Referral rewards",
          badge: "NEW",
        },
        {
          id: "payments",
          name: "Payments",
          path: "/admin/payments",
          icon: CreditCard,
          description: "Transactions, refunds, and revenue",
          badge: "NEW",
        },
      ],
    },
    {
      id: "moderation",
      name: "Moderation",
      icon: Shield,
      description: "Content review and community safety",
      color: "#f97316",
      items: [
        {
          id: "content-moderation",
          name: "Content Moderation",
          path: "/admin/moderation",
          icon: AlertTriangle,
          description: "Review doubts and flagged content",
          badge: "NEW",
        },
      ],
    },
    {
      id: "users-enrollments",
      name: "Users & Enrollments",
      icon: Users,
      description: "User administration and enrollment tracking",
      color: "#f472b6",
      items: [
        {
          id: "users-permissions",
          name: "Users & Permissions",
          path: "/admin/users",
          icon: Users,
          description: "Manage users, roles, and granular permissions",
          badge: null,
        },
        {
          id: "enrollments",
          name: "Enrollments",
          path: "/admin/enrollments",
          icon: UserCheck,
          description: "User enrollment tracking and management",
          badge: null,
        },
        {
          id: "sessions",
          name: "Active Sessions",
          path: "/admin/sessions",
          icon: Monitor,
          description: "Real-time session monitoring and management",
          badge: "NEW",
        },
        {
          id: "live-monitor",
          name: "Live Test Monitor",
          path: "/admin/live-monitor",
          icon: Radio,
          description: "Realtime view of students currently taking tests",
          badge: "NEW",
        },
        {
          id: "user-activity",
          name: "Activity Logs",
          path: "/admin/activity-log",
          icon: Activity,
          description: "User activity tracking",
          badge: null,
        },
      ],
    },
    {
      id: "audit-compliance",
      name: "Audit & Compliance",
      icon: FileSearch,
      description: "Audit trails, compliance, and system governance",
      color: "#6366f1",
      items: [
        {
          id: "audit-trail",
          name: "Audit Trail",
          path: "/admin/audit-trail",
          icon: FileSearch,
          description:
            "Track all admin actions and system changes with before/after snapshots",
          badge: "NEW",
        },
      ],
    },
    {
      id: "system-settings",
      name: "System & Settings",
      icon: Settings,
      description: "Health, backups, recovery, and configuration",
      color: "#6b7280",
      items: [
        {
          id: "recycle-bin",
          name: "Recycle Bin",
          path: "/admin/recycle-bin",
          icon: Trash2,
          description: "Soft-deleted content",
          badge: null,
        },
        {
          id: "system-health",
          name: "System Health",
          path: "/admin/system-health",
          icon: Activity,
          description: "Backend status, DB health",
          badge: null,
        },
        {
          id: "backups",
          name: "Backups",
          path: "/admin/backups",
          icon: Database,
          description: "Backup management",
          badge: null,
        },
        {
          id: "coming-soon",
          name: "Maintenance & Coming Soon",
          path: "/admin/coming-soon",
          icon: Clock,
          description: "Manage maintenance mode and feature launch states",
          badge: null,
        },
        {
          id: "settings",
          name: "Settings",
          path: "/admin/settings",
          icon: Settings,
          description: "Global configuration",
          badge: null,
        },
        {
          id: "navigation",
          name: "Navigation",
          path: "/admin/navigation",
          icon: Navigation,
          description: "Nav structure",
          badge: null,
        },
        {
          id: "two-factor",
          name: "Two-Factor Auth",
          path: "/admin/two-factor",
          icon: Shield,
          description: "Manage two-factor authentication settings",
          badge: "NEW",
        },
      ],
    },
  ],
};

/**
 * Get flattened navigation items for search/breadcrumbs
 */
export const getFlatNavItems = () => {
  const items = [];
  adminNavConfig.categories.forEach((category) => {
    category.items.forEach((item) => {
      items.push({
        ...item,
        category: category.name,
        categoryIcon: category.icon,
      });
    });
  });
  return items;
};

/**
 * Get navigation item by path
 */
export const getNavItemByPath = (path) => {
  return getFlatNavItems().find((item) => item.path === path);
};

/**
 * Get category by id
 */
export const getCategoryById = (id) => {
  return adminNavConfig.categories.find((cat) => cat.id === id);
};

/**
 * Get breadcrumb trail for a path
 */
export const getBreadcrumbs = (path) => {
  const item = getNavItemByPath(path);
  if (!item) return [];

  return [
    { name: "Admin", path: "/admin" },
    { name: item.category, path: null },
    { name: item.name, path: item.path },
  ];
};

export default adminNavConfig;
