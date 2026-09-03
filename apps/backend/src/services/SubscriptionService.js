import crypto from "crypto";
import { pool } from "../infrastructure/database/postgres-helpers.js";

function fisherYatesShuffle(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Get the shared pool directly
const getPool = () => pool;

export const SUBSCRIPTION_PLANS = {
  PRO_PASS_MONTHLY: "pro_pass_monthly",
  PRO_PASS_YEARLY: "pro_pass_yearly",
};

export const FEATURES = {
  // Test Access
  ACCESS_ALL_TESTS: "access_all_tests",
  UNLIMITED_ATTEMPTS: "unlimited_attempts",
  CHAPTER_WISE_TESTS: "chapter_wise_tests",
  SECTIONAL_TESTS: "sectional_tests",
  PREVIOUS_YEAR_PAPERS: "previous_year_papers",
  LIVE_TESTS: "live_tests",

  // Reattempt Features
  REATTEMPT_FULL: "reattempt_full",
  REATTEMPT_WRONG: "reattempt_wrong",
  REATTEMPT_UNATTEMPTED: "reattempt_unattempted",
  REATTEMPT_SLOW: "reattempt_slow",
  SMART_IMPROVEMENT: "smart_improvement",

  // Analytics Features
  ANALYTICS_DETAILED: "analytics_detailed",
  ANALYTICS_ACCURACY: "analytics_accuracy",
  ANALYTICS_TIME_SPENT: "analytics_time_spent",
  ANALYTICS_WEAK_TOPICS: "analytics_weak_topics",
  ANALYTICS_STRONG_TOPICS: "analytics_strong_topics",
  ANALYTICS_PERCENTILE: "analytics_percentile",
  ANALYTICS_PROGRESS: "analytics_progress",
  ANALYTICS_COMPARISON: "analytics_comparison",

  // Learning Features
  SOLUTIONS_DETAILED: "solutions_detailed",
  PRACTICE_MODE: "practice_mode",
  PDF_DOWNLOADS: "pdf_downloads",
  OFFLINE_ACCESS: "offline_access",

  // Support Features
  PRIORITY_SUPPORT: "priority_support",
  EARLY_ACCESS: "early_access",
};

export const FREE_LIMITS = {
  MAX_FREE_ATTEMPTS: 3,
  MAX_FREE_TEST_SERIES: 1,
};

class SubscriptionService {
  async getUserSubscription(userId) {
    const result = await getPool().query(
      `SELECT *,
              CASE plan_type
                WHEN 'pro_monthly' THEN 'Pro Monthly'
                WHEN 'pro_yearly' THEN 'Pro Yearly'
                WHEN 'pro_lifetime' THEN 'Pro Lifetime'
                WHEN 'trial' THEN 'Trial'
                ELSE 'Free'
              END AS plan_name
       FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' AND expiry_date > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows[0] || null;
  }

  async hasActiveProPass(userId) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) {
      // Also check legacy pro_expiry field
      const userResult = await getPool().query(
        "SELECT pro_expiry, is_pro_user FROM users WHERE id = $1",
        [userId],
      );
      if (userResult.rows[0]?.is_pro_user && userResult.rows[0]?.pro_expiry) {
        return new Date(userResult.rows[0].pro_expiry) > new Date();
      }
      return false;
    }
    return sub.plan_type.includes("pro_pass");
  }

  async hasFeature(userId, feature) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) {
      return false;
    }

    const featureResult = await getPool().query(
      `SELECT is_enabled FROM subscription_features 
       WHERE plan_type = $1 AND feature_key = $2`,
      [sub.plan_type, feature],
    );

    return featureResult.rows[0]?.is_enabled || false;
  }

  async getUserFeatures(userId) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) {
      return {};
    }

    const featuresResult = await getPool().query(
      `SELECT feature_key, is_enabled, limit_value 
       FROM subscription_features WHERE plan_type = $1`,
      [sub.plan_type],
    );

    const features = {};
    featuresResult.rows.forEach((f) => {
      features[f.feature_key] = f.is_enabled;
    });

    return features;
  }

  async getAttemptCount(userId, testId) {
    const result = await getPool().query(
      `SELECT COUNT(*) as count FROM attempts 
       WHERE user_id = $1 AND test_id = $2`,
      [userId, testId],
    );
    return parseInt(result.rows[0].count);
  }

  async canAttemptTest(userId, testId) {
    const isPro = await this.hasActiveProPass(userId);

    if (isPro) {
      return { allowed: true, reason: "pro_user", unlimited: true };
    }

    const attemptCount = await this.getAttemptCount(userId, testId);

    if (attemptCount >= FREE_LIMITS.MAX_FREE_ATTEMPTS) {
      return {
        allowed: false,
        reason: "limit_exceeded",
        currentAttempts: attemptCount,
        maxAttempts: FREE_LIMITS.MAX_FREE_ATTEMPTS,
        upgradeUrl: "/pro-pass",
      };
    }

    return {
      allowed: true,
      reason: "free_user",
      remaining: FREE_LIMITS.MAX_FREE_ATTEMPTS - attemptCount,
    };
  }

  async createSubscription(userId, planType, expiryDate, paymentDetails = {}) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO subscriptions (user_id, plan_type, start_date, expiry_date, status, auto_renew, payment_method, transaction_id, amount_paid)
         VALUES ($1, $2, NOW(), $3, 'active', $4, $5, $6, $7)
         RETURNING *`,
        [
          userId,
          planType,
          expiryDate,
          paymentDetails.auto_renew || false,
          paymentDetails.payment_method,
          paymentDetails.transaction_id,
          paymentDetails.amount_paid,
        ],
      );

      // Update user pro status — in the SAME transaction so a failure here
      // rolls back the subscription insert (user pays but gets no access).
      await client.query(
        `UPDATE users SET is_pro_user = true, pro_expiry = $1, pass_type = $2 WHERE id = $3`,
        [expiryDate, planType, userId],
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async cancelSubscription(subscriptionId, userId = null) {
    // If userId is provided, verify ownership before cancelling.
    // Prevents any caller who knows a subscription ID from cancelling
    // someone else's subscription.
    const whereClause = userId
      ? "WHERE id = $1 AND user_id = $2"
      : "WHERE id = $1";
    const params = userId ? [subscriptionId, userId] : [subscriptionId];
    await getPool().query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() ${whereClause}`,
      [subscriptionId],
    );
  }

  async getSubscriptionPlans() {
    const result = await getPool().query(
      `SELECT plan_id, name, price, original_price, period, features, button_text, button_class, popular, savings, is_active, sort_order, created_at, updated_at FROM subscription_plans WHERE is_active = true ORDER BY sort_order`,
    );
    return result.rows;
  }

  // Reattempt logic
  async getWrongQuestions(attemptId) {
    const result = await getPool().query(
      `SELECT aa.question_id, q.*
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1 AND aa.is_correct = false`,
      [attemptId],
    );
    return result.rows;
  }

  async getUnattemptedQuestions(attemptId) {
    const result = await getPool().query(
      `SELECT aa.question_id, q.*
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1 AND (aa.selected_option_id IS NULL OR aa.is_unattempted = true)`,
      [attemptId],
    );
    return result.rows;
  }

  async getSlowQuestions(attemptId, avgTimePerQuestion = 60) {
    const result = await getPool().query(
      `SELECT aa.question_id, q.*
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1 AND aa.time_spent_seconds > $2`,
      [attemptId, avgTimePerQuestion],
    );
    return result.rows;
  }

  async getWeakTopics(userId, testId = null) {
    let query = `
      SELECT q.topic, q.subject, 
             COUNT(*) as total,
             SUM(CASE WHEN aa.is_correct = false THEN 1 ELSE 0 END) as wrong_count,
             ROUND(SUM(CASE WHEN aa.is_correct = false THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2) as wrong_percentage
      FROM attempt_answers aa
      JOIN attempts ta ON ta.id = aa.attempt_id
      JOIN questions q ON q.id = aa.question_id
      WHERE ta.user_id = $1
    `;
    const params = [userId];

    if (testId) {
      query += ` AND ta.test_id = $2`;
      params.push(testId);
    }

    query += ` GROUP BY q.topic, q.subject
               HAVING SUM(CASE WHEN aa.is_correct = false THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric > 0.5
               ORDER BY wrong_percentage DESC`;

    const result = await getPool().query(query, params);
    return result.rows;
  }

  async createReattempt(parentAttemptId, reattemptType) {
    if (!parentAttemptId) {
      throw new Error("Parent attempt ID is required");
    }

    const { attemptService } =
      await import("../modules/attempts/attempt.service.js");
    const parentAttempt = await getPool().query(
      `SELECT user_id FROM attempts WHERE id = $1`,
      [parentAttemptId],
    );
    if (!parentAttempt.rows[0]) {
      throw new Error(
        `Parent attempt not found with ID: ${parentAttemptId}. Please ensure the attempt exists and try again.`,
      );
    }

    const res = await attemptService.createReattempt(
      parentAttempt.rows[0].user_id,
      parentAttemptId,
      reattemptType,
    );

    return {
      attempt: res.attempt,
      mainAttempt: res.attempt,
      questions: res.questions,
    };
  }

  async getAttemptHistory(userId, testId) {
    let numericTestId = parseInt(testId, 10);
    if (
      isNaN(numericTestId) ||
      String(numericTestId) !== String(testId).trim()
    ) {
      const testRes = await getPool().query(
        `SELECT id FROM tests WHERE public_id = $1 OR public_id_uuid::text = $1 OR slug = $1 LIMIT 1`,
        [testId],
      );
      if (testRes.rows.length === 0) return [];
      numericTestId = testRes.rows[0].id;
    }
    const result = await getPool().query(
      `SELECT id,
              ROW_NUMBER() OVER (ORDER BY created_at DESC) AS attempt_number,
              score, total_marks,
              CASE WHEN total_marks > 0 THEN ROUND((score / total_marks) * 100, 1) ELSE 0 END AS percentage,
              accuracy, correct, wrong, unattempted, total_time_spent,
              start_time, submitted_at, is_reattempt, reattempt_type
       FROM attempts
       WHERE user_id = $1 AND test_id = $2
       ORDER BY created_at DESC`,
      [userId, numericTestId],
    );
    return result.rows;
  }

  async processExpiredSubscriptions() {
    try {
      const subResult = await getPool().query(
        `UPDATE subscriptions 
         SET status = 'expired', updated_at = NOW() 
         WHERE status = 'active' AND expiry_date IS NOT NULL AND expiry_date < NOW()
         RETURNING id, user_id`,
      );

      const userResult = await getPool().query(
        `UPDATE users 
         SET is_pro_user = false 
         WHERE is_pro_user = true AND pro_expiry IS NOT NULL AND pro_expiry < NOW()
         RETURNING id`,
      );

      if (subResult.rowCount > 0 || userResult.rowCount > 0) {
        console.log(
          `[SubscriptionExpiry] Expired ${subResult.rowCount} subscriptions and reset ${userResult.rowCount} user pro statuses.`,
        );
      }
      return {
        expiredSubscriptions: subResult.rowCount,
        expiredUsers: userResult.rowCount,
      };
    } catch (err) {
      console.error("[SubscriptionExpiry] Worker error:", err.message);
      return { expiredSubscriptions: 0, expiredUsers: 0 };
    }
  }
}

export default new SubscriptionService();
