import express from "express";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import {
  deleteStoredAssetFile,
  resolveAssetAccessUrl,
  storeUploadedAssetFile,
} from "../../infrastructure/storage/storageProvider.js";
import { upload } from "../../infrastructure/storage/upload.js";
import logger from "../../infrastructure/logger/logger.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect)
router.use(admin)

// ===== UNIFIED ASSET MANAGEMENT =====
const inferAssetCategory = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "document";
};

const normalizeAssetRecord = (asset) => {
  const metadata =
    asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
  const createdAt =
    asset.createdAt ||
    asset.created_at ||
    asset.updatedAt ||
    new Date().toISOString();
  const name =
    asset.name || metadata.originalName || metadata.filename || "asset";
  const mimeType = asset.type || asset.mimeType || "application/octet-stream";
  const category = asset.category || inferAssetCategory(mimeType);
  const accessUrl = resolveAssetAccessUrl(asset) || asset.url;

  return {
    ...asset,
    _id: asset._id || asset.id,
    id: asset.id || asset._id,
    name,
    filename: metadata.filename || name,
    originalName: metadata.originalName || name,
    type: mimeType,
    mimeType,
    category,
    fileType: category,
    url: accessUrl,
    uploadDate: createdAt,
    createdAt,
  };
};

// Resolve a list of asset IDs (numeric or string) to a Map<id, accessUrl>.
// Null/undefined entries are skipped. Missing assets are omitted from the
// map so callers fall back to their own bannerUrl/imageUrl fields.
export const buildAssetUrlMap = async (assetIds) => {
  const ids = (assetIds || [])
    .map(parseAssetId)
    .filter((id) => id !== null && id !== undefined);

  const map = new Map();
  if (ids.length === 0) return map;

  await Promise.all(
    ids.map(async (id) => {
      try {
        const asset = await dbHelpers.findById("assets", id);
        if (asset) {
          map.set(id, resolveAssetAccessUrl(asset) || asset.url || null);
        }
      } catch {
        // Non-fatal — leave this ID absent from the map.
      }
    }),
  );
  return map;
};

const listAssets = async (req, res) => {
  try {
    const { category, type, search, page = 1, limit = 100 } = req.query;

    const allAssets = await dbHelpers.find("assets", { isActive: true });
    let filteredAssets = allAssets;

    if (category) {
      filteredAssets = filteredAssets.filter(
        (asset) =>
          (asset.category || "").toLowerCase() ===
          String(category).toLowerCase(),
      );
    }

    if (type) {
      const typeLower = String(type).toLowerCase();
      filteredAssets = filteredAssets.filter((asset) => {
        const assetType = (asset.type || "").toLowerCase();
        const assetCategory = (asset.category || "").toLowerCase();
        return (
          assetType.startsWith(`${typeLower}/`) || assetCategory === typeLower
        );
      });
    }

    if (search) {
      const query = String(search).toLowerCase();
      filteredAssets = filteredAssets.filter(
        (asset) =>
          String(asset.name || "")
            .toLowerCase()
            .includes(query) ||
          String(asset.url || "")
            .toLowerCase()
            .includes(query),
      );
    }

    filteredAssets.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 100, 1);
    const startIndex = (pageNumber - 1) * limitNumber;
    const paginatedAssets = filteredAssets
      .slice(startIndex, startIndex + limitNumber)
      .map(normalizeAssetRecord);

    res.json({
      success: true,
      data: paginatedAssets,
      total: filteredAssets.length,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: filteredAssets.length,
        totalPages: Math.ceil(filteredAssets.length / limitNumber),
      },
    });
  } catch (error) {
    logger.error("List assets error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get all assets (new endpoint)
router.get("/assets", listAssets);

// Backward-compatible endpoint for existing admin UI
router.get("/media", listAssets);

// List assets grouped by test/series scope ("folder" view).
// Returns: { tests: { "123": [...assets], "unscoped": [...] }, series: {...} }
router.get("/assets/tree", async (req, res) => {
  try {
    const allAssets = await dbHelpers.find("assets", { isActive: true });

    const tree = { tests: {}, series: {}, unscoped: [] };
    for (const asset of allAssets) {
      const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
      const tId = meta.testId ?? meta.test_id ?? null;
      const sId = meta.testSeriesId ?? meta.test_series_id ?? null;
      const record = normalizeAssetRecord(asset);

      if (tId) {
        const key = sId ? `${sId}/tests/${tId}` : String(tId);
        if (!tree.tests[key]) tree.tests[key] = [];
        tree.tests[key].push(record);
      } else if (sId) {
        if (!tree.series[sId]) tree.series[sId] = [];
        tree.series[sId].push(record);
      } else {
        tree.unscoped.push(record);
      }
    }

    res.json({ success: true, data: tree });
  } catch (error) {
    logger.error("Asset tree error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// List assets for a specific test (folder contents)
router.get("/assets/by-test/:testId", async (req, res) => {
  try {
    const testId = parseAssetId(req.params.testId);
    if (!testId) {
      return res.status(400).json({ success: false, message: "Invalid test id" });
    }
    const allAssets = await dbHelpers.find("assets", { isActive: true });
    const assets = allAssets
      .filter((a) => {
        const meta = a.metadata && typeof a.metadata === "object" ? a.metadata : {};
        return String(meta.testId ?? meta.test_id ?? "") === String(testId);
      })
      .map(normalizeAssetRecord);
    res.json({ success: true, data: assets, total: assets.length });
  } catch (error) {
    logger.error("Assets by test error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get single asset
router.get("/assets/:id", async (req, res) => {
  try {
    const asset = await dbHelpers.findById("assets", req.params.id);
    if (!asset || asset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }
    res.json({ success: true, data: normalizeAssetRecord(asset) });
  } catch (error) {
    logger.error("Get asset error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Backward-compatible endpoint
router.get("/media/:id", async (req, res) => {
  try {
    const asset = await dbHelpers.findById("assets", req.params.id);
    if (!asset || asset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }
    res.json({ success: true, data: normalizeAssetRecord(asset) });
  } catch (error) {
    logger.error("Get media error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update asset metadata (name/category)
router.patch("/assets/:id", async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) {
      updates.name = req.body.name.trim().slice(0, 255);
    }
    if (typeof req.body.category === "string" && req.body.category.trim()) {
      updates.category = req.body.category.trim().slice(0, 80);
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    const updated = await dbHelpers.updateById(
      "assets",
      req.params.id,
      updates,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }

    res.json({ success: true, data: normalizeAssetRecord(updated) });
  } catch (error) {
    logger.error("Update asset error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete asset
router.delete("/assets/:id", async (req, res) => {
  try {
    const existingAsset = await dbHelpers.findById("assets", req.params.id);
    if (!existingAsset || existingAsset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }

    try {
      await deleteStoredAssetFile(existingAsset);
    } catch (error) {
      logger.warn("[Assets] File deletion warning:", error.message);
    }

    const deleted = await dbHelpers.softDelete(
      "assets",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }
    res.json({ success: true, message: "Asset deleted" });
  } catch (error) {
    logger.error("Delete asset error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Backward-compatible delete endpoint
router.delete("/media/:id", async (req, res) => {
  try {
    const existingAsset = await dbHelpers.findById("assets", req.params.id);
    if (!existingAsset || existingAsset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    try {
      await deleteStoredAssetFile(existingAsset);
    } catch (error) {
      logger.warn("[Assets] File deletion warning:", error.message);
    }

    const deleted = await dbHelpers.softDelete(
      "assets",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }
    res.json({ success: true, message: "Media deleted" });
  } catch (error) {
    logger.error("Delete media error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ===== FILE UPLOAD =====
const handleAssetUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const mimeType = req.file.mimetype || "application/octet-stream";

    // Accept optional scope: a test-scoped upload stores under
    // assets/tests/<testId>/ (or assets/series/<id>/tests/<id>/) so every
    // image belonging to one test lives under a single prefix/folder.
    const testId = parseAssetId(req.body.testId ?? req.body.test_id);
    const testSeriesId = parseAssetId(req.body.testSeriesId ?? req.body.test_series_id ?? req.body.seriesId);

    const category =
      typeof req.body.category === "string" && req.body.category.trim()
        ? req.body.category.trim().slice(0, 80)
        : testId
          ? "test-image"
          : inferAssetCategory(mimeType);
    const assetName =
      typeof req.body.name === "string" && req.body.name.trim()
        ? req.body.name.trim().slice(0, 255)
        : req.file.originalname;
    const storedFile = await storeUploadedAssetFile(req.file, { category, testId, testSeriesId });

    const assetRecord = await dbHelpers.insertOne("assets", {
      name: assetName,
      type: mimeType,
      category,
      url: storedFile.publicUrl,
      size: req.file.size,
      metadata: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        provider: storedFile.provider,
        storageType: storedFile.storageType,
        storageKey: storedFile.storageKey,
        signedUrl: storedFile.signedUrl || null,
        testId,
        testSeriesId,
      },
      uploadedBy: req.user.id,
      isActive: true,
    });

    res.json({
      success: true,
      data: normalizeAssetRecord(assetRecord),
    });
  } catch (error) {
    logger.error("Asset upload error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

router.post("/assets/upload", upload.single("file"), handleAssetUpload);
router.post("/upload", upload.single("file"), handleAssetUpload);
router.post("/media/upload", upload.single("file"), handleAssetUpload);

export default router;
