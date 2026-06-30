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
export const sanitizeUser = (user) => {
  if (!user) return null;

  const {
    password,
    password_hash,
    emailVerificationToken,
    email_verification_token,
    emailVerificationExpires,
    email_verification_expires,
    resetPasswordToken,
    reset_password_token,
    resetPasswordExpires,
    reset_password_expires,
    ...safeUser
  } = user;

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
  return Boolean(user?.isProUser || user?.isPro || user?.is_pro || user?.role === 'admin');
};

/**
 * Checks if a test requires a Pro account
 * @param {object} test
 * @returns {boolean}
 */
export const isProRestrictedTest = (test) => {
  const type = String(test?.type || "").toLowerCase();
  return test?.isPro === true || type === "pro";
};

/**
 * Maps subject name to an emoji icon
 * @param {string} subject
 * @returns {string}
 */
export const getSubjectIcon = (subject) => {
  return emojiGetSubjectIcon(subject);
};
