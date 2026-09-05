import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockPoolConnect = jest.fn(() => ({
  query: mockClientQuery,
  release: mockClientRelease,
}));

const mockUpsertFromQuestion = jest.fn();
const mockBuildSearchText = jest.fn();
const mockSetEmbedding = jest.fn();
const mockFindUnindexed = jest.fn();
const mockGetIndexStats = jest.fn();

const mockLogSuccess = jest.fn();
const mockLogFailure = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: {
      connect: mockPoolConnect,
      query: mockClientQuery,
    },
    dbHelpers: {},
  }),
);

jest.unstable_mockModule(
  "../data/models/search/QuestionSearchIndex.js",
  () => ({
    default: {
      upsertFromQuestion: (...args) => mockUpsertFromQuestion(...args),
      buildSearchText: (...args) => mockBuildSearchText(...args),
      setEmbedding: (...args) => mockSetEmbedding(...args),
      findUnindexed: (...args) => mockFindUnindexed(...args),
      getIndexStats: (...args) => mockGetIndexStats(...args),
    },
  }),
);

jest.unstable_mockModule("../data/models/ai/AiGenerationLog.js", () => ({
  default: {
    logSuccess: (...args) => mockLogSuccess(...args),
    logFailure: (...args) => mockLogFailure(...args),
  },
}));

const { default: vectorSearchService } =
  await import("../modules/search/vectorSearch.service.js");

describe("VectorSearchService", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClientQuery.mockResolvedValue({ rows: [] });
    mockClientRelease.mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("checkPgvector", () => {
    it("returns true when pgvector extension is installed", async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ has_pgvector: true }],
      });

      const result = await vectorSearchService.checkPgvector();
      expect(result).toBe(true);
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("extname = 'vector'"),
      );
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it("returns false when pgvector extension is not present", async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ has_pgvector: false }],
      });

      const result = await vectorSearchService.checkPgvector();
      expect(result).toBe(false);
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  describe("indexQuestion", () => {
    it("returns null if question cannot be upserted", async () => {
      mockUpsertFromQuestion.mockResolvedValueOnce(null);

      const result = await vectorSearchService.indexQuestion(999);
      expect(result).toBeNull();
      expect(mockBuildSearchText).not.toHaveBeenCalled();
    });

    it("returns entry without embedding if searchText is empty", async () => {
      const entry = { id: 1, question_id: 101 };
      mockUpsertFromQuestion.mockResolvedValueOnce(entry);
      mockBuildSearchText.mockResolvedValueOnce("");

      const result = await vectorSearchService.indexQuestion(101);
      expect(result).toEqual(entry);
      expect(mockSetEmbedding).not.toHaveBeenCalled();
    });

    it("generates 1536-dim embedding and logs success when searchText exists", async () => {
      const entry = { id: 1, question_id: 101 };
      mockUpsertFromQuestion.mockResolvedValueOnce(entry);
      mockBuildSearchText.mockResolvedValueOnce(
        "What is Newton third law of motion?",
      );

      const fakeEmbedding = new Array(1536).fill(0.05);
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: fakeEmbedding }],
          usage: { total_tokens: 12 },
        }),
      });

      const result = await vectorSearchService.indexQuestion(101);
      expect(result.embeddingGenerated).toBe(true);
      expect(result.id).toBe(1);
      expect(mockSetEmbedding).toHaveBeenCalledWith(101, fakeEmbedding);
      expect(mockLogSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "embedding",
          entityId: 101,
          tokensInput: 12,
        }),
      );
    });

    it("handles embedding API failure gracefully and returns entry without crashing", async () => {
      const entry = { id: 1, question_id: 101 };
      mockUpsertFromQuestion.mockResolvedValueOnce(entry);
      mockBuildSearchText.mockResolvedValueOnce("Question text");

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await vectorSearchService.indexQuestion(101);
      expect(result).toEqual(entry);
      expect(result.embeddingGenerated).toBeUndefined();
    });
  });

  describe("indexBatch", () => {
    it("indexes batch of questions and tallies success/failed counts", async () => {
      const entry = { id: 1, question_id: 10, embeddingGenerated: true };
      jest
        .spyOn(vectorSearchService, "indexQuestion")
        .mockResolvedValueOnce(entry)
        .mockRejectedValueOnce(new Error("DB Timeout"));

      const result = await vectorSearchService.indexBatch([10, 20]);
      expect(result.total).toBe(2);
      expect(result.indexed).toBe(1);
      expect(result.embeddingGenerated).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("DB Timeout");

      vectorSearchService.indexQuestion.mockRestore();
    });
  });

  describe("indexAllUnindexed", () => {
    it("finds unindexed entries and delegates to indexBatch", async () => {
      mockFindUnindexed.mockResolvedValueOnce([
        { question_id: 50 },
        { question_id: 51 },
      ]);
      const spy = jest
        .spyOn(vectorSearchService, "indexBatch")
        .mockResolvedValueOnce({
          total: 2,
          indexed: 2,
          embeddingGenerated: 2,
          failed: 0,
          errors: [],
        });

      const result = await vectorSearchService.indexAllUnindexed(10);
      expect(mockFindUnindexed).toHaveBeenCalledWith(10);
      expect(spy).toHaveBeenCalledWith([50, 51]);

      spy.mockRestore();
    });
  });

  describe("findSimilar", () => {
    it("throws error when source question has no embedding", async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(vectorSearchService.findSimilar(42)).rejects.toThrow(
        "Question not indexed or embedding not generated",
      );
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it("queries cosine similarity <=> and maps similar questions", async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockClientQuery
        .mockResolvedValueOnce({
          rows: [{ embedding: mockVector }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              question_id: 99,
              question_text: "What is momentum?",
              difficulty: "medium",
              options: ["A", "B", "C", "D"],
              similarity: "0.885",
            },
          ],
        });

      const results = await vectorSearchService.findSimilar(42, {
        limit: 5,
        threshold: 0.75,
      });

      expect(results).toHaveLength(1);
      expect(results[0].questionId).toBe(99);
      expect(results[0].similarity).toBe(0.885);

      const secondQuery = mockClientQuery.mock.calls[1];
      expect(secondQuery[0]).toContain("<=> $1::vector");
      expect(secondQuery[1][1]).toBe(42);
      expect(secondQuery[1][2]).toBe(0.75);
      expect(secondQuery[1][3]).toBe(5);
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  describe("semanticSearch", () => {
    it("generates query embedding and runs cosine similarity with filters", async () => {
      const fakeQueryEmbedding = [0.2, 0.4, 0.6];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: fakeQueryEmbedding }],
          usage: { total_tokens: 5 },
        }),
      });

      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            question_id: 77,
            question_text: "Define electric potential",
            difficulty: "hard",
            options: ["V1", "V2"],
            topic_name: "Electrostatics",
            subject_name: "Physics",
            similarity: "0.92",
          },
        ],
      });

      const results = await vectorSearchService.semanticSearch(
        "electric potential definition",
        {
          difficulty: "hard",
          topicId: 12,
          subject: "Physics",
          limit: 10,
          threshold: 0.7,
        },
      );

      expect(results).toHaveLength(1);
      expect(results[0].questionId).toBe(77);
      expect(results[0].topicName).toBe("Electrostatics");
      expect(results[0].subjectName).toBe("Physics");
      expect(results[0].similarity).toBe(0.92);

      const searchSql = mockClientQuery.mock.calls[0][0];
      expect(searchSql).toContain("q.difficulty = $3");
      expect(searchSql).toContain("q.topic_id = $4");
      expect(searchSql).toContain("s.name ILIKE $5");
      expect(mockLogSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "semantic_search",
          tokensInput: 5,
        }),
      );
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it("logs failure to AiGenerationLog when query fails", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("Network offline"));

      await expect(vectorSearchService.semanticSearch("query")).rejects.toThrow(
        "Network offline",
      );

      expect(mockLogFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "semantic_search",
          errorMessage: "Network offline",
        }),
      );
    });
  });

  describe("findByDescription & getStats", () => {
    it("findByDescription calls semanticSearch with description", async () => {
      const spy = jest
        .spyOn(vectorSearchService, "semanticSearch")
        .mockResolvedValueOnce([]);
      await vectorSearchService.findByDescription("calculus integration", {
        limit: 5,
      });
      expect(spy).toHaveBeenCalledWith("calculus integration", { limit: 5 });
      spy.mockRestore();
    });

    it("getStats delegates to QuestionSearchIndex.getIndexStats", async () => {
      const stats = { total_indexed: 500, with_embeddings: 450 };
      mockGetIndexStats.mockResolvedValueOnce(stats);
      const result = await vectorSearchService.getStats();
      expect(result).toEqual(stats);
      expect(mockGetIndexStats).toHaveBeenCalled();
    });
  });
});
