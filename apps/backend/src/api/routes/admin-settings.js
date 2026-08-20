import express from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import logger from "../../infrastructure/logger/logger.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import { invalidateResponseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

// SECURITY: Never return raw secrets to the client (HIGH-05).
// Only keys ENDING in secret/password/token/api-key/cid are masked, so
// non-secrets like seoKeywords and passwordPolicy survive GET; masked
// placeholders must never be persisted on save.
const SENSITIVE_KEY_PATTERN = /(?:secret|password|token|api[_-]?key|cid)$/i;
const SECRET_MASK = "••••••••";

function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return value;
}

function maskSecrets(settings) {
  if (!settings || typeof settings !== "object") return settings;
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === "string" && value && SENSITIVE_KEY_PATTERN.test(key)) {
      settings[key] = SECRET_MASK;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      maskSecrets(value);
    }
  }
  return settings;
}

function stripMaskedSecrets(payload) {
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" && value.startsWith("••••")) {
      delete payload[key];
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      stripMaskedSecrets(value);
    }
  }
  return payload;
}

// ===== APP SETTINGS =====
router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const { getFullSettings } =
      await import("../../services/SettingsService.js");
    const settings = await getFullSettings();
    if (settings && settings.smtpPassword) {
      settings.smtpPassword = "••••••••";
    }
    if (settings && settings.smtp_password) {
      settings.smtp_password = "••••••••";
    }
    maskSecrets(settings);
    res.json({ success: true, data: settings });
  }),
);

router.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const ALLOWED_SETTINGS_KEYS = [
      "siteName",
      "siteDescription",
      "siteUrl",
      "logoUrl",
      "faviconUrl",
      "smtpHost",
      "smtpPort",
      "smtpUsername",
      "smtpPassword",
      "smtpSecure",
      "fromEmail",
      "fromName",
      "razorpayKeyId",
      "razorpayKeySecret",
      "googleClientId",
      "googleClientSecret",
      "maintenanceMode",
      "allowRegistrations",
      "requireEmailVerification",
      "defaultRole",
      "maxLoginAttempts",
      "lockoutDuration",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
      "analyticsTrackingId",
      "facebookPixelId",
      "contactEmail",
      "contactPhone",
      "supportUrl",
      "address",
      "socialLinks",
      "features",
      "maintenance",
      "comingSoon",
      "appearance",
      "security",
      "email",
      "payment",
      "notifications",
      "allowedEmailDomains",
      "security",
      "appearance",
      "payment",
      "notifications",
      "email",
    ];
    const allowedSettings = {};
    for (const key of ALLOWED_SETTINGS_KEYS) {
      if (req.body[key] !== undefined) {
        let value = req.body[key];
        // Coerce string booleans so "false" never becomes truthy
        if (
          key === "maintenanceMode" ||
          key === "allowRegistrations" ||
          key === "requireEmailVerification"
        ) {
          value = coerceBoolean(value);
        }
        allowedSettings[key] = value;
      }
    }

    // SECURITY: Never persist masked placeholders as if they were secrets
    stripMaskedSecrets(allowedSettings);

    const { saveSettings } = await import("../../services/SettingsService.js");
    const updated = await saveSettings(allowedSettings);
    await Promise.all([
      invalidateResponseCache("public-settings"),
      invalidateResponseCache("site-settings"),
    ]);
    if (updated && updated.smtpPassword) {
      updated.smtpPassword = "••••••••";
    }
    if (updated && updated.smtp_password) {
      updated.smtp_password = "••••••••";
    }
    maskSecrets(updated);
    res.json({ success: true, data: updated });
  }),
);

// ===== TEST EMAIL ENDPOINT =====
router.post(
  "/settings/test-email",
  asyncHandler(async (req, res) => {
    const { testTo } = req.body;

    const { getFullSettings } =
      await import("../../services/SettingsService.js");
    const currentSettings = await getFullSettings();

    const emailConfig = currentSettings.email || {};
    const smtpHost = process.env.SMTP_HOST || emailConfig.smtpHost;
    const smtpPort = process.env.SMTP_PORT || emailConfig.smtpPort;
    const smtpUsername = process.env.SMTP_USER || emailConfig.smtpUsername;
    const smtpPassword = process.env.SMTP_PASS || emailConfig.smtpPassword;
    const fromEmail = process.env.SMTP_FROM_EMAIL || emailConfig.fromEmail;
    const fromName =
      process.env.SMTP_FROM_NAME || emailConfig.fromName || "Trstprep";

    if (
      !smtpHost ||
      !smtpPort ||
      !smtpUsername ||
      !smtpPassword ||
      !fromEmail
    ) {
      return res.status(400).json({
        success: false,
        message: "Configure SMTP in environment variables first",
      });
    }

    let nodemailer;
    try {
      nodemailer = await import("nodemailer");
    } catch {
      if (!smtpHost.includes(".") || smtpPort < 1 || smtpPort > 65535) {
        return res.status(400).json({
          success: false,
          message: "Invalid SMTP host or port",
        });
      }
      return res.json({
        success: true,
        data: {
          message: "SMTP configuration looks valid (nodemailer not installed)",
        },
      });
    }

    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: false,
      auth: { user: smtpUsername, pass: smtpPassword },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: testTo || fromEmail,
      subject: "Trstprep Test Email",
      text: "This is a test email from Trstprep admin panel. If you received this, your SMTP configuration is correct.",
    });
    res.json({
      success: true,
      data: { message: "Test email sent successfully" },
    });
  }),
);

export default router;
