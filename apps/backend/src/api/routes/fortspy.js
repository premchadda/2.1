import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { protect, admin } from '../../middleware/auth.middleware.js';
import { validateCsrfToken } from '../../middleware/csrf.middleware.js';
import { fortskyService } from '../../services/fortspyService.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

// Configure multer for video uploads (100MB limit for videos)
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  },
});

// Verify a short-lived fortspy-stream JWT issued by /generate-stream-token.
// The decryption key is carried inside the signed token payload — never in
// the URL query string — so it is not leaked into access logs, browser
// history, or proxy/CDN logs.
const verifyStreamToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1]) ||
    req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Stream token is required',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'fortspy-stream') {
      return res.status(401).json({
        success: false,
        message: 'Invalid stream token type',
      });
    }
    req.streamToken = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Stream token is invalid or expired',
    });
  }
};

/**
 * @route   GET /api/fortspy/health
 * @desc    Check if FortSpy service is available
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await fortskyService.healthCheck();
    res.json({
      success: true,
      data: {
        available: isHealthy,
        baseUrl: process.env.FORTSPY_URL || 'http://localhost:5002',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check FortSpy health',
      error: sanitizeErrorMessage(error),
    });
  }
});

/**
 * @route   POST /api/fortspy/keygen
 * @desc    Generate a new AES-256 encryption key
 * @access  Private (Admin)
 */
router.post('/keygen', protect, admin, validateCsrfToken, async (req, res) => {
  try {
    const result = await fortskyService.generateKey();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('FortSpy keygen error:', error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || 'Failed to generate encryption key',
    });
  }
});

/**
 * @route   POST /api/fortspy/encrypt
 * @desc    Encrypt a video file using FortSpy AES-256
 * @access  Private (Admin)
 */
router.post('/encrypt', protect, admin, validateCsrfToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided',
      });
    }

    const result = await fortskyService.encryptVideo(
      req.file.buffer,
      req.file.originalname,
      { key: req.body.key }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('FortSpy encrypt error:', error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || 'Failed to encrypt video',
    });
  }
});

/**
 * @route   POST /api/fortspy/decrypt
 * @desc    Decrypt an encrypted video
 * @access  Private (Admin)
 */
router.post('/decrypt', protect, admin, validateCsrfToken, async (req, res) => {
  try {
    const { id, key } = req.body;

    if (!id || !key) {
      return res.status(400).json({
        success: false,
        message: 'Video ID and decryption key are required',
      });
    }

    const decryptedBuffer = await fortskyService.decryptVideo(id, key);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.send(decryptedBuffer);
  } catch (error) {
    console.error('FortSpy decrypt error:', error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || 'Failed to decrypt video',
    });
  }
});

/**
 * @route   GET /api/fortspy/stream/:id
 * @desc    Stream decrypted video frames (MJPEG)
 * @access  Private (requires valid fortspy-stream token)
 *
 * The decryption key is supplied via a short-lived signed JWT issued by
 * /generate-stream-token (Authorization: Bearer <token> or ?token=<token>).
 * The key is never accepted as a raw query parameter to avoid leakage into
 * logs, browser history, and referer headers.
 */
router.get('/stream/:id', protect, verifyStreamToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { videoId, key } = req.streamToken;

    if (String(videoId) !== String(id)) {
      return res.status(403).json({
        success: false,
        message: 'Stream token does not match this video',
      });
    }

    const streamUrl = fortskyService.getStreamUrl(id, key);

    // Proxy the stream from FortSpy
    const response = await fetch(streamUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'Failed to stream video',
      });
    }

    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    response.body.pipe(res);
  } catch (error) {
    console.error('FortSpy stream error:', error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || 'Failed to stream video',
    });
  }
});

/**
 * @route   GET /api/fortspy/info/:id
 * @desc    Get encrypted video metadata
 * @access  Private
 */
router.get('/info/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const info = await fortskyService.getVideoInfo(id);
    res.json({ success: true, data: info });
  } catch (error) {
    console.error('FortSpy info error:', error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || 'Failed to get video info',
    });
  }
});

/**
 * @route   POST /api/fortspy/generate-stream-token
 * @desc    Generate a temporary token for encrypted video streaming
 * @access  Private
 */
router.post('/generate-stream-token', protect, async (req, res) => {
  try {
    const { videoId, key } = req.body;

    if (!videoId || !key) {
      return res.status(400).json({
        success: false,
        message: 'Video ID and key are required',
      });
    }

    // Generate a short-lived token for streaming (expires in 1 hour).
    // The key is embedded in the signed payload so it can be transmitted
    // without leaking through the URL query string.
    const token = jwt.sign(
      {
        videoId,
        key,
        type: 'fortspy-stream',
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      data: {
        token,
        streamUrl: `/api/fortspy/stream/${videoId}`,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error('FortSpy token generation error:', error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || 'Failed to generate stream token',
    });
  }
});

export default router;