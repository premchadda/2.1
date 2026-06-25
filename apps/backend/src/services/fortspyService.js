import dotenv from 'dotenv';

dotenv.config();

/**
 * FortSpy Integration Service
 * 
 * Communicates with the FortSpy Python Flask API for video encryption/decryption.
 * 
 * FortSpy API Endpoints:
 *   POST /api/encrypt      - Encrypt a video file
 *   POST /api/decrypt      - Decrypt an encrypted video
 *   GET  /api/stream/:id   - Stream decrypted frames (MJPEG)
 *   GET  /api/info/:id     - Get video metadata
 *   POST /api/keygen       - Generate AES encryption key
 */

const FORTSPY_BASE_URL = process.env.FORTSPY_URL || 'http://localhost:5002';
const FORTSPY_TIMEOUT = parseInt(process.env.FORTSPY_TIMEOUT || '30000', 10);

class FortSpyService {
  constructor() {
    this.baseUrl = FORTSPY_BASE_URL;
    this.timeout = FORTSPY_TIMEOUT;
  }

  /**
   * Check if FortSpy service is available
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate a new AES-256 encryption key
   */
  async generateKey() {
    const response = await fetch(`${this.baseUrl}/api/keygen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Key generation failed' }));
      throw new Error(error.message || `FortSpy keygen failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Encrypt a video file
   * @param {Buffer} videoBuffer - The video file buffer
   * @param {string} filename - Original filename
   * @param {Object} options - Encryption options
   * @returns {Object} Encryption result with encrypted file info
   */
  async encryptVideo(videoBuffer, filename, options = {}) {
    const formData = new FormData();
    const blob = new Blob([videoBuffer], { type: 'video/mp4' });
    formData.append('file', blob, filename);

    if (options.key) {
      formData.append('key', options.key);
    }

    const response = await fetch(`${this.baseUrl}/api/encrypt`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(this.timeout * 3), // Encrypt can take longer
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Encryption failed' }));
      throw new Error(error.message || `FortSpy encryption failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Decrypt an encrypted video and return the decrypted buffer
   * @param {string} encryptedId - The encrypted video ID from FortSpy
   * @param {string} key - The AES decryption key
   * @returns {Buffer} Decrypted video buffer
   */
  async decryptVideo(encryptedId, key) {
    const response = await fetch(`${this.baseUrl}/api/decrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: encryptedId, key }),
      signal: AbortSignal.timeout(this.timeout * 2),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Decryption failed' }));
      throw new Error(error.message || `FortSpy decryption failed with status ${response.status}`);
    }

    const result = await response.json();

    if (result.url) {
      // If the API returns a URL, fetch the decrypted file
      const fileResponse = await fetch(result.url, {
        signal: AbortSignal.timeout(this.timeout * 2),
      });
      return Buffer.from(await fileResponse.arrayBuffer());
    }

    return Buffer.from(result.data, 'base64');
  }

  /**
   * Get streaming URL for a video (for real-time decryption playback)
   * @param {string} encryptedId - The encrypted video ID
   * @param {string} key - The AES decryption key
   * @returns {string} MJPEG streaming URL
   */
  getStreamUrl(encryptedId, key) {
    return `${this.baseUrl}/api/stream/${encryptedId}?key=${encodeURIComponent(key)}`;
  }

  /**
   * Get video metadata/info
   * @param {string} encryptedId - The encrypted video ID
   * @returns {Object} Video metadata
   */
  async getVideoInfo(encryptedId) {
    const response = await fetch(`${this.baseUrl}/api/info/${encryptedId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to get video info' }));
      throw new Error(error.message || `FortSpy info failed with status ${response.status}`);
    }

    return response.json();
  }
}

export const fortskyService = new FortSpyService();
export default fortskyService;
