import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import {
  generateCsrfToken,
  getCsrfToken,
  storeCsrfToken,
  validateCsrfToken,
} from "../../middleware/csrf.middleware.js";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { authController } from "./auth.controller.js";
import {
  authRateLimiter,
  protect,
  optionalAuth,
  setCachedSession,
} from "../../middleware/auth.middleware.js";
import { lockoutMiddleware } from "../../middleware/lockout.middleware.js";
import { validateBody } from "../../middleware/validation/inputValidation.js";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../../api/validators/auth.validator.js";
import { botProtectionMiddleware } from "../../middleware/botProtection.middleware.js";
import { isFeatureEnabled } from "../../services/SettingsService.js";
import {
  responseCache,
  invalidateResponseCache,
  swrCache,
} from "../../middleware/responseCache.middleware.js";
import { getUserEnrollmentsSummary } from "../../services/EnrollmentService.js";
import { getAttemptedTestsPayload } from "../../shared/utils/attempt-utils.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { availableProfileAsset } from "../../shared/utils/user-utils.js";

const router = Router();

// Middleware: block registration if userRegistration feature is disabled
const requireRegistrationEnabled = async (req, res, next) => {
  try {
    const enabled = await isFeatureEnabled("userRegistration");
    if (!enabled) {
      return res.status(403).json({
        success: false,
        message:
          "New registrations are currently disabled. Please try again later.",
      });
    }
    next();
  } catch (err) {
    // Fail-closed: if we cannot verify whether registration is enabled,
    // block the request. An attacker who can cause a DB error on this
    // query could otherwise bypass the feature flag entirely.
    console.error(
      "[Auth] Registration feature check failed (fail-closed):",
      err.message,
    );
    return res.status(503).json({
      success: false,
      message:
        "Registration is temporarily unavailable. Please try again later.",
      code: "REGISTRATION_UNAVAILABLE",
    });
  }
};

// HIGH-09 FIX: Apply strict rate limiting and bot protection to auth endpoints
router.post(
  "/login",
  lockoutMiddleware,
  botProtectionMiddleware,
  authRateLimiter,
  validateBody(loginSchema),
  authController.login,
);
router.post(
  "/login/2fa",
  lockoutMiddleware,
  botProtectionMiddleware,
  authRateLimiter,
  authController.login2FA,
);
router.post(
  "/google",
  lockoutMiddleware,
  authRateLimiter,
  authController.googleLogin,
);
router.post(
  "/register",
  requireRegistrationEnabled,
  botProtectionMiddleware,
  authRateLimiter,
  validateBody(registerSchema),
  authController.register,
);
router.post("/logout", optionalAuth, authController.logout);
router.post("/refresh", authRateLimiter, authController.refreshToken);
router.post(
  "/forgot-password",
  botProtectionMiddleware,
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  authRateLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);
router.post(
  "/change-password",
  protect,
  validateCsrfToken,
  validateBody(changePasswordSchema),
  authController.changePassword,
);
router.get("/verify-email/:token", authRateLimiter, authController.verifyEmail);
router.get("/verify-email", authRateLimiter, authController.verifyEmail);
router.post("/verify-email", authRateLimiter, authController.verifyEmail);
router.post(
  "/resend-verification",
  authRateLimiter,
  authController.resendVerification,
);

// Two-factor authentication (TOTP) management — requires an authenticated session
router.get("/2fa/status", protect, authController.getTwoFactorStatus);
router.post(
  "/2fa/enroll",
  protect,
  validateCsrfToken,
  lockoutMiddleware,
  authRateLimiter,
  authController.enrollTwoFactor,
);
router.post(
  "/2fa/verify",
  protect,
  validateCsrfToken,
  lockoutMiddleware,
  authRateLimiter,
  authController.verifyTwoFactor,
);
router.post(
  "/2fa/backup-codes/regenerate",
  protect,
  validateCsrfToken,
  lockoutMiddleware,
  authRateLimiter,
  authController.regenerateTwoFactorBackupCodes,
);
router.post(
  "/2fa/disable",
  protect,
  validateCsrfToken,
  lockoutMiddleware,
  authRateLimiter,
  authController.disableTwoFactor,
);

// Get current authenticated user
// PERF (auth latency): previously responseCache("auth-me", 120) + an awaited
// fresh-CSRF DB write on every call + sequential query waves. Cold responses
// cost 1.4-2.2s against hosted Postgres (5+ sequential round-trips). Now:
//   1. swrCache serves the cached body instantly (X-Cache: FRESH/STALE) and
//      refreshes in the background — repeat visits resolve in ~1ms.
//   2. The CSRF token is REUSED when one already exists for the session (the
//      client keeps it in memory/cookie; a regenerated one would strand it).
//   3. Handler queries (permissions, enrollments, attempts, public-id lookups)
//      run as ONE parallel batch instead of sequential waves.
// Cache is invalidated on logout, unenroll, profile update, and test submission
// via invalidateResponseCache("auth-me").
router.get(
  "/me",
  protect,
  // Per-user+session SWR namespace: the cached body embeds a per-session CSRF
  // token, so a shared per-user key would serve session A's token to session B
  // (broken CSRF). Namespace includes user id + session id; invalidation via
  // invalidateResponseCache("auth-me") still matches by prefix.
  (req, res, next) =>
    swrCache(
      `auth-me:${req.user?.id ?? "anon"}:${req.user?.sessionId ?? "nosess"}`,
      { freshTtl: 60, staleTtl: 24 * 60 * 60 },
    )(req, res, next),
  async (req, res) => {
    try {
      const t0 = Date.now();

      // PERF: Use user already loaded by protect middleware (avoids redundant DB query)
      const user = req.user;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      // Load permissions for admin users
      let permissions = user.permissions || [];
      if (
        (user.role === "admin" || user.isAdmin) &&
        permissions.length === 0
      ) {
        try {
          const { rows: permRows } = await dbHelpers.pool.query(
            `SELECT DISTINCT p.name
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = $1`,
            [user.id],
          );
          if (permRows.length > 0) {
            permissions = permRows.map((r) => r.name);
          } else {
            permissions = [
              "users:view",
              "users:create",
              "users:edit",
              "users:delete",
              "tests:view",
              "tests:create",
              "tests:edit",
              "tests:delete",
              "content:view",
              "content:create",
              "content:edit",
              "content:delete",
              "settings:view",
              "settings:create",
              "settings:edit",
              "settings:delete",
              "monetization:view",
              "monetization:create",
              "monetization:edit",
              "monetization:delete",
              "communications:view",
              "communications:create",
              "communications:edit",
              "communications:delete",
              "moderation:view",
              "moderation:create",
              "moderation:edit",
              "moderation:delete",
              "audit:view",
              "audit:create",
              "audit:edit",
              "audit:delete",
              "analytics:view",
              "analytics:create",
              "analytics:edit",
              "analytics:delete",
            ];
          }
        } catch {
          permissions = [
            "users:view",
            "users:create",
            "users:edit",
            "users:delete",
            "tests:view",
            "tests:create",
            "tests:edit",
            "tests:delete",
            "content:view",
            "content:create",
            "content:edit",
            "content:delete",
            "settings:view",
            "settings:create",
            "settings:edit",
            "settings:delete",
            "monetization:view",
            "monetization:create",
            "monetization:edit",
            "monetization:delete",
            "communications:view",
            "communications:create",
            "communications:edit",
            "communications:delete",
            "moderation:view",
            "moderation:create",
            "moderation:edit",
            "moderation:delete",
            "audit:view",
            "audit:create",
            "audit:edit",
            "audit:delete",
            "analytics:view",
            "analytics:create",
            "analytics:edit",
            "analytics:delete",
          ];
        }
      }
      // NOTE: console.time() removed here — labels are process-global and
      // concurrent /auth/me requests collided ("Label already exists").
      // Remove sensitive fields from response
      const {
        password: _,
        resetPasswordToken: __,
        resetPasswordExpires: ___,
        emailVerificationToken: ____,
        ...safeUser
      } = user;

      if (safeUser.avatar) {
        safeUser.avatar = availableProfileAsset(safeUser.avatar);
      }
      // PERF: resolve everything in ONE parallel batch. The previous code ran
      // these as sequential waves (CSRF write -> enrollments/attempts), costing
      // 2+ extra DB round-trips (~600ms) against hosted Postgres.
      let csrfToken = null;
      const csrfPromise = req.authToken
        ? (async () => {
            // REUSE the session's existing CSRF token when present. Regenerating
            // a fresh one on every /me stranded the client's stored token after
            // cache HITs and forced an awaited DB write on every cold call.
            const existing = await getCsrfToken(req.authToken).catch(
              () => null,
            );
            if (existing) return existing;
            const fresh = generateCsrfToken();
            await storeCsrfToken(req.authToken, fresh).catch(() => {});
            return fresh;
          })().catch(() => null)
        : Promise.resolve(null);

      let enrolledSeries = [];
      let enrolledExams = [];
      let enrolledStudyMaterials = [];
      let attemptedTests =
        safeUser.attemptedTests ?? safeUser.attempted_tests ?? {};
      let attemptedTestIds =
        safeUser.attemptedTestIds ?? safeUser.attempted_test_ids ?? [];
      try {
        const [enrollmentSummary, attemptedPayload, resolvedCsrfToken] =
          await Promise.all([
            getUserEnrollmentsSummary(dbHelpers, user.id, user).catch(() => ({
              enrolledSeries:
                safeUser.enrolledSeries ?? safeUser.enrolled_series ?? [],
              enrolledExams:
                safeUser.enrolledExams ?? safeUser.enrolled_exams ?? [],
              enrolledStudyMaterials:
                safeUser.enrolledStudyMaterials ??
                safeUser.enrolled_study_materials ??
                [],
            })),
            getAttemptedTestsPayload(user.id, dbHelpers).catch((attemptErr) => {
              console.warn(
                "[auth/me] Failed to compute attempted tests:",
                attemptErr.message,
              );
              return { attemptedTests, attemptedTestIds };
            }),
            csrfPromise,
          ]);

        csrfToken = resolvedCsrfToken;

        enrolledSeries = enrollmentSummary.enrolledSeries || [];
        enrolledExams = enrollmentSummary.enrolledExams || [];
        enrolledStudyMaterials = enrollmentSummary.enrolledStudyMaterials || [];
        if (attemptedPayload) {
          attemptedTests = attemptedPayload.attemptedTests || attemptedTests;
          attemptedTestIds =
            attemptedPayload.attemptedTestIds || attemptedTestIds;
        }
      } catch {
        // Fall back to user record properties
        enrolledSeries =
          safeUser.enrolledSeries ?? safeUser.enrolled_series ?? [];
        enrolledExams = safeUser.enrolledExams ?? safeUser.enrolled_exams ?? [];
        enrolledStudyMaterials =
          safeUser.enrolledStudyMaterials ??
          safeUser.enrolled_study_materials ??
          [];
      }

      res.json({
        success: true,
        data: {
          ...safeUser,
          permissions,
          enrolledSeries: Array.isArray(enrolledSeries) ? enrolledSeries : [],
          enrolledExams: Array.isArray(enrolledExams) ? enrolledExams : [],
          enrolledStudyMaterials: Array.isArray(enrolledStudyMaterials)
            ? enrolledStudyMaterials
            : [],
          attemptedTests,
          attemptedTestIds,
          csrfToken,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

export default router;
