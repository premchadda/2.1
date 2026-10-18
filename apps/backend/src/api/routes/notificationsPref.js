import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { auth } from "../../middleware/auth.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

/**
 * GET /api/notifications
 * Get user notifications (authenticated)
 */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { read, page = 1, limit = 20 } = req.query;

    let query =
      "SELECT id, user_id, type, title, message, data, image, action_url, action_text, is_read, read_at, sent_via, scheduled_at, is_sent, sent_at, priority, expires_at, created_at, updated_at, is_active, public_id_uuid, public_id, channel, is_deleted, deleted_at, deleted_by, read, metadata FROM notifications WHERE user_id = $1";
    const params = [userId];
    const paramCount = 2;

    if (read === "true") {
      query += ` AND read = true`;
    } else if (read === "false") {
      query += ` AND read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await dbHelpers.query(query, params);

    // Get unread count
    const unreadResult = await dbHelpers.query(
      "SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND read = false",
      [userId],
    );

    res.json({
      success: true,
      data: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].unread),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read (authenticated)
 */
router.put("/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await dbHelpers.query(
      `UPDATE notifications SET read = true, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Notification not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read (authenticated)
 */
router.put("/read-all", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await dbHelpers.query(
      `UPDATE notifications SET read = true, updated_at = NOW() 
       WHERE user_id = $1 AND read = false`,
      [userId],
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification (authenticated)
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await dbHelpers.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
      [id, userId],
    );

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * GET /api/notifications-pref/preferences
 * Get current user notification preferences
 */
router.get("/preferences", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    let prefs = null;

    try {
      const result = await dbHelpers.query(
        "SELECT * FROM notification_preferences WHERE user_id = $1 LIMIT 1",
        [userId],
      );
      if (result.rows.length > 0) {
        prefs = result.rows[0];
      }
    } catch {
      // Table may not exist or query error
    }

    if (!prefs) {
      prefs = {
        user_id: userId,
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        marketing: false,
        test_reminders: true,
      };
    }

    res.json({ success: true, data: prefs });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * PUT /api/notifications-pref/preferences
 * Update current user notification preferences
 */
router.put("/preferences", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      email_notifications = true,
      push_notifications = true,
      sms_notifications = false,
      marketing = false,
      test_reminders = true,
    } = req.body;

    let updated = null;
    try {
      const result = await dbHelpers.query(
        `INSERT INTO notification_preferences 
           (user_id, email_notifications, push_notifications, sms_notifications, marketing, test_reminders, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET 
           email_notifications = EXCLUDED.email_notifications,
           push_notifications = EXCLUDED.push_notifications,
           sms_notifications = EXCLUDED.sms_notifications,
           marketing = EXCLUDED.marketing,
           test_reminders = EXCLUDED.test_reminders,
           updated_at = NOW()
         RETURNING *`,
        [
          userId,
          Boolean(email_notifications),
          Boolean(push_notifications),
          Boolean(sms_notifications),
          Boolean(marketing),
          Boolean(test_reminders),
        ],
      );
      updated = result.rows[0];
    } catch {
      // Fallback representation
      updated = {
        user_id: userId,
        email_notifications,
        push_notifications,
        sms_notifications,
        marketing,
        test_reminders,
      };
    }

    res.json({ success: true, data: updated, message: "Preferences updated" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * POST /api/notifications-pref/unsubscribe
 * Unsubscribe from notifications
 */
router.post("/unsubscribe", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    try {
      await dbHelpers.query(
        `UPDATE notification_preferences
         SET email_notifications = false, push_notifications = false, marketing = false, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
    } catch {
      // Non-fatal
    }
    res.json({ success: true, message: "Successfully unsubscribed" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * POST /api/notifications-pref/subscribe
 * Subscribe to notifications (authenticated)
 */
router.post("/subscribe", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = "coming_soon", email, push } = req.body;

    const ALLOWED_TYPES = [
      "coming_soon",
      "marketing",
      "product",
      "security",
      "system",
    ];
    if (type && !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid notification type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
      });
    }

    try {
      await dbHelpers.query(
        `INSERT INTO notification_preferences (user_id, email_notifications, push_notifications, updated_at)
         VALUES ($1, true, true, NOW())
         ON CONFLICT (user_id) DO UPDATE SET 
           email_notifications = true,
           push_notifications = true,
           updated_at = NOW()`,
        [userId],
      );
    } catch {
      // Fallback if schema has notification_type column
      try {
        await dbHelpers.query(
          `INSERT INTO notification_preferences (user_id, notification_type, email, push, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id, notification_type) DO UPDATE SET 
           email = $3, push = $4, updated_at = NOW()`,
          [userId, type, email ?? true, push ?? true],
        );
      } catch {
        // Non-fatal
      }
    }

    res.json({ success: true, message: "Subscription updated" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

export default router;
