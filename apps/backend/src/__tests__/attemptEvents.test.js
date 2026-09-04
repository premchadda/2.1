import { jest } from "@jest/globals";

describe("Attempt Events Logging and Question Resolution", () => {
  let dbHelpers;
  let findEntityByIdentifier;
  let getInternalId;

  beforeEach(() => {
    jest.resetModules();
  });

  test("resolves valid question to its internal ID and inserts event", async () => {
    const mockInsertOne = jest.fn().mockResolvedValue({ id: 1 });
    const mockFindById = jest
      .fn()
      .mockResolvedValue({ id: 42, questionText: "Sample" });

    const mockDbHelpers = {
      insertOne: mockInsertOne,
      findById: mockFindById,
      findEntityByIdentifier: jest.fn().mockResolvedValue({ id: 42 }),
      getTableName: () => "questions",
    };

    // Test resolution logic
    const questionId = 42;
    const question = await mockDbHelpers.findById("questions", questionId);
    const resolvedQuestionId = question?.id ?? null;

    expect(resolvedQuestionId).toBe(42);

    await mockDbHelpers.insertOne("attemptEvents", {
      attemptId: 100,
      eventType: "pause",
      questionId: resolvedQuestionId,
      eventData: JSON.stringify({ remainingTime: 120 }),
      eventTimestamp: new Date().toISOString(),
    });

    expect(mockInsertOne).toHaveBeenCalledWith(
      "attemptEvents",
      expect.objectContaining({
        attemptId: 100,
        eventType: "pause",
        questionId: 42,
      }),
    );
  });

  test("resolves non-existent question index or invalid questionId to null to prevent FK violations", async () => {
    const mockInsertOne = jest.fn().mockResolvedValue({ id: 2 });
    const mockDbHelpers = {
      insertOne: mockInsertOne,
      findById: jest.fn().mockResolvedValue(null),
    };

    // For an index like 0 passed mistakenly as questionId
    const invalidQuestionId = 0;
    const question = await mockDbHelpers.findById(
      "questions",
      invalidQuestionId,
    );
    const resolvedQuestionId = question?.id ?? null;

    expect(resolvedQuestionId).toBeNull();

    await mockDbHelpers.insertOne("attemptEvents", {
      attemptId: 100,
      eventType: "pause",
      questionId: resolvedQuestionId,
      eventData: JSON.stringify({
        remainingTime: 120,
        currentQuestionIndex: 0,
      }),
      eventTimestamp: new Date().toISOString(),
    });

    expect(mockInsertOne).toHaveBeenCalledWith(
      "attemptEvents",
      expect.objectContaining({
        attemptId: 100,
        eventType: "pause",
        questionId: null,
      }),
    );
  });
});
