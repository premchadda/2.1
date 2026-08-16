import { Router } from 'express'
import { generateCsrfToken, storeCsrfToken, validateCsrfToken } from '../../middleware/csrf.middleware.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { authController } from './auth.controller.js'
import { authRateLimiter, protect } from '../../middleware/auth.middleware.js'
import { lockoutMiddleware } from '../../middleware/lockout.middleware.js'
import EnrollmentService from '../../services/EnrollmentService.js'
import { buildPublicIdLookup, mapLookupId } from '../../shared/utils/public-id-response.js'
import { getUserAttempts } from '../../shared/utils/attempt-utils.js'
import { isFeatureEnabled } from '../../services/SettingsService.js'
import { responseCache } from '../../middleware/responseCache.middleware.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = Router()

// Middleware: block registration if userRegistration feature is disabled
const requireRegistrationEnabled = async (req, res, next) => {
  try {
    const enabled = await isFeatureEnabled('userRegistration')
    if (!enabled) {
      return res.status(403).json({
        success: false,
        message: 'New registrations are currently disabled. Please try again later.',
      })
    }
    next()
  } catch (err) {
    // Fail-closed: if we cannot verify whether registration is enabled,
    // block the request. An attacker who can cause a DB error on this
    // query could otherwise bypass the feature flag entirely.
    console.error('[Auth] Registration feature check failed (fail-closed):', err.message)
    return res.status(503).json({
      success: false,
      message: 'Registration is temporarily unavailable. Please try again later.',
      code: 'REGISTRATION_UNAVAILABLE',
    })
  }
}

// HIGH-09 FIX: Apply strict rate limiting to auth endpoints
router.post('/login', lockoutMiddleware, authRateLimiter, authController.login)
router.post('/login/2fa', lockoutMiddleware, authRateLimiter, authController.login2FA)
router.post('/google', lockoutMiddleware, authRateLimiter, authController.googleLogin)
router.post('/register', requireRegistrationEnabled, authRateLimiter, authController.register)
router.post('/logout', protect, validateCsrfToken, authController.logout)
router.post('/refresh', authRateLimiter, authController.refreshToken)
router.post('/forgot-password', authRateLimiter, authController.forgotPassword)
router.post('/reset-password', authRateLimiter, authController.resetPassword)
router.post('/change-password', protect, validateCsrfToken, authController.changePassword)
router.get('/verify-email/:token', authRateLimiter, authController.verifyEmail)
router.post('/resend-verification', authRateLimiter, authController.resendVerification)

// Two-factor authentication (TOTP) management — requires an authenticated session
router.get('/2fa/status', protect, authController.getTwoFactorStatus)
router.post('/2fa/enroll', protect, lockoutMiddleware, authRateLimiter, authController.enrollTwoFactor)
router.post('/2fa/verify', protect, lockoutMiddleware, authRateLimiter, authController.verifyTwoFactor)
router.post('/2fa/backup-codes/regenerate', protect, lockoutMiddleware, authRateLimiter, authController.regenerateTwoFactorBackupCodes)
router.post('/2fa/disable', protect, lockoutMiddleware, authRateLimiter, authController.disableTwoFactor)

// Get current authenticated user
router.get('/me', protect, responseCache("auth-me", 30), async (req, res) => {
  try {
    // PERF: Use user already loaded by protect middleware (avoids redundant DB query)
    const user = req.user

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const [enrollments, userAttempts] = await Promise.all([
      dbHelpers.find('enrollments', { userId: user.id, isActive: true }),
      // PERF: /me only needs series/test IDs + completion flags to derive
      // enrollment/attempt summaries. Narrow the projection so we don't pull
      // the full attempt rows (large JSONB answer/section payloads) for users
      // with thousands of attempts — was a major contributor to the ~18s /me.
      getUserAttempts(user.id, dbHelpers, {
        completedOnly: true,
        columns: ['id', 'user_id', 'test_id', 'series_id', 'is_completed', 'is_reattempt', 'submitted_at', 'created_at'],
      })
    ])

    // Derive enrollment IDs from the single enrollments query
    const seriesIdSet = new Set()
    const examIdSet = new Set()
    const materialIdSet = new Set()

    for (const e of enrollments) {
      if (e.seriesId != null) seriesIdSet.add(parseInt(e.seriesId))
      if (e.examId != null) examIdSet.add(parseInt(e.examId))
      if (e.studyMaterialId != null) materialIdSet.add(parseInt(e.studyMaterialId))
    }

    // Fallback to legacy user fields if enrollments table is empty
    let enrolledSeries = [...seriesIdSet]
    let enrolledExams = [...examIdSet]
    let enrolledStudyMaterials = [...materialIdSet]

    if (enrolledSeries.length === 0 && enrolledExams.length === 0 && enrolledStudyMaterials.length === 0) {
      const parseLegacy = (val) => {
        if (!val) return []
        if (Array.isArray(val)) return val
        if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
          return val.slice(1, -1).split(',').map(Number).filter(n => !isNaN(n))
        }
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
      }
      enrolledSeries = parseLegacy(user.enrolledSeries ?? user.enrolled_series)
      enrolledExams = parseLegacy(user.enrolledExams ?? user.enrolled_exams)
      enrolledStudyMaterials = parseLegacy(user.enrolledStudyMaterials ?? user.enrolled_study_materials)
    }

    const attemptedTestsBySeries = new Map()
    const attemptedTestIds = new Set()

    for (const attempt of userAttempts) {
      if (attempt.isReattempt === true || attempt.is_reattempt === true) continue

      const seriesId = attempt.seriesId || attempt.series_id
      const testId = attempt.testId || attempt.test_id

      if (seriesId && testId) {
        const seriesKey = String(seriesId)
        if (!attemptedTestsBySeries.has(seriesKey)) {
          attemptedTestsBySeries.set(seriesKey, new Set())
        }
        attemptedTestsBySeries.get(seriesKey).add(String(testId))
      }

      if (testId) {
        attemptedTestIds.add(String(testId))
      }
    }

    const [attemptedSeriesLookup, attemptedTestsLookup] = await Promise.all([
      buildPublicIdLookup(dbHelpers, 'testSeries', Array.from(attemptedTestsBySeries.keys())),
      buildPublicIdLookup(dbHelpers, 'tests', Array.from(attemptedTestIds))
    ])

    const attemptedTests = Object.fromEntries(
      Array.from(attemptedTestsBySeries.entries()).map(([seriesId, testIds]) => [
        mapLookupId(seriesId, attemptedSeriesLookup, seriesId),
        testIds.size
      ])
    )

    // Load permissions for admin users
    let permissions = user.permissions || []
    if (user.role === 'super_admin') {
      permissions = ['*']
    } else if ((user.role === 'admin' || user.isAdmin) && permissions.length === 0) {
      try {
        const { rows: permRows } = await dbHelpers.pool.query(
          `SELECT DISTINCT p.name
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = $1`,
          [user.id]
        )
        if (permRows.length > 0) {
          permissions = permRows.map((r) => r.name)
        } else {
          permissions = [
            'users:view', 'users:create', 'users:edit', 'users:delete',
            'tests:view', 'tests:create', 'tests:edit', 'tests:delete',
            'content:view', 'content:create', 'content:edit', 'content:delete',
            'settings:view', 'settings:create', 'settings:edit', 'settings:delete',
            'monetization:view', 'monetization:create', 'monetization:edit', 'monetization:delete',
            'communications:view', 'communications:create', 'communications:edit', 'communications:delete',
            'moderation:view', 'moderation:create', 'moderation:edit', 'moderation:delete',
            'audit:view', 'audit:create', 'audit:edit', 'audit:delete',
            'analytics:view', 'analytics:create', 'analytics:edit', 'analytics:delete',
          ]
        }
      } catch {
        permissions = [
          'users:view', 'users:create', 'users:edit', 'users:delete',
          'tests:view', 'tests:create', 'tests:edit', 'tests:delete',
          'content:view', 'content:create', 'content:edit', 'content:delete',
          'settings:view', 'settings:create', 'settings:edit', 'settings:delete',
          'monetization:view', 'monetization:create', 'monetization:edit', 'monetization:delete',
          'communications:view', 'communications:create', 'communications:edit', 'communications:delete',
          'moderation:view', 'moderation:create', 'moderation:edit', 'moderation:delete',
          'audit:view', 'audit:create', 'audit:edit', 'audit:delete',
          'analytics:view', 'analytics:create', 'analytics:edit', 'analytics:delete',
        ]
      }
    }

    // Remove sensitive fields from response
    const {
      password: _,
      resetPasswordToken: __,
      resetPasswordExpires: ___,
      emailVerificationToken: ____,
      ...safeUser
    } = user

    // Generate and store CSRF token for the session
    let csrfToken = null
    if (req.authToken) {
      csrfToken = generateCsrfToken()
      await storeCsrfToken(req.authToken, csrfToken)
    }

    res.json({
      success: true,
      data: {
        ...safeUser,
        permissions,
        enrolledSeries,
        enrolledExams,
        enrolledStudyMaterials,
        attemptedTests,
        attemptedTestIds: Array.from(attemptedTestIds).map((testId) => mapLookupId(testId, attemptedTestsLookup, testId)),
        csrfToken
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

export default router
