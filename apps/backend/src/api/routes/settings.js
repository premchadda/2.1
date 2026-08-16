import { Router } from 'express'
import { getPublicSettings } from '../../services/SettingsService.js'
import { responseCache } from '../../middleware/responseCache.middleware.js'

const router = Router()

async function handleGetSettings(req, res) {
  try {
    const settings = await getPublicSettings()
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60')
    res.json({
      success: true,
      data: {
        ...settings,
        contactEmail: settings.contactEmail || 'support@trstprep.com',
        supportEmail: settings.supportEmail || 'support@trstprep.com',
        contactPhone: settings.contactPhone || '+91 98765 43210',
        phone: settings.phone || '+91 98765 43210',
        address: settings.address || 'New Delhi, India',
      },
    })
  } catch (error) {
    res.json({
      success: true,
      data: {
        contactEmail: 'support@trstprep.com',
        supportEmail: 'support@trstprep.com',
        contactPhone: '+91 98765 43210',
        phone: '+91 98765 43210',
        address: 'New Delhi, India',
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
}

/**
 * @route   GET /api/settings/public
 * @desc    Get public-facing site settings (features, maintenance, coming soon)
 * @access  Public
 */
router.get('/public', responseCache('public-settings', 120), handleGetSettings)
router.get('/', responseCache('site-settings', 120), handleGetSettings)

export default router