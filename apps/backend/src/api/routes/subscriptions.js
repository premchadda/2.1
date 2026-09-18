import express from "express";
import subscriptionService, {
  FEATURES,
  SUBSCRIPTION_PLANS,
} from "../../services/SubscriptionService.js";
import { protect } from "../../middleware/auth.middleware.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// Get all subscription plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await subscriptionService.getSubscriptionPlans();

    const formattedPlans = plans.map((plan) => ({
      id: plan.plan_id,
      name: plan.name,
      price: parseFloat(plan.price),
      originalPrice: parseFloat(plan.original_price),
      period: plan.period,
      features: plan.features,
      buttonText: plan.button_text,
      buttonClass: plan.button_class,
      popular: plan.popular,
      savings: plan.savings,
    }));

    res.json({ plans: formattedPlans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Get user's subscription status
router.get("/status", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = await subscriptionService.getUserSubscription(userId);
    const hasPro = await subscriptionService.hasActiveProPass(userId);
    const features = await subscriptionService.getUserFeatures(userId);

    // Also check legacy pro fields
    const userResult = await pool.query(
      "SELECT pro_expiry, is_pro_user FROM users WHERE id = $1",
      [userId],
    );
    const legacyPro =
      userResult.rows[0]?.is_pro_user &&
      new Date(userResult.rows[0]?.pro_expiry) > new Date();

    res.json({
      isProUser: hasPro || legacyPro,
      subscription: subscription,
      features: features,
      proExpiry: subscription?.expiry_date || userResult.rows[0]?.pro_expiry,
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

// Check if user can attempt a test
router.get("/can-attempt/:testId", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { testId } = req.params;

    const result = await subscriptionService.canAttemptTest(userId, testId);
    res.json(result);
  } catch (error) {
    console.error("Error checking attempt permission:", error);
    res.status(500).json({ error: "Failed to check permission" });
  }
});

// Check feature access
router.get("/has-feature/:feature", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { feature } = req.params;

    const hasFeature = await subscriptionService.hasFeature(userId, feature);
    res.json({ hasFeature, feature });
  } catch (error) {
    console.error("Error checking feature:", error);
    res.status(500).json({ error: "Failed to check feature" });
  }
});

// Create subscription (would be called by payment webhook)
router.post("/create", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    // Client-supplied expiryDate is IGNORED for duration: expiry is computed
    // server-side from the plan mapping below (30/365 days, capped at 366,
    // never in the past). The raw client value is only used to detect plan
    // mismatches, never trusted for access duration.
    const { planType, paymentDetails } = req.body;

    const subscription = await subscriptionService.createSubscription(
      userId,
      planType,
      undefined,
      paymentDetails,
    );

    res.json({ success: true, subscription });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

// Cancel subscription
router.post("/cancel/:subscriptionId", protect, async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    // Ownership enforced: cancelSubscription verifies user_id = req.user.id
    // so one user can never cancel another's subscription by id guessing.
    await subscriptionService.cancelSubscription(subscriptionId, req.user.id);

    res.json({ success: true, message: "Subscription cancelled" });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    // MED cancel 404: service throws status 404 when rowCount===0.
    if (error?.status === 404 || error?.code === "SUBSCRIPTION_NOT_FOUND") {
      return res.status(404).json({ error: "Subscription not found" });
    }
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// Get attempt history for a test
router.get("/attempt-history/:testId", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { testId } = req.params;

    const history = await subscriptionService.getAttemptHistory(userId, testId);

    // Calculate improvement trend
    const scores = history.map((h) => parseFloat(h.percentage || 0));
    const trend = scores.length > 1 ? scores[0] - scores[scores.length - 1] : 0;

    res.json({
      history,
      totalAttempts: history.length,
      trend: trend,
      // LOW bestScore clamp: Math.max(...[]) is -Infinity — clamp to 0.
      bestScore: scores.length > 0 ? Math.max(0, ...scores) : 0,
      latestScore: scores[0] ?? 0,
    });
  } catch (error) {
    console.error("Error fetching attempt history:", error);
    res.status(500).json({ error: "Failed to fetch attempt history" });
  }
});

// Create reattempt
router.post("/reattempt", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, reattemptType } = req.body;

    // Check if user has access to this reattempt type
    const featureMap = {
      full: FEATURES.REATTEMPT_FULL,
      wrong: FEATURES.REATTEMPT_WRONG,
      unattempted: FEATURES.REATTEMPT_UNATTEMPTED,
      slow: FEATURES.REATTEMPT_SLOW,
      smart: FEATURES.SMART_IMPROVEMENT,
      smart_improvement: FEATURES.SMART_IMPROVEMENT,
    };

    const requiredFeature = featureMap[reattemptType];
    if (requiredFeature) {
      const hasFeature = await subscriptionService.hasFeature(
        userId,
        requiredFeature,
      );
      if (!hasFeature) {
        const isPro = await subscriptionService.hasActiveProPass(userId);
        if (!isPro) {
          return res.status(403).json({
            error: "Pro Pass required",
            upgradeRequired: true,
            feature: requiredFeature,
          });
        }
      }
    }

    const result = await subscriptionService.createReattempt(
      attemptId,
      reattemptType,
    );

    res.json({
      success: true,
      attempt: result.attempt,
      questionCount: result.questions.length,
      questions: result.questions.map((q) => ({
        id: q.id,
        questionText: q.question_text,
        options: q.options,
        difficulty: q.difficulty,
      })),
    });
  } catch (error) {
    console.error("Error creating reattempt:", error);
    res.status(500).json({
      error: sanitizeErrorMessage(error) || "Failed to create reattempt",
    });
  }
});

// Get weak topics for a user
router.get("/weak-topics/:testId?", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { testId } = req.params;

    const weakTopics = await subscriptionService.getWeakTopics(
      userId,
      testId || null,
    );

    res.json({ weakTopics });
  } catch (error) {
    console.error("Error fetching weak topics:", error);
    res.status(500).json({ error: "Failed to fetch weak topics" });
  }
});

// Get analytics data
router.get("/analytics/:testId?", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { testId } = req.params;

    // Check if user has analytics access
    const hasAnalytics = await subscriptionService.hasFeature(
      userId,
      FEATURES.ANALYTICS_DETAILED,
    );
    const isPro = await subscriptionService.hasActiveProPass(userId);

    if (!hasAnalytics && !isPro) {
      return res.status(403).json({
        error: "Pro Pass required for analytics",
        upgradeRequired: true,
      });
    }

    // Get basic stats
    let query = `
      SELECT 
        COUNT(DISTINCT test_id) as tests_taken,
        COUNT(*) as total_attempts,
        SUM(correct_count) as total_correct,
        SUM(wrong_count) as total_wrong,
        SUM(unattempted_count) as total_unattempted,
        AVG(percentage) as avg_score,
        AVG(accuracy) as avg_accuracy,
        SUM(total_time_spent) as total_time
      FROM attempts 
      WHERE user_id = $1
    `;
    const params = [userId];

    if (testId) {
      query += ` AND test_id = $2`;
      params.push(testId);
    }

    const stats = await pool.query(query, params);
    const statsRow = stats.rows[0];

    res.json({
      testsTaken: parseInt(statsRow.tests_taken) || 0,
      totalAttempts: parseInt(statsRow.total_attempts) || 0,
      totalCorrect: parseInt(statsRow.total_correct) || 0,
      totalWrong: parseInt(statsRow.total_wrong) || 0,
      totalUnattempted: parseInt(statsRow.total_unattempted) || 0,
      avgScore: parseFloat(statsRow.avg_score) || 0,
      avgAccuracy: parseFloat(statsRow.avg_accuracy) || 0,
      totalTimeSpent: parseInt(statsRow.total_time) || 0,
      hasAdvancedAnalytics: hasAnalytics || isPro,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export default router;
