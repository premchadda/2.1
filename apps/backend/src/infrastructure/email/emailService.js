import nodemailer from 'nodemailer'

// Create transporter based on environment variables
const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env

  // If SMTP credentials are provided, use them
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT) || 587,
      secure: parseInt(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    })
  }

  // For production, try to use a default SMTP service
  if (process.env.NODE_ENV === 'production') {
    console.warn('No SMTP credentials configured for production. Email sending disabled.')
    return null
  }

  // Development mode - log to console
  return null
}

const transporter = createTransporter()

/**
 * Send email verification email
 * @param {string} to - Recipient email
 * @param {string} name - Recipient name
 * @param {string} token - Verification token
 */
export const sendVerificationEmail = async (to, name, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const verificationLink = `${frontendUrl}/verify-email?token=${token}`

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Trstprep <noreply@trstprep.com>',
    to,
    subject: 'Verify Your Email - Trstprep',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #667eea; margin: 0;">Trstprep</h1>
          <p style="color: #666; margin: 5px 0;">India's #1 Exam Preparation Platform</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #111; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #374151; line-height: 1.6;">
            Welcome to Trstprep! Please verify your email address to complete your registration.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 12px 30px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Or copy and paste this link into your browser:<br>
            <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">
              ${verificationLink}
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This verification link will expire in 24 hours.<br>
            If you didn't create an account with Trstprep, please ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Trstprep. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `
Hello ${name},

Welcome to Trstprep! Please verify your email address by clicking the link below:

${verificationLink}

This verification link will expire in 24 hours.

If you didn't create an account with Trstprep, please ignore this email.

© ${new Date().getFullYear()} Trstprep. All rights reserved.
    `
  }

  try {
    if (transporter) {
      await transporter.sendMail(mailOptions)
      console.log(`✅ Verification email sent to ${to}`)
    } else {
      // Development mode - log to console (Issue #35: Don't log full token)
      console.log('═══════════════════════════════════════')
      console.log('📧 VERIFICATION EMAIL (Development Mode)')
      console.log('═══════════════════════════════════════')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Token: ${token.substring(0, 8)}... (truncated for security)`)
      console.log('═══════════════════════════════════════')
    }
    return { success: true }
  } catch (error) {
    console.error('❌ Failed to send verification email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} name - Recipient name
 * @param {string} token - Reset token
 */
export const sendPasswordResetEmail = async (to, name, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const resetLink = `${frontendUrl}/reset-password?token=${token}`

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Trstprep <noreply@trstprep.com>',
    to,
    subject: 'Reset Your Password - Trstprep',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #667eea; margin: 0;">Trstprep</h1>
          <p style="color: #666; margin: 5px 0;">India's #1 Exam Preparation Platform</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #111; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #374151; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 12px 30px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color: #667eea; word-break: break-all;">
              ${resetLink}
            </a>
          </p>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px; border-radius: 4px;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>Security Tip:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and ensure your account is secure.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Trstprep. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `
Hello ${name},

We received a request to reset your password. Click the link below to create a new password:

${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

© ${new Date().getFullYear()} Trstprep. All rights reserved.
    `
  }

  try {
    if (transporter) {
      await transporter.sendMail(mailOptions)
      console.log(`✅ Password reset email sent to ${to}`)
    } else {
      // Development mode - log to console (Issue #35: Don't log full token)
      console.log('═══════════════════════════════════════')
      console.log('📧 PASSWORD RESET EMAIL (Development Mode)')
      console.log('═══════════════════════════════════════')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Token: ${token.substring(0, 8)}... (truncated for security)`)
      console.log('═══════════════════════════════════════')
    }
    return { success: true }
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send welcome email after verification
 * @param {string} to - Recipient email
 * @param {string} name - Recipient name
 */
export const sendWelcomeEmail = async (to, name) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const dashboardLink = `${frontendUrl}/dashboard`

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Trstprep <noreply@trstprep.com>',
    to,
    subject: 'Welcome to Trstprep!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #667eea; margin: 0;">🎉 Welcome to Trstprep!</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #111; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #374151; line-height: 1.6;">
            Your email has been successfully verified! You're now ready to start your exam preparation journey with Trstprep.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardLink}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 12px 30px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px;">
            <h3 style="color: #111;">Quick Start Guide:</h3>
            <ul style="color: #374151; line-height: 1.8;">
              <li>🎯 Browse test series for your target exam</li>
              <li>📚 Access study materials and video lectures</li>
              <li>📝 Take mock tests to assess your preparation</li>
              <li>📊 Track your progress with detailed analytics</li>
            </ul>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Trstprep. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `
Hello ${name},

Welcome to Trstprep! Your email has been successfully verified.

Get started now: ${dashboardLink}

Quick Start:
- Browse test series for your target exam
- Access study materials and video lectures
- Take mock tests to assess your preparation
- Track your progress with detailed analytics

© ${new Date().getFullYear()} Trstprep. All rights reserved.
    `
  }

  try {
    if (transporter) {
      await transporter.sendMail(mailOptions)
      console.log(`✅ Welcome email sent to ${to}`)
    } else {
      console.log(`📧 Welcome email (logged): ${to}`)
    }
    return { success: true }
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error)
    return { success: false, error: error.message }
  }
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
}
