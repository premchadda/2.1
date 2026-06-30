/**
 * Email Notification Service
 * Handles sending transactional emails to users
 * Supports SendGrid, AWS SES, or custom SMTP
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DISABLED_PROVIDERS = new Set(['none', 'disabled', 'off'])

const isDisabledProvider = (provider) => DISABLED_PROVIDERS.has(String(provider || 'none').toLowerCase())

class EmailService {
  constructor() {
    this.provider = (process.env.EMAIL_PROVIDER || 'none').toLowerCase()
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@trstprep.com'
    this.fromName = process.env.FROM_NAME || 'Trstprep'
    this.setupProvider()
  }

  setupProvider() {
    switch (this.provider) {
      case 'sendgrid':
        try {
          const apiKey = process.env.SENDGRID_API_KEY
          if (!apiKey || !apiKey.startsWith('SG.')) {
            console.warn('SendGrid API key not configured or invalid. Email sending disabled.')
            this.sgMail = null
            return
          }
          this.sgMail = require('@sendgrid/mail')
          this.sgMail.setApiKey(apiKey)
        } catch (e) {
          console.warn('SendGrid setup failed:', e.message);
        }
        break
      case 'aws':
        try {
          this.ses = new SESClient({
            region: process.env.AWS_REGION || 'us-east-1'
          })
        } catch (e) {
          console.warn('AWS SES setup failed:', e.message);
        }
        break
      case 'smtp':
        try {
          this.nodemailer = require('nodemailer')
          this.transporter = this.nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD
            }
          })
        } catch (e) {
          console.warn('SMTP setup failed:', e.message);
        }
        break
      default:
        if (isDisabledProvider(this.provider)) {
          console.log('[Email] Delivery disabled (EMAIL_PROVIDER=none).')
          return
        }
        console.warn(`Email provider '${this.provider}' is not supported`)
    }
  }

  /**
   * Send OTP email for phone verification
   */
  async sendOtpEmail(email, otp, expiresIn = 10) {
    const subject = 'Your Trstprep OTP - Verification Code'
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify Your Email</h2>
            <p>Your One-Time Password (OTP) is:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="letter-spacing: 5px; color: #3b82f6; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in ${expiresIn} minutes.</p>
            <p style="color: #666; font-size: 12px;">
              If you didn't request this OTP, please ignore this email or contact support.
            </p>
          </div>
        </body>
      </html>
    `

    return this.send(email, subject, htmlContent)
  }

  /**
   * Send welcome email after signup
   */
  async sendWelcomeEmail(email, userName) {
    const subject = 'Welcome to Trstprep!'
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Welcome, ${userName}!</h2>
            <p>Thank you for joining Trstprep. We're excited to help you prepare for your exams.</p>
            <p>Here's what you can do now:</p>
            <ul>
              <li>Take practice tests to assess your level</li>
              <li>Explore previous year papers (PYP)</li>
              <li>Read daily current affairs articles</li>
              <li>Join live competitive tests</li>
              <li>Track your performance with analytics</li>
            </ul>
            <p>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Go to Dashboard
              </a>
            </p>
            <p style="color: #666; font-size: 12px;">
              Need help? Contact us at ${process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || 'support@trstprep.com'}
            </p>
          </div>
        </body>
      </html>
    `

    return this.send(email, subject, htmlContent)
  }

  /**
   * Send test result notification
   */
  async sendTestResultEmail(email, userName, testTitle, score, totalMarks, air) {
    const percentage = Math.round((score / totalMarks) * 100)
    const subject = `Your ${testTitle} Result - ${percentage}%`
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Test Results for ${testTitle}</h2>
            <p>Hi ${userName},</p>
            <p>Your test has been evaluated. Here's your performance:</p>
            <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Score:</strong> ${score}/${totalMarks} (${percentage}%)</p>
              <p><strong>All India Rank:</strong> ${air}</p>
            </div>
            <p>
              <a href="${process.env.FRONTEND_URL}/test-result" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Detailed Analysis
              </a>
            </p>
            <p style="color: #666; font-size: 12px;">
              Keep practicing to improve your score!
            </p>
          </div>
        </body>
      </html>
    `

    return this.send(email, subject, htmlContent)
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetLink) {
    const subject = 'Reset Your Trstprep Password'
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the link below to set a new password:</p>
            <p style="margin: 20px 0;">
              <a href="${resetLink}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 12px;">
              This link will expire in 1 hour. If you didn't request this, please ignore this email.
            </p>
          </div>
        </body>
      </html>
    `

    return this.send(email, subject, htmlContent)
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(email, title, message, actionUrl = null) {
    const subject = `Trstprep - ${title}`
    let htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>${title}</h2>
            <p>${message}</p>
    `
    
    if (actionUrl) {
      htmlContent += `
            <p style="margin: 20px 0;">
              <a href="${actionUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Details
              </a>
            </p>
      `
    }

    htmlContent += `
            <p style="color: #666; font-size: 12px;">
              You received this email because you're subscribed to Trstprep notifications.
              <a href="${process.env.FRONTEND_URL}/settings" style="color: #3b82f6;">Manage preferences</a>
            </p>
          </div>
        </body>
      </html>
    `

    return this.send(email, subject, htmlContent)
  }

  /**
   * Core send method
   */
  async send(email, subject, htmlContent) {
    try {
      switch (this.provider) {
        case 'sendgrid':
          return await this.sendViaSendGrid(email, subject, htmlContent)
        case 'aws':
          return await this.sendViaSES(email, subject, htmlContent)
        case 'smtp':
          return await this.sendViaSMTP(email, subject, htmlContent)
        default:
          return {
            success: false,
            message: isDisabledProvider(this.provider)
              ? 'Email delivery disabled'
              : `Unsupported email provider: ${this.provider}`
          }
      }
    } catch (error) {
      console.error('Error sending email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendViaSendGrid(email, subject, htmlContent) {
    if (!this.sgMail) return { success: false, error: 'SendGrid not initialized' }
    const msg = {
      to: email,
      from: `${this.fromName} <${this.fromEmail}>`,
      subject,
      html: htmlContent
    }

    const result = await this.sgMail.send(msg)
    return { success: true, messageId: result[0].headers['x-message-id'] }
  }

  async sendViaSES(email, subject, htmlContent) {
    if (!this.ses) return { success: false, error: 'SES not initialized' }
    const result = await this.ses.send(new SendEmailCommand({
      Source: `${this.fromName} <${this.fromEmail}>`,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: 'UTF-8'
          }
        }
      }
    }))
    return { success: true, messageId: result.MessageId }
  }

  async sendViaSMTP(email, subject, htmlContent) {
    if (!this.transporter) return { success: false, error: 'SMTP not initialized' }
    const result = await this.transporter.sendMail({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: email,
      subject,
      html: htmlContent
    })

    return { success: true, messageId: result.messageId }
  }
}

export default new EmailService()
