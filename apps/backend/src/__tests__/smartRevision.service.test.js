import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockPoolClient),
  query: jest.fn(),
};

const mockWeakAreaDetection = {
  getFullAnalysis: jest.fn(),
};

const mockAiGenerationLog = {
  logSuccess: jest.fn(),
};

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: mockPool,
    dbHelpers: {},
  }),
);

jest.unstable_mockModule(
  "../modules/analytics/weakAreaDetection.service.js",
  () => ({
    default: mockWeakAreaDetection,
  }),
);

jest.unstable_mockModule("../data/models/ai/AiGenerationLog.js", () => ({
  default: mockAiGenerationLog,
}));

const { default: smartRevisionService } =
  await import("../modules/revision/smartRevision.service.js");

describe("Smart Revision & Spaced Repetition Service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPool.connect.mockResolvedValue(mockPoolClient);
    mockPoolClient.query.mockResolvedValue({ rows: [] });
  });

  describe("addToRevisionQueue", () => {
    it("inserts a new question into the revision queue with priority-based review interval", async () => {
      // 1. SELECT id FROM revision_queue (empty)
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });
      // 2. INSERT INTO revision_queue
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await smartRevisionService.addToRevisionQueue(
        1,
        101,
        "high",
      );

      expect(result.action).toBe("added");
      expect(result.priority).toBe("high");
      expect(result.nextReview).toBeInstanceOf(Date);

      // Priority high = 2, interval = 1 day
      expect(mockPoolClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO revision_queue"),
        [1, 101, 2, expect.any(Date), 1],
      );
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it("updates existing revision item priority if already queued", async () => {
      // 1. SELECT id (existing found)
      mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      // 2. UPDATE revision_queue
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await smartRevisionService.addToRevisionQueue(
        1,
        101,
        "medium",
      );

      expect(result.action).toBe("updated");
      expect(result.priority).toBe("medium");
      expect(mockPoolClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE revision_queue SET priority = $1"),
        [1, 1, 101], // medium = 1
      );
    });
  });

  describe("getDueRevisions", () => {
    it("returns questions due for review mapped with human-readable priority", async () => {
      mockPoolClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            question_id: 201,
            priority: 2, // high
            question_text: "Solve for x",
            topic_name: "Algebra",
          },
          {
            id: 2,
            question_id: 202,
            priority: 0, // low
            question_text: "Synonym of Benevolent",
            topic_name: "Vocabulary",
          },
        ],
      });

      const due = await smartRevisionService.getDueRevisions(1);

      expect(due).toHaveLength(2);
      expect(due[0].priority).toBe("high");
      expect(due[1].priority).toBe("low");
      expect(mockPoolClient.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE rq.user_id = $1"),
        [1],
      );
    });
  });

  describe("completeRevision", () => {
    it("returns null if no pending revision is found for user and question", async () => {
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await smartRevisionService.completeRevision(1, 999, true);
      expect(result).toBeNull();
    });

    it("advances spaced repetition interval when remembered is true", async () => {
      const currentRevision = {
        id: 10,
        user_id: 1,
        question_id: 301,
        priority: 1, // medium
        metadata: JSON.stringify({ reviewCount: 0 }),
      };

      // 1. SELECT current revision
      mockPoolClient.query.mockResolvedValueOnce({ rows: [currentRevision] });
      // 2. UPDATE other pre-inserted rows
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. UPDATE revision_queue with next due_at
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await smartRevisionService.completeRevision(1, 301, true);

      expect(result).not.toBeNull();
      expect(result.interval).toBe(7); // medium intervals: [3, 7, 14, 30, 60] -> index 1 is 7 days
      expect(result.reviewCount).toBe(1);
      expect(result.nextReview).toBeInstanceOf(Date);
    });

    it("resets interval to day 1 (or earliest interval) when remembered is false", async () => {
      const currentRevision = {
        id: 11,
        user_id: 1,
        question_id: 302,
        priority: 2, // high: [1, 3, 7, 14, 30]
        metadata: JSON.stringify({ reviewCount: 3 }),
      };

      mockPoolClient.query.mockResolvedValueOnce({ rows: [currentRevision] });
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await smartRevisionService.completeRevision(1, 302, false);

      expect(result.interval).toBe(1); // resets to index 0
      expect(result.reviewCount).toBe(4);
    });
  });

  describe("getMostCommonTopics", () => {
    it("aggregates and ranks most common topics by wrong count", () => {
      const wrongList = [
        { topic_name: "Geometry" },
        { topic_name: "Algebra" },
        { topic_name: "Geometry" },
        { topic_name: "Geometry" },
        { topic_name: "Algebra" },
        { topic_name: "Trigonometry" },
      ];

      const formatted = smartRevisionService.getMostCommonTopics(wrongList);
      expect(formatted).toBe(
        "Geometry (3 wrong), Algebra (2 wrong), Trigonometry (1 wrong)",
      );
    });
  });
});
