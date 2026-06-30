import { Router } from 'express'
import { getPublicSettings } from '../../services/SettingsService.js'

const router = Router()

/**
 * @route   GET /api/settings/public
 * @desc    Get public-facing site settings (features, maintenance, coming soon)
 * @access  Public — no auth required, no sensitive fields returned
 */
router.get('/public', async (req, res) => {
  try {
    const settings = await getPublicSettings()
    // Cache for 30 seconds on client, 60s on CDN — settings don't change often
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60')
    res.json({ success: true, data: settings })
  } catch (error) {
    // Graceful fallback — never block the frontend from loading
    res.json({
      success: true,
      data: {
        features: {
          userRegistration: true,
          emailVerification: true,
          smsNotifications: false,
          paymentGateway: true,
          analytics: true,
          seoEnabled: true,
          demoMode: false,
        },
        maintenance: { enabled: false },
        comingSoon: {},
      },
    })
  }
})

export default router