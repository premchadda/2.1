import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import { Readable } from "node:stream";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { validateCsrfToken } from "../../middleware/csrf.middleware.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";
import logger from "../../infrastructure/logger/logger.js";
import { fortskyService } from "../../services/fortspyService.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import {
  getRedisClient,
  isRedisReady,
} from "../../infrastructure/cache/redisClient.js";

const router = express.Router();

// Configure multer for video uploads (100MB limit for videos)
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/avi",
      "video/quicktime",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only video files are allowed."), false);
    }
  },
});

// Rate limiter for stream-token issuance / streaming (brute-force + token farming).
const fortspyStreamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many streaming requests, please try again later.",
  },
});

// Server-side key store: raw decryption keys are NEVER embedded in the JWT.
// POST /generate-stream-token stores { key } here keyed by jti; the JWT carries
// only { videoId, jti, type }. GET /stream/:id resolves the key server-side.
// Primary store is Redis (shared across backend instances); an in-memory Map
// is the single-instance fallback. Entries expire after STREAM_TOKEN_TTL_MS
// (Redis TTL mirrors the sweep; the Map is swept opportunistically on store).
const STREAM_TOKEN_TTL_MS = 10 * 60 * 1000;
const STREAM_KEY_REDIS_PREFIX = "fortspy:streamkey:";
const streamKeyStore = new Map(); // jti -> { key, videoId, userId, expiresAt }

const redisStreamKeyStore = {
  async set(jti, entry) {
    const redis = isRedisReady() ? getRedisClient() : null;
    if (redis) {
      try {
        // TTL with a small buffer over JWT expiry so the key outlives the
        // token that references it (never the reverse).
        await redis.set(
          STREAM_KEY_REDIS_PREFIX + jti,
          JSON.stringify(entry),
          "EX",
          Math.ceil((STREAM_TOKEN_TTL_MS + 30_000) / 1000),
        );
        return;
      } catch (err) {
        logger.warn(
          "[fortspy] redis stream-key set failed, falling back to memory:",
          err?.message || err,
        );
      }
    }
    storeStreamKey(jti, entry);
  },
  async get(jti) {
    const redis = isRedisReady() ? getRedisClient() : null;
    if (redis) {
      try {
        const raw = await redis.get(STREAM_KEY_REDIS_PREFIX + jti);
        if (raw) {
          const entry = JSON.parse(raw);
          if (entry.expiresAt <= Date.now()) return null;
          return entry;
        }
        // Key absent in Redis: fall through to memory in case THIS instance
        // issued it while Redis was down.
      } catch (err) {
        logger.warn(
          "[fortspy] redis stream-key get failed, falling back to memory:",
          err?.message || err,
        );
      }
    }
    return resolveStreamKey(jti);
  },
};

const storeStreamKey = (jti, entry) => {
  // Opportunistic sweep of expired entries to bound memory.
  const now = Date.now();
  for (const [k, v] of streamKeyStore) {
    if (v.expiresAt <= now) streamKeyStore.delete(k);
  }
  streamKeyStore.set(jti, entry);
};

const resolveStreamKey = (jti) => {
  const entry = streamKeyStore.get(jti);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    streamKeyStore.delete(jti);
    return null;
  }
  return entry;
};

// Entitlement gate: admins bypass; everyone else needs an active subscription
// (incl. grace period) OR an enrollment row. Fail-closed: missing tables are
// skipped (42P01), other DB errors become 500, no-entitlement becomes 403.
const hasVideoEntitlement = async (userId) => {
  if (!userId) return false;
  try {
    const sub = await pool.query(
      `SELECT 1 FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'grace_period') AND (expiry_date IS NULL OR expiry_date > NOW()) LIMIT 1`,
      [userId],
    );
    if (sub.rows.length > 0) return true;
  } catch (err) {
    if (err?.code !== "42P01") throw err;
  }
  try {
    const enr = await pool.query(
      `SELECT 1 FROM enrollments WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (enr.rows.length > 0) return true;
  } catch (err) {
    if (err?.code !== "42P01") throw err;
  }
  return false;
};

const requireVideoEntitlement = async (req, res, next) => {
  try {
    if (
      req.user?.isAdmin ||
      req.user?.role === "admin" ||
      req.user?.role === "super_admin"
    ) {
      return next();
    }
    const entitled = await hasVideoEntitlement(req.user?.id);
    if (!entitled) {
      return res.status(403).json({
        success: false,
        message: "No active subscription or enrollment for this video",
      });
    }
    next();
  } catch (err) {
    logger.error("[fortspy] entitlement check failed:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to verify entitlement" });
  }
};

// Verify a short-lived fortspy-stream JWT issued by /generate-stream-token.
// The token MUST be supplied via the X-Stream-Token header (NOT the
// Authorization header — that carries the user's access token for `protect`,
// and NOT a query string — tokens in URLs leak into access logs, browser
// history, referer headers, and proxy/CDN logs).
const verifyStreamToken = async (req, res, next) => {
  const token = req.headers["x-stream-token"];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Stream token is required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "fortspy-stream") {
      return res.status(401).json({
        success: false,
        message: "Invalid stream token type",
      });
    }
    // Resolve the raw key server-side — it is never carried in the JWT.
    const entry = decoded.jti
      ? await redisStreamKeyStore.get(decoded.jti)
      : null;
    if (!entry) {
      return res.status(401).json({
        success: false,
        message: "Stream token is invalid or expired",
      });
    }
    req.streamToken = { ...decoded, key: entry.key };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Stream token is invalid or expired",
    });
  }
};

/**
 * @route   GET /api/fortspy/health
 * @desc    Check if FortSpy service is available
 * @access  Public
 */
router.get("/health", async (req, res) => {
  try {
    const isHealthy = await fortskyService.healthCheck();
    res.json({
      success: true,
      data: {
        available: isHealthy,
        baseUrl: process.env.FORTSPY_URL || "http://localhost:5002",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check FortSpy health",
      error: sanitizeErrorMessage(error),
    });
  }
});

/**
 * @route   POST /api/fortspy/keygen
 * @desc    Generate a new AES-256 encryption key
 * @access  Private (Admin)
 */
router.post("/keygen", protect, admin, validateCsrfToken, async (req, res) => {
  try {
    const result = await fortskyService.generateKey();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("FortSpy keygen error:", error);
    res.status(500).json({
      success: false,
      message:
        sanitizeErrorMessage(error) || "Failed to generate encryption key",
    });
  }
});

/**
 * @route   POST /api/fortspy/encrypt
 * @desc    Encrypt a video file using FortSpy AES-256
 * @access  Private (Admin)
 */
router.post(
  "/encrypt",
  protect,
  admin,
  validateCsrfToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No video file provided",
        });
      }

      const result = await fortskyService.encryptVideo(
        req.file.buffer,
        req.file.originalname,
        { key: req.body.key },
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("FortSpy encrypt error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error) || "Failed to encrypt video",
      });
    }
  },
);

/**
 * @route   POST /api/fortspy/decrypt
 * @desc    Decrypt an encrypted video
 * @access  Private (Admin)
 */
router.post("/decrypt", protect, admin, validateCsrfToken, async (req, res) => {
  try {
    const { id, key } = req.body;

    if (!id || !key) {
      return res.status(400).json({
        success: false,
        message: "Video ID and decryption key are required",
      });
    }

    const decryptedBuffer = await fortskyService.decryptVideo(id, key);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", decryptedBuffer.length);
    res.send(decryptedBuffer);
  } catch (error) {
    console.error("FortSpy decrypt error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || "Failed to decrypt video",
    });
  }
});

/**
 * @route   GET /api/fortspy/stream/:id
 * @desc    Stream decrypted video frames (MJPEG)
 * @access  Private (requires valid fortspy-stream token)
 *
 * The decryption key is supplied via a short-lived signed JWT issued by
 * /generate-stream-token, transmitted ONLY as an X-Stream-Token header. The
 * key is never accepted as a raw query parameter to avoid leakage into
 * logs, browser history, and referer headers.
 */
router.get(
  "/stream/:id",
  protect,
  requireVideoEntitlement,
  fortspyStreamLimiter,
  verifyStreamToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { videoId, key, userId } = req.streamToken;

      if (String(videoId) !== String(id)) {
        return res.status(403).json({
          success: false,
          message: "Stream token does not match this video",
        });
      }

      // Bind token to the issuing user (prevents token sharing across accounts).
      if (
        userId &&
        req.user?.id &&
        String(userId) !== String(req.user.id) &&
        !req.user?.isAdmin
      ) {
        return res.status(403).json({
          success: false,
          message: "Stream token was issued to a different user",
        });
      }

      const streamUrl = fortskyService.getStreamUrl(id, key);

      // Proxy the stream from FortSpy
      const response = await fetch(streamUrl);

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to stream video",
        });
      }

      res.setHeader(
        "Content-Type",
        "multipart/x-mixed-replace; boundary=frame",
      );
      // undici fetch bodies are WHATWG streams (no .pipe) — bridge to Node.
      Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
      console.error("FortSpy stream error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error) || "Failed to stream video",
      });
    }
  },
);

/**
 * @route   GET /api/fortspy/info/:id
 * @desc    Get encrypted video metadata
 * @access  Private
 */
router.get(
  "/info/:id",
  protect,
  requireVideoEntitlement,
  fortspyStreamLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      const info = await fortskyService.getVideoInfo(id);
      res.json({ success: true, data: info });
    } catch (error) {
      console.error("FortSpy info error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error) || "Failed to get video info",
      });
    }
  },
);

/**
 * @route   POST /api/fortspy/generate-stream-token
 * @desc    Generate a temporary token for encrypted video streaming
 * @access  Private
 */
router.post(
  "/generate-stream-token",
  protect,
  requireVideoEntitlement,
  fortspyStreamLimiter,
  async (req, res) => {
    try {
      const { videoId } = req.body;
      let { key } = req.body;

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: "Video ID is required",
        });
      }

      // Prefer the server-stored key (migration 141: subject_videos.fortspy_key)
      // so clients never handle decryption keys. An explicit key in the body
      // is still honored for backwards compatibility (e.g. study-material
      // flows that carry their own keys).
      if (!key) {
        const { rows } = await pool.query(
          `SELECT fortspy_key, is_encrypted FROM subject_videos
          WHERE fortspy_id = $1 OR id::text = $1 OR public_id = $1
          LIMIT 1`,
          [String(videoId)],
        );
        if (rows.length === 0 || !rows[0].fortspy_key) {
          return res.status(404).json({
            success: false,
            message: "No encrypted stream registered for this video",
          });
        }
        key = rows[0].fortspy_key;
      }

      // Short-lived token (10 min). The raw key is stored server-side keyed by
      // jti and resolved in /stream/:id — the signed payload carries no secret,
      // only { videoId, jti, userId, type }, and is Bearer-header-only.
      const jti = randomUUID();
      await redisStreamKeyStore.set(jti, {
        key,
        videoId: String(videoId),
        userId: req.user?.id,
        expiresAt: Date.now() + STREAM_TOKEN_TTL_MS,
      });
      const token = jwt.sign(
        {
          videoId: String(videoId),
          jti,
          userId: req.user?.id,
          type: "fortspy-stream",
        },
        process.env.JWT_SECRET,
        { expiresIn: "10m" },
      );

      res.json({
        success: true,
        data: {
          token,
          streamUrl: `/api/fortspy/stream/${videoId}`,
          expiresIn: 600,
        },
      });
    } catch (error) {
      console.error("FortSpy token generation error:", error);
      res.status(500).json({
        success: false,
        message:
          sanitizeErrorMessage(error) || "Failed to generate stream token",
      });
    }
  },
);

export default router;
