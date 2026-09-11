import express from "express";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// @route   GET /api/videos
router.get("/", async (req, res) => {
  try {
    let videos = await dbHelpers.find("videos", { isActive: true });
    if (!videos || videos.length === 0) {
      videos = await dbHelpers.find("studyMaterials", {
        isActive: true,
        type: "video",
      });
    }
    res.json({ success: true, data: videos, count: videos.length });
  } catch (error) {
    console.error("Get videos error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/videos/:id   (id may be the integer PK or the vid_ UUID public_id)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Prefer resolving directly against subject_videos (by slug, integer id, or public_id)
    let video = null;
    const subjectVideoRows = await pool.query(
      `SELECT 
         sv.id, sv.study_material_id, sv.chapter_id, sv.topic_id, sv.title, sv.slug, sv.description, 
         sv.video_url, sv.thumbnail, sv.duration, sv.order_index, sv.is_pro, sv.is_active, 
         sv.created_at, sv.updated_at, sv.display_order, sv.is_deleted, 
         sv.deleted_at, sv.deleted_by, sv.public_id_uuid, sv.public_id, sv.fortspy_id, 
         sv.is_encrypted, sv.encryption_type,
         sc.title AS chapter_title,
         sc.slug AS chapter_slug,
         COALESCE(s.name, sm.title) AS subject_name,
         COALESCE(s.slug, sm.slug) AS subject_slug,
         COALESCE(s.id, sc.subject_id, sv.study_material_id) AS subject_id
       FROM subject_videos sv
       LEFT JOIN subject_chapters sc ON sv.chapter_id = sc.id
       LEFT JOIN subjects s ON sc.subject_id = s.id
       LEFT JOIN study_materials sm ON sv.study_material_id = sm.id
       WHERE (sv.slug = $1 OR sv.id::text = $1 OR sv.public_id = $1) AND (sv.is_deleted IS NOT TRUE)
       LIMIT 1`,
      [String(id)],
    );
    if (subjectVideoRows.rows.length > 0) {
      video = subjectVideoRows.rows[0];
    }
    if (!video) {
      video = await dbHelpers.findById("videos", id);
    }
    if (!video && !String(id).includes("_")) {
      // Avoid treating a study-material UUID as a video
      video = await dbHelpers.findById("studyMaterials", id);
    }

    const videoUrl = video?.videoUrl || video?.video_url || video?.url;
    const isActive = video?.is_active ?? video?.isActive;
    const isVideoType = video?.type === "video" || !!videoUrl;
    if (!video || !isActive || !isVideoType) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    const normalized = {
      id: video.public_id || video.id,
      _id: video.public_id || video.id,
      publicId: video.public_id || null,
      title: video.title,
      slug: video.slug,
      description: video.description,
      thumbnail: video.thumbnail,
      duration: video.duration,
      isPro: video.is_pro ?? video.isPro ?? false,
      isFree: !(video.is_pro ?? video.isPro ?? false),
      instructor: "Expert Faculty",
      views: video.views ?? 0,
      createdAt: video.created_at ?? video.createdAt,
      studyMaterialId: video.study_material_id ?? video.studyMaterialId,
      chapterId: video.chapter_id ?? video.chapterId,
      topicId: video.topic_id ?? video.topicId,
      subjectId:
        video.subject_id ?? video.study_material_id ?? video.studyMaterialId,
      subject: video.subject_name || video.subject || "",
      subjectName: video.subject_name || video.subject || "",
      subjectSlug: video.subject_slug || "",
      chapterTitle: video.chapter_title || "",
      chapterSlug: video.chapter_slug || "",
      videoUrl,
      url: videoUrl,
      // FortSpy encrypted playback (migration 141). NOTE: fortspy_key is
      // NEVER exposed — /api/fortspy/generate-stream-token resolves it
      // server-side from fortspy_id.
      fortspyId: video.fortspy_id ?? video.fortspyId ?? null,
      isEncrypted: video.is_encrypted ?? video.isEncrypted ?? false,
      encryptionType:
        video.encryption_type ?? video.encryptionType ?? "AES-256-CTR",
    };
    res.json({ success: true, data: normalized });
  } catch (error) {
    console.error("Get video error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// In-memory progress tracker fallback and session storage
const userVideoProgressMap = new Map();
const userVideoActivitySessions = new Map();

// @route   POST /api/videos/:id/view
router.post("/:id/view", async (req, res) => {
  try {
    const { id } = req.params;
    await pool
      .query(
        `UPDATE subject_videos SET views = COALESCE(views, 0) + 1 WHERE id::text = $1 OR public_id = $1`,
        [String(id)],
      )
      .catch(() => {});

    res.json({ success: true, message: "View recorded" });
  } catch (error) {
    res.json({ success: true, message: "View ignored" });
  }
});

// @route   POST /api/videos/:id/activity
// @desc    Ingest real-time video telemetry events (play, pause, resume, seek, heartbeat, complete)
router.post("/:id/activity", async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, events = [], lastTimestamp, totalTimeSpent } = req.body;
    const userId = req.user?.id || "guest";
    const key = `${userId}_${id}`;
    const prev = userVideoProgressMap.get(key) || {
      lastTimestamp: 0,
      totalTimeSpent: 0,
    };

    const updated = {
      videoId: id,
      lastTimestamp: parseFloat(lastTimestamp || prev.lastTimestamp || 0),
      totalTimeSpent: Math.max(
        prev.totalTimeSpent || 0,
        parseFloat(totalTimeSpent || 0),
      ),
      updatedAt: Date.now(),
    };
    userVideoProgressMap.set(key, updated);

    if (sessionId) {
      const sessionKey = `${userId}_${sessionId}`;
      const existingSession = userVideoActivitySessions.get(sessionKey) || {
        userId,
        videoId: id,
        sessionId,
        events: [],
        startedAt: Date.now(),
      };
      existingSession.events.push(...events);
      existingSession.lastTimestamp = updated.lastTimestamp;
      existingSession.totalTimeSpent = updated.totalTimeSpent;
      existingSession.updatedAt = Date.now();
      userVideoActivitySessions.set(sessionKey, existingSession);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/videos/user/progress-map
// @desc    Get all video progress checkpoints for the current user
router.get("/user/progress-map", async (req, res) => {
  try {
    const userId = req.user?.id || "guest";
    const prefix = `${userId}_`;
    const userMap = {};

    for (const [key, value] of userVideoProgressMap.entries()) {
      if (key.startsWith(prefix)) {
        const videoId = key.substring(prefix.length);
        userMap[videoId] = value;
      }
    }

    res.json({ success: true, data: userMap });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/videos/:id/progress
router.post("/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;
    const { lastTimestamp, totalTimeSpent } = req.body;
    const userId = req.user?.id || "guest";
    const key = `${userId}_${id}`;
    const prev = userVideoProgressMap.get(key) || {
      lastTimestamp: 0,
      totalTimeSpent: 0,
    };

    const updated = {
      videoId: id,
      lastTimestamp: parseFloat(lastTimestamp || 0),
      totalTimeSpent:
        (prev.totalTimeSpent || 0) +
        Math.max(0, parseFloat(totalTimeSpent || 0)),
      updatedAt: Date.now(),
    };
    userVideoProgressMap.set(key, updated);

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/videos/:id/progress
router.get("/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "guest";
    const key = `${userId}_${id}`;
    const progress = userVideoProgressMap.get(key) || {
      lastTimestamp: 0,
      totalTimeSpent: 0,
    };
    res.json({ success: true, data: progress });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
