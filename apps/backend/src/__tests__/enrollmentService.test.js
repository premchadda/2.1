import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import EnrollmentService, {
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
  getEnrollmentStats,
  updateEnrollmentProgress,
} from "../services/EnrollmentService.js";

describe("EnrollmentService", () => {
  let mockDbHelpers;

  beforeEach(() => {
    jest.resetAllMocks();
    mockDbHelpers = {
      findOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      insertOne: jest.fn(),
      updateById: jest.fn(),
    };
  });

  describe("Series Enrollment", () => {
    it("isEnrolledInSeries returns true when active enrollment exists", async () => {
      mockDbHelpers.findOne.mockResolvedValue({
        id: 101,
        userId: 1,
        seriesId: 10,
        isActive: true,
      });
      const enrolled = await isEnrolledInSeries(mockDbHelpers, 1, 10);
      expect(enrolled).toBe(true);
      expect(mockDbHelpers.findOne).toHaveBeenCalledWith("enrollments", {
        userId: 1,
        seriesId: 10,
        isActive: true,
      });
    });

    it("isEnrolledInSeries returns false when enrollment is missing or inactive", async () => {
      mockDbHelpers.findOne.mockResolvedValue(null);
      const enrolled = await isEnrolledInSeries(mockDbHelpers, 1, 999);
      expect(enrolled).toBe(false);
    });

    it("enrollInSeries returns alreadyEnrolled: true if user is already enrolled", async () => {
      const existingEnrollment = {
        id: 202,
        userId: 1,
        seriesId: 10,
        isActive: true,
      };
      mockDbHelpers.findOne.mockResolvedValue(existingEnrollment);

      const result = await enrollInSeries(mockDbHelpers, 1, 10);
      expect(result.alreadyEnrolled).toBe(true);
      expect(result.enrollment).toEqual(existingEnrollment);
      expect(mockDbHelpers.insertOne).not.toHaveBeenCalled();
    });

    it("enrollInSeries inserts new record and syncs users.enrolled_series", async () => {
      mockDbHelpers.findOne.mockResolvedValue(null);
      mockDbHelpers.insertOne.mockResolvedValue({
        id: 301,
        userId: 1,
        seriesId: 10,
        status: "active",
        isPaid: true,
      });
      mockDbHelpers.findById.mockResolvedValue({
        id: 1,
        enrolledSeries: [5],
      });
      mockDbHelpers.updateById.mockResolvedValue({ id: 1 });

      const result = await enrollInSeries(mockDbHelpers, 1, 10, {
        isPaid: true,
        paymentId: "pay_12345",
        amount: 499,
      });

      expect(result.alreadyEnrolled).toBe(false);
      expect(result.enrollment.id).toBe(301);
      expect(mockDbHelpers.insertOne).toHaveBeenCalledWith(
        "enrollments",
        expect.objectContaining({
          userId: 1,
          seriesId: 10,
          status: "active",
          isPaid: true,
          paymentId: "pay_12345",
          amount: 499,
          isActive: true,
        }),
      );
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith("users", 1, {
        enrolledSeries: [5, 10],
      });
    });

    it("unenrollFromSeries soft-deletes record and removes series from user", async () => {
      mockDbHelpers.findOne.mockResolvedValue({
        id: 401,
        userId: 1,
        seriesId: 10,
        isActive: true,
      });
      mockDbHelpers.findById.mockResolvedValue({
        id: 1,
        enrolledSeries: [5, 10, 15],
      });

      const success = await unenrollFromSeries(mockDbHelpers, 1, 10);
      expect(success).toBe(true);
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith(
        "enrollments",
        401,
        {
          isActive: false,
          status: "cancelled",
        },
      );
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith("users", 1, {
        enrolledSeries: [5, 15],
      });
    });

    it("unenrollFromSeries returns false if user was not enrolled", async () => {
      mockDbHelpers.findOne.mockResolvedValue(null);
      const success = await unenrollFromSeries(mockDbHelpers, 1, 999);
      expect(success).toBe(false);
      expect(mockDbHelpers.updateById).not.toHaveBeenCalled();
    });
  });

  describe("Exam Enrollment", () => {
    it("isEnrolledInExam checks active exam enrollment", async () => {
      mockDbHelpers.findOne.mockResolvedValue({
        id: 501,
        userId: 2,
        examId: 20,
      });
      const enrolled = await isEnrolledInExam(mockDbHelpers, 2, 20);
      expect(enrolled).toBe(true);
    });

    it("enrollInExam creates exam enrollment and updates users.enrolledExams", async () => {
      mockDbHelpers.findOne.mockResolvedValue(null);
      mockDbHelpers.insertOne.mockResolvedValue({
        id: 502,
        userId: 2,
        examId: 20,
      });
      mockDbHelpers.findById.mockResolvedValue({ id: 2, enrolled_exams: [10] });

      const result = await enrollInExam(mockDbHelpers, 2, 20);
      expect(result.alreadyEnrolled).toBe(false);
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith("users", 2, {
        enrolledExams: [10, 20],
      });
    });

    it("unenrollFromExam cancels exam enrollment and filters users.enrolledExams", async () => {
      mockDbHelpers.findOne.mockResolvedValue({
        id: 503,
        userId: 2,
        examId: 20,
      });
      mockDbHelpers.findById.mockResolvedValue({
        id: 2,
        enrolledExams: [20, 30],
      });

      const success = await unenrollFromExam(mockDbHelpers, 2, 20);
      expect(success).toBe(true);
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith(
        "enrollments",
        503,
        {
          isActive: false,
          status: "cancelled",
        },
      );
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith("users", 2, {
        enrolledExams: [30],
      });
    });
  });

  describe("Study Material Enrollment", () => {
    it("isEnrolledInStudyMaterial checks active study material enrollment", async () => {
      mockDbHelpers.findOne.mockResolvedValue({
        id: 601,
        userId: 3,
        studyMaterialId: 30,
      });
      const enrolled = await isEnrolledInStudyMaterial(mockDbHelpers, 3, 30);
      expect(enrolled).toBe(true);
    });

    it("enrollInStudyMaterial handles duplicate enrollment gracefully", async () => {
      mockDbHelpers.findOne.mockResolvedValue({
        id: 601,
        userId: 3,
        studyMaterialId: 30,
      });
      const result = await enrollInStudyMaterial(mockDbHelpers, 3, 30);
      expect(result.alreadyEnrolled).toBe(true);
      expect(mockDbHelpers.insertOne).not.toHaveBeenCalled();
    });

    it("enrollInStudyMaterial creates record and syncs users.enrolledStudyMaterials", async () => {
      mockDbHelpers.findOne.mockResolvedValue(null);
      mockDbHelpers.insertOne.mockResolvedValue({
        id: 602,
        userId: 3,
        studyMaterialId: 30,
      });
      mockDbHelpers.findById.mockResolvedValue({
        id: 3,
        enrolledStudyMaterials: [],
      });

      const result = await enrollInStudyMaterial(mockDbHelpers, 3, 30);
      expect(result.alreadyEnrolled).toBe(false);
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith("users", 3, {
        enrolledStudyMaterials: [30],
      });
    });

    it("unenrollFromStudyMaterial updates record and removes ID", async () => {
      mockDbHelpers.findOne.mockResolvedValue({
        id: 603,
        userId: 3,
        studyMaterialId: 30,
      });
      mockDbHelpers.findById.mockResolvedValue({
        id: 3,
        enrolled_study_materials: [30, 40],
      });

      const success = await unenrollFromStudyMaterial(mockDbHelpers, 3, 30);
      expect(success).toBe(true);
      expect(mockDbHelpers.updateById).toHaveBeenCalledWith("users", 3, {
        enrolledStudyMaterials: [40],
      });
    });
  });

  describe("Listing & Legacy Fallback Parsing", () => {
    it("getUserSeriesEnrollments queries enrollments with type: series", async () => {
      mockDbHelpers.find.mockResolvedValue([{ id: 1, seriesId: 10 }]);
      const res = await getUserSeriesEnrollments(mockDbHelpers, 1);
      expect(res).toHaveLength(1);
      expect(mockDbHelpers.find).toHaveBeenCalledWith("enrollments", {
        userId: 1,
        isActive: true,
        type: "series",
      });
    });

    it("getUserExamEnrollments queries enrollments with type: exam", async () => {
      mockDbHelpers.find.mockResolvedValue([{ id: 2, examId: 20 }]);
      const res = await getUserExamEnrollments(mockDbHelpers, 1);
      expect(res).toHaveLength(1);
      expect(mockDbHelpers.find).toHaveBeenCalledWith("enrollments", {
        userId: 1,
        isActive: true,
        type: "exam",
      });
    });

    it("getUserStudyMaterialEnrollments queries enrollments with type: study_material", async () => {
      mockDbHelpers.find.mockResolvedValue([{ id: 3, studyMaterialId: 30 }]);
      const res = await getUserStudyMaterialEnrollments(mockDbHelpers, 1);
      expect(res).toHaveLength(1);
      expect(mockDbHelpers.find).toHaveBeenCalledWith("enrollments", {
        userId: 1,
        isActive: true,
        type: "study_material",
      });
    });

    it("getEnrolledSeriesIds extracts unique IDs from enrollments table", async () => {
      mockDbHelpers.find.mockResolvedValue([
        { seriesId: 10 },
        { seriesId: "20" },
        { seriesId: 10 },
      ]);
      const ids = await getEnrolledSeriesIds(mockDbHelpers, 1);
      expect(ids).toEqual([10, 20]);
    });

    it("getEnrolledSeriesIds falls back to user record Postgres array text format '{10,20}'", async () => {
      mockDbHelpers.find.mockResolvedValue([]);
      mockDbHelpers.findById.mockResolvedValue({
        id: 1,
        enrolledSeries: "{10,20,30}",
      });
      const ids = await getEnrolledSeriesIds(mockDbHelpers, 1);
      expect(ids).toEqual([10, 20, 30]);
    });

    it("getEnrolledExamIds falls back to user record JSON string format '[1,2]'", async () => {
      mockDbHelpers.find.mockResolvedValue([]);
      mockDbHelpers.findById.mockResolvedValue({
        id: 1,
        enrolledExams: "[101, 102]",
      });
      const ids = await getEnrolledExamIds(mockDbHelpers, 1);
      expect(ids).toEqual([101, 102]);
    });

    it("getEnrolledStudyMaterialIds falls back to empty array if user property is invalid", async () => {
      mockDbHelpers.find.mockResolvedValue([]);
      mockDbHelpers.findById.mockResolvedValue({
        id: 1,
        enrolled_study_materials: "invalid-json-or-array",
      });
      const ids = await getEnrolledStudyMaterialIds(mockDbHelpers, 1);
      expect(ids).toEqual([]);
    });
  });

  describe("Stats & Progress", () => {
    it("getEnrollmentStats aggregates counts across series, exams, paid and free", async () => {
      mockDbHelpers.find.mockResolvedValue([
        { seriesId: 1, isPaid: true },
        { seriesId: 2, isPaid: false },
        { examId: 10, isPaid: true },
        { studyMaterialId: 5, isPaid: false },
      ]);

      const stats = await getEnrollmentStats(mockDbHelpers, {
        status: "active",
      });
      expect(stats.total).toBe(4);
      expect(stats.series).toBe(2);
      expect(stats.exams).toBe(1);
      expect(stats.studyMaterials).toBe(1);
      expect(stats.paid).toBe(2);
      expect(stats.free).toBe(2);
    });

    it("updateEnrollmentProgress clamps progress between 0 and 100", async () => {
      mockDbHelpers.updateById.mockImplementation((tbl, id, data) => ({
        id,
        ...data,
      }));

      const under = await updateEnrollmentProgress(mockDbHelpers, 1, -15);
      expect(under.progress).toBe(0);

      const over = await updateEnrollmentProgress(mockDbHelpers, 1, 150);
      expect(over.progress).toBe(100);

      const normal = await updateEnrollmentProgress(mockDbHelpers, 1, 75);
      expect(normal.progress).toBe(75);
    });
  });
});
