import crypto from 'crypto'
import { pool } from '../infrastructure/database/postgres-helpers.js'

/**
 * Certificate Generation Engine
 * Generates verified exam/test completion certificates with cryptographic SHA-256 verification hash.
 *
 * SECURITY FIX (Phase 3.9): verifyCertificate now does a DB lookup instead of
 * accepting any arbitrary string. A per-certificate random salt makes the hash
 * unguessable even if the attacker knows the attempt_id/user_id/test_id.
 */
class CertificateService {
  /**
   * Ensure the certificates table exists. Called lazily on first use.
   */
  async ensureTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS certificates (
          id SERIAL PRIMARY KEY,
          attempt_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          test_id INTEGER,
          hash VARCHAR(64) UNIQUE NOT NULL,
          salt VARCHAR(32) NOT NULL,
          recipient_name VARCHAR(255),
          test_title VARCHAR(500),
          score NUMERIC,
          total_marks NUMERIC,
          percentage NUMERIC,
          issued_at TIMESTAMPTZ DEFAULT NOW(),
          is_revoked BOOLEAN DEFAULT FALSE,
          revoked_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_certificates_hash ON certificates(hash) WHERE is_revoked = FALSE`)
    } catch (err) {
      // Table creation is best-effort; if it fails (e.g., permissions),
      // verification will fall back to the legacy behavior (log + reject all).
      console.error('[Certificate] Table creation failed:', err.message)
    }
  }

  /**
   * Generate certificate payload for a completed test attempt.
   */
  async generateCertificate(attemptId, userId) {
    const { rows } = await pool.query(
      `SELECT a.id as attempt_id, a.user_id, a.test_id, a.score, a.total_marks,
              a.submitted_at, a.created_at, t.title as test_title, u.name as user_name, u.email as user_email
       FROM attempts a
       JOIN tests t ON a.test_id = t.id
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [attemptId, userId]
    )

    if (rows.length === 0) {
      return { success: false, message: 'Attempt not found or access denied', statusCode: 404 }
    }

    const attempt = rows[0]
    const score = Number(attempt.score || 0)
    const totalMarks = Number(attempt.total_marks || 100)
    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(1)) : 0

    // Generate a per-certificate random salt (32 bytes) so the hash is
    // unguessable even if the attacker knows attempt_id/user_id/test_id.
    const salt = crypto.randomBytes(16).toString('hex')
    const verificationData = `${attempt.attempt_id}:${attempt.user_id}:${attempt.test_id}:${attempt.submitted_at || attempt.created_at}:${salt}`
    const certificateHash = crypto.createHash('sha256').update(verificationData).digest('hex')

    const certificateId = `CERT-${attempt.attempt_id}-${certificateHash.substring(0, 6)}`

    // Persist the certificate so verifyCertificate can look it up.
    try {
      await this.ensureTable()
      await pool.query(
        `INSERT INTO certificates (attempt_id, user_id, test_id, hash, salt, recipient_name, test_title, score, total_marks, percentage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (hash) DO NOTHING`,
        [
          attempt.attempt_id,
          attempt.user_id,
          attempt.test_id,
          certificateHash,
          salt,
          attempt.user_name || 'Student',
          attempt.test_title || 'Competitive Exam Mock',
          score,
          totalMarks,
          percentage,
        ]
      )
    } catch (err) {
      // Non-fatal — certificate is still returned, but verification may fail.
      console.error('[Certificate] Persist failed (non-fatal):', err.message)
    }

    const certificate = {
      certificateId,
      verificationHash: certificateHash,
      recipientName: attempt.user_name || 'Student',
      testTitle: attempt.test_title || 'Competitive Exam Mock',
      score,
      totalMarks,
      percentage,
      issuedAt: attempt.submitted_at || attempt.created_at || new Date().toISOString(),
      issuer: 'Trstprep Learning Engine',
      verificationUrl: `/api/certificates/verify/${certificateHash}`
    }

    return { success: true, data: certificate }
  }

  /**
   * Verify certificate by hash — does a DB lookup instead of accepting any string.
   */
  async verifyCertificate(hash) {
    if (!hash || typeof hash !== 'string') {
      return { isValid: false, message: 'Invalid verification hash' }
    }

    try {
      await this.ensureTable()
      const { rows } = await pool.query(
        `SELECT c.*, u.name as user_name, t.title as test_title
         FROM certificates c
         LEFT JOIN users u ON c.user_id = u.id
         LEFT JOIN tests t ON c.test_id = t.id
         WHERE c.hash = $1 AND c.is_revoked = FALSE`,
        [hash]
      )

      if (rows.length === 0) {
        return { isValid: false, message: 'Certificate not found or has been revoked' }
      }

      const cert = rows[0]
      return {
        isValid: true,
        verificationHash: hash,
        status: 'AUTHENTIC_TRSTPREP_CERTIFICATE',
        certificateId: `CERT-${cert.attempt_id}-${hash.substring(0, 6)}`,
        recipientName: cert.recipient_name || cert.user_name || 'Student',
        testTitle: cert.test_title || cert.test_title || 'Competitive Exam Mock',
        score: Number(cert.score || 0),
        totalMarks: Number(cert.total_marks || 100),
        percentage: Number(cert.percentage || 0),
        issuedAt: cert.issued_at,
      }
    } catch (err) {
      console.error('[Certificate] Verification failed:', err.message)
      return { isValid: false, message: 'Certificate verification system unavailable' }
    }
  }

  /**
   * Revoke a certificate (admin only).
   */
  async revokeCertificate(hash) {
    try {
      await this.ensureTable()
      const { rows } = await pool.query(
        `UPDATE certificates SET is_revoked = TRUE, revoked_at = NOW() WHERE hash = $1 AND is_revoked = FALSE RETURNING id`,
        [hash]
      )
      return rows.length > 0
    } catch (err) {
      console.error('[Certificate] Revoke failed:', err.message)
      return false
    }
  }
}

export default new CertificateService()
