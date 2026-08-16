import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

const router = express.Router();

router.use(protect)
router.use(admin)

// ===== COUPONS MANAGEMENT =====
router.get("/coupons", asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const query = includeInactive === 'true' ? {} : { isActive: true };
  const coupons = await dbHelpers.find("coupons", query);
  res.json({ success: true, data: coupons });
}));

// Allowed fields for coupon create/update — prevents mass assignment of
// internal fields like id, createdAt, createdBy, etc.
const COUPON_ALLOWED_FIELDS = new Set([
  'code', 'description', 'discountType', 'discountValue', 'maxDiscount',
  'minPurchase', 'minOrderValue', 'maxUses', 'usageLimit', 'userUsageLimit',
  'usedCount', 'usageCount', 'validFrom', 'validUntil', 'isActive', 'applicablePlans',
  'applicableCategories', 'usedByUsers',
])

// Allowed fields for subscription plan create/update
const PLAN_ALLOWED_FIELDS = new Set([
  'name', 'planId', 'slug', 'price', 'originalPrice', 'period', 'duration', 'features',
  'buttonText', 'buttonClass', 'popular', 'isPopular', 'savings', 'isActive', 'sortOrder',
  'description', 'trialDays', 'maxAttempts', 'isPro',
])

// Allowed fields for notification create/update
const NOTIFICATION_ALLOWED_FIELDS = new Set([
  'title', 'message', 'type', 'userId', 'userIds', 'isRead', 'isActive',
  'actionUrl', 'priority', 'scheduledAt', 'sentVia', 'metadata',
])

const filterAllowed = (body, allowed) => {
  const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.has(k)))
  // Normalize Coupon aliases
  if ('minOrderValue' in filtered && !('minPurchase' in filtered)) {
    filtered.minPurchase = filtered.minOrderValue
  }
  if ('usageLimit' in filtered && !('maxUses' in filtered)) {
    filtered.maxUses = filtered.usageLimit
  }
  if ('usageCount' in filtered && !('usedCount' in filtered)) {
    filtered.usedCount = filtered.usageCount
  }
  // Normalize Plan aliases
  if ('isPopular' in filtered && !('popular' in filtered)) {
    filtered.popular = filtered.isPopular
  }
  if ('duration' in filtered && !('period' in filtered)) {
    filtered.period = filtered.duration
  }
  return filtered
}

router.post("/coupons", asyncHandler(async (req, res) => {
  const newCoupon = await dbHelpers.insertOne("coupons", {
    ...filterAllowed(req.body, COUPON_ALLOWED_FIELDS),
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ success: true, data: newCoupon });
}));

router.put("/coupons/:id", asyncHandler(async (req, res) => {
  const updated = await dbHelpers.updateById("coupons", req.params.id, {
    ...filterAllowed(req.body, COUPON_ALLOWED_FIELDS),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: "Coupon not found" });
  }
  res.json({ success: true, data: updated });
}));

router.delete("/coupons/:id", asyncHandler(async (req, res) => {
  const deleted = await dbHelpers.softDelete(
    "coupons",
    req.params.id,
    req.user.id,
  );
  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: "Coupon not found" });
  }
  res.json({ success: true, message: "Coupon moved to trash" });
}));

// ===== NOTIFICATIONS MANAGEMENT =====
router.get("/notifications", asyncHandler(async (req, res) => {
  const notifications = await dbHelpers.find("notifications", {});
  const data = notifications.map((row) => ({
    ...row,
    isSent: Array.isArray(row.sentVia)
      ? row.sentVia.length > 0
      : Boolean((row.sentVia || []).length),
    actionText: row.metadata?.actionText || null,
  }));
  res.json({ success: true, data });
}));

router.post("/notifications", asyncHandler(async (req, res) => {
  const filtered = filterAllowed(req.body, NOTIFICATION_ALLOWED_FIELDS);
  // is_sent / action_text are NOT notifications columns — store them in the
  // metadata JSONB instead so insertOne never writes nonexistent columns.
  const actionText = req.body.actionText ?? req.body.action_text;
  const extraData = req.body.data;
  if (actionText !== undefined || extraData !== undefined) {
    filtered.metadata = {
      ...(filtered.metadata || {}),
      ...(actionText !== undefined ? { actionText } : {}),
      ...(extraData !== undefined ? { data: extraData } : {}),
    };
  }
  const newNotification = await dbHelpers.insertOne("notifications", {
    ...filtered,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ success: true, data: newNotification });
}));

router.post("/notifications/bulk", asyncHandler(async (req, res) => {
  const { userIds, notification } = req.body;
  const { title, message, type } = notification || {};
  const bulkActionText = notification?.actionText ?? notification?.action_text;
  const bulkData = notification?.data;
  const notifications = (userIds || []).map((userId) => ({
    title,
    message,
    type,
    userId,
    actionUrl: notification?.actionUrl ?? notification?.action_url ?? null,
    priority: notification?.priority ?? null,
    scheduledAt: notification?.scheduledAt ?? notification?.scheduled_at ?? null,
    sentVia: notification?.sentVia ?? notification?.sent_via ?? [],
    metadata: {
      ...(notification?.metadata || {}),
      ...(bulkActionText !== undefined ? { actionText: bulkActionText } : {}),
      ...(bulkData !== undefined ? { data: bulkData } : {}),
    },
    createdAt: new Date().toISOString(),
  }));
  const inserted = await dbHelpers.insertMany("notifications", notifications);
  res
    .status(201)
    .json({ success: true, data: inserted, count: inserted.length });
}));

router.put("/notifications/:id", asyncHandler(async (req, res) => {
  const updated = await dbHelpers.updateById("notifications", req.params.id, {
    ...filterAllowed(req.body, NOTIFICATION_ALLOWED_FIELDS),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: "Notification not found" });
  }
  res.json({ success: true, data: updated });
}));

router.delete("/notifications/:id", asyncHandler(async (req, res) => {
  const deleted = await dbHelpers.softDelete(
    "notifications",
    req.params.id,
    req.user.id,
  );
  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: "Notification not found" });
  }
  res.json({ success: true, message: "Notification moved to trash" });
}));

// ===== LEADERBOARD MANAGEMENT =====
router.get("/leaderboards", asyncHandler(async (req, res) => {
  const leaderboards = await dbHelpers.find("leaderboards", {
    isActive: true,
  });
  res.json({ success: true, data: leaderboards });
}));

// ===== SUBSCRIPTION PLANS MANAGEMENT =====
router.get("/subscription-plans", asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const query = includeInactive === 'true' ? {} : { isActive: true };
  const plans = await dbHelpers.find("subscriptionPlans", query);
  res.json({ success: true, data: plans });
}));

router.post("/subscription-plans", asyncHandler(async (req, res) => {
  const newPlan = await dbHelpers.insertOne("subscriptionPlans", {
    ...filterAllowed(req.body, PLAN_ALLOWED_FIELDS),
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ success: true, data: newPlan });
}));

router.put("/subscription-plans/:id", asyncHandler(async (req, res) => {
  const updated = await dbHelpers.updateById(
    "subscriptionPlans",
    req.params.id,
    {
      ...filterAllowed(req.body, PLAN_ALLOWED_FIELDS),
      updatedAt: new Date().toISOString(),
    },
  );
  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: "Plan not found" });
  }
  res.json({ success: true, data: updated });
}));

router.delete("/subscription-plans/:id", asyncHandler(async (req, res) => {
  const deleted = await dbHelpers.softDelete(
    "subscriptionPlans",
    req.params.id,
    req.user.id,
  );
  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: "Plan not found" });
  }
  res.json({ success: true, message: "Plan moved to trash" });
}));

export default router;
