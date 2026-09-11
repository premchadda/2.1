/**
 * EnrollmentService - Central service for all enrollment operations
 * Uses the enrollments table as the primary source of truth
 * Falls back to users.enrolled_* arrays for backward compatibility
 */

/**
 * Check if a user is enrolled in a test series
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} seriesId - Test series ID
 * @returns {Promise<boolean>}
 */
export async function isEnrolledInSeries(dbHelpers, userId, seriesId) {
  const enrollment = await dbHelpers.findOne("enrollments", {
    userId,
    seriesId,
    isActive: true,
  });
  return !!enrollment;
}

/**
 * Check if a user is enrolled in an exam
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} examId - Exam ID
 * @returns {Promise<boolean>}
 */
export async function isEnrolledInExam(dbHelpers, userId, examId) {
  const enrollment = await dbHelpers.findOne("enrollments", {
    userId,
    examId,
    isActive: true,
  });
  return !!enrollment;
}

/**
 * Check if a user is enrolled in a study material
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} materialId - Study material ID
 * @returns {Promise<boolean>}
 */
export async function isEnrolledInStudyMaterial(dbHelpers, userId, materialId) {
  const enrollment = await dbHelpers.findOne("enrollments", {
    userId,
    studyMaterialId: materialId,
    isActive: true,
  });
  return !!enrollment;
}

/**
 * Enroll user in a test series
 * Creates record in enrollments table and updates users.enrolled_series for backward compatibility
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} seriesId - Test series ID
 * @param {object} options - Optional: isPaid, paymentId, amount, expiresAt
 * @returns {Promise<object>} Enrollment record
 */
export async function enrollInSeries(
  dbHelpers,
  userId,
  seriesId,
  options = {},
) {
  const {
    isPaid = false,
    paymentId = null,
    amount = 0,
    expiresAt = null,
  } = options;

  // Check if already enrolled
  const existing = await dbHelpers.findOne("enrollments", {
    userId,
    seriesId,
    isActive: true,
  });

  if (existing) {
    return { alreadyEnrolled: true, enrollment: existing };
  }

  // Create enrollment record in enrollments table
  const enrollment = await dbHelpers.insertOne("enrollments", {
    userId,
    seriesId,
    status: "active",
    progress: 0,
    isPaid,
    paymentId,
    amount,
    expiresAt,
    isActive: true,
    enrolledAt: new Date().toISOString(),
  });

  // Also update users.enrolled_series for backward compatibility
  const user = await dbHelpers.findById("users", userId);
  const enrolledSeries = parseLegacyArray(
    user.enrolledSeries ?? user.enrolled_series,
  );
  if (!enrolledSeries.includes(seriesId)) {
    await dbHelpers.updateById("users", userId, {
      enrolledSeries: [...enrolledSeries, seriesId],
    });
  }

  return { alreadyEnrolled: false, enrollment };
}

/**
 * Unenroll user from a test series
 * Soft-deletes enrollment record and removes from users.enrolled_series
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} seriesId - Test series ID
 * @returns {Promise<boolean>} True if unenrolled, false if not enrolled
 */
export async function unenrollFromSeries(dbHelpers, userId, seriesId) {
  const enrollment = await dbHelpers.findOne("enrollments", {
    userId,
    seriesId,
    isActive: true,
  });

  if (!enrollment) {
    return false;
  }

  // Soft delete the enrollment record
  await dbHelpers.updateById("enrollments", enrollment.id, {
    isActive: false,
    status: "cancelled",
  });

  // Also update users.enrolled_series for backward compatibility
  const user = await dbHelpers.findById("users", userId);
  const enrolledSeries = parseLegacyArray(
    user.enrolledSeries ?? user.enrolled_series,
  );
  const newEnrolledSeries = enrolledSeries.filter(
    (id) => String(id) !== String(seriesId),
  );
  await dbHelpers.updateById("users", userId, {
    enrolledSeries: newEnrolledSeries,
  });

  return true;
}

/**
 * Enroll user in an exam
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} examId - Exam ID
 * @param {object} options - Optional: isPaid, paymentId, amount, expiresAt
 * @returns {Promise<object>} Enrollment record
 */
export async function enrollInExam(dbHelpers, userId, examId, options = {}) {
  const {
    isPaid = false,
    paymentId = null,
    amount = 0,
    expiresAt = null,
  } = options;

  const existing = await dbHelpers.findOne("enrollments", {
    userId,
    examId,
    isActive: true,
  });

  if (existing) {
    return { alreadyEnrolled: true, enrollment: existing };
  }

  const enrollment = await dbHelpers.insertOne("enrollments", {
    userId,
    examId,
    status: "active",
    progress: 0,
    isPaid,
    paymentId,
    amount,
    expiresAt,
    isActive: true,
    enrolledAt: new Date().toISOString(),
  });

  // Also update users.enrolled_exams for backward compatibility
  const user = await dbHelpers.findById("users", userId);
  const enrolledExams = parseLegacyArray(
    user.enrolledExams ?? user.enrolled_exams,
  );
  if (!enrolledExams.includes(examId)) {
    await dbHelpers.updateById("users", userId, {
      enrolledExams: [...enrolledExams, examId],
    });
  }

  return { alreadyEnrolled: false, enrollment };
}

/**
 * Unenroll user from an exam
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} examId - Exam ID
 * @returns {Promise<boolean>}
 */
export async function unenrollFromExam(dbHelpers, userId, examId) {
  const enrollment = await dbHelpers.findOne("enrollments", {
    userId,
    examId,
    isActive: true,
  });

  if (!enrollment) {
    return false;
  }

  await dbHelpers.updateById("enrollments", enrollment.id, {
    isActive: false,
    status: "cancelled",
  });

  const user = await dbHelpers.findById("users", userId);
  const enrolledExams = parseLegacyArray(
    user.enrolledExams ?? user.enrolled_exams,
  );
  const newEnrolledExams = enrolledExams.filter(
    (id) => String(id) !== String(examId),
  );
  await dbHelpers.updateById("users", userId, {
    enrolledExams: newEnrolledExams,
  });

  return true;
}

/**
 * Enroll user in a study material
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} materialId - Study material ID
 * @param {object} options - Optional: isPaid, paymentId, amount, expiresAt
 * @returns {Promise<object>} Enrollment record
 */
export async function enrollInStudyMaterial(
  dbHelpers,
  userId,
  materialId,
  options = {},
) {
  const {
    isPaid = false,
    paymentId = null,
    amount = 0,
    expiresAt = null,
  } = options;

  const existing = await dbHelpers.findOne("enrollments", {
    userId,
    studyMaterialId: materialId,
    isActive: true,
  });

  if (existing) {
    return { alreadyEnrolled: true, enrollment: existing };
  }

  const enrollment = await dbHelpers.insertOne("enrollments", {
    userId,
    studyMaterialId: materialId,
    status: "active",
    progress: 0,
    isPaid,
    paymentId,
    amount,
    expiresAt,
    isActive: true,
    enrolledAt: new Date().toISOString(),
  });

  // Also update users.enrolled_study_materials for backward compatibility
  const user = await dbHelpers.findById("users", userId);
  const enrolledMaterials = parseLegacyArray(
    user.enrolledStudyMaterials ?? user.enrolled_study_materials,
  );
  if (!enrolledMaterials.includes(materialId)) {
    await dbHelpers.updateById("users", userId, {
      enrolledStudyMaterials: [...enrolledMaterials, materialId],
    });
  }

  return { alreadyEnrolled: false, enrollment };
}

/**
 * Unenroll user from a study material
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @param {number} materialId - Study material ID
 * @returns {Promise<boolean>}
 */
export async function unenrollFromStudyMaterial(dbHelpers, userId, materialId) {
  const enrollment = await dbHelpers.findOne("enrollments", {
    userId,
    studyMaterialId: materialId,
    isActive: true,
  });

  if (!enrollment) {
    return false;
  }

  await dbHelpers.updateById("enrollments", enrollment.id, {
    isActive: false,
    status: "cancelled",
  });

  const user = await dbHelpers.findById("users", userId);
  const enrolledMaterials = parseLegacyArray(
    user.enrolledStudyMaterials ?? user.enrolled_study_materials,
  );
  const newEnrolledMaterials = enrolledMaterials.filter(
    (id) => String(id) !== String(materialId),
  );
  await dbHelpers.updateById("users", userId, {
    enrolledStudyMaterials: newEnrolledMaterials,
  });

  return true;
}

/**
 * Get all series enrollments for a user
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of enrollment records
 */
export async function getUserSeriesEnrollments(dbHelpers, userId) {
  return dbHelpers.find("enrollments", {
    userId,
    isActive: true,
    type: "series",
  });
}

/**
 * Get all exam enrollments for a user
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of enrollment records
 */
export async function getUserExamEnrollments(dbHelpers, userId) {
  return dbHelpers.find("enrollments", {
    userId,
    isActive: true,
    type: "exam",
  });
}

/**
 * Get all study material enrollments for a user
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of enrollment records
 */
export async function getUserStudyMaterialEnrollments(dbHelpers, userId) {
  return dbHelpers.find("enrollments", {
    userId,
    isActive: true,
    type: "study_material",
  });
}

/**
 * Get enrolled series IDs for a user (primary: enrollments table, fallback: users.enrolled_series)
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @returns {Promise<number[]>} Array of series IDs
 */
export async function getEnrolledSeriesIds(dbHelpers, userId) {
  // Primary: query enrollments table
  const enrollments = await dbHelpers.find("enrollments", {
    userId,
    isActive: true,
  });

  const seriesIds = enrollments
    .filter((e) => e.seriesId !== null && e.seriesId !== undefined)
    .map((e) => parseInt(e.seriesId));

  if (seriesIds.length > 0) {
    return [...new Set(seriesIds)];
  }

  // Fallback: read from users.enrolled_series
  const user = await dbHelpers.findById("users", userId);
  return parseLegacyArray(user.enrolledSeries ?? user.enrolled_series);
}

/**
 * Get enrolled exam IDs for a user
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @returns {Promise<number[]>} Array of exam IDs
 */
export async function getEnrolledExamIds(dbHelpers, userId) {
  const enrollments = await dbHelpers.find("enrollments", {
    userId,
    isActive: true,
  });

  const examIds = enrollments
    .filter((e) => e.examId !== null && e.examId !== undefined)
    .map((e) => parseInt(e.examId));

  if (examIds.length > 0) {
    return [...new Set(examIds)];
  }

  const user = await dbHelpers.findById("users", userId);
  return parseLegacyArray(user.enrolledExams ?? user.enrolled_exams);
}

/**
 * Get enrolled study material IDs for a user
 * @param {object} dbHelpers - Database helpers
 * @param {number} userId - User ID
 * @returns {Promise<number[]>} Array of study material IDs
 */
export async function getEnrolledStudyMaterialIds(dbHelpers, userId) {
  const enrollments = await dbHelpers.find("enrollments", {
    userId,
    isActive: true,
  });

  const materialIds = enrollments
    .filter(
      (e) => e.studyMaterialId !== null && e.studyMaterialId !== undefined,
    )
    .map((e) => parseInt(e.studyMaterialId));

  if (materialIds.length > 0) {
    return [...new Set(materialIds)];
  }

  const user = await dbHelpers.findById("users", userId);
  return parseLegacyArray(
    user.enrolledStudyMaterials ?? user.enrolled_study_materials,
  );
}

/**
 * Fast unified batch enrollment summary for /api/auth/me and user profile loads.
 * Runs a single query against enrollments table and uses the already-loaded user object
 * for legacy fallbacks, avoiding up to 5 redundant database round-trips.
 *
 * @param {object} dbHelpers - Database helpers
 * @param {number|string} userId - User ID
 * @param {object} [fallbackUser=null] - Already loaded user object
 * @returns {Promise<{ enrolledSeries: number[], enrolledExams: number[], enrolledStudyMaterials: number[] }>}
 */
export async function getUserEnrollmentsSummary(
  dbHelpers,
  userId,
  fallbackUser = null,
) {
  const enrollments = await dbHelpers
    .find("enrollments", { userId, isActive: true }, null, null, [
      "series_id",
      "exam_id",
      "study_material_id",
    ])
    .catch(() => []);

  const seriesIds = [];
  const examIds = [];
  const materialIds = [];

  for (const e of enrollments) {
    const sId = e.seriesId ?? e.series_id;
    if (sId !== null && sId !== undefined) seriesIds.push(parseInt(sId, 10));

    const eId = e.examId ?? e.exam_id;
    if (eId !== null && eId !== undefined) examIds.push(parseInt(eId, 10));

    const mId = e.studyMaterialId ?? e.study_material_id;
    if (mId !== null && mId !== undefined) materialIds.push(parseInt(mId, 10));
  }

  let finalSeries = seriesIds.length > 0 ? [...new Set(seriesIds)] : null;
  let finalExams = examIds.length > 0 ? [...new Set(examIds)] : null;
  let finalMaterials =
    materialIds.length > 0 ? [...new Set(materialIds)] : null;

  if (!finalSeries || !finalExams || !finalMaterials) {
    let u = fallbackUser;
    if (!u) {
      u = await dbHelpers.findById("users", userId).catch(() => null);
    }
    if (u) {
      if (!finalSeries) {
        finalSeries = parseLegacyArray(u.enrolledSeries ?? u.enrolled_series);
      }
      if (!finalExams) {
        finalExams = parseLegacyArray(u.enrolledExams ?? u.enrolled_exams);
      }
      if (!finalMaterials) {
        finalMaterials = parseLegacyArray(
          u.enrolledStudyMaterials ?? u.enrolled_study_materials,
        );
      }
    }
  }

  return {
    enrolledSeries: finalSeries || [],
    enrolledExams: finalExams || [],
    enrolledStudyMaterials: finalMaterials || [],
  };
}

/**
 * Parse legacy PostgreSQL array format (handles both JS arrays and PostgreSQL text format)
 * @param {any} value - The value to parse
 * @returns {number[]}
 */
function parseLegacyArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    if (value.startsWith("{") && value.endsWith("}")) {
      const inner = value.slice(1, -1);
      if (!inner.trim()) return [];
      return inner
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Get enrollment statistics
 * @param {object} dbHelpers - Database helpers
 * @param {object} filters - Optional filters: seriesId, examId, status
 * @returns {Promise<object>} Statistics
 */
export async function getEnrollmentStats(dbHelpers, filters = {}) {
  const { seriesId, examId, status = "active" } = filters;

  const query = { isActive: true };
  if (seriesId) query.seriesId = seriesId;
  if (examId) query.examId = examId;
  if (status) query.status = status;

  const enrollments = await dbHelpers.find("enrollments", query);

  return {
    total: enrollments.length,
    series: enrollments.filter((e) => e.seriesId).length,
    exams: enrollments.filter((e) => e.examId).length,
    studyMaterials: enrollments.filter((e) => e.studyMaterialId).length,
    paid: enrollments.filter((e) => e.isPaid).length,
    free: enrollments.filter((e) => !e.isPaid).length,
  };
}

/**
 * Update enrollment progress
 * @param {object} dbHelpers - Database helpers
 * @param {number} enrollmentId - Enrollment record ID
 * @param {number} progress - Progress percentage (0-100)
 * @returns {Promise<object>} Updated enrollment
 */
export async function updateEnrollmentProgress(
  dbHelpers,
  enrollmentId,
  progress,
) {
  return dbHelpers.updateById("enrollments", enrollmentId, {
    progress: Math.min(100, Math.max(0, progress)),
  });
}

export default {
  isEnrolledInSeries,
  isEnrolledInExam,
  isEnrolledInStudyMaterial,
  enrollInSeries,
  unenrollFromSeries,
  enrollInExam,
  unenrollFromExam,
  enrollInStudyMaterial,
  unenrollFromStudyMaterial,
  getUserSeriesEnrollments,
  getUserExamEnrollments,
  getUserStudyMaterialEnrollments,
  getEnrolledSeriesIds,
  getEnrolledExamIds,
  getEnrolledStudyMaterialIds,
  getUserEnrollmentsSummary,
  getEnrollmentStats,
  updateEnrollmentProgress,
};
