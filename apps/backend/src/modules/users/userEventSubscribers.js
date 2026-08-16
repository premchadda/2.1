import { messageBroker } from '../../infrastructure/events/messageBroker.js'
import emailService from '../../services/EmailService.js'

/**
 * Event subscribers for user-related domain events.
 * Decouples controller actions from notifications and other downstream side effects.
 */
export function registerUserEventSubscribers() {
  // 1. Welcome email on user registration
  messageBroker.subscribe('user.registered', async (payload) => {
    const { email, name } = payload
    if (!email) return
    console.log(`[EventSubscriber] Handling user.registered for ${email}`)
    await emailService.sendWelcomeEmail(email, name || 'Student')
  })

  // 2. Security email on password change
  messageBroker.subscribe('user.password_changed', async (payload) => {
    const { email } = payload
    if (!email) return
    console.log(`[EventSubscriber] Handling user.password_changed for ${email}`)
    await emailService.sendNotificationEmail(
      email,
      'Password Changed Successfully',
      'Your Trstprep password was recently changed. If you did not make this change, please contact support or reset your password immediately.'
    )
  })

  // 3. OTP email delivery
  messageBroker.subscribe('user.otp_requested', async (payload) => {
    const { email, otp } = payload
    if (!email || !otp) return
    console.log(`[EventSubscriber] Handling user.otp_requested for ${email}`)
    await emailService.sendOtpEmail(email, otp)
  })

  // 4. Password reset link delivery
  messageBroker.subscribe('user.password_reset_requested', async (payload) => {
    const { email, resetLink } = payload
    if (!email || !resetLink) return
    console.log(`[EventSubscriber] Handling user.password_reset_requested for ${email}`)
    await emailService.sendPasswordResetEmail(email, resetLink)
  })

  console.log('[EventSubscriber] Registered all user event subscribers')
}
