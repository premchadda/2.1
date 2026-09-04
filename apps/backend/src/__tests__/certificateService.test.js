import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {},
  }),
);

const { default: certificateService } =
  await import("../services/certificateService.js");

describe("CertificateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all pool.query calls return empty rows (covers ensureTable DDL)
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  describe("verifyCertificate", () => {
    it("returns isValid:false when hash is empty string", async () => {
      const result = await certificateService.verifyCertificate("");
      expect(result.isValid).toBe(false);
    });

    it("returns isValid:false when hash is null", async () => {
      const result = await certificateService.verifyCertificate(null);
      expect(result.isValid).toBe(false);
    });

    it("returns isValid:false when hash is undefined", async () => {
      const result = await certificateService.verifyCertificate(undefined);
      expect(result.isValid).toBe(false);
    });

    it("returns isValid:false when hash is not a string", async () => {
      const result = await certificateService.verifyCertificate(12345);
      expect(result.isValid).toBe(false);
    });

    it("returns isValid:false when hash is an object", async () => {
      const result = await certificateService.verifyCertificate({
        hash: "abc",
      });
      expect(result.isValid).toBe(false);
    });

    it("returns isValid:false when no certificate found in DB", async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });
      const result = await certificateService.verifyCertificate("abcdef123456");
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("returns isValid:true with certificate data when found", async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [
          {
            attempt_id: 42,
            user_id: 1,
            test_id: 10,
            hash: "abcdef123456",
            salt: "somesalt",
            recipient_name: "Test Student",
            test_title: "Mock Test",
            score: 80,
            total_marks: 100,
            percentage: 80,
            issued_at: "2025-01-01T00:00:00Z",
            user_name: "Test Student",
          },
        ],
      });
      const result = await certificateService.verifyCertificate("abcdef123456");
      expect(result.isValid).toBe(true);
      expect(result.certificateId).toContain("CERT-42");
      expect(result.recipientName).toBe("Test Student");
    });
  });

  describe("generateCertificate", () => {
    it("returns 404 when attempt does not exist", async () => {
      certificateService.ensureTable = jest.fn().mockResolvedValue(undefined);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await certificateService.generateCertificate(999, 1);
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it("generates certificate when attempt exists", async () => {
      const attemptRow = {
        attempt_id: 1,
        user_id: 1,
        test_id: 10,
        score: 85,
        total_marks: 100,
        submitted_at: "2025-06-01T10:00:00Z",
        created_at: "2025-06-01T09:00:00Z",
        test_title: "Physics Mock",
        user_name: "Alice",
        user_email: "alice@test.com",
      };

      // Override ensureTable to be a no-op, then mock the attempt query + INSERT
      certificateService.ensureTable = jest.fn().mockResolvedValue(undefined);
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [attemptRow] }) // attempt lookup
        .mockResolvedValueOnce({ rows: [] }); // INSERT INTO certificates

      const result = await certificateService.generateCertificate(1, 1);
      expect(result.success).toBe(true);
      expect(result.data.verificationHash).toHaveLength(64);
      expect(result.data.recipientName).toBe("Alice");
      expect(result.data.testTitle).toBe("Physics Mock");
      expect(result.data.percentage).toBe(85);
    });
  });
});
