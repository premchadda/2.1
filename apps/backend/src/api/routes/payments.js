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
import {
  applyPaymentTax,
  normalizePaymentSettings,
} from "../../shared/utils/payment-settings.js";

const router = express.Router();

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

const recordAdminPayment = async ({
  userId,
  amount,
  currency,
  gatewayPaymentId,
  orderId,
  planId,
  metadata = {},
}) => {
  await ensureAdminPaymentsTable();
  const existing = await pool.query(
    "SELECT id FROM payments WHERE gateway_payment_id = $1 LIMIT 1",
    [gatewayPaymentId],
  );
  if (existing.rows.length > 0) return;

  await pool.query(
    `INSERT INTO payments
      (user_id, amount, currency, status, gateway, gateway_payment_id, metadata)
     VALUES ($1, $2, $3, 'success', 'razorpay', $4, $5::jsonb)`,
    [
      userId,
      amount,
      currency || "INR",
      gatewayPaymentId,
      JSON.stringify({ orderId, planId, ...metadata }),
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

    // Server-side price validation: look up the plan and verify amount matches
    let originalAmount = parsedAmount;
    try {
      const plans = await dbHelpers.find("subscription_plans");
      const plan = plans.find(
        (p) => p.id === planId || p.slug === planId || p.plan_id === planId,
      );
      if (plan) {
        const expectedAmount = Number(plan.price || plan.amount || 0);
        if (expectedAmount > 0) {
          originalAmount = expectedAmount;
        }
      }
    } catch (e) {
      // If plans table doesn't exist, continue with client amount (fallback)
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
        const mockOrderId = `order_mock_${Date.now()}_${req.user.id}`;
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

      const isMockOrder = razorpay_order_id?.startsWith("order_mock_");
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

        // Idempotency guard: if we have already recorded a transaction for this
        // Razorpay order, the user has already been upgraded. Replay of the same
        // verified signature (intentional or accidental) must NOT grant Pro a
        // second time or re-increment coupon usage. Mirrors the guard on the
        // webhook handler below.
        const alreadyProcessed = await dbHelpers.findOne("transactions", {
          orderId: razorpay_order_id,
        });
        if (alreadyProcessed) {
          return res.json({
            success: true,
            message: "Payment already verified",
            data: {
              proExpiry:
                alreadyProcessed.planId === "pro-yearly"
                  ? undefined
                  : undefined,
            },
          });
        }

        // SECURITY: Derive planId from the Razorpay order's notes — NOT from the
        // client-supplied req.body.planId. The order was created by our backend in
        // /create-order with `notes.planId` set to the server-validated value, so
        // it is authoritative.
        const { razorpayKeyId, razorpayKeySecret } = await getPaymentSettings();
        let authoritativePlanId = planId;

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

        // Update user status
        const user = await dbHelpers.findById("users", req.user.id);
        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        // Calculate expiry based on the AUTHORITATIVE planId (from Razorpay order)
        let expiryDays = 30;
        if (authoritativePlanId === "pro-yearly") expiryDays = 365;

        const proExpiry = new Date();
        proExpiry.setDate(proExpiry.getDate() + expiryDays);

        await dbHelpers.updateById("users", req.user.id, {
          isProUser: true,
          proExpiry: proExpiry.toISOString(),
        });

        // Record coupon usage if applied
        if (couponCode) {
          try {
            const coupons = await dbHelpers.find("coupons", {
              code: couponCode,
              isActive: true,
            });
            const coupon = coupons[0];
            if (coupon) {
              const usedBy = Array.isArray(coupon.usedByUsers)
                ? coupon.usedByUsers
                : [];
              if (!usedBy.includes(req.user.id)) {
                usedBy.push(req.user.id);
                await dbHelpers.updateById("coupons", coupon.id || coupon._id, {
                  usedCount: Number(coupon.usedCount || 0) + 1,
                  usedByUsers: usedBy,
                });
              }
            }
          } catch (couponErr) {
            console.error(
              "Error updating coupon usage in verify:",
              couponErr.message,
            );
          }
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

        // Record the legacy transaction and the admin-facing payment record.
        try {
          await dbHelpers.insertOne("transactions", {
            userId: req.user.id,
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount: transactionAmount,
            currency: "INR",
            status: "completed",
            planId: authoritativePlanId,
            createdAt: new Date().toISOString(),
          });
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
            metadata: {
              couponCode: couponCode || null,
              source: isMockOrder ? "mock_verify" : "verify",
              isMock: isMockOrder || false,
            },
          });
        } catch (paymentErr) {
          console.error(
            "Error recording admin payment in verify:",
            paymentErr.message,
          );
        }

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

            const method =
              typeof emailService.send === "function" ? "send" : "sendDirect";
            await emailService[method](
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

          // Idempotency guard: skip if this gateway payment was already processed
          // (Razorpay retries webhooks on delivery failure).
          const alreadyProcessed = await dbHelpers.findOne("transactions", {
            paymentId: gatewayPaymentId,
          });
          if (alreadyProcessed) {
            return res.json({
              success: true,
              message: "Webhook already processed",
            });
          }

          await dbHelpers.withTransaction(async (client) => {
            // Update user status
            const user = await dbHelpers.findById("users", userId);
            if (!user) return;

            let expiryDays = 30;
            if (planId === "pro-yearly") expiryDays = 365;

            const proExpiry = new Date();
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

            // Record coupon usage if applied
            if (couponCode) {
              try {
                const coupons = await dbHelpers.find("coupons", {
                  code: couponCode,
                  isActive: true,
                });
                const coupon = coupons[0];
                if (coupon) {
                  const usedBy = Array.isArray(coupon.usedByUsers)
                    ? coupon.usedByUsers
                    : [];
                  if (!usedBy.includes(userId)) {
                    usedBy.push(userId);
                    await dbHelpers.updateById(
                      "coupons",
                      coupon.id || coupon._id,
                      {
                        usedCount: Number(coupon.usedCount || 0) + 1,
                        usedByUsers: usedBy,
                      },
                      client,
                    );
                  }
                }
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
            });

            // P0 FIX: webhook receipt email (was missing)
            try {
              const userRec = await dbHelpers.findById("users", userId);
              if (userRec?.email) {
                const { default: emailService } =
                  await import("../../services/EmailService.js");
                let expiryForEmail = new Date();
                expiryForEmail.setDate(
                  expiryForEmail.getDate() +
                    (planId === "pro-yearly" ? 365 : 30),
                );
                const html = emailService.getHtmlWrapper
                  ? emailService.getHtmlWrapper(
                      "Payment Confirmed — Trstprep Pro Pass",
                      `<p>Hi ${userRec.name || userRec.email},</p><p>Your payment was confirmed via webhook and <strong>${planId || "Pro"}</strong> is active.</p><div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #e5e7eb;"><p><strong>Order:</strong> ${orderId}</p><p><strong>Payment:</strong> ${gatewayPaymentId}</p><p><strong>Amount:</strong> ₹${paymentEntity.amount / 100}</p></div><p>Keep this as your receipt.</p>`,
                      {
                        text: "Go to Dashboard",
                        url: `${process.env.FRONTEND_URL || "https://trstprep.com"}/dashboard`,
                      },
                    )
                  : `<p>Payment confirmed: ${orderId} / ${gatewayPaymentId} ₹${paymentEntity.amount / 100}</p>`;
                const m =
                  typeof emailService.send === "function"
                    ? "send"
                    : "sendDirect";
                await emailService[m](
                  userRec.email,
                  `Payment Confirmed — ₹${paymentEntity.amount / 100} — Trstprep`,
                  html,
                ).catch(() => {});
              }
            } catch (_e) {
              void _e;
            }
          });
        }
      } else if (event === "refund.created" || event === "refund.processed") {
        const refundEntity = req.body.payload?.refund?.entity || {};
        const gatewayPaymentId = refundEntity.payment_id || paymentEntity?.id;
        const refundId = refundEntity.id;

        if (gatewayPaymentId) {
          const existingTx = await dbHelpers.findOne("transactions", {
            paymentId: gatewayPaymentId,
          });
          if (existingTx && existingTx.status === "refunded") {
            return res.json({
              success: true,
              message: "Refund webhook already processed",
            });
          }

          await dbHelpers.withTransaction(async (client) => {
            if (existingTx) {
              await dbHelpers.updateById(
                "transactions",
                existingTx.id || existingTx._id,
                {
                  status: "refunded",
                  refundId: refundId || null,
                  updatedAt: new Date().toISOString(),
                },
                client,
              );

              if (existingTx.userId) {
                await dbHelpers.updateById(
                  "users",
                  existingTx.userId,
                  {
                    isProUser: false,
                    proExpiry: null,
                  },
                  client,
                );
              }
              // P0 FIX: keep payments ledger in sync on webhook refund
              try {
                await pool.query(
                  `UPDATE payments SET status='refunded', refunded_at=NOW() WHERE gateway_payment_id=$1 AND status != 'refunded'`,
                  [gatewayPaymentId],
                );
              } catch (_e) {
                void _e;
              }
            }
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
