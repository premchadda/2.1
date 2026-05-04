/**
 * SMS Notification Service
 * Handles sending SMS messages to users
 * Supports Twilio and AWS SNS
 */
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DISABLED_PROVIDERS = new Set(['none', 'disabled', 'off'])

const isDisabledProvider = (provider) => DISABLED_PROVIDERS.has(String(provider || 'none').toLowerCase())

class SmsService {
  constructor() {
    this.provider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase()
    this.setupProvider()
  }

  setupProvider() {
    switch (this.provider) {
      case 'twilio':
        try {
          this.twilio = require('twilio')(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          )
          this.fromNumber = process.env.TWILIO_PHONE_NUMBER
        } catch (e) {
          console.warn('Twilio setup failed:', e.message);
        }
        break
      case 'aws':
        try {
          this.sns = new SNSClient({
            region: process.env.AWS_REGION || 'us-east-1'
          })
        } catch (e) {
          console.warn('AWS SNS setup failed:', e.message);
        }
        break
      default:
        if (isDisabledProvider(this.provider)) {
          console.log('[SMS] Delivery disabled (SMS_PROVIDER=none).')
          return
        }
        console.warn(`SMS provider '${this.provider}' is not supported`)
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOtp(phoneNumber, otp) {
    const message = `Your Trstprep OTP is: ${otp}. Valid for 10 minutes. Do not share with anyone.`
    return this.send(phoneNumber, message)
  }

  /**
   * Send login notification
   */
  async sendLoginNotification(phoneNumber, device = 'Mobile') {
    const message = `New login to your Trstprep account from ${device}. If this wasn't you, change your password immediately.`
    return this.send(phoneNumber, message)
  }

  /**
   * Send test result notification
   */
  async sendTestResultNotification(phoneNumber, testTitle, score, air) {
    const message = `You scored ${score} in ${testTitle}. All India Rank: ${air}. Check your results on Trstprep app.`
    return this.send(phoneNumber, message)
  }

  /**
   * Send live test reminder
   */
  async sendLiveTestReminder(phoneNumber, testTitle, startTime) {
    const message = `Live Test "${testTitle}" starts in 30 minutes at ${startTime}. Click to register: ${process.env.FRONTEND_URL}`
    return this.send(phoneNumber, message)
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(phoneNumber, orderId, amount) {
    const message = `Payment of ₹${amount} received for Order ${orderId}. Thank you for choosing Trstprep!`
    return this.send(phoneNumber, message)
  }

  /**
   * Core send method
   */
  async send(phoneNumber, message) {
    // Validate phone number
    const cleanedNumber = this.validateAndFormatPhone(phoneNumber)
    if (!cleanedNumber) {
      return { success: false, error: 'Invalid phone number format' }
    }

    try {
      switch (this.provider) {
        case 'twilio':
          return await this.sendViaTwilio(cleanedNumber, message)
        case 'aws':
          return await this.sendViaSNS(cleanedNumber, message)
        default:
          return {
            success: false,
            message: isDisabledProvider(this.provider)
              ? 'SMS delivery disabled'
              : `Unsupported SMS provider: ${this.provider}`
          }
      }
    } catch (error) {
      console.error('Error sending SMS:', error)
      return { success: false, error: error.message }
    }
  }

  async sendViaTwilio(phoneNumber, message) {
    if (!this.twilio) return { success: false, error: 'Twilio not initialized' }
    const result = await this.twilio.messages.create({
      body: message,
      from: this.fromNumber,
      to: phoneNumber
    })
    return { success: true, messageId: result.sid }
  }

  async sendViaSNS(phoneNumber, message) {
    if (!this.sns) return { success: false, error: 'SNS not initialized' }
    const result = await this.sns.send(new PublishCommand({
      Message: message,
      PhoneNumber: phoneNumber
    }))
    return { success: true, messageId: result.MessageId }
  }

  /**
   * Validate and format phone number to E.164 format
   */
  validateAndFormatPhone(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '')

    // If starts with 91 (India), keep as is
    if (cleaned.startsWith('91')) {
      if (cleaned.length === 12) {
        return '+' + cleaned
      }
    }

    // If 10 digits, assume India and add +91
    if (cleaned.length === 10) {
      return '+91' + cleaned
    }

    // If already has country code
    if (cleaned.length > 10) {
      return '+' + cleaned
    }

    return null
  }

  /**
   * Send bulk SMS
   */
  async sendBulk(phoneNumbers, message) {
    const results = []
    for (const phoneNumber of phoneNumbers) {
      const result = await this.send(phoneNumber, message)
      results.push({ phoneNumber, ...result })
    }
    return results
  }

  /**
   * Send templated SMS (supports placeholders)
   */
  async sendTemplate(phoneNumber, templateKey, variables = {}) {
    const templates = {
      otp: 'Your Trstprep OTP is: {{OTP}}. Valid for 10 minutes.',
      login_alert: 'New login to your Trstprep account from {{DEVICE}}.',
      test_result: 'You scored {{SCORE}} in {{TEST}}. AIR: {{AIR}}.',
      live_test_reminder: 'Live Test {{TEST}} starts in 30 minutes at {{TIME}}.',
      payment_success: 'Payment of ₹{{AMOUNT}} received for Order {{ORDER_ID}}.'
    }

    let message = templates[templateKey]
    if (!message) {
      return { success: false, error: `Template '${templateKey}' not found` }
    }

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(`{{${key}}}`, value)
    })

    return this.send(phoneNumber, message)
  }
}

export default new SmsService()
