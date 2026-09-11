import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPool = {
  query: jest.fn(),
};

const mockAnalytics = {
  getUserWeakTopics: jest.fn(),
};

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: mockPool,
    dbHelpers: {
      find: jest.fn(),
    },
  }),
);

jest.unstable_mockModule("../services/core/analyticsService.js", () => ({
  default: mockAnalytics,
  getUserWeakTopics: mockAnalytics.getUserWeakTopics,
}));
jest.unstable_mockModule("../services/core/common.js", () => ({
  safeNumber: (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  },
}));

const { getRecommendationsForUser, refreshRecommendationsFromEvent } =
  await import("../services/core/recommendationService.js");

const WEAK_TOPICS = [
  {
    topic: "Percentages",
    subject: "Quantitative Aptitude",
    attempts: 5,
    correct: 2,
    wrong: 3,
    accuracy: 40,
    weaknessScore: 60,
  },
  {
    topic: "Reading Comprehension",
    subject: "English",
    attempts: 4,
    correct: 1,
    wrong: 3,
    accuracy: 25,
    weaknessScore: 75,
  },
];

const TESTS = [
  {
    id: 1,
    title: "Percentages Mastery Test",
    category: "Quant",
    sub_category: "Arithmetic",
    tags: ["percentages", "quantitative aptitude"],
    created_at: "2026-01-01",
  },
  {
    id: 2,
    title: "English RC Practice",
    category: "English",
    sub_category: "Verbal",
    tags: ["reading comprehension"],
    created_at: "2026-02-01",
  },
  {
    id: 3,
    title: "Unrelated History Test",
    category: "GK",
    sub_category: null,
    tags: ["history"],
    created_at: "2026-03-01",
  },
];

// Pool query routing: route SQL to mock results by statement content.
const routeQuery = (sql) => {
  if (/SELECT DISTINCT test_id FROM attempts/i.test(sql)) {
    return { rows: [{ test_id: 3 }] }; // user already attempted test 3
  }
  if (
    /SELECT id, title, category, sub_category, tags, created_at\s+FROM tests/i.test(
      sql,
    )
  ) {
    return { rows: TESTS };
  }
  if (/SELECT id, name, subject\s+FROM subject_topics/i.test(sql)) {
    return {
      rows: [
        { id: 11, name: "Percentages", subject: "Quantitative Aptitude" },
        { id: 12, name: "Reading Comprehension", subject: "English" },
      ],
    };
  }
  if (/SELECT DISTINCT user_id FROM attempts WHERE test_id/i.test(sql)) {
    return { rows: [{ user_id: 7 }, { user_id: 8 }] };
  }
  if (/UPDATE user_recommendations/i.test(sql)) {
    return { rows: [], rowCount: 1 };
  }
  if (/INSERT INTO user_recommendations/i.test(sql)) {
    return { rows: [] };
  }
  return { rows: [] };
};

describe("recommendationService explainability + growth fixes", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAnalytics.getUserWeakTopics.mockResolvedValue(WEAK_TOPICS);
    mockPool.query.mockImplementation(async (sql) => routeQuery(sql));
  });

  describe("getRecommendationsForUser", () => {
    it("attaches a rationale referencing accuracy and attempts to every recommended test", async () => {
      const payload = await getRecommendationsForUser(1, { limit: 6 });

      expect(payload.recommendedTests.length).toBeGreaterThan(0);
      for (const t of payload.recommendedTests) {
        expect(typeof t.reason).toBe("string");
        expect(t.reason.length).toBeGreaterThan(10);
        expect(t.reason).toMatch(/because|since|Recommended/i);
      }
    });

    it("names the weak topic and its measured accuracy in the rationale", async () => {
      const payload = await getRecommendationsForUser(1, { limit: 6 });
      const percentages = payload.recommendedTests.find((t) => t.id === 1);
      expect(percentages.reason).toContain("Percentages");
      expect(percentages.reason).toContain("40.0%");
      expect(percentages.reason).toContain("5 attempts");
    });

    it("excludes tests the user has already completed", async () => {
      const payload = await getRecommendationsForUser(1, { limit: 6 });
      const ids = payload.recommendedTests.map((t) => t.id);
      expect(ids).not.toContain(3);
    });

    it("attaches matchedTopics with accuracy data for traceability", async () => {
      const payload = await getRecommendationsForUser(1, { limit: 6 });
      const withMatch = payload.recommendedTests.find((t) => t.id === 1);
      expect(withMatch.matchedTopics.length).toBeGreaterThan(0);
      expect(withMatch.matchedTopics[0]).toMatchObject({
        topic: "Percentages",
        subject: "Quantitative Aptitude",
        accuracy: 40,
      });
    });

    it("deactivates previous active recommendations before inserting the new row (bounded growth)", async () => {
      await getRecommendationsForUser(1, { limit: 6 });

      const updateCall = mockPool.query.mock.calls.find(([sql]) =>
        /UPDATE\s+user_recommendations\s+SET\s+is_active\s*=\s*false/i.test(
          sql,
        ),
      );
      const insertCall = mockPool.query.mock.calls.find(([sql]) =>
        /INSERT INTO user_recommendations/i.test(sql),
      );

      expect(updateCall).toBeDefined();
      expect(insertCall).toBeDefined();
      // Deactivation must happen before insert
      const updateIndex = mockPool.query.mock.calls.indexOf(updateCall);
      const insertIndex = mockPool.query.mock.calls.indexOf(insertCall);
      expect(updateIndex).toBeLessThan(insertIndex);
    });

    it("loads the catalog with a bounded projection, not dbHelpers.find full rows", async () => {
      await getRecommendationsForUser(1, { limit: 6 });
      const catalogCall = mockPool.query.mock.calls.find(([sql]) =>
        /FROM tests/i.test(sql),
      );
      expect(catalogCall).toBeDefined();
      expect(catalogCall[0]).toContain("LIMIT 500");
      expect(catalogCall[0]).toContain("SELECT id, title, category");
    });

    it("gives chapter suggestions a personalized reason", async () => {
      const payload = await getRecommendationsForUser(1, { limit: 6 });
      expect(payload.recommendedChapters.length).toBeGreaterThan(0);
      for (const c of payload.recommendedChapters) {
        expect(c.reason).toMatch(/accuracy/i);
        expect(c.reason).toMatch(/%|attempt/i);
      }
    });

    it("falls back to recent tests with an honest no-match rationale", async () => {
      mockAnalytics.getUserWeakTopics.mockResolvedValue([]);
      const payload = await getRecommendationsForUser(1, { limit: 6 });
      expect(payload.recommendedTests.length).toBeGreaterThan(0);
      for (const t of payload.recommendedTests) {
        expect(t.reason).toMatch(/No weak-topic match/i);
      }
    });
  });

  describe("refreshRecommendationsFromEvent", () => {
    it("reads distinct users from the canonical attempts table, not test_attempts", async () => {
      const result = await refreshRecommendationsFromEvent({ testId: 42 });
      const userQueryCall = mockPool.query.mock.calls.find(([sql]) =>
        /SELECT DISTINCT user_id FROM attempts WHERE test_id/i.test(sql),
      );
      expect(userQueryCall).toBeDefined();
      expect(userQueryCall[0]).not.toContain("test_attempts");
      expect(userQueryCall[1]).toEqual([42]);
      expect(result.refreshed).toBe(2);
    });

    it("returns 0 when neither userId nor testId is provided", async () => {
      const result = await refreshRecommendationsFromEvent({});
      expect(result).toEqual({ refreshed: 0 });
    });
  });
});
