import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockFindById = jest.fn();
const mockUpdateById = jest.fn();
const mockLogAuditEvent = jest.fn();
const mockFindByIdentifier = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {
      find: (...args) => mockFind(...args),
      findOne: (...args) => mockFindOne(...args),
      findById: (...args) => mockFindById(...args),
      updateById: (...args) => mockUpdateById(...args),
      toCamel: (row) => row,
    },
  }),
);

jest.unstable_mockModule("../data/models/index.js", () => ({
  Test: {
    findByIdentifier: (...args) => mockFindByIdentifier(...args),
  },
}));

jest.unstable_mockModule("../middleware/audit.middleware.js", () => ({
  logAuditEvent: (...args) => mockLogAuditEvent(...args),
}));

jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => next(),
  admin: (req, res, next) => next(),
}));

jest.unstable_mockModule("../middleware/responseCache.middleware.js", () => ({
  responseCache: () => (req, res, next) => next(),
}));

const {
  LIFECYCLE_STATES,
  ALLOWED_TRANSITIONS,
  validatePublicationPrerequisites,
  shuffleQuestionsWithSeed,
  mulberry32,
  default: adminTestsRouter,
} = await import("../api/routes/admin-tests.js");

const getRouteHandler = (path, method = "put") => {
  const layer = adminTestsRouter.stack.find(
    (l) =>
      l.route &&
      l.route.path === path &&
      l.route.methods &&
      l.route.methods[method],
  );
  if (!layer) {
    throw new Error(
      `Route handler not found for ${method.toUpperCase()} ${path}`,
    );
  }
  return layer.route.stack.slice(-1)[0].handle;
};

describe("Admin Test Lifecycle & Versioned Publishing Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("State Machine Transition Rules", () => {
    it("defines valid lifecycle states", () => {
      expect(LIFECYCLE_STATES.DRAFT).toBe("draft");
      expect(LIFECYCLE_STATES.IN_REVIEW).toBe("in_review");
      expect(LIFECYCLE_STATES.SCHEDULED).toBe("scheduled");
      expect(LIFECYCLE_STATES.PUBLISHED).toBe("published");
      expect(LIFECYCLE_STATES.ARCHIVED).toBe("archived");
    });

    it("allows draft to transition to in_review and archived", () => {
      expect(ALLOWED_TRANSITIONS.draft).toContain("in_review");
      expect(ALLOWED_TRANSITIONS.draft).toContain("archived");
      expect(ALLOWED_TRANSITIONS.draft).not.toContain("published");
    });

    it("allows in_review to transition to draft, scheduled, published, and archived", () => {
      expect(ALLOWED_TRANSITIONS.in_review).toContain("draft");
      expect(ALLOWED_TRANSITIONS.in_review).toContain("scheduled");
      expect(ALLOWED_TRANSITIONS.in_review).toContain("published");
      expect(ALLOWED_TRANSITIONS.in_review).toContain("archived");
    });

    it("allows scheduled to transition to in_review, published, and archived", () => {
      expect(ALLOWED_TRANSITIONS.scheduled).toContain("published");
      expect(ALLOWED_TRANSITIONS.scheduled).toContain("in_review");
      expect(ALLOWED_TRANSITIONS.scheduled).toContain("archived");
      expect(ALLOWED_TRANSITIONS.scheduled).not.toContain("draft");
    });

    it("allows published to transition to archived or draft (unpublish)", () => {
      expect(ALLOWED_TRANSITIONS.published).toContain("archived");
      expect(ALLOWED_TRANSITIONS.published).toContain("draft");
      expect(ALLOWED_TRANSITIONS.published).not.toContain("scheduled");
    });

    it("allows archived to only transition back to draft", () => {
      expect(ALLOWED_TRANSITIONS.archived).toEqual(["draft"]);
    });
  });

  describe("Publication Prerequisite Validation", () => {
    it("fails if test has zero questions, zero marks, or zero duration", () => {
      const invalidTest = {
        totalQuestions: 0,
        totalMarks: 0,
        duration: 0,
      };

      const result = validatePublicationPrerequisites(invalidTest, 0);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors[0]).toContain("totalQuestions > 0");
      expect(result.errors[1]).toContain("totalMarks > 0");
      expect(result.errors[2]).toContain("duration > 0");
    });

    it("considers associated question count if test totalQuestions is missing", () => {
      const test = {
        totalMarks: 100,
        duration: 60,
      };

      const resultWithCount = validatePublicationPrerequisites(test, 25);
      expect(resultWithCount.valid).toBe(true);
      expect(resultWithCount.errors.length).toBe(0);
    });

    it("succeeds when all prerequisites are met", () => {
      const validTest = {
        totalQuestions: 50,
        totalMarks: 200,
        duration: 60,
      };

      const result = validatePublicationPrerequisites(validTest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Deterministic Seed Shuffling", () => {
    const sampleQuestions = [
      { id: 101, marks: 2, topic: "Algebra" },
      { id: 102, marks: 2, topic: "Geometry" },
      { id: 103, marks: 2, topic: "Arithmetic" },
      { id: 104, marks: 2, topic: "Number System" },
      { id: 105, marks: 2, topic: "Trigonometry" },
      { id: 106, marks: 2, topic: "Statistics" },
      { id: 107, marks: 2, topic: "Probability" },
      { id: 108, marks: 2, topic: "Calculus" },
    ];

    it("produces identical question order when given the same seed", () => {
      const seed = "ssc-cgl-tier1-2026";
      const shuffle1 = shuffleQuestionsWithSeed(sampleQuestions, seed);
      const shuffle2 = shuffleQuestionsWithSeed(sampleQuestions, seed);

      expect(shuffle1.map((q) => q.id)).toEqual(shuffle2.map((q) => q.id));
      expect(shuffle1.length).toBe(sampleQuestions.length);
    });

    it("produces different orders for different seeds", () => {
      const shuffleA = shuffleQuestionsWithSeed(
        sampleQuestions,
        "seed-alpha-123",
      );
      const shuffleB = shuffleQuestionsWithSeed(
        sampleQuestions,
        "seed-beta-987",
      );

      expect(shuffleA.map((q) => q.id)).not.toEqual(shuffleB.map((q) => q.id));
    });

    it("preserves all original elements and does not mutate the source array", () => {
      const originalCopy = [...sampleQuestions];
      const shuffled = shuffleQuestionsWithSeed(sampleQuestions, 777);

      expect(sampleQuestions).toEqual(originalCopy);
      expect(shuffled.map((q) => q.id).sort()).toEqual(
        sampleQuestions.map((q) => q.id).sort(),
      );
    });

    it("handles single-element or empty questions array gracefully", () => {
      expect(shuffleQuestionsWithSeed([])).toEqual([]);
      expect(shuffleQuestionsWithSeed([{ id: 1 }])).toEqual([{ id: 1 }]);
    });
  });

  describe("Route Handlers: Lifecycle Transitions & Shuffle Preview", () => {
    const lifecycleHandler = getRouteHandler("/tests/:id/lifecycle", "put");
    const shufflePreviewHandler = getRouteHandler(
      "/tests/:id/shuffle-preview",
      "post",
    );

    it("rejects unknown target states with 400", async () => {
      const req = {
        params: { id: "1" },
        body: { status: "invalid_state" },
        user: { id: 1 },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await lifecycleHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Invalid target status"),
        }),
      );
    });

    it("rejects invalid state transition from draft to published directly", async () => {
      mockFindByIdentifier.mockResolvedValueOnce({
        id: 1,
        status: "draft",
        totalQuestions: 50,
        totalMarks: 100,
        duration: 60,
      });

      const req = {
        params: { id: "1" },
        body: { status: "published" },
        user: { id: 1 },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await lifecycleHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining(
            "Invalid transition from 'draft' to 'published'",
          ),
        }),
      );
    });

    it("transitions draft to in_review successfully and logs audit", async () => {
      mockFindByIdentifier.mockResolvedValueOnce({
        id: 1,
        status: "draft",
        version: 1,
      });
      mockUpdateById.mockResolvedValueOnce({
        id: 1,
        status: "in_review",
        version: 1,
      });

      const req = {
        params: { id: "1" },
        body: { status: "in_review", note: "Review requested" },
        user: { id: 99 },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await lifecycleHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: "in_review",
          previousStatus: "draft",
        }),
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TEST_LIFECYCLE_TRANSITION",
          resourceId: 1,
        }),
      );
    });

    it("validates publication prerequisites and increments version upon publishing", async () => {
      mockFindByIdentifier.mockResolvedValueOnce({
        id: 2,
        status: "in_review",
        totalQuestions: 100,
        totalMarks: 200,
        duration: 120,
        version: 1,
      });
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: 100 }] });
      mockUpdateById.mockResolvedValueOnce({
        id: 2,
        status: "published",
        version: 2,
      });

      const req = {
        params: { id: "2" },
        body: { status: "published", shuffleSeed: "live-seed-1" },
        user: { id: 99 },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await lifecycleHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: "published",
          version: 2,
        }),
      );
      expect(mockUpdateById).toHaveBeenCalledWith(
        "tests",
        2,
        expect.objectContaining({
          status: "published",
          version: 2,
          isLive: true,
          shuffleSeed: "live-seed-1",
        }),
      );
    });

    it("generates deterministic shuffle preview for question bank", async () => {
      mockFindByIdentifier.mockResolvedValueOnce({
        id: 5,
        title: "Reasoning Mock Test",
      });
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            question_text: "Q1",
            marks: 2,
            difficulty: "Easy",
            topic: "Syllogism",
          },
          {
            id: 20,
            question_text: "Q2",
            marks: 2,
            difficulty: "Medium",
            topic: "Blood Relations",
          },
          {
            id: 30,
            question_text: "Q3",
            marks: 2,
            difficulty: "Hard",
            topic: "Puzzles",
          },
        ],
      });

      const req = {
        params: { id: "5" },
        body: { seed: "fixed-seed-2026" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await shufflePreviewHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          totalQuestions: 3,
          seed: "fixed-seed-2026",
          shuffledOrder: expect.any(Array),
        }),
      );
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.shuffledOrder).toHaveLength(3);
      expect(jsonCall.shuffledOrder[0]).toHaveProperty("questionId");
      expect(jsonCall.shuffledOrder[0]).toHaveProperty("position", 1);
    });
  });
});
