/**
 * PII field encryption at the application layer (M14).
 *
 * Mirrors the DB-side pgcrypto scheme (AES-256) so the backend can write
 * encrypted values into the `*_enc` columns and decrypt them on read, keeping
 * PII out of plaintext storage. The key is taken from PGCRYPTO_KEY (same
 * secret the migration 088 uses). In development without a key we degrade to a
 * clearly-marked base64 obfuscation so local runs still work — NEVER rely on
 * that for production; production MUST set PGCRYPTO_KEY.
 */
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_ENV = 'PGCRYPTO_KEY'

const getKey = () => {
  const raw = process.env[KEY_ENV]
  if (!raw || raw.length < 16) {
    return null
  }
  // Derive a stable 32-byte key from the secret.
  return crypto.createHash('sha256').update(raw).digest()
}

export const isPiiEncryptionEnabled = () => getKey() !== null

export const encryptPii = (plaintext) => {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null
  const value = String(plaintext)
  const key = getKey()
  if (!key) {
    // Dev-only obfuscation; not secure. Emits a header so it is obviously not ciphertext.
    return 'dev:' + Buffer.from(value, 'utf8').toString('base64')
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store iv::tag::ciphertext (base64) so it round-trips through text columns.
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join('::')
}

export const decryptPii = (ciphertext) => {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null
  const value = String(ciphertext)
  if (value.startsWith('dev:')) {
    return Buffer.from(value.slice(4), 'base64').toString('utf8')
  }
  const key = getKey()
  if (!key) return value // cannot decrypt without key; return as-is
  const [ivB64, tagB64, dataB64] = value.split('::')
  if (!ivB64 || !tagB64 || !dataB64) return value
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
