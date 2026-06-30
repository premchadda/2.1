import { Router } from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { authController } from './auth.controller.js'
import { authRateLimiter, protect } from '../../middleware/auth.middleware.js'
import { lockoutMiddleware } from '../../middleware/lockout.middleware.js'
import EnrollmentService from '../../services/EnrollmentService.js'
import { buildPublicIdLookup, mapLookupId } from '../../shared/utils/public-id-response.js'
import { getUserAttempts } from '../../shared/utils/attempt-utils.js'
import { isFeatureEnabled } from '../../services/SettingsService.js'

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
  } catch {
    // If settings can't be loaded, allow registration (fail open)
    next()
  }
}

// HIGH-09 FIX: Apply strict rate limiting to auth endpoints
router.post('/login', lockoutMiddleware, authRateLimiter, authController.login)
router.post('/google', lockoutMiddleware, authRateLimiter, authController.googleLogin)
router.post('/register', requireRegistrationEnabled, authRateLimiter, authController.register)
router.post('/logout', authController.logout)
router.post('/refresh', authRateLimiter, authController.refreshToken)
router.post('/forgot-password', authRateLimiter, authController.forgotPassword)
router.post('/reset-password', authRateLimiter, authController.resetPassword)
router.post('/change-password', protect, authController.changePassword)
router.get('/verify-email/:token', authController.verifyEmail)

// Get current authenticated user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await dbHelpers.findById('users', req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const [enrolledSeries, enrolledExams, enrolledStudyMaterials, userAttempts] = await Promise.all([
      EnrollmentService.getEnrolledSeriesIds(dbHelpers, req.user.id),
      EnrollmentService.getEnrolledExamIds(dbHelpers, req.user.id),
      EnrollmentService.getEnrolledStudyMaterialIds(dbHelpers, req.user.id),
      getUserAttempts(req.user.id, dbHelpers, { completedOnly: true })
    ])

    const attemptedTestsBySeries = new Map()
    const attemptedTestIds = new Set()

    userAttempts.forEach((attempt) => {
      if (attempt.isReattempt === true || attempt.is_reattempt === true) {
        return
      }

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
    })

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

    // Remove sensitive fields from response
    const { 
      password: _, 
      resetPasswordToken: __, 
      resetPasswordExpires: ___,
      emailVerificationToken: ____,
      ...safeUser 
    } = user

    res.json({
      success: true,
      data: {
        ...safeUser,
        enrolledSeries,
        enrolledExams,
        enrolledStudyMaterials,
        attemptedTests,
        attemptedTestIds: Array.from(attemptedTestIds).map((testId) => mapLookupId(testId, attemptedTestsLookup, testId))
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

export default router
