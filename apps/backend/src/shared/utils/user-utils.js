import { idsMatch } from "./db-utils.js";
import { buildPublicIdLookup, mapLookupId } from "./public-id-response.js";
import { getSubjectIcon as emojiGetSubjectIcon } from '../config/emojiConfig.js';

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

  // Fetch all series matching IDs
  const allSeries = await dbHelpers.find("testSeries");
  return allSeries.filter((series) =>
    user.enrolledSeries.some(
      (enrolledId) =>
        idsMatch(enrolledId, series._id) || idsMatch(enrolledId, series.id),
    ),
  );
};

/**
 * Sanitizes user object for public/API response
 * @param {object} user
 * @returns {object|null}
 */
// Sensitive credential/secret/PII fields that must NEVER be returned to clients.
// Covers both camelCase and snake_case variants (dbHelpers returns snake_case keys).
// M7: extends beyond auth secrets to direct PII (phone, DOB, location, education,
// bio, government ids) that should not be shared in generic user payloads.
const SENSITIVE_USER_FIELDS = new Set([
  'password',
  'password_hash',
  'salt',
  'refresh_token_version',
  'email_verification_token',
  'emailVerificationToken',
  'email_verification_expires',
  'emailVerificationExpires',
  'reset_password_token',
  'resetPasswordToken',
  'reset_password_expires',
  'resetPasswordExpires',
  'two_factor_secret',
  'two_factor_secret_encrypted',
  'otp_secret',
  'phone_auth_secret',
  'razorpay_customer_id',
  'device_fingerprint',
  'login_secret',
  // PII (M7)
  'phone',
  'phone_number',
  'dob',
  'date_of_birth',
  'location',
  'city',
  'state',
  'country',
  'pincode',
  'pin_code',
  'postal_code',
  'education',
  'bio',
  'aadhaar',
  'pan_number',
  'government_id'
]);

/**
 * Sanitizes a user record for public/API responses.
 * Strips credential, secret, and sensitive-PII fields regardless of key casing.
 * @param {object|null} user
 * @returns {object|null}
 */
export const sanitizeUser = (user) => {
  if (!user) return null;

  const safeUser = {};
  for (const key of Object.keys(user)) {
    if (!SENSITIVE_USER_FIELDS.has(key)) {
      safeUser[key] = user[key];
    }
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
  if (user.role === 'admin') return true;
  const passType = String(user.passType || user.pass_type || '').toLowerCase();
  if (passType && passType !== 'free' && passType !== 'none') return true;
  if (user.isProUser === true || user.is_pro_user === true || user.isPro === true || user.is_pro === true) {
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
  if (String(test.type || '').toLowerCase() === 'free') return false;
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
