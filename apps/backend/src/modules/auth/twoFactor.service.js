import crypto from 'node:crypto'
import bcrypt from 'bcrypt'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const DEFAULT_WINDOW = 1
const DEFAULT_TIMESTEP = 30
const DEFAULT_DIGITS = 6
const DEFAULT_BACKUP_CODE_COUNT = 8

const base32Encode = (buffer) => {
  let result = ''
  let bits = 0
  let value = 0
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return result
}

const base32Decode = (secret) => {
  const cleaned = secret.replace(/=+$/, '').toUpperCase()
  let bits = 0
  let value = 0
  const bytes = []
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`)
    }
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export const generateSecret = (length = 20) => {
  return base32Encode(crypto.randomBytes(length))
}

export const generateOTP = (secret, timeStep = DEFAULT_TIMESTEP, forTime = Date.now(), digits = DEFAULT_DIGITS) => {
  const counter = Math.floor(forTime / 1000 / timeStep)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))

  const key = base32Decode(secret)
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const truncated =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const token = truncated % 10 ** digits
  return token.toString().padStart(digits, '0')
}

export const verifyTOTP = (token, secret, window = DEFAULT_WINDOW, timeStep = DEFAULT_TIMESTEP, forTime = Date.now()) => {
  if (!token || !secret) return false
  const normalized = String(token).replace(/\s+/g, '')
  if (normalized.length !== DEFAULT_DIGITS || !/^\d+$/.test(normalized)) return false
  const counter = Math.floor(forTime / 1000 / timeStep)
  for (let error = -window; error <= window; error += 1) {
    const candidateTime = (counter + error) * timeStep * 1000
    const candidate = generateOTP(secret, timeStep, candidateTime)
    // Timing-safe comparison to prevent timing side-channel attacks
    try {
      const a = Buffer.from(candidate, 'utf8')
      const b = Buffer.from(normalized, 'utf8')
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true
      }
    } catch {
      // Buffer creation failed — skip this candidate
    }
  }
  return false
}

export const generateBackupCodes = (count = DEFAULT_BACKUP_CODE_COUNT) => {
  const codes = []
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  // Use rejection sampling to avoid modulo bias (256 % 32 = 0, but charset has 32 chars)
  const maxValid = Math.floor(256 / charset.length) * charset.length // 256 for 32-char charset
  const bytesNeeded = count * 8 * 2 // over-allocate for rejection
  const bytes = crypto.randomBytes(bytesNeeded)
  let byteIdx = 0
  for (let i = 0; i < count; i += 1) {
    let code = ''
    while (code.length < 8) {
      if (byteIdx >= bytes.length) {
        // Re-fetch if we run out
        const extra = crypto.randomBytes(16)
        for (let k = 0; k < extra.length; k++) bytes[byteIdx++] = extra[k]
      }
      const b = bytes[byteIdx++]
      if (b < maxValid) {
        code += charset[b % charset.length]
      }
    }
    codes.push(code)
  }
  return codes
}

export const hashBackupCodes = async (codes) => {
  const hashed = []
  for (const code of codes) {
    hashed.push(await bcrypt.hash(code, 10))
  }
  return hashed
}

export const verifyBackupCode = async (providedCode, storedHashedCodes) => {
  if (!providedCode || !Array.isArray(storedHashedCodes)) return -1
  const normalized = String(providedCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
  for (let i = 0; i < storedHashedCodes.length; i += 1) {
    const stored = storedHashedCodes[i]
    if (!stored) continue
    try {
      if (await bcrypt.compare(normalized, stored)) {
        return i
      }
    } catch {
      // Skip malformed entries
    }
  }
  return -1
}

export const buildOtpauthUri = (secret, email, issuer = 'TestPrep') => {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_TIMESTEP),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

export const twoFactorService = {
  generateSecret,
  generateOTP,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  buildOtpauthUri,
}

export default twoFactorService