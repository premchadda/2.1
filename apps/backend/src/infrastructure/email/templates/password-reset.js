export const html = ({ safeName, link }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #667eea; margin: 0;">Trstprep</h1>
          <p style="color: #666; margin: 5px 0;">India's #1 Exam Preparation Platform</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #111; margin-top: 0;">Hello ${safeName},</h2>
          <p style="color: #374151; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 12px 30px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Or copy and paste this link into your browser:<br>
            <a href="${link}" style="color: #667eea; word-break: break-all;">
              ${link}
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
    `

export const text = ({ safeName, link }) => `
Hello ${safeName},

We received a request to reset your password. Click the link below to create a new password:

${link}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

© ${new Date().getFullYear()} Trstprep. All rights reserved.
    `

export default { html, text }
