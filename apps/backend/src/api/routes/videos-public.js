import express from 'express';
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/videos/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let video = await dbHelpers.findById('videos', id);
    if (!video) {
      video = await dbHelpers.findById('studyMaterials', id);
    }
    const isVideoType = video?.type === 'video' || video?.videoUrl || video?.url;
    if (!video || !video.isActive || !isVideoType) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }
    res.json({ success: true, data: video });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
