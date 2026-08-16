import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import verificationTemplate from './templates/verification.js'
import passwordResetTemplate from './templates/password-reset.js'
import welcomeTemplate from './templates/welcome.js'

// ---------------------------------------------------------------------------
// M9: The email queue previously lived only in memory, so any pending mail was
// LOST on process restart/crash. It is now persisted to a JSONL spool file so
// unsent mail survives restarts and is replayed on boot. Processing stays
// sequential (nodemailer pooling already parallelises the socket I/O).
// M10: The transporter is a lazy singleton, but it now re-reads SMTP env vars
// each time it is (re)built and can be explicitly reset, so a config change is
// picked up without a code change.
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3
const SPOOL_DIR = process.env.EMAIL_SPOOL_DIR || path.join(process.cwd(), '.email-spool')
const SPOOL_FILE = path.join(SPOOL_DIR, 'queue.jsonl')

const emailQueue = []
let processing = false
// Track the env signature the current transporter was built with so we can
// detect config changes (M10).
let _transporter = null
let _transporterEnvSig = null

const envSignature = () =>
  ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
    .map((k) => `${k}=${process.env[k] || ''}`)
    .join('|')

const ensureSpool = () => {
  try {
    if (!fs.existsSync(SPOOL_DIR)) fs.mkdirSync(SPOOL_DIR, { recursive: true })
  } catch (e) {
    console.error('[Email] Could not create spool dir:', e.message)
  }
}

// PERF: Serialize all spool file mutations through a single promise chain so
// reads/writes never interleave. Each op uses async fs APIs so the event loop
// is never blocked by a synchronous writeFileSync on the (hot) send path.
let _spoolChain = Promise.resolve()

const runSpoolOp = (op) => {
  _spoolChain = _spoolChain.then(op).catch((e) => {
    console.error('[Email] Spool error:', e.message)
  })
  return _spoolChain
}

const appendToSpool = (job) => {
  ensureSpool()
  return runSpoolOp(() => fs.promises.appendFile(SPOOL_FILE, JSON.stringify(job) + '\n'))
}

const removeFromSpool = (jobId) => {
  if (!fs.existsSync(SPOOL_FILE)) return
  return runSpoolOp(async () => {
    const lines = (await fs.promises.readFile(SPOOL_FILE, 'utf8'))
      .split('\n')
      .filter(Boolean)
    const remaining = lines.filter((l) => {
      try {
        return JSON.parse(l)._id !== jobId
      } catch {
        return false
      }
    })
    if (remaining.length === lines.length) return
    await fs.promises.writeFile(
      SPOOL_FILE,
      remaining.join('\n') + (remaining.length ? '\n' : '')
    )
  })
}

const replaySpool = () => {
  try {
    if (!fs.existsSync(SPOOL_FILE)) return
    const lines = fs.readFileSync(SPOOL_FILE, 'utf8').split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        emailQueue.push(JSON.parse(line))
      } catch {
        /* skip corrupt line */
      }
    }
    if (emailQueue.length) {
      console.log(`[Email] Replaying ${emailQueue.length} persisted mail job(s) from spool`)
    }
  } catch (e) {
    console.error('[Email] Failed to replay spool:', e.message)
  }
}

const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT) || 587,
      secure: parseInt(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    })
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMTP credentials not configured. Cannot send email in production. Set SMTP_HOST, SMTP_USER, SMTP_PASS.')
  }

  // Development mode - log to console
  return null
}

function getTransporter() {
  const sig = envSignature()
  // M10: rebuild if env changed (or not yet built)
  if (!_transporter || _transporterEnvSig !== sig) {
    _transporter = createTransporter()
    _transporterEnvSig = sig
  }
  return _transporter
}

// Allow explicit reset (e.g. after a config reload) so the next send rebuilds.
export const resetTransporter = () => {
  _transporter = null
  _transporterEnvSig = null
}

async function processEmailQueue() {
  if (processing) return
  processing = true

  while (emailQueue.length > 0) {
    const emailJob = emailQueue.shift()
    try {
      const t = await getTransporter()
      if (t) {
        await t.sendMail(emailJob)
        console.log(`[Email] Sent to ${emailJob.to} (subject: ${emailJob.subject})`)
      } else {
        console.log(`[Email] (Dev) To: ${emailJob.to} | Subject: ${emailJob.subject}`)
      }
      if (emailJob._id) removeFromSpool(emailJob._id)
    } catch (error) {
      console.error(`[Email] Send failed to ${emailJob.to}: ${error.message}`)
      if ((emailJob._retries || 0) < MAX_RETRIES) {
        emailJob._retries = (emailJob._retries || 0) + 1
        // Re-persist the retried job so it survives a crash between attempts.
        emailJob._id = emailJob._id || `job_${Date.now()}_${Math.random().toString(36).slice(2)}`
        appendToSpool(emailJob)
        emailQueue.push(emailJob)
        console.log(`[Email] Re-queued (attempt ${emailJob._retries}/${MAX_RETRIES})`)
      } else {
        console.error(`[Email] Dropped after ${MAX_RETRIES} retries: ${emailJob.to}`)
        if (emailJob._id) removeFromSpool(emailJob._id)
      }
    }
  }

  processing = false
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const enqueue = (mailOptions) => {
  const job = {
    ...mailOptions,
    _id: `job_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    _retries: 0,
  }
  appendToSpool(job)
  emailQueue.push(job)
  processEmailQueue() // fire-and-forget
  return { success: true, queued: true }
}

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (to, name, token) => {
  const safeName = escapeHtml(name)
  const isHttps = process.env.ENFORCE_HTTPS === 'true'
  const frontendUrl = process.env.FRONTEND_URL || `${isHttps ? 'https' : 'http'}://localhost:3000`
  const verificationLink = `${frontendUrl}/verify-email?token=${token}`

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Trstprep <noreply@trstprep.com>',
    to,
    subject: 'Verify Your Email - Trstprep',
    html: verificationTemplate.html({ safeName, link: verificationLink }),
    text: verificationTemplate.text({ safeName, link: verificationLink }),
  }

  try {
    return enqueue(mailOptions)
  } catch (error) {
    console.error('[Email] Failed to queue verification email:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (to, name, token) => {
  const safeName = escapeHtml(name)
  const isHttps = process.env.ENFORCE_HTTPS === 'true'
  const frontendUrl = process.env.FRONTEND_URL || `${isHttps ? 'https' : 'http'}://localhost:3000`
  const resetLink = `${frontendUrl}/reset-password?token=${token}`

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Trstprep <noreply@trstprep.com>',
    to,
    subject: 'Reset Your Password - Trstprep',
    html: passwordResetTemplate.html({ safeName, link: resetLink }),
    text: passwordResetTemplate.text({ safeName, link: resetLink }),
  }

  try {
    return enqueue(mailOptions)
  } catch (error) {
    console.error('[Email] Failed to queue password reset email:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Send welcome email after verification
 */
export const sendWelcomeEmail = async (to, name) => {
  const safeName = escapeHtml(name)
  const isHttps = process.env.ENFORCE_HTTPS === 'true'
  const frontendUrl = process.env.FRONTEND_URL || `${isHttps ? 'https' : 'http'}://localhost:3000`
  const dashboardLink = `${frontendUrl}/dashboard`

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Trstprep <noreply@trstprep.com>',
    to,
    subject: 'Welcome to Trstprep!',
    html: welcomeTemplate.html({ safeName, link: dashboardLink }),
    text: welcomeTemplate.text({ safeName, link: dashboardLink }),
  }

  try {
    return enqueue(mailOptions)
  } catch (error) {
    console.error('[Email] Failed to queue welcome email:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Generic enqueue for caller-supplied mail options.
 */
export const queueEmail = async (mailOptions) => {
  try {
    return enqueue(mailOptions)
  } catch (error) {
    console.error('[Email] Failed to queue email:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Drain the queue on shutdown so in-flight mail is not abruptly killed.
 */
export const drainEmailQueue = async () => {
  // wait for the current processing loop to finish
  let guard = 0
  while (processing && guard < 50) {
    await new Promise((r) => setTimeout(r, 100))
    guard++
  }
  if (emailQueue.length) {
    console.warn(`[Email] Shutdown with ${emailQueue.length} unsent mail job(s) still in spool (will replay on next boot)`)
  }
}

// Replay any persisted mail on module load (M9).
replaySpool()

export const getEmailQueueStatus = () => ({
  pending: emailQueue.length,
  processing,
  spoolFile: SPOOL_FILE,
})

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  getEmailQueueStatus,
  queueEmail,
  resetTransporter,
  drainEmailQueue,
}
