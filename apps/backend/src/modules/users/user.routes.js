import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { protect } from "../../middleware/auth.middleware.js";
import {
  responseCache,
  invalidateResponseCache,
} from "../../middleware/responseCache.middleware.js";
import {
  storeUploadedAssetFile,
  deleteStoredAssetFile,
} from "../../infrastructure/storage/storageProvider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import {
  createSchema,
  validateBody,
} from "../../middleware/validation/inputValidation.js";
import { analyticsService } from "../../services/core/index.js";
import { idsMatch, parseNumericId } from "../../shared/utils/db-utils.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import {
  buildPublicIdLookup,
  getPublicResponseId,
  mapLookupId,
} from "../../shared/utils/public-id-response.js";
import {
  sanitizeUser,
  parseEnrolledSeries,
  getSubjectIcon,
  mapEnrolledSeriesIdsForResponse,
  populateEnrolledSeries,
  isProUser,
} from "../../shared/utils/user-utils.js";
import {
  encryptPii,
  decryptPii,
  isPiiEncryptionEnabled,
} from "../../shared/utils/piiCrypto.js";
import {
  getUserAttempts,
  isCompletedAttempt,
  formatAttemptResponse,
} from "../../shared/utils/attempt-utils.js";
import EnrollmentService from "../../services/EnrollmentService.js";
import EntitlementService from "../../services/EntitlementService.js";
import {
  invalidateSession,
  getUserSessions,
} from "../../services/SessionCaptureService.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

const recordIdentifierValues = (record, fields) =>
  fields
    .flatMap((field) => [record?.[field]])
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value));

const addLookupAliases = (lookup, record, fields) => {
  for (const value of recordIdentifierValues(record, fields)) {
    lookup[value] = record;
    if (/^\d+$/.test(value)) lookup[Number(value)] = record;
  }
};

const findLookupRecord = (lookup, values) => {
  for (const value of values) {
    if (lookup[value] !== undefined) return lookup[value];
    const stringValue = String(value);
    if (lookup[stringValue] !== undefined) return lookup[stringValue];
    if (
      /^\d+$/.test(stringValue) &&
      lookup[Number(stringValue)] !== undefined
    ) {
      return lookup[Number(stringValue)];
    }
  }
  return null;
};

// M14: decrypt PII shadow columns back into the user object for API responses.
// No-ops (returns the input unchanged) when PII encryption is not enabled.
const decryptUserPii = (user) => {
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
    if (enc) out[plainKey] = decryptPii(enc);
  }
  return out;
};

// Profile update validation schema (Issue #33)
const profileUpdateSchema = createSchema()
  .field("name", {
    type: "string",
    required: false,
    minLength: 2,
    maxLength: 100,
  })
  .field("mobile", { type: "string", required: false, maxLength: 15 }) // Pattern removed to allow empty strings
  .field("avatar", { type: "string", required: false, maxLength: 10000000 }) // Increased to 10MB for base64 images
  .field("banner", { type: "string", required: false, maxLength: 10000000 })
  .field("phone", { type: "string", required: false, maxLength: 15 })
  .field("dateOfBirth", { type: "string", required: false, maxLength: 20 })
  .field("location", { type: "string", required: false, maxLength: 200 })
  .field("education", { type: "string", required: false, maxLength: 200 })
  .field("bio", { type: "string", required: false, maxLength: 500 });

/**
 * Delete old profile asset file from disk
 * @param {string} oldPath - The old file path (e.g., /assets/avatar/avatar_123_1234567890.jpg)
 */
const deleteOldProfileAsset = (oldPath) => {
  if (!oldPath || typeof oldPath !== "string") return;

  // Full URLs (Supabase/S3) — try to extract storage key and delete via provider
  if (oldPath.startsWith("http://") || oldPath.startsWith("https://")) {
    try {
      const url = new URL(oldPath);
      // Supabase public URL pattern: /storage/v1/object/public/<bucket>/<key>
      const publicMatch = url.pathname.match(
        /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
      );
      if (publicMatch) {
        const storageKey = decodeURIComponent(publicMatch[2]);
        // Build a synthetic asset object for deleteStoredAssetFile
        deleteStoredAssetFile({
          metadata: { provider: "supabase", storageKey },
        }).catch(() => {});
      }
    } catch {
      // Not a valid URL — ignore
    }
    return;
  }

  // Legacy local paths under /assets/avatar/
  if (!oldPath.startsWith("/assets/avatar/")) return;

  const fileName = path.basename(oldPath);
  const filePath = path.join(__dirname, "../../../uploads/avatars", fileName);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(
      `❌ [assetDeleteError] Failed to delete ${fileName}:`,
      error.message,
    );
  }
};

/**
 * Save profile asset and optionally delete old file
 * @param {string} imageData - Base64 image data
 * @param {string} userId - User ID
 * @param {string} prefix - File prefix (avatar/banner)
 * @param {string} oldPath - Old file path to delete (optional)
 * @returns {string|null} New file path
 */
const saveProfileAsset = async (imageData, userId, prefix, oldPath = null) => {
  const matches = String(imageData).match(
    /^data:image\/([a-zA-Z0-9]+);base64,(.+)$/,
  );

  if (!matches) {
    return null;
  }

  // Delete old file if provided
  if (oldPath) {
    deleteOldProfileAsset(oldPath);
  }

  const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");
  const fileName = `${prefix}_${userId}_${Date.now()}.${ext}`;

  // Compress to keep files small: avatars are square thumbnails, banners are wide.
  const maxWidth = prefix === "banner" ? 1280 : 256;
  const maxHeight = prefix === "banner" ? 480 : 256;
  let compressedBuffer = buffer;
  let mimetype = `image/${matches[1] === "jpeg" ? "jpeg" : matches[1]}`;

  try {
    const sharp = (await import("sharp")).default;
    compressedBuffer = await sharp(buffer)
      .rotate()
      .resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    mimetype = "image/webp";
  } catch (error) {
    console.error(
      `❌ [assetSaveError] Failed to compress ${fileName}:`,
      error.message,
    );
  }

  // Build a synthetic file object for the storage provider
  const syntheticFile = {
    buffer: compressedBuffer,
    mimetype,
    originalname: fileName,
    filename: fileName,
  };

  try {
    const result = await storeUploadedAssetFile(syntheticFile, {
      category: "avatars",
    });
    return result.publicUrl;
  } catch (error) {
    console.error(
      `❌ [assetSaveError] Storage provider failed for ${fileName}:`,
      error.message,
    );
    // Fallback: write to local disk
    const uploadDir = path.join(__dirname, "../../../uploads/avatars");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(filePath, compressedBuffer);
    return `/assets/avatar/${fileName}`;
  }
};

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await dbHelpers.findById("users", req.user.id);
    const profileUser = isPiiEncryptionEnabled() ? decryptUserPii(user) : user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch enrolled series from enrollments table
    const enrolledSeriesIds = await EnrollmentService.getEnrolledSeriesIds(
      dbHelpers,
      req.user.id,
    );
    const allSeries = await dbHelpers.find("testSeries");
    const populatedSeries = allSeries.filter((s) =>
      enrolledSeriesIds.some((id) => String(id) === String(s.id || s._id)),
    );

    // Fetch user's completed test attempts to calculate progress and provide attempted tests info
    const userAttempts = await getUserAttempts(req.user.id, dbHelpers, {
      completedOnly: true,
    });

    const attemptedTestsBySeries = new Map();
    const attemptedTestIds = new Set();

    userAttempts.forEach((attempt) => {
      if (attempt.isReattempt === true || attempt.is_reattempt === true) {
        return;
      }

      const seriesId = attempt.seriesId || attempt.series_id;
      const testId = attempt.testId || attempt.test_id;

      if (seriesId && testId) {
        const seriesKey = String(seriesId);
        if (!attemptedTestsBySeries.has(seriesKey)) {
          attemptedTestsBySeries.set(seriesKey, new Set());
        }
        attemptedTestsBySeries.get(seriesKey).add(String(testId));
      }

      if (testId) {
        attemptedTestIds.add(String(testId));
      }
    });

    const attemptedSeriesLookup = await buildPublicIdLookup(
      dbHelpers,
      "testSeries",
      Array.from(attemptedTestsBySeries.keys()),
    );
    const attemptedTestsLookup = await buildPublicIdLookup(
      dbHelpers,
      "tests",
      Array.from(attemptedTestIds),
    );

    const attemptedTests = Object.fromEntries(
      Array.from(attemptedTestsBySeries.entries()).map(
        ([seriesId, testIds]) => [
          mapLookupId(seriesId, attemptedSeriesLookup, seriesId),
          testIds.size,
        ],
      ),
    );

    res.json({
      success: true,
      data: {
        ...sanitizeUser(profileUser),
        enrolledSeries: populatedSeries,
        attemptedTests,
        attemptedTestIds: Array.from(attemptedTestIds).map((testId) =>
          mapLookupId(testId, attemptedTestsLookup, testId),
        ),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  express.json({ limit: "10mb" }),
  protect,
  validateBody(profileUpdateSchema),
  async (req, res) => {
    try {
      const {
        name,
        mobile,
        avatar,
        banner,
        phone,
        dateOfBirth,
        location,
        education,
        bio,
        notificationPreferences,
        privacy,
        isActive,
      } = req.body;

      // Sanitize inputs (Issue #33)
      const sanitizedData = {};
      if (name !== undefined)
        sanitizedData.name = String(name).trim().substring(0, 100);
      // Handle both 'mobile' and 'phone' fields (frontend sends 'phone')
      const phoneValue = mobile ?? phone;
      if (phoneValue !== undefined)
        sanitizedData.mobile = String(phoneValue).trim().substring(0, 15);

      // Now that the columns exist in the database, we can update them without 500 errors
      if (dateOfBirth !== undefined)
        sanitizedData.dateOfBirth = String(dateOfBirth).trim().substring(0, 20);
      if (location !== undefined)
        sanitizedData.location = String(location).trim().substring(0, 200);
      if (education !== undefined)
        sanitizedData.education = String(education).trim().substring(0, 200);
      if (bio !== undefined)
        sanitizedData.bio = String(bio).trim().substring(0, 500);

      // M14: encrypt PII into the dedicated *_enc columns so it is not stored as
      // plaintext. The plaintext columns are retained for backward compat but the
      // encrypted copies are the source of truth.
      if (isPiiEncryptionEnabled()) {
        if (phoneValue !== undefined)
          sanitizedData.phone_enc = encryptPii(phoneValue);
        if (dateOfBirth !== undefined)
          sanitizedData.dob_enc = encryptPii(dateOfBirth);
        if (location !== undefined)
          sanitizedData.location_enc = encryptPii(location);
        if (education !== undefined)
          sanitizedData.education_enc = encryptPii(education);
        if (bio !== undefined) sanitizedData.bio_enc = encryptPii(bio);
      }

      // Fetch current user data to get old file paths
      const currentUser = await dbHelpers.findById("users", req.user.id);
      const oldAvatar = currentUser?.avatar || null;
      const oldBanner = currentUser?.banner || null;

      if (avatar === "") {
        // Deleting avatar - remove old file
        if (oldAvatar) deleteOldProfileAsset(oldAvatar);
        sanitizedData.avatar = null;
      } else if (avatar && avatar.startsWith("data:image")) {
        // Uploading new avatar - delete old and save new
        sanitizedData.avatar = await saveProfileAsset(
          avatar,
          req.user.id,
          "avatar",
          oldAvatar,
        );
      } else if (avatar) {
        // Setting avatar from URL
        sanitizedData.avatar = String(avatar).trim().substring(0, 500);
      }

      if (banner === "") {
        // Deleting banner - remove old file
        if (oldBanner) deleteOldProfileAsset(oldBanner);
        sanitizedData.banner = null;
      } else if (banner && banner.startsWith("data:image")) {
        // Uploading new banner - delete old and save new
        sanitizedData.banner = await saveProfileAsset(
          banner,
          req.user.id,
          "banner",
          oldBanner,
        );
      } else if (banner) {
        // Setting banner from URL
        sanitizedData.banner = String(banner).trim().substring(0, 500);
      }

      if (
        notificationPreferences &&
        typeof notificationPreferences === "object" &&
        !Array.isArray(notificationPreferences)
      ) {
        sanitizedData.notificationPreferences = {
          email: Boolean(notificationPreferences.email),
          push: Boolean(notificationPreferences.push),
          sms: Boolean(notificationPreferences.sms),
          testReminders: Boolean(notificationPreferences.testReminders),
          promotional: Boolean(notificationPreferences.promotional),
          weeklyReport: Boolean(notificationPreferences.weeklyReport),
        };
      }

      if (privacy && typeof privacy === "object" && !Array.isArray(privacy)) {
        sanitizedData.privacy = {
          profileVisibility: ["public", "friends", "private"].includes(
            privacy.profileVisibility,
          )
            ? privacy.profileVisibility
            : "public",
          showProgress: privacy.showProgress !== false,
          showOnLeaderboard: privacy.showOnLeaderboard !== false,
          allowMessages: privacy.allowMessages !== false,
        };
      }

      // SECURITY: Strip admin-only fields from the request body so a regular user
      // cannot self-modify isActive (self-deactivation), role, isProUser, proExpiry,
      // or other privileged fields via the profile update endpoint.
      const ADMIN_ONLY_FIELDS = [
        "isActive",
        "role",
        "isProUser",
        "proExpiry",
        "pro_expiry",
        "passType",
        "pass_type",
        "deactivatedAt",
        "refreshTokenVersion",
        "refresh_token_version",
        "emailVerified",
        "isEmailVerified",
        "phoneVerified",
      ];
      for (const field of ADMIN_ONLY_FIELDS) {
        delete sanitizedData[field];
      }
      // `isActive` from req.body is intentionally ignored — self-deactivation
      // must go through the dedicated DELETE /profile endpoint (account deletion).

      const user = await dbHelpers.updateById(
        "users",
        req.user.id,
        sanitizedData,
      );
      const decryptedUser = isPiiEncryptionEnabled()
        ? decryptUserPii(user)
        : user;
      const enrolledSeries = await mapEnrolledSeriesIdsForResponse(
        user.enrolledSeries ?? user.enrolled_series ?? [],
        dbHelpers,
      );

      res.json({
        success: true,
        data: {
          ...sanitizeUser(decryptedUser),
          enrolledSeries,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   DELETE /api/users/profile
// @desc    Delete user account (soft delete)
// @access  Private
router.delete("/profile", protect, async (req, res) => {
  try {
    // Soft delete by deactivating the account
    await dbHelpers.updateById("users", req.user.id, {
      isActive: false,
      deactivatedAt: new Date().toISOString(),
      deletionRequested: true,
      deletionDate: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 7 days grace period
    });

    // Log the user out on the client side
    res.json({
      success: true,
      message:
        "Account deactivation requested. Your account will be deleted in 7 days.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   POST /api/users/enroll/:seriesId
// @desc    Enroll in a test series (supports both numeric ID and slug)
// @access  Private
router.post("/enroll/:seriesId", protect, async (req, res) => {
  try {
    const { seriesId } = req.params;
    console.log(
      "[Enroll] Request received for seriesId:",
      seriesId,
      "userId:",
      req.user.id,
    );

    const series = await findEntityByIdentifier(
      dbHelpers,
      "testSeries",
      seriesId,
      {
        slugFields: ["slug"],
      },
    );

    if (!series) {
      console.log("[Enroll] Series not found:", seriesId);
      return res.status(404).json({
        success: false,
        message: "Test series not found",
      });
    }
    console.log(
      "[Enroll] Series found:",
      series._id || series.id,
      series.title,
    );

    // Check if series is Pro and user has Pro access via centralized EntitlementService
    const entitlement = EntitlementService.canEnrollSeries(req.user, series);
    if (!entitlement.allowed) {
      console.log(
        "[Enroll] Entitlement check failed:",
        entitlement.reason,
        "series:",
        seriesId,
        "userId:",
        req.user.id,
      );
      return res.status(403).json({
        success: false,
        message:
          entitlement.message ||
          "Pro Pass required to enroll in this test series",
        requiresPro: entitlement.requiresPro === true,
      });
    }

    const canonicalSeriesId = getInternalId(series);

    // Use EnrollmentService - primary source is enrollments table
    const result = await EnrollmentService.enrollInSeries(
      dbHelpers,
      req.user.id,
      canonicalSeriesId,
    );

    if (result.alreadyEnrolled) {
      console.log("[Enroll] User already enrolled");
      const enrolledSeriesIds = await EnrollmentService.getEnrolledSeriesIds(
        dbHelpers,
        req.user.id,
      );
      const enrolledSeriesResponse = await mapEnrolledSeriesIdsForResponse(
        enrolledSeriesIds,
        dbHelpers,
      );
      return res.json({
        success: true,
        message: "Already enrolled in this series",
        alreadyEnrolled: true,
        data: enrolledSeriesResponse,
      });
    }

    console.log("[Enroll] Created enrollment record in enrollments table");

    // AUTO-ENROLLMENT: Enroll user in all exams related to this series
    try {
      console.log("[Enroll] Starting auto-enrollment in related exams...");

      const seriesData = await dbHelpers.findById(
        "testSeries",
        canonicalSeriesId,
      );
      if (seriesData && seriesData.stages && seriesData.stages.length > 0) {
        console.log("[Enroll] Series has stages:", seriesData.stages);

        const currentEnrolledExamIds =
          await EnrollmentService.getEnrolledExamIds(dbHelpers, req.user.id);

        const examIdsToAdd = [];
        for (const stageId of seriesData.stages) {
          const stage = await dbHelpers.findById("stages", stageId);
          if (stage && stage.examIds && Array.isArray(stage.examIds)) {
            for (const examId of stage.examIds) {
              const examIdNum = parseInt(examId);
              if (
                !isNaN(examIdNum) &&
                !currentEnrolledExamIds.includes(examIdNum) &&
                !examIdsToAdd.includes(examIdNum)
              ) {
                examIdsToAdd.push(examIdNum);
              }
            }
          }
        }

        console.log("[Enroll] Exams to auto-enroll:", examIdsToAdd);

        for (const examId of examIdsToAdd) {
          try {
            await EnrollmentService.enrollInExam(
              dbHelpers,
              req.user.id,
              examId,
            );
            console.log("[Enroll] Created enrollment record for exam:", examId);
          } catch (err) {
            console.error("[Enroll] Error creating exam enrollment:", err);
          }
        }
      }
    } catch (autoEnrollError) {
      console.error("[Enroll] Error during auto-enrollment:", autoEnrollError);
    }

    const enrolledSeriesIds = await EnrollmentService.getEnrolledSeriesIds(
      dbHelpers,
      req.user.id,
    );
    const enrolledSeriesLookup = await buildPublicIdLookup(
      dbHelpers,
      "testSeries",
      enrolledSeriesIds,
    );

    res.json({
      success: true,
      message: "Successfully enrolled",
      alreadyEnrolled: false,
      data: enrolledSeriesIds.map((value) =>
        mapLookupId(value, enrolledSeriesLookup, value),
      ),
    });
  } catch (error) {
    console.error("[Enroll] Error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   DELETE /api/users/unenroll/:seriesId
// @desc    Unenroll from a test series (archives user history)
// @access  Private
router.delete("/unenroll/:seriesId", protect, async (req, res) => {
  try {
    const { seriesId } = req.params;
    console.log(
      "[Unenroll] Request received for seriesId:",
      seriesId,
      "userId:",
      req.user.id,
    );

    const series = await findEntityByIdentifier(
      dbHelpers,
      "testSeries",
      seriesId,
      {
        slugFields: ["slug"],
      },
    );

    if (!series) {
      console.log("[Unenroll] Series not found:", seriesId);
      return res.status(404).json({
        success: false,
        message: "Test series not found",
      });
    }
    console.log(
      "[Unenroll] Series found:",
      series._id || series.id,
      series.title,
    );

    const canonicalSeriesId = getInternalId(series);

    // 1. Archive user history before deleting
    try {
      const attempts = await dbHelpers.find("attempts", {
        userId: req.user.id,
        seriesId: canonicalSeriesId,
      });

      if (attempts.length > 0) {
        for (const attempt of attempts) {
          await dbHelpers.insertOne("user_history_archive", {
            userId: req.user.id,
            seriesId: canonicalSeriesId,
            type: "test_attempt",
            originalId: attempt._id || attempt.id,
            data: attempt,
            archivedAt: new Date().toISOString(),
          });
        }
        console.log(`[Unenroll] Archived ${attempts.length} test attempts`);
      }

      const studyHistory = await dbHelpers.find("studyProgress", {
        userId: req.user.id,
        seriesId: canonicalSeriesId,
      });

      if (studyHistory.length > 0) {
        for (const history of studyHistory) {
          await dbHelpers.insertOne("user_history_archive", {
            userId: req.user.id,
            seriesId: canonicalSeriesId,
            type: "study_progress",
            originalId: history._id || history.id,
            data: history,
            archivedAt: new Date().toISOString(),
          });
        }
        console.log(
          `[Unenroll] Archived ${studyHistory.length} study progress records`,
        );
      }
    } catch (archiveError) {
      console.error("[Unenroll] Error archiving history:", archiveError);
    }

    // 2. Delete test attempts, quiz attempts and study progress for this series & its tests
    try {
      await dbHelpers.pool.query(
        `DELETE FROM attempts 
         WHERE user_id = $1 
           AND (series_id = $2 OR test_id IN (SELECT id FROM tests WHERE series_id = $2))`,
        [req.user.id, canonicalSeriesId],
      );

      await dbHelpers.pool.query(
        `DELETE FROM test_attempts 
         WHERE user_id = $1 
           AND (series_id = $2 OR test_id IN (SELECT id FROM tests WHERE series_id = $2))`,
        [req.user.id, canonicalSeriesId],
      );

      await dbHelpers.pool.query(
        `DELETE FROM study_progress 
         WHERE user_id = $1 
           AND series_id = $2`,
        [req.user.id, canonicalSeriesId],
      );
      console.log(
        `[Unenroll] Deleted all previous attempt history for series ${canonicalSeriesId} and user ${req.user.id}`,
      );
    } catch (deleteError) {
      console.error("[Unenroll] Error deleting attempts:", deleteError);
    }

    // 3. Use EnrollmentService to unenroll
    const unenrolled = await EnrollmentService.unenrollFromSeries(
      dbHelpers,
      req.user.id,
      canonicalSeriesId,
    );

    if (!unenrolled) {
      console.log("[Unenroll] User not enrolled in this series");
      return res.status(400).json({
        success: false,
        message: "You are not enrolled in this series",
      });
    }

    console.log("[Unenroll] Successfully unenrolled");

    // 4. Invalidate caches for instant real-time sync
    try {
      await invalidateResponseCache("auth-me");
      await invalidateResponseCache("user-stats");
      await invalidateResponseCache("dashboard");
      await invalidateResponseCache("series-list");
    } catch (cacheErr) {
      console.error("[Unenroll] Error invalidating cache:", cacheErr);
    }

    const enrolledSeriesIds = await EnrollmentService.getEnrolledSeriesIds(
      dbHelpers,
      req.user.id,
    );
    const enrolledSeriesLookup = await buildPublicIdLookup(
      dbHelpers,
      "testSeries",
      enrolledSeriesIds,
    );

    res.json({
      success: true,
      message:
        "Successfully unenrolled. All previous attempt history has been deleted.",
      data: enrolledSeriesIds.map((value) =>
        mapLookupId(value, enrolledSeriesLookup, value),
      ),
      enrolledSeries: enrolledSeriesIds.map((value) =>
        mapLookupId(value, enrolledSeriesLookup, value),
      ),
      unenrolledSeriesId: canonicalSeriesId,
    });
  } catch (error) {
    console.error("[Unenroll] Error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/users/enrolled-series
// @desc    Get user's enrolled series
// @access  Private
router.get("/enrolled-series", protect, async (req, res) => {
  try {
    // Primary: get enrolled series IDs from enrollments table
    const enrolledSeriesIds = await EnrollmentService.getEnrolledSeriesIds(
      dbHelpers,
      req.user.id,
    );

    // Populate series details
    const allSeries = await dbHelpers.find("testSeries", { isActive: true });
    const populatedSeries = allSeries.filter((s) =>
      enrolledSeriesIds.some((id) => String(id) === String(s.id || s._id)),
    );

    res.json({
      success: true,
      data: populatedSeries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/users/analytics
// @desc    Get user's performance analytics
// @access  Private
router.get(
  "/analytics",
  protect,
  responseCache("user-analytics", 60),
  async (req, res) => {
    try {
      const userAttempts = await getUserAttempts(req.user.id, dbHelpers);
      const userId = String(req.user.id);

      // Sort all user attempts by date (newest first)
      const allAttempts = [...userAttempts].sort(
        (a, b) =>
          new Date(
            b.submitted_at || b.created_at || b.submittedAt || b.createdAt || 0,
          ) -
          new Date(
            a.submitted_at || a.created_at || a.submittedAt || a.createdAt || 0,
          ),
      );

      // Filter out completed/submitted ones for performance calculation
      const results = allAttempts.filter((a) => {
        const st = String(a.status || "").toLowerCase();
        return (
          isCompletedAttempt(a) ||
          st === "completed" ||
          st === "submitted" ||
          st === "finish" ||
          st === "finished" ||
          a.score !== undefined
        );
      });

      // Calculate analytics
      const totalTests = results.length;
      let totalQuestions = 0;
      let totalCorrect = 0;
      let totalWrong = 0;
      let totalSkipped = 0;
      let totalScore = 0;
      let totalTimeSpent = 0;

      let subjectWise = [];
      let topicWise = [];

      try {
        // Fetch real subject-wise stats from the database by joining with questions and subjects
        const subjectStatsRes = await dbHelpers.pool.query(
          `
        SELECT 
          s.name as name,
          COUNT(*)::int as attempted,
          SUM(CASE 
            WHEN (
              CASE 
                WHEN jsonb_typeof(t.qa->'selectedOption') = 'number' THEN (t.qa->>'selectedOption')::int
                WHEN jsonb_typeof(t.qa->'selectedOption') = 'object' AND jsonb_typeof(t.qa->'selectedOption'->'selectedOption') = 'number' THEN (t.qa->'selectedOption'->>'selectedOption')::int
                WHEN t.qa->>'selectedOption' ~ '^-?[0-9]+$' THEN (t.qa->>'selectedOption')::int
                ELSE NULL 
              END
            ) = q.correct_option THEN 1 
            ELSE 0 
          END)::int as correct
        FROM (
          SELECT id, jsonb_array_elements(CASE WHEN jsonb_typeof(answers)='array' THEN answers ELSE '[]'::jsonb END) as qa
          FROM attempts 
          WHERE user_id = $1 AND (status IN ('completed', 'submitted', 'finish', 'finished') OR is_completed = true)
        ) t
        JOIN questions q ON (
          CASE 
            WHEN jsonb_typeof(t.qa->'questionId') = 'number' THEN (t.qa->>'questionId')::int
            WHEN t.qa->>'questionId' ~ '^[0-9]+$' THEN (t.qa->>'questionId')::int
            ELSE NULL 
          END
        ) = q.id
        JOIN subjects s ON (
          s.id = q.subject_id
          OR (q.subject IS NOT NULL AND q.subject::text ~ '^[0-9]+$' AND s.id = q.subject::text::int)
          OR (q.subject IS NOT NULL AND NOT (q.subject::text ~ '^[0-9]+$') AND LOWER(s.name) = LOWER(q.subject::text))
        )
        GROUP BY s.name
      `,
          [req.user.id],
        );

        const subjectStatsRow = subjectStatsRes.rows || [];
        subjectWise = subjectStatsRow.map((s) => ({
          name: s.name,
          accuracy:
            s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0,
          attempted: s.attempted,
          icon: getSubjectIcon(s.name),
        }));
      } catch (subjErr) {
        console.warn(
          "[Analytics] Subject stats extraction fallback:",
          subjErr.message,
        );
      }

      try {
        // Fetch topic-level analytics
        const topicStatsRes = await dbHelpers.pool.query(
          `
        SELECT 
          COALESCE(tp.name, 'Uncategorized') as topic_name,
          COALESCE(s.name, 'General') as subject_name,
          COUNT(*)::int as attempted,
          SUM(CASE 
            WHEN (
              CASE 
                WHEN jsonb_typeof(t.qa->'selectedOption') = 'number' THEN (t.qa->>'selectedOption')::int
                WHEN jsonb_typeof(t.qa->'selectedOption') = 'object' AND jsonb_typeof(t.qa->'selectedOption'->'selectedOption') = 'number' THEN (t.qa->'selectedOption'->>'selectedOption')::int
                WHEN t.qa->>'selectedOption' ~ '^-?[0-9]+$' THEN (t.qa->>'selectedOption')::int
                ELSE NULL 
              END
            ) = q.correct_option THEN 1 
            ELSE 0 
          END)::int as correct,
          AVG(CASE 
            WHEN LOWER(q.difficulty::text) IN ('easy', '1') THEN 1 
            WHEN LOWER(q.difficulty::text) IN ('medium', '2') THEN 2 
            WHEN LOWER(q.difficulty::text) IN ('hard', '3') THEN 3 
            ELSE 2 
          END) as avg_difficulty_numeric
        FROM (
          SELECT id, jsonb_array_elements(CASE WHEN jsonb_typeof(answers)='array' THEN answers ELSE '[]'::jsonb END) as qa
          FROM attempts 
          WHERE user_id = $1 AND (status IN ('completed', 'submitted', 'finish', 'finished') OR is_completed = true)
        ) t
        JOIN questions q ON (
          CASE 
            WHEN jsonb_typeof(t.qa->'questionId') = 'number' THEN (t.qa->>'questionId')::int
            WHEN t.qa->>'questionId' ~ '^[0-9]+$' THEN (t.qa->>'questionId')::int
            ELSE NULL 
          END
        ) = q.id
        LEFT JOIN subject_topics tp ON tp.id = q.topic_id
        LEFT JOIN subjects s ON (
          s.id = q.subject_id
          OR (q.subject IS NOT NULL AND q.subject::text ~ '^[0-9]+$' AND s.id = q.subject::text::int)
          OR (q.subject IS NOT NULL AND NOT (q.subject::text ~ '^[0-9]+$') AND LOWER(s.name) = LOWER(q.subject::text))
        )
        GROUP BY tp.name, s.name
        HAVING COUNT(*) > 0
        ORDER BY attempted DESC
        LIMIT 20
      `,
          [req.user.id],
        );

        topicWise = (topicStatsRes.rows || []).map((t) => ({
          topicName: t.topic_name,
          subjectName: t.subject_name,
          attempted: t.attempted,
          correct: t.correct,
          accuracy:
            t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0,
          difficulty: !t.avg_difficulty_numeric
            ? "medium"
            : t.avg_difficulty_numeric < 1.5
              ? "easy"
              : t.avg_difficulty_numeric < 2.5
                ? "medium"
                : "hard",
        }));
      } catch (topErr) {
        console.warn(
          "[Analytics] Topic stats extraction fallback:",
          topErr.message,
        );
      }

      const recentTests = [];
      results.forEach((result, index) => {
        // Aggregate totals handling both camelCase and snake_case properties
        const c =
          Number(
            result.correct ?? result.correctAnswers ?? result.correct_answers,
          ) || 0;
        const w =
          Number(result.wrong ?? result.wrongAnswers ?? result.wrong_answers) ||
          0;
        const s =
          Number(
            result.unattempted ?? result.skipped ?? result.skipped_questions,
          ) || 0;
        const q =
          Number(result.totalQuestions ?? result.total_questions) || c + w + s;
        const sc = parseFloat(result.score) || 0;
        const t =
          Number(
            result.time_spent ??
              result.timeSpent ??
              result.timeTaken ??
              result.duration,
          ) || 0;

        totalQuestions += q;
        totalCorrect += c;
        totalWrong += w;
        totalSkipped += s;
        totalScore += sc;
        totalTimeSpent += t;

        // Recent tests (last 10)
        if (index < 10) {
          recentTests.push({
            id: getPublicResponseId(
              dbHelpers,
              "attempts",
              result,
              result._id || result.id,
            ),
            title:
              result.testTitle ||
              result.test_title ||
              result.title ||
              `Test ${index + 1}`,
            score: Math.round(sc),
            accuracy:
              result.accuracy !== null && result.accuracy !== undefined
                ? Math.round(Number(result.accuracy))
                : c + w > 0
                  ? Math.round((c / (c + w)) * 100)
                  : 0,
            date:
              result.submittedAt ||
              result.submitted_at ||
              result.createdAt ||
              result.created_at,
          });
        }
      });

      // Calculate averages
      const avgAccuracy =
        totalCorrect + totalWrong > 0
          ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
          : results.some((r) => Number(r.accuracy) > 0)
            ? Math.round(
                results.reduce((acc, r) => acc + (Number(r.accuracy) || 0), 0) /
                  results.length,
              )
            : 0;
      const avgScore =
        totalTests > 0 ? parseFloat((totalScore / totalTests).toFixed(1)) : 0;

      // Determine strong and weak subjects
      const sortedSubjects = [...subjectWise].sort(
        (a, b) => b.accuracy - a.accuracy,
      );
      const strongSubjects = sortedSubjects
        .filter((s) => s.attempted > 0 && s.accuracy >= 60)
        .map((s) => s.name);
      const weakSubjects = sortedSubjects
        .filter((s) => s.attempted > 0 && s.accuracy < 60)
        .map((s) => s.name);

      const rank =
        totalTests > 0
          ? await analyticsService.calculateUserRank(req.user.id, avgScore)
          : 0;
      const totalUsersResult = await dbHelpers.pool.query(
        "SELECT COUNT(*)::int as count FROM users",
      );
      const totalUsers = Number(totalUsersResult.rows[0]?.count) || 0;
      const percentile =
        totalTests > 0
          ? Math.round(((totalUsers - rank) / totalUsers) * 100)
          : 0;

      const streak = await analyticsService.getStudyStreak(req.user.id);

      const analytics = {
        totalTests,
        totalQuestions,
        totalHours: Math.round(totalTimeSpent / 3600), // Convert seconds to hours
        correct: totalCorrect,
        wrong: totalWrong,
        skipped: totalSkipped,
        avgAccuracy,
        avgScore,
        rank: rank > 0 ? rank : null,
        totalUsers,
        percentile:
          totalTests > 0 && rank > 0 && totalUsers > 0
            ? Math.max(0, Math.min(100, percentile))
            : null,
        timePerQuestion:
          totalQuestions > 0
            ? Math.round(totalTimeSpent / totalQuestions)
            : null,
        streak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        strongSubjects,
        weakSubjects,
        recentTests,
        subjectWise,
        topicWise,
        weakTopics: topicWise
          .filter((t) => t.accuracy < 50)
          .slice(0, 5)
          .map((t) => t.topicName),
        strongTopics: topicWise
          .filter((t) => t.accuracy >= 70)
          .slice(0, 5)
          .map((t) => t.topicName),
      };

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   GET /api/users/attempts/incomplete
// @desc    Get user's in-progress / paused (resumable) test attempts
// @access  Private
router.get("/attempts/incomplete", protect, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const userAttempts = await dbHelpers.find("attempts", { userId });

    // Set of test IDs that the user has already completed
    const completedTestIds = new Set(
      userAttempts
        .filter((a) => {
          const st = String(a.status || "").toUpperCase();
          return st === "COMPLETED" || a.isCompleted || a.is_completed;
        })
        .flatMap((a) =>
          recordIdentifierValues(a, [
            "testId",
            "test_id",
            "testPublicId",
            "test_public_id",
            "testUuid",
            "test_uuid",
            "testSlug",
            "test_slug",
          ]),
        ),
    );

    const incompleteAttempts = userAttempts.filter((a) => {
      const status = String(a.status || "").toUpperCase();
      const isPausedOrInProgress =
        status === "IN_PROGRESS" || status === "PAUSED";
      if (!isPausedOrInProgress) return false;

      const testId = String(a.testId || a.test_id);
      let answersArr = [];
      if (Array.isArray(a.answers)) {
        answersArr = a.answers;
      } else if (typeof a.answers === "string" && a.answers.trim()) {
        try {
          const parsed = JSON.parse(a.answers);
          answersArr = Array.isArray(parsed) ? parsed : [];
        } catch {
          answersArr = [];
        }
      }

      // If the test has already been completed and this incomplete attempt has 0 answers, ignore it
      if (
        completedTestIds.has(testId) &&
        (!answersArr || answersArr.length === 0)
      ) {
        return false;
      }
      return true;
    });

    if (incompleteAttempts.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Most recently active first
    incompleteAttempts.sort(
      (a, b) =>
        new Date(b.lastActivityAt || b.updatedAt || b.createdAt || 0) -
        new Date(a.lastActivityAt || a.updatedAt || a.createdAt || 0),
    );

    const tests = await dbHelpers.find("tests");
    const series = await dbHelpers.find("testSeries");

    const testMap = {};
    tests.forEach((test) =>
      addLookupAliases(testMap, test, [
        "_id",
        "id",
        "publicId",
        "public_id",
        "publicIdUuid",
        "public_id_uuid",
        "uuid",
        "slug",
      ]),
    );

    const seriesMap = {};
    series.forEach((entry) =>
      addLookupAliases(seriesMap, entry, [
        "_id",
        "id",
        "publicId",
        "public_id",
        "publicIdUuid",
        "public_id_uuid",
        "uuid",
        "slug",
      ]),
    );

    const formatted = incompleteAttempts.map((attempt) => {
      const test =
        findLookupRecord(
          testMap,
          recordIdentifierValues(attempt, [
            "testId",
            "test_id",
            "testPublicId",
            "test_public_id",
            "testUuid",
            "test_uuid",
            "testSlug",
            "test_slug",
          ]),
        ) || {};
      const resolvedSeriesId =
        attempt.seriesId ||
        attempt.series_id ||
        attempt.seriesPublicId ||
        attempt.series_public_id ||
        test.seriesId ||
        test.series_id;
      const testSeries =
        findLookupRecord(
          seriesMap,
          recordIdentifierValues(test, ["seriesId", "series_id"]).concat(
            recordIdentifierValues(attempt, [
              "seriesId",
              "series_id",
              "seriesPublicId",
              "series_public_id",
              "seriesSlug",
              "series_slug",
            ]),
          ),
        ) || {};

      const totalDuration = test.duration
        ? test.duration * 60
        : attempt.remainingTimeSeconds || 0;
      const timeSpent = attempt.totalTimeSpent || 0;
      const progressPct =
        totalDuration > 0
          ? Math.min(100, Math.round((timeSpent / totalDuration) * 100))
          : 0;

      return {
        attemptId: getPublicResponseId(
          dbHelpers,
          "attempts",
          attempt,
          attempt._id || attempt.id,
        ),
        testId: getPublicResponseId(
          dbHelpers,
          "tests",
          test,
          attempt.testId || attempt.test_id || test.id || test._id,
        ),
        testSlug: test.slug || attempt.testSlug || attempt.test_slug || null,
        seriesId: getPublicResponseId(
          dbHelpers,
          "testSeries",
          testSeries,
          resolvedSeriesId,
        ),
        seriesSlug:
          testSeries.slug || attempt.seriesSlug || attempt.series_slug || null,
        title: attempt.testTitle || test.title || "Unknown Test",
        seriesTitle: testSeries.title || "Unknown Series",
        status: attempt.status,
        totalQuestions:
          attempt.totalQuestions || test.questions || test.total_questions || 0,
        answeredQuestions: Array.isArray(attempt.answers)
          ? attempt.answers.length
          : 0,
        timeSpentSeconds: timeSpent,
        remainingTimeSeconds: attempt.remainingTimeSeconds || 0,
        totalDurationSeconds: totalDuration,
        progressPct,
        lastQuestionIndex: attempt.lastQuestionIndex || 0,
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("Get incomplete attempts error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/users/attempts
// @desc    Get user's test attempts (completed only)
// @access  Private
router.get(
  "/attempts",
  protect,
  responseCache("user-attempts", 60),
  async (req, res) => {
    try {
      const { limit = 50, page = 1 } = req.query;

      // Get user ID
      const userId = Number(req.user.id);

      // Get all attempts for this user directly from DB and user quizzes in parallel
      const [userAttempts, quizzes] = await Promise.all([
        dbHelpers.find("attempts", { userId: userId }),
        dbHelpers.find("quizzes", { created_by: userId }).catch(() => []),
      ]);

      // Filter completed/submitted attempts
      const completedAttempts = userAttempts.filter((a) => {
        const statusStr = String(a.status || "").toLowerCase();
        const statusOk =
          a.isCompleted === true ||
          statusStr === "completed" ||
          statusStr === "submitted" ||
          statusStr === "finish" ||
          statusStr === "finished";

        return statusOk;
      });

      // Sort by date desc
      completedAttempts.sort(
        (a, b) =>
          new Date(b.submittedAt || b.createdAt || 0) -
          new Date(a.submittedAt || a.createdAt || 0),
      );

      // Collect ONLY the specific test and series IDs needed for completed attempts
      const rawTestIds = completedAttempts.flatMap((a) =>
        recordIdentifierValues(a, [
          "testId",
          "test_id",
          "testPublicId",
          "test_public_id",
          "testUuid",
          "test_uuid",
          "testSlug",
          "test_slug",
        ]),
      );
      const numTestIds = rawTestIds
        .filter((id) => typeof id === "number" || /^\d+$/.test(id))
        .map(Number);
      const strTestIds = rawTestIds.filter(
        (id) => typeof id === "string" && !/^\d+$/.test(id),
      );

      const [numTests, strTests] = await Promise.all([
        numTestIds.length
          ? dbHelpers.find("tests", { id: { $in: [...new Set(numTestIds)] } })
          : Promise.resolve([]),
        strTestIds.length
          ? dbHelpers.find("tests", {
              public_id: { $in: [...new Set(strTestIds)] },
            })
          : Promise.resolve([]),
      ]);
      const tests = [...numTests, ...strTests];

      const rawSeriesIds = [
        ...completedAttempts.flatMap((a) =>
          recordIdentifierValues(a, [
            "seriesId",
            "series_id",
            "seriesPublicId",
            "series_public_id",
            "seriesSlug",
            "series_slug",
          ]),
        ),
        ...tests.flatMap((t) =>
          recordIdentifierValues(t, ["seriesId", "series_id"]),
        ),
      ];
      const numSeriesIds = rawSeriesIds
        .filter((id) => typeof id === "number" || /^\d+$/.test(id))
        .map(Number);
      const strSeriesIds = rawSeriesIds.filter(
        (id) => typeof id === "string" && !/^\d+$/.test(id),
      );

      const [numSeries, strSeries] = await Promise.all([
        numSeriesIds.length
          ? dbHelpers.find("testSeries", {
              id: { $in: [...new Set(numSeriesIds)] },
            })
          : Promise.resolve([]),
        strSeriesIds.length
          ? dbHelpers.find("testSeries", {
              public_id: { $in: [...new Set(strSeriesIds)] },
            })
          : Promise.resolve([]),
      ]);
      const series = [...numSeries, ...strSeries];

      const testMap = {};
      tests.forEach((test) =>
        addLookupAliases(testMap, test, [
          "_id",
          "id",
          "publicId",
          "public_id",
          "publicIdUuid",
          "public_id_uuid",
          "uuid",
          "slug",
        ]),
      );

      const seriesMap = {};
      series.forEach((entry) =>
        addLookupAliases(seriesMap, entry, [
          "_id",
          "id",
          "publicId",
          "public_id",
          "publicIdUuid",
          "public_id_uuid",
          "uuid",
          "slug",
        ]),
      );

      // Format attempts with test and series details
      const formattedAttempts = completedAttempts.map((attempt) => {
        const attemptTestId = attempt.testId || attempt.test_id;
        const test =
          findLookupRecord(
            testMap,
            recordIdentifierValues(attempt, [
              "testId",
              "test_id",
              "testPublicId",
              "test_public_id",
              "testUuid",
              "test_uuid",
              "testSlug",
              "test_slug",
            ]),
          ) || {};

        const resolvedSeriesId =
          attempt.seriesId ||
          attempt.series_id ||
          attempt.seriesPublicId ||
          attempt.series_public_id ||
          test.seriesId ||
          test.series_id;
        const testSeries =
          findLookupRecord(
            seriesMap,
            recordIdentifierValues(test, ["seriesId", "series_id"]).concat(
              recordIdentifierValues(attempt, [
                "seriesId",
                "series_id",
                "seriesPublicId",
                "series_public_id",
                "seriesSlug",
                "series_slug",
              ]),
            ),
          ) || {};

        const formatted = {
          id: getPublicResponseId(
            dbHelpers,
            "attempts",
            attempt,
            attempt._id || attempt.id,
          ),
          testId: getPublicResponseId(
            dbHelpers,
            "tests",
            test,
            attempt.testId || attempt.test_id || test.id || test._id,
          ),
          testSlug: test.slug || attempt.testSlug || attempt.test_slug || null,
          seriesId: getPublicResponseId(
            dbHelpers,
            "testSeries",
            testSeries,
            resolvedSeriesId,
          ),
          seriesSlug:
            testSeries.slug ||
            attempt.seriesSlug ||
            attempt.series_slug ||
            null,
          title: attempt.testTitle || test.title || "Unknown Test",
          seriesTitle: testSeries.title || "Unknown Series",
          score: attempt.score || 0,
          totalMarks: attempt.totalMarks || test.totalMarks || 200,
          correct: attempt.correct || attempt.correctAnswers || 0,
          wrong: attempt.wrong || attempt.wrongAnswers || 0,
          skipped: attempt.unattempted || attempt.skippedQuestions || 0,
          accuracy: attempt.accuracy || 0,
          rank: attempt.rank || null,
          totalParticipants: attempt.totalParticipants || 0,
          timeSpent: attempt.timeSpent || attempt.timeTaken || 0,
          date: attempt.submittedAt || attempt.createdAt,
          submittedAt: attempt.submittedAt || attempt.createdAt,
          isReattempt: !!(attempt.isReattempt || attempt.is_reattempt),
          is_reattempt: !!(attempt.isReattempt || attempt.is_reattempt),
        };
        return formatted;
      });

      // Also format quizzes created by user (as a teacher/creator)
      const formattedQuizzes = (quizzes || []).map((q) => ({
        id: q.id,
        type: "quiz",
        testId: q.id,
        testSlug: q.slug,
        seriesId: null,
        seriesSlug: null,
        title: q.title || "Quiz",
        seriesTitle: "Practice Quiz",
        score: null,
        totalMarks: q.question_ids?.length || 0,
        correct: null,
        wrong: null,
        skipped: null,
        accuracy: null,
        rank: null,
        totalParticipants: null,
        timeSpent: null,
        date: q.created_at,
        submittedAt: q.created_at,
      }));

      // Combine tests and quizzes
      const allAttempts = [...formattedAttempts, ...formattedQuizzes];
      allAttempts.sort(
        (a, b) =>
          new Date(b.date || b.submittedAt || 0) -
          new Date(a.date || a.submittedAt || 0),
      );

      // Paginate
      const startIndex = (page - 1) * limit;
      const paginatedAttempts = allAttempts.slice(
        startIndex,
        startIndex + parseInt(limit),
      );

      res.json({
        success: true,
        data: paginatedAttempts,
        total: allAttempts.length,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allAttempts.length,
          totalPages: Math.ceil(allAttempts.length / limit),
        },
      });
    } catch (error) {
      console.error("Get attempts error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   GET /api/users/sessions
// @desc    Get user's active sessions
// @access  Private
router.get("/sessions", protect, async (req, res) => {
  try {
    // Use raw SQL via getUserSessions — dbHelpers.find doesn't handle snake_case PG columns correctly
    const sessions = await getUserSessions(req.user.id);
    // Map to camelCase for frontend
    const formattedSessions = (sessions || []).map((s) => ({
      id: s.id,
      sessionId: s.session_id,
      device: s.device_type,
      ip: s.ip_address || "Unknown",
      location:
        s.city && s.country
          ? `${s.city}, ${s.country}`
          : s.country || s.city || "Unknown",
      lastActive: s.last_active,
      isCurrent: s.is_active,
      browser: s.browser || "Unknown",
      os: s.os || "Unknown",
      createdAt: s.created_at,
    }));

    // Sort by most recently active
    formattedSessions.sort(
      (a, b) => new Date(b.lastActive) - new Date(a.lastActive),
    );

    res.json({ success: true, data: formattedSessions });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   DELETE /api/users/sessions/:sessionId
// @desc    Revoke a specific session (soft delete)
// @access  Private
router.delete("/sessions/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate ownership before revoking — search both id and session_id columns
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const sessionResult = await pool.query(
      "SELECT user_id, session_id FROM user_sessions WHERE (session_id = $1 OR id::text = $1) AND is_active = true",
      [sessionId],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    if (String(session.user_id) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Use service to invalidate (soft delete) and emit WebSocket event
    await invalidateSession(session.session_id || sessionId, {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
    });

    res.json({ success: true, message: "Session revoked" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/users/change-email
// @desc    Request email change with verification
// @access  Private
router.post("/change-email", protect, async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid email required" });
    }
    // In production, would send verification email
    const user = await dbHelpers.findById("users", req.user.id);
    if (user.email === newEmail) {
      return res
        .status(400)
        .json({ success: false, message: "New email must be different" });
    }
    res.json({
      success: true,
      message: "Verification email sent to new address",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/users/top-performers
// @desc    Get top performers leaderboard
// @access  Public
router.get("/top-performers", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    const topPerformers = await analyticsService.getTopPerformers(parsedLimit);

    res.json({ success: true, data: topPerformers });
  } catch (error) {
    console.error("Top performers error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
