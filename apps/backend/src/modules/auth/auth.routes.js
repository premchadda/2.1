import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import {
  generateCsrfToken,
  storeCsrfToken,
  validateCsrfToken,
} from "../../middleware/csrf.middleware.js";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { authController } from "./auth.controller.js";
import {
  authRateLimiter,
  protect,
  optionalAuth,
} from "../../middleware/auth.middleware.js";
import { lockoutMiddleware } from "../../middleware/lockout.middleware.js";
import { botProtectionMiddleware } from "../../middleware/botProtection.middleware.js";
import { isFeatureEnabled } from "../../services/SettingsService.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local profile assets are ephemeral on cloud deployments. Do not advertise a
// stale path that will make every client request a guaranteed 404.
const availableProfileAsset = (asset) => {
  if (typeof asset !== "string" || !asset.startsWith("/assets/avatar/")) {
    return asset;
  }
  const filename = path.basename(asset);
  const localPath = path.join(__dirname, "../../../uploads/avatars", filename);
  return fs.existsSync(localPath) ? asset : null;
};

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
  authController.register,
);
router.post("/logout", optionalAuth, authController.logout);
router.post("/refresh", authRateLimiter, authController.refreshToken);
router.post(
  "/forgot-password",
  botProtectionMiddleware,
  authRateLimiter,
  authController.forgotPassword,
);
router.post("/reset-password", authRateLimiter, authController.resetPassword);
router.post(
  "/change-password",
  protect,
  validateCsrfToken,
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
  lockoutMiddleware,
  authRateLimiter,
  authController.enrollTwoFactor,
);
router.post(
  "/2fa/verify",
  protect,
  lockoutMiddleware,
  authRateLimiter,
  authController.verifyTwoFactor,
);
router.post(
  "/2fa/backup-codes/regenerate",
  protect,
  lockoutMiddleware,
  authRateLimiter,
  authController.regenerateTwoFactorBackupCodes,
);
router.post(
  "/2fa/disable",
  protect,
  lockoutMiddleware,
  authRateLimiter,
  authController.disableTwoFactor,
);

// Get current authenticated user
router.get("/me", protect, responseCache("auth-me", 120), async (req, res) => {
  try {
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
    if (user.role === "super_admin") {
      permissions = ["*"];
    } else if (
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

    // Generate and store CSRF token for the session
    let csrfToken = null;
    if (req.authToken) {
      csrfToken = generateCsrfToken();
      await storeCsrfToken(req.authToken, csrfToken);
    }

    res.json({
      success: true,
      data: {
        ...safeUser,
        permissions,
        enrolledSeries: [],
        enrolledExams: [],
        enrolledStudyMaterials: [],
        attemptedTests: {},
        attemptedTestIds: [],
        csrfToken,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
