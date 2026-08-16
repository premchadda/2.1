export const html = ({ safeName, link }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #667eea; margin: 0;">Trstprep</h1>
          <p style="color: #666; margin: 5px 0;">India's #1 Exam Preparation Platform</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #111; margin-top: 0;">Hello ${safeName},</h2>
          <p style="color: #374151; line-height: 1.6;">
            Welcome to Trstprep! Please verify your email address to complete your registration.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 12px 30px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Or copy and paste this link into your browser:<br>
            <a href="${link}" style="color: #667eea; word-break: break-all;">
              ${link}
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
    `

export const text = ({ safeName, link }) => `
Hello ${safeName},

Welcome to Trstprep! Please verify your email address by clicking the link below:

${link}

This verification link will expire in 24 hours.

If you didn't create an account with Trstprep, please ignore this email.

© ${new Date().getFullYear()} Trstprep. All rights reserved.
    `

export default { html, text }
