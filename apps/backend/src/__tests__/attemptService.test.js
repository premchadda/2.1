import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockAttemptRepo = {
  findById: jest.fn(),
  findActiveByUserAndTest: jest.fn(),
  countByUserAndTest: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  saveAnswers: jest.fn(),
  saveSectionScores: jest.fn(),
  getAnswers: jest.fn(),
  getSectionScores: jest.fn(),
  logEvent: jest.fn(),
};

const mockTestRepo = {
  findByIdentifier: jest.fn(),
  getQuestions: jest.fn(),
};

const mockQuestionRepo = {
  findById: jest.fn(),
};

const mockAddJob = jest.fn();
const mockEmitDomainEvent = jest.fn();

const mockPoolClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockPoolClient),
  query: jest.fn(),
};

jest.unstable_mockModule("../modules/attempts/attempt.repository.js", () => ({
  AttemptRepository: jest.fn().mockImplementation(() => mockAttemptRepo),
}));

jest.unstable_mockModule("../modules/tests/test.repository.js", () => ({
  TestRepository: jest.fn().mockImplementation(() => mockTestRepo),
}));

jest.unstable_mockModule("../modules/questions/question.repository.js", () => ({
  QuestionRepository: jest.fn().mockImplementation(() => mockQuestionRepo),
}));

jest.unstable_mockModule("../infrastructure/queue/queueManager.js", () => ({
  addJob: mockAddJob,
  QUEUE_NAMES: { ANALYTICS: "analytics" },
}));

jest.unstable_mockModule("../infrastructure/events/eventBus.js", () => ({
  emitDomainEvent: mockEmitDomainEvent,
}));

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {},
    pool: mockPool,
  }),
);

const { attemptService } =
  await import("../modules/attempts/attempt.service.js");

describe("attemptService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPool.connect.mockResolvedValue(mockPoolClient);
    mockPoolClient.query.mockResolvedValue({ rows: [] });
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  describe("start()", () => {
    it("throws if test is not found", async () => {
      mockTestRepo.findByIdentifier.mockResolvedValue(null);
      await expect(attemptService.start(1, 999)).rejects.toThrow(
        "Test not found",
      );
    });

    it("resumes an existing active attempt if found", async () => {
      mockTestRepo.findByIdentifier.mockResolvedValue({
        id: 10,
        title: "Mock Test",
      });
      const activeAttempt = {
        id: 50,
        userId: 1,
        testId: 10,
        status: "in_progress",
      };
      mockAttemptRepo.findActiveByUserAndTest.mockResolvedValue(activeAttempt);

      const result = await attemptService.start(1, 10);
      expect(result.resumed).toBe(true);
      expect(result.attempt).toEqual(activeAttempt);
      expect(mockAttemptRepo.insert).not.toHaveBeenCalled();
    });

    it("throws if free attempt limit has been reached", async () => {
      mockTestRepo.findByIdentifier.mockResolvedValue({ id: 10 });
      mockAttemptRepo.findActiveByUserAndTest.mockResolvedValue(null);
      mockAttemptRepo.countByUserAndTest.mockResolvedValue(3); // FREE_MAX is 3

      await expect(attemptService.start(1, 10)).rejects.toThrow(
        "Attempt limit reached. Upgrade to Pro for unlimited attempts.",
      );
    });

    it("creates a new attempt and queues analytics event", async () => {
      mockTestRepo.findByIdentifier.mockResolvedValue({
        id: 10,
        seriesId: 100,
        totalMarks: 50,
      });
      mockAttemptRepo.findActiveByUserAndTest.mockResolvedValue(null);
      mockAttemptRepo.countByUserAndTest.mockResolvedValue(1);
      mockTestRepo.getQuestions.mockResolvedValue([{ id: 101 }, { id: 102 }]);

      const createdAttempt = {
        id: 99,
        userId: 1,
        testId: 10,
        status: "in_progress",
      };
      mockAttemptRepo.insert.mockResolvedValue(createdAttempt);

      const result = await attemptService.start(1, 10);
      expect(result.resumed).toBe(false);
      expect(result.attempt.id).toBe(99);
      expect(mockAttemptRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          testId: 10,
          seriesId: 100,
          status: "in_progress",
          totalQuestions: 2,
        }),
      );
      expect(mockAddJob).toHaveBeenCalledWith(
        "analytics",
        "analytics.test-started",
        {
          userId: 1,
          testId: 10,
          attemptId: 99,
        },
      );
    });
  });

  describe("saveProgress(), pause(), and resume()", () => {
    it("saveProgress validates ownership and updates data", async () => {
      mockAttemptRepo.findById.mockResolvedValue({
        id: 50,
        userId: 1,
        answers: [],
      });
      await attemptService.saveProgress(1, 50, {
        answers: [{ questionId: 101, selectedOption: 1 }],
        timeSpent: 120,
      });

      expect(mockAttemptRepo.update).toHaveBeenCalledWith(
        50,
        expect.objectContaining({
          timeTaken: 120,
        }),
      );
      expect(mockAttemptRepo.saveAnswers).toHaveBeenCalledWith(50, [
        { questionId: 101, selectedOption: 1 },
      ]);
    });

    it("saveProgress throws if unauthorized user", async () => {
      mockAttemptRepo.findById.mockResolvedValue({ id: 50, userId: 99 });
      await expect(
        attemptService.saveProgress(1, 50, { answers: [] }),
      ).rejects.toThrow("Attempt not found");
    });

    it("pause updates status to paused", async () => {
      mockAttemptRepo.findById.mockResolvedValue({ id: 50, userId: 1 });
      await attemptService.pause(1, 50);
      expect(mockAttemptRepo.update).toHaveBeenCalledWith(50, {
        status: "paused",
      });
    });

    it("resume updates status to in_progress", async () => {
      mockAttemptRepo.findById.mockResolvedValue({ id: 50, userId: 1 });
      await attemptService.resume(1, 50);
      expect(mockAttemptRepo.update).toHaveBeenCalledWith(50, {
        status: "in_progress",
      });
    });
  });

  describe("submit() & Scoring Pipeline", () => {
    it("calculates marks, accuracy, section scores, and results table entry", async () => {
      const testObj = {
        id: 10,
        title: "SSC CGL Practice",
        totalMarks: 4,
        negativeMarking: 0.5,
      };
      mockTestRepo.findByIdentifier.mockResolvedValue(testObj);

      const questions = [
        {
          id: 101,
          marks: 2,
          negativeMarks: 0.5,
          correct_option: 0,
          section: "Quantitative",
        },
        {
          id: 102,
          marks: 2,
          negativeMarks: 0.5,
          correct_option: 1,
          section: "Quantitative",
        },
      ];
      mockTestRepo.getQuestions.mockResolvedValue(questions);

      const savedAttempt = {
        id: 777,
        userId: 1,
        testId: 10,
        status: "completed",
      };
      mockAttemptRepo.insert.mockResolvedValue(savedAttempt);

      const submitData = {
        answers: [
          { questionId: 101, selectedOption: 0 }, // Correct (+2)
          { questionId: 102, selectedOption: 2 }, // Wrong (-0.5)
        ],
        timeSpent: 180,
        sectionTimers: { Quantitative: 180 },
      };

      const result = await attemptService.submit(1, 10, submitData);

      expect(result.id).toBe(777);
      expect(mockAttemptRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          score: 1.5, // 2 - 0.5
          correct: 1,
          wrong: 1,
          unattempted: 0,
          accuracy: 50.0,
          timeTaken: 180,
          status: "completed",
          isCompleted: true,
        }),
        mockPoolClient,
      );

      // Verify section scores saved
      expect(mockAttemptRepo.saveSectionScores).toHaveBeenCalledWith(
        777,
        expect.objectContaining({
          Quantitative: expect.objectContaining({
            score: 1.5,
            correct: 1,
            wrong: 1,
          }),
        }),
        mockPoolClient,
      );

      // Verify domain event emitted
      expect(mockEmitDomainEvent).toHaveBeenCalledWith(
        "test_submitted",
        expect.objectContaining({
          userId: 1,
          testId: 10,
          attemptId: 777,
        }),
      );
    });
  });

  describe("getResult()", () => {
    it("returns complete result when authorized", async () => {
      mockAttemptRepo.findById.mockResolvedValue({
        id: 777,
        userId: 1,
        testId: 10,
      });
      mockTestRepo.getQuestions.mockResolvedValue([{ id: 101 }]);
      mockAttemptRepo.getAnswers.mockResolvedValue([
        { questionId: 101, isCorrect: true },
      ]);
      mockAttemptRepo.getSectionScores.mockResolvedValue({
        Quantitative: { score: 2 },
      });

      const res = await attemptService.getResult(777, 1);
      expect(res.attempt.id).toBe(777);
      expect(res.questions).toHaveLength(1);
      expect(res.answers).toHaveLength(1);
      expect(res.sectionScores.Quantitative.score).toBe(2);
    });

    it("throws unauthorized if attempting to view another user's result", async () => {
      mockAttemptRepo.findById.mockResolvedValue({ id: 777, userId: 2 });
      await expect(attemptService.getResult(777, 1)).rejects.toThrow(
        "Unauthorized",
      );
    });
  });

  describe("transitionAttempt()", () => {
    it("validates lifecycle state machine", async () => {
      mockAttemptRepo.findById.mockResolvedValue({
        id: 1,
        status: "in_progress",
      });
      mockAttemptRepo.update.mockResolvedValue({ id: 1, status: "submitting" });

      const updated = await attemptService.transitionAttempt(1, "submitting");
      expect(updated.status).toBe("submitting");
    });

    it("rejects illegal transitions from completed state", async () => {
      mockAttemptRepo.findById.mockResolvedValue({
        id: 1,
        status: "completed",
      });
      await expect(
        attemptService.transitionAttempt(1, "in_progress"),
      ).rejects.toThrow(
        "Invalid attempt state transition from 'completed' to 'in_progress'",
      );
    });
  });

  describe("createReattempt()", () => {
    it("throws if reattempt type is invalid", async () => {
      await expect(
        attemptService.createReattempt(1, 100, "invalid_mode"),
      ).rejects.toThrow("Invalid reattempt type");
    });

    it("creates reattempt with only wrong questions in 'wrong' mode", async () => {
      mockPool.query
        // 1st call: SELECT * FROM attempts WHERE id = $1
        .mockResolvedValueOnce({
          rows: [
            {
              id: 100,
              user_id: 1,
              test_id: 10,
              test_title: "SSC CGL Prelims",
              attempt_number: 1,
            },
          ],
        })
        // 2nd call: SELECT * FROM attempt_answers WHERE attempt_id = $1
        .mockResolvedValueOnce({
          rows: [
            { question_id: 101, is_correct: true },
            { question_id: 102, is_correct: false },
          ],
        })
        // 3rd call: INSERT INTO attempts RETURNING *
        .mockResolvedValueOnce({
          rows: [
            {
              id: 101,
              user_id: 1,
              test_id: 10,
              test_title: "SSC CGL Prelims - Wrong Questions",
              is_reattempt: true,
              reattempt_type: "wrong",
            },
          ],
        });

      mockTestRepo.getQuestions.mockResolvedValue([
        { id: 101, text: "Q1" },
        { id: 102, text: "Q2" },
      ]);

      const reattempt = await attemptService.createReattempt(1, 100, "wrong");

      expect(reattempt.attempt.is_reattempt).toBe(true);
      expect(reattempt.questions).toHaveLength(1);
      expect(reattempt.questions[0].id).toBe(102);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO attempts"),
        expect.arrayContaining([
          1,
          10,
          expect.stringContaining("Wrong Questions"),
        ]),
      );
    });

    it("throws NO_QUESTIONS_FOR_REATTEMPT if no questions qualify", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 100, user_id: 1, test_id: 10 }],
        })
        .mockResolvedValueOnce({
          rows: [{ question_id: 101, is_correct: true }], // All correct!
        });

      mockTestRepo.getQuestions.mockResolvedValue([{ id: 101, text: "Q1" }]);

      await expect(
        attemptService.createReattempt(1, 100, "wrong"),
      ).rejects.toThrow(
        "No eligible questions available for this reattempt mode.",
      );
    });
  });
});
