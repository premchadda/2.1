import { idsMatch } from "./db-utils.js";
import { buildPublicIdLookup, mapLookupId } from "./public-id-response.js";
import { getSubjectIcon as emojiGetSubjectIcon } from "../config/emojiConfig.js";
import { decryptPii, isPiiEncryptionEnabled } from "./piiCrypto.js";

/**
 * Populates enrolled series data for a user
 * @param {object} user
 * @param {object} dbHelpers
 * @returns {Promise<Array>}
 */
export const populateEnrolledSeries = async (user, dbHelpers) => {
  if (
    !user.enrolledSeries ||
    !Array.isArray(user.enrolledSeries) ||
    user.enrolledSeries.length === 0
  ) {
    return [];
  }

  // Fetch only series matching enrolled IDs
  const seriesIds = user.enrolledSeries
    .map((id) => (typeof id === "object" && id ? id.id || id._id : id))
    .filter(Boolean);

  if (seriesIds.length === 0) return [];

  return dbHelpers.find("testSeries", { id: { $in: seriesIds } });
};

// Credentials, hashes, salts, reset tokens, and internal secrets that must NEVER be returned in any API response.
const CREDENTIAL_SECRET_FIELDS = new Set([
  "password",
  "password_hash",
  "salt",
  "refresh_token_version",
  "refreshTokenVersion",
  "email_verification_token",
  "emailVerificationToken",
  "email_verification_expires",
  "emailVerificationExpires",
  "reset_password_token",
  "resetPasswordToken",
  "reset_password_expires",
  "resetPasswordExpires",
  "two_factor_secret",
  "twoFactorSecret",
  "two_factor_secret_encrypted",
  "otp_secret",
  "otpSecret",
  "phone_auth_secret",
  "phoneAuthSecret",
  "razorpay_customer_id",
  "razorpayCustomerId",
  "device_fingerprint",
  "deviceFingerprint",
  "login_secret",
  "loginSecret",
  "phone_enc",
  "dob_enc",
  "location_enc",
  "education_enc",
  "bio_enc",
  "aadhaar",
  "pan_number",
  "panNumber",
  "government_id",
  "governmentId",
]);

// Extra PII fields stripped when exposing user records to OTHER/ANONYMOUS users (e.g. leaderboard, comments)
const PUBLIC_ANONYMOUS_PII_FIELDS = new Set([
  "phone",
  "phone_number",
  "dob",
  "date_of_birth",
  "dateOfBirth",
  "location",
  "city",
  "state",
  "country",
  "pincode",
  "pin_code",
  "postal_code",
  "education",
  "bio",
]);

/**
 * Decrypts any encrypted shadow columns back into readable properties on the user object.
 * @param {object|null} user
 * @returns {object|null}
 */
export const decryptUserPii = (user) => {
  if (!user || !isPiiEncryptionEnabled()) return user;
  const out = { ...user };
  const map = [
    ["phone_enc", "phone"],
    ["phone_enc", "mobile"],
    ["dob_enc", "dateOfBirth"],
    ["dob_enc", "dob"],
    ["location_enc", "location"],
    ["education_enc", "education"],
    ["bio_enc", "bio"],
  ];
  for (const [encKey, plainKey] of map) {
    const enc = user[encKey];
    if (enc && !out[plainKey]) {
      try {
        out[plainKey] = decryptPii(enc);
      } catch {
        // preserve existing if decryption fails
      }
    }
  }
  return out;
};

/**
 * Sanitizes a user record for API responses.
 * - Strips credentials, hashes, 2FA secrets, and internal auth secrets unconditionally.
 * - If `options.isPublicList` is true, also strips contact/location PII for other users.
 * - By default preserves user profile attributes (name, email, phone, mobile, dob, location, education, bio) for the authenticated user and admin endpoints.
 * @param {object|null} user
 * @param {object} [options]
 * @param {boolean} [options.isPublicList=false]
 * @returns {object|null}
 */
export const sanitizeUser = (user, options = {}) => {
  if (!user) return null;

  // Decrypt any PII columns if present
  const decrypted = decryptUserPii(user);

  const safeUser = {};
  for (const key of Object.keys(decrypted)) {
    if (CREDENTIAL_SECRET_FIELDS.has(key)) {
      continue;
    }
    if (options.isPublicList && PUBLIC_ANONYMOUS_PII_FIELDS.has(key)) {
      continue;
    }
    safeUser[key] = decrypted[key];
  }
  return safeUser;
};

/**
 * Helper to parse enrolledSeries which might be stored as string in PostgreSQL
 * @param {any} enrolledSeries
 * @returns {Array}
 */
export const parseEnrolledSeries = (enrolledSeries) => {
  if (!enrolledSeries) return [];

  if (Array.isArray(enrolledSeries)) return enrolledSeries;

  if (typeof enrolledSeries === "string") {
    if (enrolledSeries.startsWith("{") && enrolledSeries.endsWith("}")) {
      const inner = enrolledSeries.slice(1, -1);
      if (!inner.trim()) return [];
      return inner.split(",").map((id) => {
        const num = parseInt(id.trim(), 10);
        return isNaN(num) ? id.trim() : num;
      });
    }

    try {
      const parsed = JSON.parse(enrolledSeries);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

/**
 * Maps enrolledSeries values to the public IDs exposed by the API.
 * Keeps any non-numeric legacy values unchanged as a fallback.
 * @param {any} enrolledSeries
 * @param {object} dbHelpers
 * @returns {Promise<Array>}
 */
export const mapEnrolledSeriesIdsForResponse = async (
  enrolledSeries,
  dbHelpers,
) => {
  const parsedEnrolledSeries = parseEnrolledSeries(enrolledSeries);
  const enrolledSeriesLookup = await buildPublicIdLookup(
    dbHelpers,
    "testSeries",
    parsedEnrolledSeries,
  );
  return parsedEnrolledSeries.map((value) =>
    mapLookupId(value, enrolledSeriesLookup, value),
  );
};

/**
 * Checks if a user has a Pro account
 * @param {object} user
 * @returns {boolean}
 */
export const isProUser = (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  const passType = String(user.passType || user.pass_type || "").toLowerCase();
  if (passType && passType !== "free" && passType !== "none") return true;
  if (
    user.isProUser === true ||
    user.is_pro_user === true ||
    user.isPro === true ||
    user.is_pro === true
  ) {
    if (user.proExpiry || user.pro_expiry) {
      return new Date(user.proExpiry || user.pro_expiry) > new Date();
    }
    return true;
  }
  return false;
};

/**
 * Checks if a test requires a Pro account
 * @param {object} test
 * @returns {boolean}
 */
export const isProRestrictedTest = (test) => {
  if (!test) return false;
  if (test.isFree === true || test.is_free === true) return false;
  if (String(test.type || "").toLowerCase() === "free") return false;
  return test.isPro === true || test.is_pro === true;
};

/**
 * Maps subject name to an emoji icon
 * @param {string} subject
 * @returns {string}
 */
export const getSubjectIcon = (subject) => {
  return emojiGetSubjectIcon(subject);
};
