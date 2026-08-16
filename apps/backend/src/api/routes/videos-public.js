import express from 'express';
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

// @route   GET /api/videos
router.get('/', async (req, res) => {
  try {
    let videos = await dbHelpers.find('videos', { isActive: true });
    if (!videos || videos.length === 0) {
      videos = await dbHelpers.find('studyMaterials', { isActive: true, type: 'video' });
    }
    res.json({ success: true, data: videos, count: videos.length });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/videos/:id   (id may be the integer PK or the vid_ UUID public_id)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prefer resolving directly against subject_videos (by integer id or public_id)
    let video = null;
    const subjectVideoRows = await pool.query(
      `SELECT id, study_material_id, chapter_id, title, slug, description, video_url, thumbnail, duration, order_index, is_pro, is_active, created_at, updated_at, display_order, topic_id, is_deleted, deleted_at, deleted_by, public_id_uuid, public_id FROM subject_videos
       WHERE (id::text = $1 OR public_id = $1) AND (is_deleted IS NOT TRUE)
       LIMIT 1`,
      [String(id)]
    );
    if (subjectVideoRows.rows.length > 0) {
      video = subjectVideoRows.rows[0];
    }
    if (!video) {
      video = await dbHelpers.findById('videos', id);
    }
    if (!video && !String(id).includes('_')) {
      // Avoid treating a study-material UUID as a video
      video = await dbHelpers.findById('studyMaterials', id);
    }

    const videoUrl = video?.videoUrl || video?.video_url || video?.url;
    const isActive = video?.is_active ?? video?.isActive;
    const isVideoType = video?.type === 'video' || !!videoUrl;
    if (!video || !isActive || !isVideoType) {
      return res.status(404).json({ success: false, message: 'Video not found' });
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
      instructor: 'Expert Faculty',
      views: video.views ?? 0,
      createdAt: video.created_at ?? video.createdAt,
      studyMaterialId: video.study_material_id ?? video.studyMaterialId,
      chapterId: video.chapter_id ?? video.chapterId,
      topicId: video.topic_id ?? video.topicId,
      subjectId: video.subject_id ?? video.subjectId,
      videoUrl,
      url: videoUrl,
    };
    res.json({ success: true, data: normalized });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// In-memory progress tracker fallback and session storage
const userVideoProgressMap = new Map();
const userVideoActivitySessions = new Map();

// @route   POST /api/videos/:id/view
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE subject_videos SET views = COALESCE(views, 0) + 1 WHERE id::text = $1 OR public_id = $1`,
      [String(id)]
    ).catch(() => {});

    res.json({ success: true, message: 'View recorded' });
  } catch (error) {
    res.json({ success: true, message: 'View ignored' });
  }
});

// @route   POST /api/videos/:id/activity
// @desc    Ingest real-time video telemetry events (play, pause, resume, seek, heartbeat, complete)
router.post('/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, events = [], lastTimestamp, totalTimeSpent } = req.body;
    const userId = req.user?.id || 'guest';
    const key = `${userId}_${id}`;
    const prev = userVideoProgressMap.get(key) || { lastTimestamp: 0, totalTimeSpent: 0 };

    const updated = {
      videoId: id,
      lastTimestamp: parseFloat(lastTimestamp || prev.lastTimestamp || 0),
      totalTimeSpent: Math.max(prev.totalTimeSpent || 0, parseFloat(totalTimeSpent || 0)),
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
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/videos/user/progress-map
// @desc    Get all video progress checkpoints for the current user
router.get('/user/progress-map', async (req, res) => {
  try {
    const userId = req.user?.id || 'guest';
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
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/videos/:id/progress
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { lastTimestamp, totalTimeSpent } = req.body;
    const userId = req.user?.id || 'guest';
    const key = `${userId}_${id}`;
    const prev = userVideoProgressMap.get(key) || { lastTimestamp: 0, totalTimeSpent: 0 };

    const updated = {
      videoId: id,
      lastTimestamp: parseFloat(lastTimestamp || 0),
      totalTimeSpent: (prev.totalTimeSpent || 0) + Math.max(0, parseFloat(totalTimeSpent || 0)),
      updatedAt: Date.now()
    };
    userVideoProgressMap.set(key, updated);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/videos/:id/progress
router.get('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'guest';
    const key = `${userId}_${id}`;
    const progress = userVideoProgressMap.get(key) || { lastTimestamp: 0, totalTimeSpent: 0 };
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
