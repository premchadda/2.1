import { AttemptRepository } from "./attempt.repository.js";
import { TestRepository } from "../tests/test.repository.js";
import { QuestionRepository } from "../questions/question.repository.js";
import { addJob, QUEUE_NAMES } from "../../infrastructure/queue/queueManager.js";
import { emitDomainEvent } from "../../infrastructure/events/eventBus.js";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";

const repo = new AttemptRepository();
const testRepo = new TestRepository();
const questionRepo = new QuestionRepository();

const ATTEMPT_LIMITS = {
  FREE_MAX: 3,
};

export const attemptService = {
  async start(userId, testId) {
    const test = await testRepo.findByIdentifier(testId);
    if (!test) throw new Error("Test not found");

    const existing = await repo.findActiveByUserAndTest(userId, test.id);
    if (existing) {
      return { attempt: existing, resumed: true };
    }

    const attemptCount = await repo.countByUserAndTest(userId, test.id);
    if (attemptCount >= ATTEMPT_LIMITS.FREE_MAX) {
      throw new Error("Attempt limit reached. Upgrade to Pro for unlimited attempts.");
    }

    const questions = await testRepo.getQuestions(test.id);
    const attempt = await repo.insert({
      userId,
      testId: test.id,
      seriesId: test.seriesId || test.series_id,
      status: "in_progress",
      isCompleted: false,
      questions: questions.map((q) => q.id),
      answers: [],
      totalMarks: test.totalMarks || test.total_marks,
      totalQuestions: questions.length,
      startedAt: new Date().toISOString(),
    });

    await addJob(QUEUE_NAMES.ANALYTICS, "analytics.test-started", { userId, testId: test.id, attemptId: attempt.id });

    return { attempt, resumed: false };
  },

  async saveProgress(userId, attemptId, data) {
    const attempt = await repo.findById(attemptId);
    if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");

    await repo.update(attemptId, {
      answers: data.answers || attempt.answers,
      timeTaken: data.timeSpent ?? attempt.timeTaken,
      markedForReview: data.markedForReview || attempt.markedForReview,
      sectionTimes: data.sectionTimers || attempt.sectionTimes,
    });

    if (data.answers) {
      await repo.saveAnswers(attemptId, data.answers);
    }
  },

  async pause(userId, attemptId) {
    const attempt = await repo.findById(attemptId);
    if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");
    return repo.update(attemptId, { status: "paused" });
  },

  async resume(userId, attemptId) {
    const attempt = await repo.findById(attemptId);
    if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");
    return repo.update(attemptId, { status: "in_progress" });
  },

  async submit(userId, testId, data) {
    const { answers = [], timeSpent = 0, attemptId, markedForReview, sectionTimers } = data;

    const test = await testRepo.findByIdentifier(testId);
    if (!test) throw new Error("Test not found");

    const questions = await testRepo.getQuestions(test.id);
    const totalQuestions = questions.length;
    const totalMarks = Number(test.totalMarks ?? totalQuestions * 2);
    const fallbackMarksPerQ = totalQuestions > 0 ? totalMarks / totalQuestions : 1;
    const testNegativeMarking = Number(test.negativeMarking ?? test.negativeMarks ?? 0.25);

    let correct = 0, wrong = 0, unattempted = 0, totalScore = 0;
    const evaluatedAnswers = [];

    for (const question of questions) {
      const answer = answers.find((a) => String(a.questionId) === String(question.id));
      const selectedOption = answer?.selectedOption !== undefined && answer?.selectedOption !== null
        ? Number(answer.selectedOption) : null;
      const correctOption = Number(question.correct_answer ?? question.correctOption ?? question.correct_option ?? -1);

      const qMarks = Number(question.marks ?? question.junction_marks ?? fallbackMarksPerQ);
      const qNegMarks = Number(question.negative_marks ?? question.junction_neg_marks ?? question.negMarks ?? testNegativeMarking);
      const questionType = (question.question_type ?? question.questionType ?? question.type ?? 'mcq').toLowerCase();

      let isCorrect = false;
      let isWrong = false;

      if (selectedOption === null) {
        unattempted++;
      } else if (questionType === 'msq' && Array.isArray(question.options)) {
        const correctOptions = question.options
          .map((opt, idx) => (opt?.isCorrect || opt?.is_correct || opt?.correct) ? idx : -1)
          .filter(idx => idx >= 0);
        const selectedArr = Array.isArray(selectedOption) ? selectedOption : [selectedOption];
        const selectedSet = new Set(selectedArr);
        const correctSet = new Set(correctOptions);

        const allCorrectSelected = correctOptions.every(idx => selectedSet.has(idx));
        const noWrongSelected = selectedArr.every(idx => correctSet.has(idx));

        if (allCorrectSelected && noWrongSelected && selectedArr.length === correctOptions.length) {
          isCorrect = true;
          correct++;
          totalScore += qMarks;
        } else if (noWrongSelected && selectedArr.length > 0) {
          const partialCount = selectedArr.filter(idx => correctSet.has(idx)).length;
          const partial = qMarks * (partialCount / correctOptions.length);
          correct += 0.5;
          totalScore += partial;
        } else {
          isWrong = true;
          wrong++;
          totalScore -= qNegMarks;
        }
      } else {
        isCorrect = selectedOption !== null && selectedOption === correctOption;
        isWrong = selectedOption !== null && selectedOption !== correctOption;

        if (isCorrect) { correct++; totalScore += qMarks; }
        else if (isWrong) { wrong++; totalScore -= qNegMarks; }
        else { unattempted++; }
      }

      evaluatedAnswers.push({
        questionId: question.id,
        selectedOption,
        isCorrect,
        isWrong,
        timeSpent: answer?.timeSpent || 0,
        marks: isCorrect ? qMarks : (isWrong ? -qNegMarks : 0),
      });
    }

    const score = Number(totalScore.toFixed(2));
    const accuracy = (correct + wrong) > 0 ? (correct / (correct + wrong)) * 100 : 0;

    const attemptData = {
      userId,
      testId: test.id,
      seriesId: test.seriesId || test.series_id,
      totalQuestions,
      score,
      totalMarks,
      correct,
      wrong,
      unattempted,
      accuracy: Number(accuracy.toFixed(1)),
      timeTaken: Number(timeSpent),
      markedForReview,
      sectionTimers,
      status: "completed",
      isCompleted: true,
      submittedAt: new Date().toISOString(),
    };

    // DATA-INTEGRITY FIX (H17): the attempt row, its answers, and its section
    // scores must be written atomically. Previously these were three separate
    // statements with no transaction, so a failure after the attempt insert
    // left a "completed" attempt with missing/partial answers. Wrap all writes
    // in a single transaction and only emit the domain event after COMMIT.
    const client = await pool.connect();
    let attempt;
    try {
      await client.query("BEGIN");

      if (attemptId) {
        attempt = await repo.update(attemptId, attemptData, client);
      } else {
        attempt = await repo.insert(attemptData, client);
      }

      await repo.saveAnswers(attempt.id, evaluatedAnswers, client);

      if (sectionTimers) {
        const sectionScores = {};
        for (const [sectionId, timer] of Object.entries(sectionTimers)) {
          const sectionQuestions = questions.filter((q) => String(q.section_id) === String(sectionId));
          const secCorrect = evaluatedAnswers.filter(
            (a) => a.isCorrect && sectionQuestions.some((sq) => String(sq.id) === String(a.questionId))
          ).length;
          const secWrong = evaluatedAnswers.filter(
            (a) => a.isWrong && sectionQuestions.some((sq) => String(sq.id) === String(a.questionId))
          ).length;
          const secUnattempted = sectionQuestions.length - secCorrect - secWrong;
          const secScore = evaluatedAnswers
            .filter((a) => sectionQuestions.some((sq) => String(sq.id) === String(a.questionId)))
            .reduce((sum, a) => sum + (a.marks || 0), 0);
          const secTotalMarks = sectionQuestions.reduce((sum, q) => sum + Number(q.marks ?? q.junction_marks ?? fallbackMarksPerQ), 0);
          sectionScores[sectionId] = {
            score: Number(secScore.toFixed(2)),
            totalMarks: secTotalMarks,
            correct: secCorrect,
            wrong: secWrong,
            unattempted: secUnattempted,
            timeSpent: timer,
          };
        }
        await repo.saveSectionScores(attempt.id, sectionScores, client);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    await emitDomainEvent('test_submitted', {
      userId, testId: test.id, attemptId: attempt.id,
      title: "Test Submitted",
      message: `Your ${test.title} result is ready`,
      // Flag live-test submissions so the WS layer can scope leaderboard
      // refreshes to actual live tests (same check as test.routes.js).
      source: (test.isLive || test.is_live) ? 'live-tests' : undefined,
    });

    return attempt;
  },

  async getResult(attemptId, requestingUserId) {
    const attempt = await repo.findById(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.userId !== requestingUserId) throw new Error("Unauthorized");

    const questions = await testRepo.getQuestions(attempt.testId);
    const answers = await repo.getAnswers(attemptId);
    const sectionScores = await repo.getSectionScores(attemptId);

    return { attempt, questions, answers, sectionScores };
  },

  async logEvent(attemptId, eventType, eventData) {
    return repo.logEvent(attemptId, eventType, eventData);
  },

  async getState(attemptId) {
    return repo.findById(attemptId);
  },
};
