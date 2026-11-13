/**
 * PII field encryption at the application layer (M14).
 *
 * Mirrors the DB-side pgcrypto scheme (AES-256-GCM) so the backend can write
 * encrypted values into the `*_enc` columns and decrypt them on read, keeping
 * PII out of plaintext storage.
 *
 * Standardized on AES-256-GCM with dual-delimiter auto-detection (supports both
 * `::` base64 canonical and `:` hex legacy formats) to prevent cipher collisions
 * and cross-subsystem decryption failures.
 */
import crypto from "crypto";

const ALGO = "aes-256-gcm";

export const getKey = () => {
  const raw = process.env.DB_ENCRYPTION_KEY || process.env.PGCRYPTO_KEY;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV !== "production") {
      // Deterministic dev/test fallback so encryption functions during local test suites
      return crypto
        .createHash("sha256")
        .update("trstprep-dev-encryption-key-for-local-testing-32-chars")
        .digest();
    }
    return null;
  }
  // Derive a stable 32-byte key from the secret.
  return crypto.createHash("sha256").update(raw).digest();
};

export const isPiiEncryptionEnabled = () => getKey() !== null;

/**
 * Encrypt plaintext using canonical AES-256-GCM with base64 and '::' delimiter.
 */
export const encryptPii = (plaintext) => {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return plaintext;
  }
  const value = String(plaintext);
  const key = getKey();
  if (!key) {
    // Dev-only obfuscation; not secure. Emits a header so it is obviously not ciphertext.
    return "dev:" + Buffer.from(value, "utf8").toString("base64");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Canonical format: iv::tag::ciphertext (base64, dual-colon delimiter)
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join("::");
};

/**
 * Decrypt ciphertext with dual-delimiter auto-detection:
 * Supports:
 * 1. "::" delimiter: base64-encoded [iv, tag, data] (canonical piiCrypto format)
 * 2. ":" delimiter: hex-encoded [iv, tag, data] (postgres-helpers format)
 * 3. ":" delimiter: hex-encoded [iv, data] (legacy aes-256-cbc format)
 * 4. "dev:" prefix: base64-encoded development obfuscation
 * Returns original value if unencrypted or if decryption fails gracefully.
 */
export const decryptPii = (ciphertext) => {
  if (ciphertext === null || ciphertext === undefined || ciphertext === "") {
    return ciphertext;
  }
  const value = String(ciphertext);
  if (value.startsWith("dev:")) {
    try {
      return Buffer.from(value.slice(4), "base64").toString("utf8");
    } catch {
      return value;
    }
  }

  // If there's no delimiter, it's not encrypted (legacy plaintext)
  if (!value.includes(":")) return value;

  const key = getKey();
  if (!key) return value; // cannot decrypt without key; return as-is

  // Case 1: Dual-colon delimiter "::" (canonical piiCrypto format: iv::tag::data in base64)
  if (value.includes("::")) {
    const parts = value.split("::");
    if (parts.length === 3) {
      const [ivPart, tagPart, dataPart] = parts;
      if (ivPart && tagPart && dataPart) {
        // Try base64 decoding (canonical)
        try {
          const iv = Buffer.from(ivPart, "base64");
          const tag = Buffer.from(tagPart, "base64");
          const data = Buffer.from(dataPart, "base64");
          if (iv.length === 12 && tag.length === 16) {
            const decipher = crypto.createDecipheriv(ALGO, key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([
              decipher.update(data),
              decipher.final(),
            ]).toString("utf8");
          }
        } catch {
          // If base64 failed, try hex fallback
        }

        // Try hex decoding (in case hex was joined with ::)
        try {
          const iv = Buffer.from(ivPart, "hex");
          const tag = Buffer.from(tagPart, "hex");
          const decipher = crypto.createDecipheriv(ALGO, key, iv);
          decipher.setAuthTag(tag);
          let decrypted = decipher.update(dataPart, "hex", "utf8");
          decrypted += decipher.final("utf8");
          return decrypted;
        } catch {
          // Fall through
        }
      }
    }
    return value;
  }

  // Case 2: Single-colon delimiter ":" (postgres-helpers format or legacy CBC)
  const parts = value.split(":");

  // Subcase 2a: 3 parts (iv:tag:data)
  if (parts.length === 3) {
    const [ivPart, tagPart, dataPart] = parts;
    if (!ivPart || !tagPart || !dataPart) return value;

    // Check if parts are hex encoded (postgres-helpers default)
    const isHex =
      /^[0-9a-fA-F]+$/.test(ivPart) && /^[0-9a-fA-F]+$/.test(tagPart);
    if (isHex) {
      try {
        const iv = Buffer.from(ivPart, "hex");
        const tag = Buffer.from(tagPart, "hex");
        if (iv.length === 12 && tag.length === 16) {
          const decipher = crypto.createDecipheriv(ALGO, key, iv);
          decipher.setAuthTag(tag);
          let decrypted = decipher.update(dataPart, "hex", "utf8");
          decrypted += decipher.final("utf8");
          return decrypted;
        }
      } catch {
        // Try base64 below
      }
    }

    // Try base64 with single colon
    try {
      const iv = Buffer.from(ivPart, "base64");
      const tag = Buffer.from(tagPart, "base64");
      const data = Buffer.from(dataPart, "base64");
      if (iv.length === 12 && tag.length === 16) {
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
          decipher.update(data),
          decipher.final(),
        ]).toString("utf8");
      }
    } catch {
      // Fall through
    }

    return value;
  }

  // Subcase 2b: 2 parts (iv:encrypted — legacy CBC format)
  if (parts.length === 2) {
    const [ivHex, encHex] = parts;
    if (!ivHex || !encHex) return value;
    try {
      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      return value;
    }
  }

  return value;
};

// Case-variant aliases for uniform contract support
export const encryptPII = encryptPii;
export const decryptPII = decryptPii;

export default {
  encryptPii,
  decryptPii,
  encryptPII,
  decryptPII,
  isPiiEncryptionEnabled,
  getKey,
};
