import { Router } from 'express'
import { authController } from './auth.controller.js'
import { authRateLimiter, protect } from '../../middleware/auth.middleware.js'
import { lockoutMiddleware } from '../../middleware/lockout.middleware.js'
import EnrollmentService from '../../services/EnrollmentService.js'
import { buildPublicIdLookup, mapLookupId } from '../../shared/utils/public-id-response.js'
import { getUserAttempts } from '../../shared/utils/attempt-utils.js'

const router = Router()

// HIGH-09 FIX: Apply strict rate limiting to auth endpoints
// Also apply lockout middleware to check for account lockout before processing
router.post('/login', lockoutMiddleware, authRateLimiter, authController.login)
router.post('/google', lockoutMiddleware, authRateLimiter, authController.googleLogin)
router.post('/register', authRateLimiter, authController.register)
router.post('/logout', authController.logout)
router.post('/refresh', authRateLimiter, authController.refreshToken)
router.post('/forgot-password', authRateLimiter, authController.forgotPassword)
router.post('/reset-password', authRateLimiter, authController.resetPassword)
router.post('/change-password', protect, authController.changePassword)
router.get('/verify-email/:token', authController.verifyEmail)

// Get current authenticated user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await global.dbHelpers.findById('users', req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const [enrolledSeries, enrolledExams, enrolledStudyMaterials, userAttempts] = await Promise.all([
      EnrollmentService.getEnrolledSeriesIds(global.dbHelpers, req.user.id),
      EnrollmentService.getEnrolledExamIds(global.dbHelpers, req.user.id),
      EnrollmentService.getEnrolledStudyMaterialIds(global.dbHelpers, req.user.id),
      getUserAttempts(req.user.id, global.dbHelpers, { completedOnly: true })
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
      buildPublicIdLookup(global.dbHelpers, 'testSeries', Array.from(attemptedTestsBySeries.keys())),
      buildPublicIdLookup(global.dbHelpers, 'tests', Array.from(attemptedTestIds))
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
