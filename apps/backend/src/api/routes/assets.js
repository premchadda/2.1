/**
 * Public asset delivery.
 *
 *   GET /api/assets/:id/download  ->  302 redirect to the resolved access URL
 *
 * Why a redirect instead of proxying the bytes: papers/videos can be hundreds of
 * megabytes. Redirecting lets S3 / Supabase / the CDN serve the file directly
 * and keeps range requests working. Access control is therefore whatever the
 * storage provider enforces on that URL — this route never widens it.
 *
 * Auth: required. Study papers are paid content, and an anonymous caller gets a
 * distinguishable 401-vs-404 answer that turns this into an asset-ID existence
 * oracle. The frontend uses this as a plain <a href> (PypPaperCard.jsx); auth is
 * httpOnly-cookie based, so the browser sends the cookie on navigation and the
 * download still works for a signed-in learner.
 */
import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { resolveAssetAccessUrl } from "../../infrastructure/storage/storageProvider.js";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import { protect } from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";

const router = express.Router();

router.use(protect);

const isRedirectable = (url) =>
  typeof url === "string" && /^https?:\/\//i.test(url.trim());

router.get("/:id/download", async (req, res) => {
  const id = parseAssetId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid asset id",
    });
  }

  try {
    const asset = await dbHelpers.findById("assets", id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    const url = resolveAssetAccessUrl(asset) || asset.url;
    if (!isRedirectable(url)) {
      logger.warn(`[assets] Asset ${id} has no resolvable access URL`);
      return res.status(404).json({
        success: false,
        message: "Asset file is unavailable",
      });
    }

    res.setHeader("Cache-Control", "private, max-age=300");
    return res.redirect(302, url);
  } catch (error) {
    logger.error(
      `[assets] Download redirect failed for ${id}: ${error.message}`,
    );
    return res.status(500).json({
      success: false,
      message: "Failed to resolve asset",
    });
  }
});

export default router;
