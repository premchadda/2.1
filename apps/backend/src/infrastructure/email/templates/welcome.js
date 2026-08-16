export const html = ({ safeName, link }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #667eea; margin: 0;">🎉 Welcome to Trstprep!</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #111; margin-top: 0;">Hello ${safeName},</h2>
          <p style="color: #374151; line-height: 1.6;">
            Your email has been successfully verified! You're now ready to start your exam preparation journey with Trstprep.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" 
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
    `

export const text = ({ safeName, link }) => `
Hello ${safeName},

Welcome to Trstprep! Your email has been successfully verified.

Get started now: ${link}

Quick Start:
- Browse test series for your target exam
- Access study materials and video lectures
- Take mock tests to assess your preparation
- Track your progress with detailed analytics

© ${new Date().getFullYear()} Trstprep. All rights reserved.
    `

export default { html, text }
