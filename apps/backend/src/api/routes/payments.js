import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { protect, optionalAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { applyPercentageDiscount } from "../../shared/utils/money.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { isFeatureEnabled } from "../../services/SettingsService.js";
import { PLAN_DURATION_DAYS } from "../../services/SubscriptionService.js";
import {
  applyPaymentTax,
  normalizePaymentSettings,
} from "../../shared/utils/payment-settings.js";

const router = express.Router();

// LOW mock prefix: single const for mock-order detection + creation.
const MOCK_ORDER_PREFIX = "order_mock_";

// MED canonical days: normalize hyphen/underscore + case, then look up the
// shared PLAN_DURATION_DAYS map. Returns null for unknown plans (caller 400s).
const resolvePlanDays = (planId) => {
  if (!planId) return null;
  const normalized = String(planId).trim().toLowerCase().replace(/-/g, "_");
  // Legacy checkout slugs ("pro-yearly"/"pro-monthly") map to canonical keys.
  const alias = {
    pro_yearly: "pro_yearly",
    pro_monthly: "pro_monthly",
  };
  const key = alias[normalized] || normalized;
  return PLAN_DURATION_DAYS[key] ?? null;
};

// Helper to get payment settings
const getPaymentSettings = async () => {
  let payment = {};
  try {
    const { getFullSettings } =
      await import("../../services/SettingsService.js");
    const fullSettings = await getFullSettings();
    payment = {
      ...(fullSettings.payment || {}),
      // Preserve compatibility with older saves that kept payment fields at
      // the site_config root instead of under payment.
      razorpayKeyId:
        fullSettings.payment?.razorpayKeyId || fullSettings.razorpayKeyId,
      razorpayKeySecret:
        fullSettings.payment?.razorpayKeySecret ||
        fullSettings.razorpayKeySecret,
      currency: fullSettings.payment?.currency || fullSettings.currency,
      taxEnabled: fullSettings.payment?.taxEnabled ?? fullSettings.taxEnabled,
      taxRate: fullSettings.payment?.taxRate ?? fullSettings.taxRate,
    };
  } catch {
    const settings = await dbHelpers.find("appSettings");
    payment = settings[0]?.payment || {};
  }

  // Support both snake_case (DB) and camelCase (env) variants.
  return {
    ...normalizePaymentSettings({
      ...payment,
      razorpayKeyId: payment.razorpayKeyId || process.env.RAZORPAY_KEY_ID,
      razorpayKeySecret:
        payment.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET,
    }),
  };
};

let adminPaymentsTableReady = false;
const ensureAdminPaymentsTable = async () => {
  // P1 FIX: migration 098 creates table; fallback probes instead of unconditional DDL.
  if (adminPaymentsTableReady) return;
  try {
    await pool.query(`SELECT 1 FROM payments LIMIT 1`);
  } catch {
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
  }
  adminPaymentsTableReady = true;
};

/**
 * Record an admin-facing payment row (payments ledger mirror of transactions).
 * @param {object} args
 * @param {number} args.userId
 * @param {number} args.amount
 * @param {string} [args.currency]
 * @param {string} args.gatewayPaymentId
 * @param {string} [args.orderId]
 * @param {string} [args.planId]
 * @param {object} [args.metadata]
 * @param {string} [args.gateway] - 'razorpay' default; pass 'mock' for mock rows.
 * @param {object} [args.client] - REQUIRED for transactional callers: pass the
 *   active txn client so the insert participates in the caller's transaction.
 *   Falls back to pool only for legacy non-transactional callers.
 */
const recordAdminPayment = async ({
  userId,
  amount,
  currency,
  gatewayPaymentId,
  orderId,
  planId,
  metadata = {},
  gateway,
  client, // optional: reuse transaction client
}) => {
  await ensureAdminPaymentsTable();
  // LOW default-client trap: transactional callers must pass client; warn on
  // pool fallback so cross-ledger atomicity regressions are visible in logs.
  if (!client) {
    console.warn(
      "[payments] recordAdminPayment called without txn client — falling back to pool (non-atomic)",
    );
  }
  const conn = client || pool;
  const gatewayValue = gateway || (metadata?.isMock ? "mock" : "razorpay");
  // UNIQUE guard (no DDL here — migration 143 owns the unique constraint on
  // payments.gateway_payment_id): prefer INSERT ... ON CONFLICT DO NOTHING
  // where the constraint exists; fall back to the SELECT-then-INSERT probe
  // on older schemas where the constraint is absent.
  try {
    await conn.query(
      `INSERT INTO payments
        (user_id, amount, currency, status, gateway, gateway_payment_id, metadata)
       VALUES ($1, $2, $3, 'success', $6, $4, $5::jsonb)
       ON CONFLICT (gateway_payment_id) DO NOTHING`,
      [
        userId,
        amount,
        currency || "INR",
        gatewayPaymentId,
        JSON.stringify({ orderId, planId, ...metadata }),
        gatewayValue,
      ],
    );
    return;
  } catch (conflictErr) {
    // 42P10 (no matching constraint) / 42703 etc. — constraint absent on
    // this schema; fall through to the probe-based guard below.
    if (conflictErr?.code && conflictErr.code !== "42P10") throw conflictErr;
  }
  const existing = await conn.query(
    "SELECT id FROM payments WHERE gateway_payment_id = $1 LIMIT 1",
    [gatewayPaymentId],
  );
  if (existing.rows.length > 0) return;

  await conn.query(
    `INSERT INTO payments
      (user_id, amount, currency, status, gateway, gateway_payment_id, metadata)
     VALUES ($1, $2, $3, 'success', $6, $4, $5::jsonb)`,
    [
      userId,
      amount,
      currency || "INR",
      gatewayPaymentId,
      JSON.stringify({ orderId, planId, ...metadata }),
      gatewayValue,
    ],
  );
};

// Helper to validate coupon
const validateCouponHelper = async (couponCode, amount, userId, planId) => {
  if (!couponCode) return { valid: false, message: "Coupon code required" };

  // Find coupon
  const coupons = await dbHelpers.find("coupons", {
    code: couponCode,
    isActive: true,
  });
  const coupon = coupons[0];
  if (!coupon) return { valid: false, message: "Invalid coupon code" };

  // Check valid dates
  const now = new Date();
  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return { valid: false, message: "Coupon is not active yet" };
  }
  if (coupon.validUntil && new Date(coupon.validUntil) < now) {
    return { valid: false, message: "Coupon has expired" };
  }

  // Check usage limit
  const limit = Number(coupon.usageLimit || 0);
  const count = Number(coupon.usedCount || coupon.usageCount || 0);
  if (limit > 0 && count >= limit) {
    return { valid: false, message: "Coupon usage limit reached" };
  }

  // Check min order value/purchase
  const minVal = Number(coupon.minPurchase || coupon.minOrderValue || 0);
  if (amount < minVal) {
    return {
      valid: false,
      message: `Minimum purchase amount of ${minVal} required`,
    };
  }

  // Check applicable plans
  if (
    coupon.applicablePlans &&
    Array.isArray(coupon.applicablePlans) &&
    coupon.applicablePlans.length > 0
  ) {
    if (!coupon.applicablePlans.includes(planId)) {
      return { valid: false, message: "Coupon is not applicable to this plan" };
    }
  }

  // Check one per user
  if (coupon.onePerUser !== false) {
    const usedBy = Array.isArray(coupon.usedByUsers) ? coupon.usedByUsers : [];
    if (usedBy.includes(userId)) {
      return { valid: false, message: "You have already used this coupon" };
    }
  }

  // Calculate discount — integer paise math to avoid float rounding (M8)
  let discount = 0;
  const val = Number(coupon.discountValue || 0);
  let finalAmount = amount;
  if (coupon.discountType === "percentage") {
    const result = applyPercentageDiscount(
      amount,
      val,
      Number(coupon.maxDiscount || 0),
    );
    discount = result.discountRupees;
    finalAmount = result.finalRupees;
  } else {
    // fixed
    discount = val;
    finalAmount = Math.max(0, amount - val);
  }

  return {
    valid: true,
    coupon,
    discount,
    finalAmount,
  };
};

// @route   POST /api/payments/validate-coupon
// @desc    Validate a coupon code (supports guests previewing prices or authenticated users)
// @access  Public / Optional Auth
router.post(
  "/validate-coupon",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { couponCode, amount, planId } = req.body;
    if (!couponCode || !amount || !planId) {
      return res.status(400).json({
        success: false,
        message: "Coupon code, amount, and plan ID are required",
      });
    }

    const validation = await validateCouponHelper(
      couponCode,
      Number(amount),
      req.user?.id || null,
      planId,
    );
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    res.json({
      success: true,
      discount: validation.discount,
      finalAmount: validation.finalAmount,
      data: {
        code: couponCode,
        discount: validation.discount,
        finalAmount: validation.finalAmount,
      },
    });
  }),
);

// @route   POST /api/payments/apply-coupon (alias for /validate-coupon)
router.post(
  "/apply-coupon",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { couponCode, amount, planId } = req.body;
    if (!couponCode || !amount || !planId) {
      return res.status(400).json({
        success: false,
        message: "Coupon code, amount, and plan ID are required",
      });
    }

    const validation = await validateCouponHelper(
      couponCode,
      Number(amount),
      req.user?.id || null,
      planId,
    );
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    res.json({
      success: true,
      discount: validation.discount,
      finalAmount: validation.finalAmount,
      data: {
        code: couponCode,
        discount: validation.discount,
        finalAmount: validation.finalAmount,
      },
    });
  }),
);

// @route   POST /api/payments/create-order
// @desc    Create a Razorpay order
// @access  Private
router.post("/create-order", protect, async (req, res) => {
  try {
    if (!(await isFeatureEnabled("paymentGateway"))) {
      return res.status(503).json({
        success: false,
        code: "PAYMENT_GATEWAY_DISABLED",
        message: "Payment gateway is currently unavailable.",
      });
    }
    const { planId, amount, couponCode } = req.body;

    if (!planId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Plan ID and amount are required",
      });
    }

    // Validate amount is a positive number within reasonable range
    const parsedAmount = Number(amount);
    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedAmount > 100000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    // Server-side price validation (MED fail-closed): plan row must exist;
    // client amount is never trusted. No client-amount fallback.
    let originalAmount;
    try {
      const plans = await dbHelpers.find("subscription_plans");
      const plan = plans.find(
        (p) => p.id === planId || p.slug === planId || p.plan_id === planId,
      );
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: "Unknown plan. Please select a valid plan.",
        });
      }
      const expectedAmount = Number(plan.price || plan.amount || 0);
      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan price. Please contact support.",
        });
      }
      originalAmount = expectedAmount;
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Unable to validate plan price. Please try again.",
      });
    }

    let finalAmount = originalAmount;
    let discount = 0;

    if (couponCode) {
      const validation = await validateCouponHelper(
        couponCode,
        originalAmount,
        req.user.id,
        planId,
      );
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
        });
      }
      finalAmount = validation.finalAmount;
      discount = validation.discount;
    }

    const { razorpayKeyId, razorpayKeySecret, currency, taxEnabled, taxRate } =
      await getPaymentSettings();
    const isDemoMode = await isFeatureEnabled("demoMode").catch(() => false);

    const taxedAmount = applyPaymentTax(finalAmount, { taxEnabled, taxRate });
    finalAmount = taxedAmount.finalAmount;
    const { taxAmount } = taxedAmount;

    if (!razorpayKeyId || !razorpayKeySecret || isDemoMode) {
      if (process.env.NODE_ENV !== "production") {
        const mockOrderId = `${MOCK_ORDER_PREFIX}${Date.now()}_${req.user.id}`;
        return res.json({
          success: true,
          data: {
            orderId: mockOrderId,
            amount: Math.round(finalAmount * 100),
            currency: currency || "INR",
            keyId: razorpayKeyId || "rzp_test_mock_sandbox",
            taxAmount,
            taxRate: taxedAmount.taxRate,
            isMock: true,
          },
        });
      }
      return res.status(503).json({
        success: false,
        message:
          "Payment gateway not configured. Please contact administrator.",
      });
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const options = {
      amount: Math.round(finalAmount * 100), // amount in the smallest currency unit
      currency: currency,
      receipt: `receipt_order_${Date.now()}_${req.user.id}`,
      notes: {
        planId,
        userId: req.user.id,
        couponCode: couponCode || "",
        discount: String(discount),
        originalAmount: String(originalAmount),
        taxAmount: String(taxAmount),
        taxRate: String(taxedAmount.taxRate),
      },
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId,
        taxAmount,
        taxRate: taxedAmount.taxRate,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Payment processing failed. Please try again.",
    });
  }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment signature
// @access  Private
router.post(
  "/verify",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planId,
        couponCode,
      } = req.body;

      const { razorpayKeySecret } = await getPaymentSettings();
      const isDemoMode = await isFeatureEnabled("demoMode").catch(() => false);

      const isMockOrder = razorpay_order_id?.startsWith(MOCK_ORDER_PREFIX);
      let isSignatureValid = false;
      let verifiedOrderAmount = null;

      if (isMockOrder && process.env.NODE_ENV !== "production") {
        // Mock orders ONLY allowed when NODE_ENV !== production (never in production, even with demoMode)
        console.warn(
          `[Payments] Mock verify accepted for ${razorpay_order_id} user=${req.user.id} demoMode=${isDemoMode}`,
        );
        isSignatureValid = true;
      } else if (razorpayKeySecret) {
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac("sha256", razorpayKeySecret)
          .update(body.toString())
          .digest("hex");

        const expectedBuf = Buffer.from(expectedSignature, "utf8");
        const actualBuf = Buffer.from(razorpay_signature || "", "utf8");
        isSignatureValid =
          expectedBuf.length === actualBuf.length &&
          crypto.timingSafeEqual(expectedBuf, actualBuf);
      }

      if (isSignatureValid) {
        // Payment verified
        //
        // NOTE: the Razorpay order fetch below is network I/O and MUST stay
        // outside the DB transaction. Only the business-logic writes that
        // follow run inside the single advisory-locked transaction.

        // SECURITY: Derive planId AND couponCode from the Razorpay order's
        // notes — NOT from the client-supplied req.body. The order was created
        // by our backend in /create-order with `notes.planId`/`notes.couponCode`
        // set to server-validated values, so notes are authoritative.
        const { razorpayKeyId, razorpayKeySecret } = await getPaymentSettings();
        let authoritativePlanId = planId;
        let authoritativeCouponCode = couponCode || "";
        let orderOriginalAmount = null;

        if (!isMockOrder && razorpayKeyId && razorpayKeySecret) {
          const razorpay = new Razorpay({
            key_id: razorpayKeyId,
            key_secret: razorpayKeySecret,
          });
          try {
            const razorpayOrder =
              await razorpay.orders.fetch(razorpay_order_id);
            verifiedOrderAmount = Number(razorpayOrder.amount || 0) / 100;
            authoritativePlanId = razorpayOrder.notes?.planId || planId;
            // HIGH coupon binding: coupon comes from fetched order notes.
            authoritativeCouponCode = razorpayOrder.notes?.couponCode || "";
            orderOriginalAmount = razorpayOrder.notes?.originalAmount
              ? Number(razorpayOrder.notes.originalAmount)
              : null;
            // Reject client/order coupon mismatch (binding).
            const bodyCoupon = (couponCode || "").trim();
            const orderCoupon = (authoritativeCouponCode || "").trim();
            if (bodyCoupon !== orderCoupon) {
              return res.status(400).json({
                success: false,
                message:
                  "Coupon does not match the server order. Please restart checkout.",
              });
            }
            // Validate the captured amount against the exact server-created
            // order amount, including coupons and tax.
            const expectedAmountPaise = Number(razorpayOrder.amount || 0);
            if (
              razorpayOrder.amount_paid > 0 &&
              razorpayOrder.amount_paid !== expectedAmountPaise
            ) {
              console.error(
                `[Payments] Amount mismatch: order ${razorpay_order_id} paid ${razorpayOrder.amount_paid} paise, expected ${expectedAmountPaise} paise`,
              );
              return res.status(400).json({
                success: false,
                message:
                  "Payment amount does not match the server order. Please contact support.",
              });
            }
          } catch (orderFetchErr) {
            console.error(
              "[Payments] Failed to fetch order for plan verification:",
              orderFetchErr.message,
            );
            // Fail-closed: don't grant Pro if we can't verify the plan from the order.
            return res.status(400).json({
              success: false,
              message:
                "Unable to verify payment details. Please contact support.",
            });
          }
        }

        // Calculate expiry based on the AUTHORITATIVE planId (from Razorpay order).
        // Early renewal extends from the existing expiry (no lost days):
        // expiry = max(now, existing) + plan days (JS max; SQL equivalent is
        // GREATEST(NOW(), pro_expiry) + make_interval(days => $n)).
        // MED canonical days: shared PLAN_DURATION_DAYS; unknown plan → 400.
        const expiryDays = resolvePlanDays(authoritativePlanId);
        if (!expiryDays) {
          return res.status(400).json({
            success: false,
            message: "Unknown plan. Please contact support.",
          });
        }

        // P1 FIX: don't trust client amount; fallback to server-expected price when Razorpay fetch unavailable (mock/dev only)
        let fallbackAmount = expiryDays === 365 ? 999 : 99;
        try {
          const planRows = await dbHelpers.find("subscription_plans");
          const fbPlan = planRows.find(
            (p) => (p.plan_id || p.planId || p.id) === authoritativePlanId,
          );
          if (fbPlan)
            fallbackAmount = Number(
              fbPlan.price || fbPlan.amount || fallbackAmount,
            );
        } catch (_e) {
          void _e;
        }
        const transactionAmount =
          verifiedOrderAmount != null ? verifiedOrderAmount : fallbackAmount;

        // Single advisory-locked transaction for ALL fulfillment writes.
        // Concurrent verifies for the same Razorpay order serialize on the
        // pg_advisory_xact_lock (mirrors the webhook guard) so double-submit
        // / retry replay cannot double-grant Pro or double-count coupons.
        // Idempotency: re-check transactions.order_id INSIDE the lock.
        // UNIQUE guard (no DDL here — migration 143 owns unique constraints
        // on transactions order/payment ids): the in-txn SELECT probe + the
        // advisory lock together make replay safe on schemas with or without
        // the constraint.
        const verifyClient = await pool.connect();
        let verifyUser = null;
        let verifyProExpiry = null;
        try {
          await verifyClient.query("BEGIN");
          await verifyClient.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            [String(razorpay_order_id || "")],
          );

          // HIGH cross-path: probe BOTH order_id AND payment_id inside the
          // lock; EITHER hit = replay (verify↔webhook race safe).
          const alreadyByOrder = await verifyClient.query(
            `SELECT id, order_id, payment_id, amount, currency, status, plan_id FROM transactions WHERE order_id = $1 LIMIT 1`,
            [razorpay_order_id],
          );
          const alreadyByPayment = razorpay_payment_id
            ? await verifyClient.query(
                `SELECT id, order_id, payment_id, amount, currency, status, plan_id FROM transactions WHERE payment_id = $1 LIMIT 1`,
                [razorpay_payment_id],
              )
            : { rows: [] };
          const existingReplay =
            alreadyByOrder.rows[0] || alreadyByPayment.rows[0] || null;
          if (existingReplay) {
            // MED replay body: return existing txn fields + current proExpiry.
            const replayUser = await dbHelpers.findById(
              "users",
              req.user.id,
              null,
              verifyClient,
            );
            await verifyClient.query("ROLLBACK");
            const currentExpiry =
              replayUser?.proExpiry || replayUser?.pro_expiry || null;
            return res.json({
              success: true,
              message: "Payment already verified",
              data: {
                orderId: existingReplay.order_id || razorpay_order_id,
                paymentId: existingReplay.payment_id || razorpay_payment_id,
                amount: Number(existingReplay.amount) || transactionAmount,
                currency: existingReplay.currency || "INR",
                planId: existingReplay.plan_id || authoritativePlanId,
                status: existingReplay.status,
                transactionId: existingReplay.id,
                proExpiry: currentExpiry,
              },
            });
          }

          // HIGH coupon binding (re-validate inside txn): re-run helper
          // against the authoritative coupon; reject mismatch/invalid 400.
          if (authoritativeCouponCode) {
            const couponCheck = await validateCouponHelper(
              authoritativeCouponCode,
              Number(
                orderOriginalAmount ?? verifiedOrderAmount ?? transactionAmount,
              ),
              req.user.id,
              authoritativePlanId,
            );
            if (!couponCheck.valid) {
              await verifyClient.query("ROLLBACK");
              return res.status(400).json({
                success: false,
                message: couponCheck.message || "Invalid coupon for this order",
              });
            }
          }

          // Update user status
          verifyUser = await dbHelpers.findById(
            "users",
            req.user.id,
            null,
            verifyClient,
          );
          if (!verifyUser) {
            await verifyClient.query("ROLLBACK");
            return res
              .status(404)
              .json({ success: false, message: "User not found" });
          }

          const existingExpiry = new Date(
            verifyUser.proExpiry || verifyUser.pro_expiry || 0,
          );
          const expiryBase =
            !Number.isNaN(existingExpiry.getTime()) &&
            existingExpiry > new Date()
              ? existingExpiry
              : new Date();
          verifyProExpiry = new Date(expiryBase);
          verifyProExpiry.setDate(verifyProExpiry.getDate() + expiryDays);

          await dbHelpers.updateById(
            "users",
            req.user.id,
            {
              isProUser: true,
              proExpiry: verifyProExpiry.toISOString(),
            },
            verifyClient,
          );

          // Record coupon usage if applied (authoritative coupon from order notes)
          // Atomic coupon increment: single UPDATE (used_count = used_count + 1)
          // avoids the lost-update race of read-modify-write under concurrency.
          // Same atomic shape as the webhook handler below.
          if (authoritativeCouponCode) {
            try {
              await verifyClient.query(
                `UPDATE coupons
                 SET used_count = COALESCE(used_count, 0) + 1,
                     used_by_users = CASE
                       WHEN used_by_users IS NULL THEN to_jsonb(ARRAY[$2::text])
                       WHEN used_by_users::jsonb ? $2 THEN used_by_users
                       ELSE used_by_users::jsonb || to_jsonb($2::text)
                     END,
                     updated_at = NOW()
                 WHERE code = $1 AND is_active = true
                   AND NOT (used_by_users::jsonb ? $2)`,
                [authoritativeCouponCode, String(req.user.id)],
              );
            } catch (couponErr) {
              console.error(
                "Error updating coupon usage in verify:",
                couponErr.message,
              );
            }
          }

          // Record the legacy transaction and the admin-facing payment record.
          try {
            await dbHelpers.insertOne(
              "transactions",
              {
                userId: req.user.id,
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                amount: transactionAmount,
                currency: "INR",
                status: "completed",
                planId: authoritativePlanId,
                createdAt: new Date().toISOString(),
              },
              verifyClient,
            );
          } catch (txnErr) {
            console.error(
              "Error recording transaction in verify:",
              txnErr.message,
            );
          }
          try {
            await recordAdminPayment({
              userId: req.user.id,
              amount: transactionAmount,
              currency: "INR",
              gatewayPaymentId: razorpay_payment_id,
              orderId: razorpay_order_id,
              planId: authoritativePlanId,
              gateway: isMockOrder ? "mock" : "razorpay",
              metadata: {
                couponCode: authoritativeCouponCode || null,
                source: isMockOrder ? "mock_verify" : "verify",
                isMock: isMockOrder || false,
              },
              client: verifyClient,
            });
          } catch (paymentErr) {
            console.error(
              "Error recording admin payment in verify:",
              paymentErr.message,
            );
          }

          await verifyClient.query("COMMIT");
        } catch (verifyTxnErr) {
          try {
            await verifyClient.query("ROLLBACK");
          } catch {
            // rollback best-effort; original error is what matters
          }
          throw verifyTxnErr;
        } finally {
          verifyClient.release();
        }

        const user = verifyUser;
        const proExpiry = verifyProExpiry;

        res.json({
          success: true,
          message: "Payment verified successfully and Pro status updated",
          data: {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount: transactionAmount,
            currency: "INR",
            planId: authoritativePlanId,
            proExpiry: proExpiry.toISOString(),
          },
        });

        // P0 FIX: send receipt email via correct EmailService API (supports queuing)
        // Fire-and-forget after response to avoid blocking verify latency.
        (async () => {
          try {
            const { default: emailService } =
              await import("../../services/EmailService.js");
            const receiptHtml = emailService.getHtmlWrapper
              ? emailService.getHtmlWrapper(
                  "Payment Confirmed — Trstprep Pro Pass",
                  `
                  <p>Hi ${user.name || user.email},</p>
                  <p>Your payment has been confirmed and <strong>${authoritativePlanId === "pro-yearly" ? "Pro Yearly" : "Pro Monthly"}</strong> is now active.</p>
                  <div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #e5e7eb;">
                    <p style="margin:4px 0"><strong>Order ID:</strong> ${razorpay_order_id}</p>
                    <p style="margin:4px 0"><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
                    <p style="margin:4px 0"><strong>Amount Paid:</strong> ₹${transactionAmount}</p>
                    <p style="margin:4px 0"><strong>Plan:</strong> ${authoritativePlanId}</p>
                    <p style="margin:4px 0"><strong>Valid Until:</strong> ${proExpiry.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
                  </div>
                  <p>Keep this email as your payment receipt. You can also view your transactions from your profile.</p>
                  <p>Thank you for choosing Trstprep!</p>
                  `,
                  {
                    text: "Go to Dashboard",
                    url: `${process.env.FRONTEND_URL || "https://trstprep.com"}/dashboard`,
                  },
                )
              : `
                  <h2>Payment Confirmed</h2>
                  <p>Order: ${razorpay_order_id} | Payment: ${razorpay_payment_id} | Amount: ₹${transactionAmount} | Plan: ${authoritativePlanId}</p>
                  <p>Expiry: ${proExpiry.toLocaleDateString()}</p>
                  <p>Thank you for your purchase!</p>
                `;

            await emailService.send(
              user.email,
              `Payment Confirmed — ₹${transactionAmount} — Trstprep Pro Pass`,
              receiptHtml,
            );
          } catch (e) {
            console.error("Payment confirmation email error:", e.message);
          }
        })();
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid signature",
        });
      }
    } catch (error) {
      console.error("Verify payment error:", error);
      res.status(500).json({
        success: false,
        message: "Payment verification failed. Please try again.",
      });
    }
  }),
);

// @route   POST /api/payments/webhook
// @desc    Handle Razorpay webhook for payment confirmation
// @access  Public (but verify signature)
// P0 FIX: raw body is now provided by app-port5001.js before global JSON parser.
// Router-level raw parser kept as fallback for direct mounting; handles both Buffer and pre-parsed cases.
router.post(
  "/webhook",
  (req, res, next) => {
    // If app-level raw parser already ran, req.body is Buffer
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString("utf8");
      try {
        req.body = JSON.parse(req.rawBody);
      } catch (e) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON" });
      }
      return next();
    }
    // Fallback: body already parsed by express.json (e.g., tests) — re-serialize deterministically
    if (
      req.body &&
      typeof req.body === "object" &&
      !Buffer.isBuffer(req.body)
    ) {
      req.rawBody = JSON.stringify(req.body);
      return next();
    }
    // Legacy path: still Buffer-like
    try {
      req.rawBody = (req.body || "").toString();
      req.body = JSON.parse(req.rawBody);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid JSON" });
    }
    next();
  },
  async (req, res) => {
    // Helper: persist webhook event for admin audit (best-effort, never blocks response)
    const persistWebhookEvent = async ({
      event,
      gatewayPaymentId,
      orderId,
      status,
      error,
      signatureValid,
    }) => {
      try {
        // CREATE TABLE on the hot path contends under retry storms — run it
        // once per process (a failure leaves the flag unset so the next
        // request retries the DDL instead of skipping it forever).
        if (!persistWebhookEvent.tableEnsured) {
          await pool.query(
            `CREATE TABLE IF NOT EXISTS webhook_events (
              id SERIAL PRIMARY KEY,
              gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay',
              event VARCHAR(100) NOT NULL,
              gateway_payment_id VARCHAR(255),
              order_id VARCHAR(255),
              status VARCHAR(50) NOT NULL DEFAULT 'received',
              payload JSONB NOT NULL DEFAULT '{}'::jsonb,
              headers JSONB NOT NULL DEFAULT '{}'::jsonb,
              signature_valid BOOLEAN NOT NULL DEFAULT true,
              error TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
          );
          persistWebhookEvent.tableEnsured = true;
        }
        await pool.query(
          `INSERT INTO webhook_events (gateway, event, gateway_payment_id, order_id, status, payload, headers, signature_valid, error)
           VALUES ('razorpay', $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
          [
            event || req.body?.event || "unknown",
            gatewayPaymentId || null,
            orderId || null,
            status || "received",
            JSON.stringify(req.body || {}),
            JSON.stringify({
              "x-razorpay-signature":
                req.headers["x-razorpay-signature"] || null,
            }),
            signatureValid !== false,
            error || null,
          ],
        );
      } catch (e) {
        // never fail webhook on audit write
        console.warn("[webhook_events] persist failed:", e.message);
      }
    };

    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) {
        console.error("Razorpay webhook secret not configured");
        await persistWebhookEvent({
          status: "failed",
          error: "Webhook secret not configured",
          signatureValid: false,
        });
        return res
          .status(500)
          .json({ success: false, message: "Webhook not configured" });
      }

      const rawBody = req.rawBody;

      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      const razorpaySignature = req.headers["x-razorpay-signature"];
      const expectedBuf = Buffer.from(expectedSignature, "utf8");
      const actualBuf = Buffer.from(razorpaySignature || "", "utf8");
      if (
        expectedBuf.length !== actualBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, actualBuf)
      ) {
        await persistWebhookEvent({
          status: "failed",
          error: "Invalid signature",
          signatureValid: false,
        });
        return res
          .status(400)
          .json({ success: false, message: "Invalid signature" });
      }

      const event = req.body.event;
      const paymentEntity = req.body.payload?.payment?.entity || {};
      // Persist received event early (before business logic) so admin sees delivery even if downstream fails
      await persistWebhookEvent({
        event,
        gatewayPaymentId:
          paymentEntity.id ||
          req.body?.payload?.refund?.entity?.payment_id ||
          null,
        orderId: paymentEntity.order_id || null,
        status: "received",
        signatureValid: true,
      });

      if (event === "payment.captured") {
        // Payment was successfully captured
        const orderId = paymentEntity.order_id;
        const userId = paymentEntity.notes?.userId;
        const planId = paymentEntity.notes?.planId;
        const couponCode = paymentEntity.notes?.couponCode;

        if (userId) {
          const gatewayPaymentId = paymentEntity.id;

          const receipt = await dbHelpers.withTransaction(async (client) => {
            // Idempotency guard: pg advisory lock keyed on the gateway payment
            // id serializes concurrent webhooks for the SAME payment (Razorpay
            // retries on delivery failure). A row lock cannot do this — there
            // is no row to lock on first delivery, and payment_id has no
            // unique constraint, so two concurrent retries could both pass a
            // SELECT ... FOR UPDATE guard and double-process.
            const lockKey = crypto
              .createHash("sha256")
              .update(`razorpay:payment:${gatewayPaymentId}`)
              .digest()
              // Signed 64-bit read: pg_advisory_xact_lock(bigint) takes a
              // SIGNED int8 (max 2^63-1). An unsigned read overflows the
              // parameter ~50% of the time ("bigint out of range"), which
              // would 500 deterministic halves of all webhooks.
              .readBigInt64BE(0);
            await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

            // HIGH cross-path: probe BOTH payment_id AND order_id inside the
            // lock; EITHER hit = replay (verify↔webhook race safe). Inserts
            // below keep writing both columns.
            const byPayment = await client.query(
              `SELECT id FROM transactions WHERE payment_id = $1 LIMIT 1`,
              [gatewayPaymentId],
            );
            // UNIQUE guard (no DDL here — migration 143 owns unique
            // constraints on transactions order/payment ids): the advisory
            // lock above + these in-txn probes make replay safe with or
            // without the constraint.
            if (byPayment.rows.length > 0) {
              return; // Already processed — skip inside transaction
            }
            if (orderId) {
              const byOrder = await client.query(
                `SELECT id FROM transactions WHERE order_id = $1 LIMIT 1`,
                [orderId],
              );
              if (byOrder.rows.length > 0) {
                return; // Already processed via verify path — skip
              }
            }

            // Update user status
            const user = await dbHelpers.findById(
              "users",
              userId,
              null,
              client,
            );
            if (!user) return;

            // MED canonical days: shared PLAN_DURATION_DAYS; unknown → no grant.
            const expiryDays = resolvePlanDays(planId);
            if (!expiryDays) {
              console.warn(
                `[webhook] unknown planId ${planId} for payment ${gatewayPaymentId} — skipping Pro grant`,
              );
              return;
            }

            // Early renewal extends from the existing expiry (no lost days):
            // expiry = max(now, existing) + plan days (JS max; SQL
            // equivalent is GREATEST(NOW(), pro_expiry)).
            const existingExpiry = new Date(
              user.proExpiry || user.pro_expiry || 0,
            );
            const expiryBase =
              !Number.isNaN(existingExpiry.getTime()) &&
              existingExpiry > new Date()
                ? existingExpiry
                : new Date();
            const proExpiry = new Date(expiryBase);
            proExpiry.setDate(proExpiry.getDate() + expiryDays);

            await dbHelpers.updateById(
              "users",
              userId,
              {
                isProUser: true,
                proExpiry: proExpiry.toISOString(),
              },
              client,
            );

            // Record coupon usage if applied — atomic single UPDATE (same as
            // /verify): safe under verify+webhook races, no lost updates.
            if (couponCode) {
              try {
                await client.query(
                  `UPDATE coupons
                   SET used_count = COALESCE(used_count, 0) + 1,
                       used_by_users = CASE
                         WHEN used_by_users IS NULL THEN to_jsonb(ARRAY[$2::text])
                         WHEN used_by_users::jsonb ? $2 THEN used_by_users
                         ELSE used_by_users::jsonb || to_jsonb($2::text)
                       END,
                       updated_at = NOW()
                   WHERE code = $1 AND is_active = true
                     AND NOT (used_by_users::jsonb ? $2)`,
                  [couponCode, String(userId)],
                );
              } catch (couponErr) {
                console.error(
                  "Error updating coupon usage in webhook:",
                  couponErr.message,
                );
              }
            }

            // Record transaction
            await dbHelpers.insertOne(
              "transactions",
              {
                userId,
                orderId,
                paymentId: gatewayPaymentId,
                amount: paymentEntity.amount / 100,
                currency: paymentEntity.currency,
                status: "completed",
                planId,
                createdAt: new Date().toISOString(),
              },
              client,
            );

            await recordAdminPayment({
              userId,
              amount: paymentEntity.amount / 100,
              currency: paymentEntity.currency,
              gatewayPaymentId,
              orderId,
              planId,
              metadata: { couponCode: couponCode || null, source: "webhook" },
              client,
            });

            // Return receipt context — the email is sent AFTER commit (below)
            // so SMTP I/O never holds the advisory lock / transaction open.
            return {
              receiptEmail: user?.email || null,
              receiptName: user?.name || user?.email || null,
              receiptPlanId: planId,
              receiptOrderId: orderId,
              receiptPaymentId: gatewayPaymentId,
              receiptAmount: paymentEntity.amount / 100,
            };
          });

          // Post-commit receipt email (best-effort): SMTP I/O must never hold
          // the advisory lock / transaction open under a retry storm.
          try {
            if (receipt?.receiptEmail) {
              const { default: emailService } =
                await import("../../services/EmailService.js");
              const html = emailService.getHtmlWrapper
                ? emailService.getHtmlWrapper(
                    "Payment Confirmed — Trstprep Pro Pass",
                    `<p>Hi ${receipt.receiptName},</p><p>Your payment was confirmed via webhook and <strong>${receipt.receiptPlanId || "Pro"}</strong> is active.</p><div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #e5e7eb;"><p><strong>Order:</strong> ${receipt.receiptOrderId}</p><p><strong>Payment:</strong> ${receipt.receiptPaymentId}</p><p><strong>Amount:</strong> ₹${receipt.receiptAmount}</p></div><p>Keep this as your receipt.</p>`,
                    {
                      text: "Go to Dashboard",
                      url: `${process.env.FRONTEND_URL || "https://trstprep.com"}/dashboard`,
                    },
                  )
                : `<p>Payment confirmed: ${receipt.receiptOrderId} / ${receipt.receiptPaymentId} ₹${receipt.receiptAmount}</p>`;
              await emailService
                .send(
                  receipt.receiptEmail,
                  `Payment Confirmed — ₹${receipt.receiptAmount} — Trstprep`,
                  html,
                )
                .catch(() => {});
            }
          } catch {
            /* receipt mail is non-fatal */
          }
        }
      } else if (event === "refund.created" || event === "refund.processed") {
        const refundEntity = req.body.payload?.refund?.entity || {};
        const gatewayPaymentId = refundEntity.payment_id || paymentEntity?.id;
        const refundId = refundEntity.id;

        if (gatewayPaymentId) {
          // HIGH webhook refund: payment-key advisory lock + in-txn re-probe
          // + all 3 writes (transactions + users + payments) via txn client.
          await dbHelpers.withTransaction(async (client) => {
            await client.query(
              "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
              [`refund:payment:${gatewayPaymentId}`],
            );
            // In-txn re-probe (no stale outside read).
            const probe = await client.query(
              `SELECT id, user_id, amount, status FROM transactions WHERE payment_id = $1 LIMIT 1`,
              [gatewayPaymentId],
            );
            const txRow = probe.rows[0] || null;
            if (!txRow) return;
            if (txRow.status === "refunded") return;

            // HIGH partials: full (>=captured) revokes Pro; partial keeps Pro.
            const capturedPaise = Math.round(Number(txRow.amount || 0) * 100);
            const refundPaise = Number(refundEntity.amount || 0);
            const isFull =
              !refundPaise || capturedPaise <= 0
                ? true
                : refundPaise >= capturedPaise;
            const refundAmountRupees =
              refundPaise > 0 ? refundPaise / 100 : Number(txRow.amount) || 0;

            // Resolve internal id for dbHelpers (accepts numeric id).
            let fullTx = null;
            try {
              fullTx = await dbHelpers.findOne("transactions", {
                paymentId: gatewayPaymentId,
              });
            } catch {
              fullTx = null;
            }
            const txId = fullTx?.id || fullTx?._id || txRow.id;
            await dbHelpers.updateById(
              "transactions",
              txId,
              {
                status: isFull ? "refunded" : "partially_refunded",
                refundId: refundId || null,
                refundAmount: refundAmountRupees,
                updatedAt: new Date().toISOString(),
              },
              client,
            );

            if (txRow.user_id) {
              if (isFull) {
                // MED webhook otherSuccess: mirror admin guard — only revoke
                // when no other successful payment remains.
                const otherSuccess = await client.query(
                  `SELECT 1 FROM payments WHERE user_id=$1 AND status='success' LIMIT 1`,
                  [txRow.user_id],
                );
                if (otherSuccess.rows.length === 0) {
                  await dbHelpers.updateById(
                    "users",
                    txRow.user_id,
                    {
                      isProUser: false,
                      proExpiry: null,
                    },
                    client,
                  );
                }
              }
              // Partial → keep Pro + note stored in payments metadata below.
            }
            // P0 FIX: keep payments ledger in sync on webhook refund (txn client).
            await client.query(
              `UPDATE payments SET status=$2, refunded_at=NOW(),
                 metadata = COALESCE(metadata,'{}'::jsonb) || $3::jsonb
               WHERE gateway_payment_id=$1 AND status != 'refunded'`,
              [
                gatewayPaymentId,
                isFull ? "refunded" : "partially_refunded",
                JSON.stringify({
                  refund: {
                    refundId: refundId || null,
                    refundAmount: refundAmountRupees,
                    isPartial: !isFull,
                    source: "webhook",
                    refundedAt: new Date().toISOString(),
                  },
                }),
              ],
            );
          });
        }
      }

      // Update webhook_events status to processed (best-effort)
      try {
        const evt = req.body.event;
        const payId =
          req.body?.payload?.payment?.entity?.id ||
          req.body?.payload?.refund?.entity?.payment_id ||
          null;
        await pool.query(
          `UPDATE webhook_events SET status='processed' WHERE gateway_payment_id=$1 AND event=$2 AND status='received'`,
          [payId, evt],
        );
      } catch (_e) {
        void _e;
      }
      res.json({ success: true, message: "Webhook processed" });
    } catch (error) {
      console.error("Webhook error:", error);
      try {
        await pool.query(
          `INSERT INTO webhook_events (gateway, event, status, payload, headers, signature_valid, error)
           VALUES ('razorpay', $1, 'failed', $2::jsonb, '{}'::jsonb, true, $3)`,
          [
            req.body?.event || "unknown",
            JSON.stringify(req.body || {}),
            error.message,
          ],
        );
      } catch (_e) {
        void _e;
      }
      res
        .status(500)
        .json({ success: false, message: "Webhook processing failed" });
    }
  },
);

// P0 FIX: User transaction history + receipt download
router.get(
  "/my-transactions",
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    try {
      const rows = await dbHelpers.find("transactions", { userId }, limit);
      // sort by createdAt desc and apply offset manually (dbHelpers find no offset)
      rows.sort(
        (a, b) =>
          new Date(b.createdAt || b.created_at) -
          new Date(a.createdAt || a.created_at),
      );
      const sliced = rows.slice(offset, offset + limit);
      // enrich with payments metadata if available
      const enriched = sliced.map((r) => ({
        id: r.id || r._id,
        orderId: r.orderId || r.order_id,
        paymentId: r.paymentId || r.payment_id,
        amount: Number(r.amount) || 0,
        currency: r.currency || "INR",
        status: r.status || "completed",
        planId: r.planId || r.plan_id,
        createdAt: r.createdAt || r.created_at,
        refundId: r.refundId || r.refund_id || null,
      }));
      res.json({ success: true, count: enriched.length, data: enriched });
    } catch (e) {
      // fallback raw query
      try {
        const result = await pool.query(
          `SELECT id, user_id, order_id, payment_id, amount, currency, status, plan_id, created_at FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [userId, limit, offset],
        );
        const data = result.rows.map((r) => ({
          id: r.id,
          orderId: r.order_id,
          paymentId: r.payment_id,
          amount: parseFloat(r.amount) || 0,
          currency: r.currency || "INR",
          status: r.status,
          planId: r.plan_id,
          createdAt: r.created_at,
        }));
        res.json({ success: true, count: data.length, data });
      } catch (err) {
        res
          .status(500)
          .json({ success: false, message: sanitizeErrorMessage(err) });
      }
    }
  }),
);

router.get(
  "/receipt/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const orderId = req.params.orderId;
    let txn = null;
    try {
      txn = await dbHelpers.findOne("transactions", { orderId, userId });
    } catch (_e) {
      void _e;
    }
    if (!txn) {
      try {
        const r = await pool.query(
          `SELECT id, user_id, order_id, payment_id, amount, currency, status, plan_id, created_at FROM transactions WHERE order_id=$1 AND user_id=$2 LIMIT 1`,
          [orderId, userId],
        );
        txn = r.rows[0] || null;
      } catch (_e) {
        void _e;
      }
    }
    if (!txn)
      return res
        .status(404)
        .json({ success: false, message: "Receipt not found" });
    // also fetch user
    let user = null;
    try {
      user = await dbHelpers.findById("users", userId);
    } catch (_e) {
      void _e;
    }
    res.json({
      success: true,
      data: {
        receiptNo: `TRST-${txn.id || txn._id}-${String(
          txn.orderId || txn.order_id,
        )
          .slice(-6)
          .toUpperCase()}`,
        orderId: txn.orderId || txn.order_id,
        paymentId: txn.paymentId || txn.payment_id,
        amount: Number(txn.amount) || 0,
        currency: txn.currency || "INR",
        status: txn.status,
        planId: txn.planId || txn.plan_id,
        createdAt: txn.createdAt || txn.created_at,
        user: user ? { name: user.name, email: user.email } : null,
      },
    });
  }),
);

export default router;
