import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { protect } from "../../middleware/auth.middleware.js";
import { createRateLimiter } from "../../middleware/rateLimiterFactory.js";

import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import {
  buildPublicIdLookup,
  mapLookupId,
} from "../../shared/utils/public-id-response.js";
import EnrollmentService from "../../services/EnrollmentService.js";
import { invalidateResponseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import logger from "../../infrastructure/logger/logger.js";
const router = express.Router();
const enrollmentLimiter = createRateLimiter("moderate");

router.post(
  "/enroll-exam/:examId",
  protect,
  enrollmentLimiter,
  async (req, res) => {
    try {
      const { examId } = req.params;
      // PII-safe: log examId only, never userId.
      logger.debug({ examId }, "[Enroll Exam] Request received");

      const exam = await findEntityByIdentifier(dbHelpers, "exams", examId, {
        slugFields: ["slug", "exam_id"],
      });

      if (!exam) {
        logger.debug({ examId }, "[Enroll Exam] Exam not found");
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }
      logger.debug(
        { examId, title: exam.title || exam.name },
        "[Enroll Exam] Exam found",
      );

      const canonicalExamId = getInternalId(exam);

      const result = await EnrollmentService.enrollInExam(
        dbHelpers,
        req.user.id,
        canonicalExamId,
      );

      if (result.alreadyEnrolled) {
        logger.debug({ examId }, "[Enroll Exam] User already enrolled");
        const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
          dbHelpers,
          req.user.id,
        );
        const enrolledExamsLookup = await buildPublicIdLookup(
          dbHelpers,
          "exams",
          enrolledExamIds,
        );
        return res.json({
          success: true,
          message: "Already enrolled in this exam",
          alreadyEnrolled: true,
          data: enrolledExamIds.map((value) =>
            mapLookupId(value, enrolledExamsLookup, value),
          ),
        });
      }

      logger.debug({ examId }, "[Enroll Exam] Created enrollment record");

      // /me caches the enrolledExams list — evict so the new enrollment shows up.
      invalidateResponseCache("auth-me").catch(() => {});
      const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
        dbHelpers,
        req.user.id,
      );
      const enrolledExamsLookup = await buildPublicIdLookup(
        dbHelpers,
        "exams",
        enrolledExamIds,
      );

      res.json({
        success: true,
        message: "Successfully enrolled in exam",
        alreadyEnrolled: false,
        data: enrolledExamIds.map((value) =>
          mapLookupId(value, enrolledExamsLookup, value),
        ),
      });
    } catch (error) {
      console.error("[Enroll Exam] Error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

router.delete("/unenroll-exam/:examId", protect, async (req, res) => {
  try {
    const { examId } = req.params;
    // PII-safe: log examId only, never userId.
    logger.debug({ examId }, "[Unenroll Exam] Request received");

    const exam = await findEntityByIdentifier(dbHelpers, "exams", examId, {
      slugFields: ["slug", "exam_id"],
    });

    if (!exam) {
      logger.debug({ examId }, "[Unenroll Exam] Exam not found");
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }
    logger.debug(
      { examId, title: exam.title || exam.name },
      "[Unenroll Exam] Exam found",
    );

    const canonicalExamId = getInternalId(exam);

    const unenrolled = await EnrollmentService.unenrollFromExam(
      dbHelpers,
      req.user.id,
      canonicalExamId,
    );

    if (!unenrolled) {
      logger.debug(
        { examId },
        "[Unenroll Exam] User not enrolled in this exam",
      );
      return res.status(400).json({
        success: false,
        message: "You are not enrolled in this exam",
      });
    }

    logger.debug({ examId }, "[Unenroll Exam] Successfully unenrolled");

    // /me caches the enrolledExams list — evict after unenrollment.
    invalidateResponseCache("auth-me").catch(() => {});
    const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
      dbHelpers,
      req.user.id,
    );
    const enrolledExamsLookup = await buildPublicIdLookup(
      dbHelpers,
      "exams",
      enrolledExamIds,
    );

    res.json({
      success: true,
      message: "Successfully unenrolled from exam",
      data: enrolledExamIds.map((value) =>
        mapLookupId(value, enrolledExamsLookup, value),
      ),
    });
  } catch (error) {
    console.error("[Unenroll Exam] Error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

router.get("/enrolled-exams", protect, async (req, res) => {
  try {
    const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
      dbHelpers,
      req.user.id,
    );

    const populatedExams =
      enrolledExamIds.length > 0
        ? (
            await dbHelpers.find("exams", {
              id: { $in: enrolledExamIds },
            })
          ).sort(
            (a, b) =>
              (a.displayOrder ?? a.display_order ?? 0) -
              (b.displayOrder ?? b.display_order ?? 0),
          )
        : [];

    res.json({
      success: true,
      data: populatedExams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
