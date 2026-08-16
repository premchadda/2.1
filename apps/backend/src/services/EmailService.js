/**
 * Email Notification Service
 * Handles sending transactional emails to users
 * Supports SendGrid, AWS SES, or custom SMTP
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { createRequire } from 'module';
import logger from '../infrastructure/logger/logger.js';
const require = createRequire(import.meta.url);

const DISABLED_PROVIDERS = new Set(['none', 'disabled', 'off'])

const isDisabledProvider = (provider) => DISABLED_PROVIDERS.has(String(provider || 'none').toLowerCase())

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const getFrontendUrl = () => {
  const isHttps = process.env.ENFORCE_HTTPS === 'true'
  return process.env.FRONTEND_URL || `${isHttps ? 'https' : 'http'}://localhost:3000`
}

class EmailService {
  constructor() {
    this.provider = (process.env.EMAIL_PROVIDER || 'none').toLowerCase()
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@trstprep.com'
    this.fromName = process.env.FROM_NAME || 'Trstprep'
    this.setupProvider()
  }

  setupProvider() {
    if (isDisabledProvider(this.provider)) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('[Email] Transactional email provider is disabled (EMAIL_PROVIDER=none) in production. Set EMAIL_PROVIDER to sendgrid, aws, or smtp when ready.')
      } else {
        logger.info('[Email] Delivery disabled (EMAIL_PROVIDER=none).')
      }
      return
    }

    switch (this.provider) {
      case 'sendgrid':
        try {
          const apiKey = process.env.SENDGRID_API_KEY
          if (!apiKey || !apiKey.startsWith('SG.')) {
            logger.warn('SendGrid API key not configured or invalid. Email sending disabled.')
            this.sgMail = null
            return
          }
          this.sgMail = require('@sendgrid/mail')
          this.sgMail.setApiKey(apiKey)
        } catch (e) {
          logger.warn('SendGrid setup failed:', e.message);
        }
        break
      case 'aws':
        try {
          this.ses = new SESClient({
            region: process.env.AWS_REGION || 'us-east-1'
          })
        } catch (e) {
          logger.warn('AWS SES setup failed:', e.message);
        }
        break
      case 'smtp':
        // Transporter will be initialized dynamically on demand to support reconnections
        break
      default:
        if (isDisabledProvider(this.provider)) {
          logger.info('[Email] Delivery disabled (EMAIL_PROVIDER=none).')
          return
        }
        logger.warn(`Email provider '${this.provider}' is not supported`)
    }
  }

  getHtmlWrapper(title, bodyContent, actionButton = null) {
    const actionHtml = actionButton
      ? `<p style="margin: 30px 0; text-align: center;">
           <a href="${escapeHtml(actionButton.url)}" style="background-color: #4f46e5; background-image: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1); transition: all 0.2s ease;">
             ${escapeHtml(actionButton.text)}
           </a>
         </p>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <style>
            @media only screen and (max-width: 620px) {
              .container { width: 100% !important; padding: 0 !important; }
              .content { padding: 20px !important; }
            }
          </style>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 40px 0;">
            <tr>
              <td align="center">
                <table class="container" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background-color: #4f46e5; background-image: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px 20px; color: #ffffff;">
                      <h1 style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0; text-transform: uppercase;">Trstprep</h1>
                      ${title ? `<p style="font-size: 14px; opacity: 0.9; margin: 5px 0 0 0; font-weight: 500;">${escapeHtml(title)}</p>` : ''}
                    </td>
                  </tr>
                  <!-- Body Content -->
                  <tr>
                    <td class="content" style="padding: 40px 30px; font-size: 16px; line-height: 1.6; color: #374151;">
                      ${bodyContent}
                      ${actionHtml}
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="background-color: #f9fafb; padding: 24px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; text-align: center;">
                      <p style="margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Trstprep Academy</p>
                      <p style="margin: 0 0 12px 0;">Need help? Contact us at <a href="mailto:${process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || 'support@trstprep.com'}" style="color: #4f46e5; text-decoration: none; font-weight: 500;">${process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || 'support@trstprep.com'}</a></p>
                      <p style="margin: 0; font-size: 11px; opacity: 0.7;">&copy; ${new Date().getFullYear()} Trstprep. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  /**
   * Send OTP email for phone verification
   */
  async sendOtpEmail(email, otp, expiresIn = 10) {
    const subject = 'Your Trstprep OTP - Verification Code'
    const bodyContent = `
      <p>Hello,</p>
      <p>We received a request to verify your email address. Your One-Time Password (OTP) is:</p>
      <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 12px; margin: 24px 0; border: 1px solid #e5e7eb;">
        <h1 style="letter-spacing: 8px; color: #4f46e5; margin: 0; font-size: 32px; font-weight: 800;">${otp}</h1>
      </div>
      <p>This OTP will expire in <strong>${expiresIn} minutes</strong>.</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        If you didn't request this OTP, please ignore this email or contact support.
      </p>
    `
    const htmlContent = this.getHtmlWrapper('Verify Your Email', bodyContent)
    return this.send(email, subject, htmlContent)
  }

  /**
   * Send welcome email after signup
   */
  async sendWelcomeEmail(email, userName) {
    const subject = 'Welcome to Trstprep!'
    const bodyContent = `
      <p>Hi ${escapeHtml(userName)},</p>
      <p>Thank you for joining Trstprep! We're excited to help you prepare and excel in your exams.</p>
      <p>Here is what you can do to get started right now:</p>
      <ul style="padding-left: 20px; margin: 16px 0;">
        <li style="margin-bottom: 8px;">Take practice tests to assess your current level</li>
        <li style="margin-bottom: 8px;">Explore previous year papers (PYQ)</li>
        <li style="margin-bottom: 8px;">Read daily current affairs articles</li>
        <li style="margin-bottom: 8px;">Join live competitive mock tests</li>
        <li style="margin-bottom: 8px;">Track your performance with real-time analytics</li>
      </ul>
      <p>Best of luck with your preparation!</p>
    `
    const actionButton = {
      text: 'Go to Dashboard',
      url: `${getFrontendUrl()}/dashboard`
    }
    const htmlContent = this.getHtmlWrapper('Welcome to Trstprep', bodyContent, actionButton)
    return this.send(email, subject, htmlContent)
  }

  /**
   * Send test result notification
   */
  async sendTestResultEmail(email, userName, testTitle, score, totalMarks, air) {
    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0
    const escapedTitle = escapeHtml(testTitle)
    const subject = `Your ${escapedTitle} Result - ${percentage}%`
    const bodyContent = `
      <p>Hi ${escapeHtml(userName)},</p>
      <p>Your attempt for <strong>${escapedTitle}</strong> has been successfully evaluated. Here is a summary of your performance:</p>
      <div style="background: #f9fafb; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #e5e7eb;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 6px 0; color: #4b5563;"><strong>Score Obtained:</strong></td>
            <td style="padding: 6px 0; text-align: right; color: #111827; font-weight: bold;">${score}/${totalMarks} (${percentage}%)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #4b5563;"><strong>All India Rank:</strong></td>
            <td style="padding: 6px 0; text-align: right; color: #4f46e5; font-weight: bold;">${escapeHtml(air)}</td>
          </tr>
        </table>
      </div>
      <p>Click below to view the detailed breakdown, question-wise analytics, and answer explanations.</p>
    `
    const actionButton = {
      text: 'View Detailed Analysis',
      url: `${getFrontendUrl()}/test-result`
    }
    const htmlContent = this.getHtmlWrapper('Test Performance Report', bodyContent, actionButton)
    return this.send(email, subject, htmlContent)
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetLink) {
    const subject = 'Reset Your Trstprep Password'
    const bodyContent = `
      <p>Hello,</p>
      <p>We received a request to reset your account password. Click the button below to set a new password:</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
      </p>
    `
    const actionButton = {
      text: 'Reset Password',
      url: resetLink
    }
    const htmlContent = this.getHtmlWrapper('Password Reset Request', bodyContent, actionButton)
    return this.send(email, subject, htmlContent)
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(email, title, message, actionUrl = null) {
    const escapedTitle = escapeHtml(title)
    const subject = `Trstprep - ${escapedTitle}`
    const bodyContent = `
      <p>${escapeHtml(message)}</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px; border-top: 1px dashed #e5e7eb; padding-top: 16px;">
        You received this email because you're subscribed to Trstprep notifications.
        <a href="${getFrontendUrl()}/settings" style="color: #4f46e5; text-decoration: none;">Manage preferences</a>
      </p>
    `
    const actionButton = actionUrl ? {
      text: 'View Details',
      url: actionUrl
    } : null;

    const htmlContent = this.getHtmlWrapper(escapedTitle, bodyContent, actionButton)
    return this.send(email, subject, htmlContent)
  }

  async getTransporter() {
    if (this.transporter) return this.transporter;
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
      });
      return this.transporter;
    } catch (e) {
      logger.error('SMTP dynamic initialization failed:', e.message);
      return null;
    }
  }

  /**
   * Core send method
   */
  async send(email, subject, htmlContent) {
    const isWorker = process.env.IS_WORKER === 'true';
    try {
      const { isQueueEnabled, addJob, QUEUE_NAMES } = await import('../infrastructure/queue/queueManager.js').catch(() => ({}));
      if (isQueueEnabled && isQueueEnabled() && !isWorker) {
        try {
          await addJob(QUEUE_NAMES.NOTIFICATIONS, 'notifications.send-email', {
            payload: { email, subject, htmlContent }
          });
          logger.info(`[Email] Enqueued email job to ${email} for background processing`);
          return { success: true, queued: true };
        } catch (queueErr) {
          logger.warn('Failed to queue email job, falling back to direct delivery:', queueErr.message);
        }
      }
      return await this.sendDirect(email, subject, htmlContent);
    } catch (error) {
      logger.error('Error sending email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendDirect(email, subject, htmlContent) {
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
      logger.error('Error in direct email send:', error)
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
    const transporter = await this.getTransporter();
    if (!transporter) return { success: false, error: 'SMTP transporter not initialized' }
    const result = await transporter.sendMail({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: email,
      subject,
      html: htmlContent
    })

    return { success: true, messageId: result.messageId }
  }
}

export default new EmailService()
