import express from "express";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

const router = express.Router();

router.use(protect);
router.use(admin);

const PAYMENT_STATUSES = ["success", "failed", "pending", "refunded"];

let paymentsTableEnsured = false;

const ensurePaymentsTable = async () => {
  if (paymentsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      gateway VARCHAR(50),
      gateway_payment_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      refunded_at TIMESTAMP,
      refunded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB DEFAULT '{}'::jsonb
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC)`,
  );
  paymentsTableEnsured = true;
};

const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress;

// GET /admin/payments — default list of payments
router.get(
  "/",
  asyncHandler(async (req, res, next) => {
    req.url = "/transactions";
    return router.handle(req, res, next);
  }),
);

// GET /admin/payments/transactions — paginated list of recent payments
router.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    await ensurePaymentsTable();

    const rawPage = parseInt(req.query.page) || 1;
    const rawLimit = parseInt(req.query.limit) || 20;
    const page = Math.max(1, rawPage);
    const limit = Math.min(Math.max(1, rawLimit), 100);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim();
    const status = req.query.status;

    const conditions = [];
    const values = [];
    let i = 1;

    if (status && PAYMENT_STATUSES.includes(status)) {
      conditions.push(`p.status = $${i++}`);
      values.push(status);
    }
    if (search) {
      conditions.push(`(
      COALESCE(u.name, '') ILIKE $${i} OR
      COALESCE(u.email, '') ILIKE $${i} OR
      COALESCE(p.gateway_payment_id, '') ILIKE $${i} OR
      COALESCE(p.gateway, '') ILIKE $${i}
    )`);
      values.push(`%${search}%`);
      i++;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     ${whereClause}`,
      values,
    );
    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const pageResult = await pool.query(
      `SELECT
       p.id,
       p.user_id,
       p.amount,
       p.currency,
       p.status,
       p.gateway,
       p.gateway_payment_id,
       p.created_at,
       p.refunded_at,
       p.refunded_by,
       p.metadata,
       u.name AS user_name,
       u.email AS user_email
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    const data = pageResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name || null,
      userEmail: row.user_email || null,
      amount: parseFloat(row.amount) || 0,
      currency: row.currency || "INR",
      status: row.status,
      gateway: row.gateway || null,
      gatewayPaymentId: row.gateway_payment_id || null,
      createdAt: row.created_at,
      refundedAt: row.refunded_at,
      refundedBy: row.refunded_by,
      metadata: row.metadata || {},
    }));

    res.json({
      success: true,
      count: data.length,
      total,
      page,
      limit,
      totalPages,
      data,
    });
  }),
);

// GET /admin/payments/stats — aggregate payment counts
router.get(
  "/stats",
  responseCache("admin-payment-stats", 60),
  asyncHandler(async (req, res) => {
    await ensurePaymentsTable();

    const result = await pool.query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0)::float AS total_revenue,
      COUNT(*) FILTER (WHERE status = 'success')::int AS successful,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30d,
      COUNT(*)::int AS total
    FROM payments
  `);

    res.json({ success: true, data: result.rows[0] || {} });
  }),
);

// POST /admin/payments/:id/refund — mark a payment as refunded (admin per spec, not superAdmin)
router.post(
  "/:id/refund",
  asyncHandler(async (req, res) => {
    await ensurePaymentsTable();

    const paymentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment id" });
    }

    const existing = await pool.query(
      `SELECT id, status, amount, currency, user_id, gateway, gateway_payment_id
     FROM payments WHERE id = $1`,
      [paymentId],
    );
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }
    const payment = existing.rows[0];
    if (payment.status === "refunded") {
      return res
        .status(400)
        .json({ success: false, message: "Payment already refunded" });
    }
    if (payment.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Only successful payments can be refunded",
      });
    }

    const updated = await pool.query(
      `UPDATE payments
       SET status = 'refunded',
           refunded_at = NOW(),
           refunded_by = $2
     WHERE id = $1
     RETURNING *`,
      [paymentId, req.user.id],
    );

    try {
      await dbHelpers.insertOne("audit_logs", {
        action: "refund",
        resource: "payments",
        entity_type: "payments",
        resourceId: paymentId,
        adminId: req.user.id,
        adminEmail: req.user.email,
        adminName: req.user.name,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"],
        details: {
          paymentId,
          userId: payment.user_id,
          amount: parseFloat(payment.amount) || 0,
          currency: payment.currency,
          gateway: payment.gateway,
          gatewayPaymentId: payment.gateway_payment_id,
          previousStatus: payment.status,
          newStatus: "refunded",
        },
        status: "success",
        requestMethod: req.method,
        requestPath: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
    } catch (auditError) {
      logger.error("Audit log insert failed:", auditError);
    }

    res.json({ success: true, data: updated.rows[0] });
  }),
);

// GET /admin/payments/webhooks — list recent webhook events if table exists
router.get(
  "/webhooks",
  asyncHandler(async (req, res) => {
    let events = [];
    try {
      events = await dbHelpers.find("webhook_events", {}, 50);
    } catch (tableError) {
      logger.warn("webhook_events table unavailable:", tableError);
    }
    res.json({ success: true, count: events.length, data: events });
  }),
);

export default router;
