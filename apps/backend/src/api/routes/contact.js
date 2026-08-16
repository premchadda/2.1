import { Router } from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js'

const router = Router()

/**
 * @route   POST /api/contact
 * @desc    Submit student contact inquiry
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required',
      })
    }

    try {
      await dbHelpers.insertOne('activityLogs', {
        userId: req.user?.id || null,
        activityType: 'contact_inquiry',
        details: JSON.stringify({ name, email, phone, subject, message }),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        createdAt: new Date().toISOString(),
      })
    } catch {
      // Non-blocking log
    }

    res.json({
      success: true,
      message: 'Thank you! Your inquiry has been received. Our team will get back to you shortly.',
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
