import { isFeatureEnabled } from "../services/SettingsService.js";
import logger from "../infrastructure/logger/logger.js";

/**
 * Bot Protection Middleware
 *
 * Implements two invisible, friction-free bot detection mechanisms:
 * 1. Honeypot Field (`_hp_website_trap`): Hidden from real human users via CSS/DOM.
 *    Automated bots that indiscriminately populate all form inputs will fill this in.
 * 2. Timing Heuristics (`_form_rendered_at`): Validates that human users take a realistic
 *    amount of time (>= 400ms) to fill and submit the form, catching instant headless scripts.
 *
 * Can be turned ON/OFF anytime from Admin Settings (features.botProtection).
 */
export const botProtectionMiddleware = async (req, res, next) => {
  try {
    const enabled = await isFeatureEnabled("botProtection");
    if (!enabled) {
      return next();
    }

    const honeypotValue = req.body?._hp_website_trap;
    if (
      honeypotValue &&
      typeof honeypotValue === "string" &&
      honeypotValue.trim() !== ""
    ) {
      logger.warn("[BotProtection] Honeypot triggered by IP:", req.ip);
      return res.status(400).json({
        success: false,
        code: "BOT_DETECTED",
        message: "Automated submission detected. Please try again.",
      });
    }

    const renderedAt = Number(req.body?._form_rendered_at);
    if (renderedAt && !Number.isNaN(renderedAt)) {
      const elapsedMs = Date.now() - renderedAt;
      // If submitted in under 400ms, it's an automated script (humans take at least 1-2s)
      if (elapsedMs > 0 && elapsedMs < 400) {
        logger.warn(
          `[BotProtection] Impossibly fast form submission (${elapsedMs}ms) by IP:`,
          req.ip,
        );
        return res.status(400).json({
          success: false,
          code: "BOT_SPEED_DETECTED",
          message: "Submission too fast. Please take your time and try again.",
        });
      }
    }

    next();
  } catch (error) {
    // Fail-open for middleware error so legitimate users are not blocked by internal errors
    logger.error(
      "[BotProtection] Middleware error (failing open):",
      error.message,
    );
    next();
  }
};
