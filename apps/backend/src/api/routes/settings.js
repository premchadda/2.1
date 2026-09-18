import { Router } from "express";
import { getPublicSettings } from "../../services/SettingsService.js";
import logger from "../../infrastructure/logger/logger.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";

const router = Router();

async function handleGetSettings(req, res) {
  try {
    const settings = await getPublicSettings();
    res.set("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json({
      success: true,
      data: {
        ...settings,
        contactEmail: settings.contactEmail || "support@trstprep.com",
        supportEmail: settings.supportEmail || "support@trstprep.com",
        contactPhone: settings.contactPhone || "+91 98765 43210",
        phone: settings.phone || "+91 98765 43210",
        address: settings.address || "New Delhi, India",
      },
    });
  } catch (error) {
    // Synthetic fallback: a DB outage is otherwise indistinguishable from
    // success. Flag it via header so clients/ops can tell. Note: the
    // responseCache wrapper caches success-shaped bodies, so a fallback may
    // persist up to the 120s TTL — the header marks the source either way.
    logger.warn(
      "[Settings] getPublicSettings failed, serving synthetic fallback:",
      error?.message,
    );
    res.set("X-Settings-Fallback", "1");
    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      data: {
        contactEmail: "support@trstprep.com",
        supportEmail: "support@trstprep.com",
        contactPhone: "+91 98765 43210",
        phone: "+91 98765 43210",
        address: "New Delhi, India",
        features: {
          userRegistration: true,
          emailVerification: true,
          smsNotifications: false,
          paymentGateway: true,
          analytics: true,
          seoEnabled: true,
          demoMode: false,
        },
        maintenance: { enabled: false },
        comingSoon: {},
      },
    });
  }
}

/**
 * @route   GET /api/settings/public
 * @desc    Get public-facing site settings (features, maintenance, coming soon)
 * @access  Public
 */
// Identical public payload for every caller — cache once globally instead of
// once per user (the positional responseCache form defaults userScoped:true,
// which would fan out per-user buckets for identical bytes).
router.get(
  "/public",
  responseCache("public-settings", 120, { userScoped: false }),
  handleGetSettings,
);
router.get(
  "/",
  responseCache("public-settings", 120, { userScoped: false }),
  handleGetSettings,
);

export default router;
