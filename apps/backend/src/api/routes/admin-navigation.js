import express from "express";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import {
  responseCache,
  invalidateResponseCache,
} from "../../middleware/responseCache.middleware.js";

const router = express.Router();

const DEFAULT_NAVIGATION = Object.freeze([
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    route: "/admin",
    order: 1,
    category: "dashboard",
    enabled: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: "BarChart3",
    route: "/admin/analytics",
    order: 1,
    category: "analytics",
    enabled: true,
  },
  {
    id: "leaderboards",
    label: "Leaderboards",
    icon: "Trophy",
    route: "/admin/leaderboards",
    order: 2,
    category: "analytics",
    enabled: true,
  },
  {
    id: "deep-analytics",
    label: "Deep Analytics",
    icon: "TrendingUp",
    route: "/admin/deep-analytics",
    order: 3,
    category: "analytics",
    enabled: true,
  },
  {
    id: "exam-categories",
    label: "Exam Categories",
    icon: "Layers",
    route: "/admin/exam-categories",
    order: 1,
    category: "exams",
    enabled: true,
  },
  {
    id: "exam-manager",
    label: "Exam Manager",
    icon: "FileText",
    route: "/admin/exams",
    order: 2,
    category: "exams",
    enabled: true,
  },
  {
    id: "stages",
    label: "Stages",
    icon: "Flag",
    route: "/admin/stages",
    order: 3,
    category: "exams",
    enabled: true,
  },
  {
    id: "test-categories",
    label: "Test Categories",
    icon: "Tags",
    route: "/admin/test-categories",
    order: 4,
    category: "exams",
    enabled: true,
  },
  {
    id: "sections",
    label: "Sections",
    icon: "Columns",
    route: "/admin/sections",
    order: 5,
    category: "exams",
    enabled: true,
  },
  {
    id: "tag-configs",
    label: "Tag Configs",
    icon: "Settings",
    route: "/admin/tag-configs",
    order: 6,
    category: "exams",
    enabled: true,
  },
  {
    id: "test-series",
    label: "Test Series",
    icon: "BookOpen",
    route: "/admin/test-series",
    order: 1,
    category: "assessments",
    enabled: true,
  },
  {
    id: "tests",
    label: "Tests",
    icon: "ClipboardList",
    route: "/admin/tests",
    order: 2,
    category: "assessments",
    enabled: true,
  },
  {
    id: "questions",
    label: "Questions",
    icon: "HelpCircle",
    route: "/admin/questions",
    order: 3,
    category: "assessments",
    enabled: true,
  },
  {
    id: "quizzes",
    label: "Quizzes",
    icon: "Brain",
    route: "/admin/quizzes",
    order: 4,
    category: "assessments",
    enabled: true,
  },
  {
    id: "practice-questions",
    label: "Practice Questions",
    icon: "PenTool",
    route: "/admin/practice-questions",
    order: 5,
    category: "assessments",
    enabled: true,
  },
  {
    id: "sm-manager",
    label: "Study Materials",
    icon: "FolderOpen",
    route: "/admin/study-materials",
    order: 1,
    category: "study_materials",
    enabled: true,
  },
  {
    id: "subject-relations",
    label: "Subject Relations",
    icon: "Share2",
    route: "/admin/subject-relations",
    order: 3,
    category: "study_materials",
    enabled: true,
  },
  {
    id: "videos",
    label: "Videos",
    icon: "Video",
    route: "/admin/videos",
    order: 4,
    category: "study_materials",
    enabled: true,
  },
  {
    id: "media-library",
    label: "Media Library",
    icon: "Image",
    route: "/admin/media",
    order: 5,
    category: "study_materials",
    enabled: true,
  },
  {
    id: "current-affairs",
    label: "Current Affairs",
    icon: "Newspaper",
    route: "/admin/current-affairs",
    order: 6,
    category: "study_materials",
    enabled: true,
  },
  {
    id: "content-manager",
    label: "Content Manager",
    icon: "FileEdit",
    route: "/admin/content",
    order: 7,
    category: "study_materials",
    enabled: true,
  },
  {
    id: "email-templates",
    label: "Email Templates",
    icon: "Mail",
    route: "/admin/email-templates",
    order: 1,
    category: "notifications",
    enabled: true,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "Bell",
    route: "/admin/notifications",
    order: 2,
    category: "notifications",
    enabled: true,
  },
  {
    id: "banners",
    label: "Banners",
    icon: "Image",
    route: "/admin/banners",
    order: 3,
    category: "notifications",
    enabled: true,
  },
  {
    id: "faq",
    label: "FAQ",
    icon: "MessageCircle",
    route: "/admin/faq",
    order: 4,
    category: "notifications",
    enabled: true,
  },
  {
    id: "subscription-plans",
    label: "Subscription Plans",
    icon: "CreditCard",
    route: "/admin/subscriptions",
    order: 1,
    category: "subscriptions",
    enabled: true,
  },
  {
    id: "coupons",
    label: "Coupons",
    icon: "Percent",
    route: "/admin/coupons",
    order: 2,
    category: "subscriptions",
    enabled: true,
  },
  {
    id: "promotions",
    label: "Promotions",
    icon: "Gift",
    route: "/admin/promotions",
    order: 3,
    category: "subscriptions",
    enabled: true,
  },
  {
    id: "roles-permissions",
    label: "Roles & Permissions",
    icon: "Shield",
    route: "/admin/roles",
    order: 1,
    category: "users",
    enabled: true,
  },
  {
    id: "users",
    label: "Users",
    icon: "Users",
    route: "/admin/users",
    order: 2,
    category: "users",
    enabled: true,
  },
  {
    id: "enrollments",
    label: "Enrollments",
    icon: "UserCheck",
    route: "/admin/enrollments",
    order: 3,
    category: "users",
    enabled: true,
  },
  {
    id: "activity-logs",
    label: "Activity Logs",
    icon: "Activity",
    route: "/admin/activity-logs",
    order: 4,
    category: "users",
    enabled: true,
  },
  {
    id: "audit-trail",
    label: "Audit Trail",
    icon: "Search",
    route: "/admin/audit-trail",
    order: 1,
    category: "audit",
    enabled: true,
  },
  {
    id: "recycle-bin",
    label: "Recycle Bin",
    icon: "Trash2",
    route: "/admin/recycle-bin",
    order: 1,
    category: "system",
    enabled: true,
  },
  {
    id: "logs",
    label: "Terminal Logs",
    icon: "Terminal",
    route: "/admin/logs",
    order: 2,
    category: "system",
    enabled: true,
  },
]);

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(admin);

/**
 * GET /admin/navigation
 * Get complete navigation structure
 * Returns all navigation items organized by category and ordered
 */
router.get("/", responseCache("admin-navigation", 60), async (req, res) => {
  try {
    const { category, enabled } = req.query;

    let whereClause = "";
    const params = [];
    let paramIndex = 1;

    if (category) {
      whereClause += `WHERE category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (enabled !== undefined) {
      whereClause += whereClause ? " AND" : "WHERE";
      whereClause += ` enabled = $${paramIndex}`;
      params.push(enabled === "true");
      paramIndex++;
    }

    const { rows } = await pool.query(
      `SELECT 
        id,
        label,
        icon,
        route,
        "order",
        category,
        enabled,
        parent_id,
        description,
        badge,
        badge_color,
        created_at,
        updated_at
       FROM navigation_config 
       ${whereClause}
       ORDER BY 
         CASE category
           WHEN 'dashboard' THEN 1
           WHEN 'analytics' THEN 2
           WHEN 'exams' THEN 3
           WHEN 'assessments' THEN 4
           WHEN 'study_materials' THEN 5
           WHEN 'notifications' THEN 6
           WHEN 'subscriptions' THEN 7
           WHEN 'users' THEN 8
           WHEN 'audit' THEN 9
           WHEN 'system' THEN 10
           ELSE 99
         END,
         "order" ASC`,
      params,
    );

    // Group navigation items by category
    const navigationByCategory = {};

    rows.forEach((item) => {
      if (!navigationByCategory[item.category]) {
        navigationByCategory[item.category] = {
          category: item.category,
          items: [],
        };
      }

      navigationByCategory[item.category].items.push({
        id: item.id,
        label: item.label,
        icon: item.icon,
        route: item.route,
        enabled: item.enabled,
        order: item.order ?? item.display_order ?? 0,
        section: item.section || item.category || "main",
        parent_id: item.parent_id,
        description: item.description,
        badge: item.badge,
        badge_color: item.badge_color,
      });
    });

    res.json({
      success: true,
      data: {
        navigation: Object.values(navigationByCategory),
        total: rows.length,
        enabled_count: rows.filter((r) => r.enabled).length,
        disabled_count: rows.filter((r) => !r.enabled).length,
      },
    });
  } catch (error) {
    console.error("Get navigation error:", error.message);
    // Surface the error — do NOT masquerade as success with default config.
    res.status(500).json({
      success: false,
      error: "Failed to load navigation configuration",
      details: sanitizeErrorMessage(error),
    });
  }
});

/**
 * PUT /admin/navigation
 * Update complete navigation structure
 * Accepts array of navigation items with order
 */
router.put("/", async (req, res) => {
  const { navigation } = req.body;

  if (!navigation || !Array.isArray(navigation)) {
    return res.status(400).json({
      success: false,
      error: "navigation array is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Delete all existing navigation items
    await client.query("DELETE FROM navigation_config");

    // Insert new navigation items
    for (const [index, item] of navigation.entries()) {
      await client.query(
        `INSERT INTO navigation_config (
          id, label, icon, route, "order", category, enabled, 
          parent_id, description, badge, badge_color
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          item.id,
          item.label,
          item.icon || null,
          item.route || null,
          item.order !== undefined ? item.order : index,
          item.category,
          item.enabled !== undefined ? item.enabled : true,
          item.parent_id || null,
          item.description || null,
          item.badge || null,
          item.badge_color || null,
        ],
      );
    }

    await client.query("COMMIT");
    invalidateResponseCache("admin-navigation");

    res.json({
      success: true,
      message: "Navigation updated successfully",
      data: {
        total_items: navigation.length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update navigation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update navigation configuration",
      details: sanitizeErrorMessage(error),
    });
  } finally {
    client.release();
  }
});

/**
 * POST /admin/navigation/reset
 * Reset navigation to default configuration
 */
router.post("/reset", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Delete current navigation
    await client.query("DELETE FROM navigation_config");

    // Insert default navigation structure
    const defaultNavigation = [
      // Dashboard
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "LayoutDashboard",
        route: "/admin",
        order: 1,
        category: "dashboard",
        enabled: true,
      },

      // Analytics
      {
        id: "analytics",
        label: "Analytics",
        icon: "BarChart3",
        route: "/admin/analytics",
        order: 1,
        category: "analytics",
        enabled: true,
      },
      {
        id: "leaderboards",
        label: "Leaderboards",
        icon: "Trophy",
        route: "/admin/leaderboards",
        order: 2,
        category: "analytics",
        enabled: true,
      },
      {
        id: "deep-analytics",
        label: "Deep Analytics",
        icon: "TrendingUp",
        route: "/admin/deep-analytics",
        order: 3,
        category: "analytics",
        enabled: true,
      },

      // Exams & Categories
      {
        id: "exam-categories",
        label: "Exam Categories",
        icon: "Layers",
        route: "/admin/exam-categories",
        order: 1,
        category: "exams",
        enabled: true,
      },
      {
        id: "exam-manager",
        label: "Exam Manager",
        icon: "FileText",
        route: "/admin/exams",
        order: 2,
        category: "exams",
        enabled: true,
      },
      {
        id: "stages",
        label: "Stages",
        icon: "Flag",
        route: "/admin/stages",
        order: 3,
        category: "exams",
        enabled: true,
      },
      {
        id: "test-categories",
        label: "Test Categories",
        icon: "Tags",
        route: "/admin/test-categories",
        order: 4,
        category: "exams",
        enabled: true,
      },
      {
        id: "sections",
        label: "Sections",
        icon: "Columns",
        route: "/admin/sections",
        order: 5,
        category: "exams",
        enabled: true,
      },
      {
        id: "tag-configs",
        label: "Tag Configs",
        icon: "Settings",
        route: "/admin/tag-configs",
        order: 6,
        category: "exams",
        enabled: true,
      },

      // Assessments & Quizzes
      {
        id: "test-series",
        label: "Test Series",
        icon: "BookOpen",
        route: "/admin/test-series",
        order: 1,
        category: "assessments",
        enabled: true,
      },
      {
        id: "tests",
        label: "Tests",
        icon: "ClipboardList",
        route: "/admin/tests",
        order: 2,
        category: "assessments",
        enabled: true,
      },
      {
        id: "questions",
        label: "Questions",
        icon: "HelpCircle",
        route: "/admin/questions",
        order: 3,
        category: "assessments",
        enabled: true,
      },
      {
        id: "quizzes",
        label: "Quizzes",
        icon: "Brain",
        route: "/admin/quizzes",
        order: 4,
        category: "assessments",
        enabled: true,
      },
      {
        id: "practice-questions",
        label: "Practice Questions",
        icon: "PenTool",
        route: "/admin/practice-questions",
        order: 5,
        category: "assessments",
        enabled: true,
      },

      // Study Materials
      {
        id: "sm-manager",
        label: "Study Materials",
        icon: "FolderOpen",
        route: "/admin/study-materials",
        order: 1,
        category: "study_materials",
        enabled: true,
      },
      {
        id: "subject-relations",
        label: "Subject Relations",
        icon: "Share2",
        route: "/admin/subject-relations",
        order: 3,
        category: "study_materials",
        enabled: true,
      },
      {
        id: "videos",
        label: "Videos",
        icon: "Video",
        route: "/admin/videos",
        order: 4,
        category: "study_materials",
        enabled: true,
      },
      {
        id: "media-library",
        label: "Media Library",
        icon: "Image",
        route: "/admin/media",
        order: 5,
        category: "study_materials",
        enabled: true,
      },
      {
        id: "current-affairs",
        label: "Current Affairs",
        icon: "Newspaper",
        route: "/admin/current-affairs",
        order: 6,
        category: "study_materials",
        enabled: true,
      },
      {
        id: "content-manager",
        label: "Content Manager",
        icon: "FileEdit",
        route: "/admin/content",
        order: 7,
        category: "study_materials",
        enabled: true,
      },

      // Notifications & Communications
      {
        id: "email-templates",
        label: "Email Templates",
        icon: "Mail",
        route: "/admin/email-templates",
        order: 1,
        category: "notifications",
        enabled: true,
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: "Bell",
        route: "/admin/notifications",
        order: 2,
        category: "notifications",
        enabled: true,
      },
      {
        id: "banners",
        label: "Banners",
        icon: "Image",
        route: "/admin/banners",
        order: 3,
        category: "notifications",
        enabled: true,
      },
      {
        id: "faq",
        label: "FAQ",
        icon: "MessageCircle",
        route: "/admin/faq",
        order: 4,
        category: "notifications",
        enabled: true,
      },

      // Subscriptions & Monetization
      {
        id: "subscription-plans",
        label: "Subscription Plans",
        icon: "CreditCard",
        route: "/admin/subscriptions",
        order: 1,
        category: "subscriptions",
        enabled: true,
      },
      {
        id: "coupons",
        label: "Coupons",
        icon: "Percent",
        route: "/admin/coupons",
        order: 2,
        category: "subscriptions",
        enabled: true,
      },
      {
        id: "promotions",
        label: "Promotions",
        icon: "Gift",
        route: "/admin/promotions",
        order: 3,
        category: "subscriptions",
        enabled: true,
      },

      // Users & Enrollments
      {
        id: "roles-permissions",
        label: "Roles & Permissions",
        icon: "Shield",
        route: "/admin/roles",
        order: 1,
        category: "users",
        enabled: true,
      },
      {
        id: "users",
        label: "Users",
        icon: "Users",
        route: "/admin/users",
        order: 2,
        category: "users",
        enabled: true,
      },
      {
        id: "enrollments",
        label: "Enrollments",
        icon: "UserCheck",
        route: "/admin/enrollments",
        order: 3,
        category: "users",
        enabled: true,
      },
      {
        id: "activity-logs",
        label: "Activity Logs",
        icon: "Activity",
        route: "/admin/activity-logs",
        order: 4,
        category: "users",
        enabled: true,
      },

      // Audit & Compliance
      {
        id: "audit-trail",
        label: "Audit Trail",
        icon: "Search",
        route: "/admin/audit-trail",
        order: 1,
        category: "audit",
        enabled: true,
      },

      // System & Settings
      {
        id: "recycle-bin",
        label: "Recycle Bin",
        icon: "Trash2",
        route: "/admin/recycle-bin",
        order: 1,
        category: "system",
        enabled: true,
      },
      {
        id: "system-health",
        label: "System Health",
        icon: "Heart",
        route: "/admin/system-health",
        order: 2,
        category: "system",
        enabled: true,
      },
      {
        id: "backups",
        label: "Backups",
        icon: "Database",
        route: "/admin/backups",
        order: 3,
        category: "system",
        enabled: true,
      },
      {
        id: "settings",
        label: "Settings",
        icon: "Settings",
        route: "/admin/settings",
        order: 4,
        category: "system",
        enabled: true,
      },
      {
        id: "navigation-manager",
        label: "Navigation",
        icon: "Navigation",
        route: "/admin/navigation",
        order: 5,
        category: "system",
        enabled: true,
      },
    ];

    for (const item of defaultNavigation) {
      await client.query(
        `INSERT INTO navigation_config (
          id, label, icon, route, "order", category, enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.id,
          item.label,
          item.icon,
          item.route,
          item.order,
          item.category,
          item.enabled,
        ],
      );
    }

    await client.query("COMMIT");
    invalidateResponseCache("admin-navigation");

    res.json({
      success: true,
      message: "Navigation reset to default configuration",
      data: {
        total_items: defaultNavigation.length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reset navigation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset navigation configuration",
      details: sanitizeErrorMessage(error),
    });
  } finally {
    client.release();
  }
});

/**
 * POST /admin/navigation
 * Create a single navigation item
 */
router.post("/", async (req, res) => {
  const {
    id,
    label,
    icon,
    route,
    order,
    category,
    enabled,
    parent_id,
    description,
    badge,
    badge_color,
  } = req.body;

  if (!id || !label) {
    return res
      .status(400)
      .json({ success: false, error: "id and label are required" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO navigation_config (id, label, icon, route, "order", category, enabled, parent_id, description, badge, badge_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        label,
        icon || null,
        route || null,
        order || 0,
        category || "main",
        enabled !== undefined ? enabled : true,
        parent_id || null,
        description || null,
        badge || null,
        badge_color || null,
      ],
    );

    res.status(201).json({
      success: true,
      data: rows[0],
      message: "Navigation item created successfully",
    });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({
          success: false,
          error: "Navigation item with this ID already exists",
        });
    }
    console.error("Create navigation item error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create navigation item" });
  }
});

/**
 * DELETE /admin/navigation/:id
 * Delete a single navigation item
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM navigation_config WHERE id = $1 RETURNING id",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Navigation item not found" });
    }
    res.json({
      success: true,
      message: "Navigation item deleted successfully",
    });
  } catch (error) {
    console.error("Delete navigation item error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete navigation item" });
  }
});

/**
 * Shared single-item update used by both PATCH and PUT /admin/navigation/:id.
 * Accepts both DB column names and the frontend's camelCase aliases
 * (`isVisible` → `enabled`, `section` → `category`).
 */
async function updateNavigationItem(req, res) {
  const { id } = req.params;
  const updates = req.body;

  try {
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    const fieldAliases = {
      label: "label",
      icon: "icon",
      route: "route",
      order: "order",
      category: "category",
      section: "category",
      enabled: "enabled",
      isVisible: "enabled",
      parent_id: "parent_id",
      description: "description",
      badge: "badge",
      badge_color: "badge_color",
    };

    for (const [bodyField, dbField] of Object.entries(fieldAliases)) {
      if (updates[bodyField] !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex}`);
        params.push(updates[bodyField]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid fields to update",
      });
    }

    updateFields.push("updated_at = NOW()");
    params.push(id);

    const { rows } = await pool.query(
      `UPDATE navigation_config 
       SET ${updateFields.join(", ")} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      params,
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Navigation item not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
      message: "Navigation item updated successfully",
    });
  } catch (error) {
    console.error("Update navigation item error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update navigation item",
      details: sanitizeErrorMessage(error),
    });
  }
}

/**
 * PUT /admin/navigation/:id
 * Update single navigation item (same semantics as PATCH — prevents PUT from
 * falling through to the tag-configs router's overlapping /navigation/:id).
 */
router.put("/:id", updateNavigationItem);

/**
 * PATCH /admin/navigation/:id
 * Update single navigation item
 */
router.patch("/:id", updateNavigationItem);

export default router;
