import { AttemptRepository } from "./attempt.repository.js";
import { TestRepository } from "../tests/test.repository.js";
import { QuestionRepository } from "../questions/question.repository.js";
import {
  addJob,
  QUEUE_NAMES,
} from "../../infrastructure/queue/queueManager.js";
import { emitDomainEvent } from "../../infrastructure/events/eventBus.js";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import {
  resolveQuestionMarks,
  scoreMcqAnswer,
} from "../../shared/utils/scoreAttempt.js";

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
      throw new Error(
        "Attempt limit reached. Upgrade to Pro for unlimited attempts.",
      );
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

    await addJob(QUEUE_NAMES.ANALYTICS, "analytics.test-started", {
      userId,
      testId: test.id,
      attemptId: attempt.id,
    });

    return { attempt, resumed: false };
  },

  async saveProgress(userId, attemptId, data) {
    const attempt = await repo.findById(attemptId);
    if (!attempt || attempt.userId !== userId)
      throw new Error("Attempt not found");

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
    if (!attempt || attempt.userId !== userId)
      throw new Error("Attempt not found");
    return repo.update(attemptId, { status: "paused" });
  },

  async resume(userId, attemptId) {
    const attempt = await repo.findById(attemptId);
    if (!attempt || attempt.userId !== userId)
      throw new Error("Attempt not found");
    return repo.update(attemptId, { status: "in_progress" });
  },

  async submit(userId, testId, data) {
    const {
      answers = [],
      timeSpent = 0,
      attemptId,
      markedForReview,
      sectionTimers,
    } = data;

    const test = await testRepo.findByIdentifier(testId);
    if (!test) throw new Error("Test not found");

    const questions = await testRepo.getQuestions(test.id);
    const totalQuestions = questions.length;
    const totalMarks = Number(test.totalMarks ?? totalQuestions * 2);
    const fallbackMarksPerQ =
      totalQuestions > 0 ? totalMarks / totalQuestions : 2;
    const testNegRaw =
      test.negativeMarking !== undefined && test.negativeMarking !== null
        ? Number(test.negativeMarking)
        : test.negativeMarks !== undefined && test.negativeMarks !== null
          ? Number(test.negativeMarks)
          : test.negative_marks !== undefined && test.negative_marks !== null
            ? Number(test.negative_marks)
            : undefined;

    let correct = 0,
      wrong = 0,
      unattempted = 0,
      totalScore = 0;
    const evaluatedAnswers = [];

    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const question = questions[qIdx];
      const answer = answers.find(
        (a) =>
          String(a.questionId) === String(question.id) ||
          (a.questionIndex !== undefined && Number(a.questionIndex) === qIdx),
      );
      const rawSelected =
        answer?.selectedOption !== undefined
          ? answer.selectedOption
          : answer?.answer;
      let selectedOption = null;
      if (
        rawSelected !== undefined &&
        rawSelected !== null &&
        rawSelected !== ""
      ) {
        if (Number.isFinite(Number(rawSelected))) {
          selectedOption = Number(rawSelected);
        } else {
          const s = String(rawSelected).trim();
          const m = s.match(/^[A-Za-z]$/);
          selectedOption = m ? s.toUpperCase().charCodeAt(0) - 65 : null;
        }
      }
      const rawCorrect =
        question.correct_option ??
        question.correctOption ??
        question.correct_answer ??
        question.correct;
      let correctIndex = -1;
      if (
        rawCorrect !== undefined &&
        rawCorrect !== null &&
        rawCorrect !== ""
      ) {
        const asNum = Number(rawCorrect);
        if (Number.isFinite(asNum)) {
          correctIndex = asNum;
        } else {
          const s = String(rawCorrect).trim();
          const m = s.match(/^[A-Da-d]$/);
          correctIndex = m ? s.toUpperCase().charCodeAt(0) - 65 : -1;
        }
      }
      const correctOption = correctIndex;

      const { positive: qMarks, negative: qNegMarks } = resolveQuestionMarks(
        question,
        {
          marksPerQuestion: fallbackMarksPerQ,
          negativeMarking: testNegRaw,
        },
      );
      const questionType = (
        question.question_type ??
        question.questionType ??
        question.type ??
        "mcq"
      ).toLowerCase();

      let isCorrect = false;
      let isWrong = false;

      if (selectedOption === null) {
        unattempted++;
      } else if (questionType === "msq" && Array.isArray(question.options)) {
        const correctOptions = question.options
          .map((opt, idx) =>
            opt?.isCorrect || opt?.is_correct || opt?.correct ? idx : -1,
          )
          .filter((idx) => idx >= 0);
        const selectedArr = Array.isArray(selectedOption)
          ? selectedOption
          : [selectedOption];
        const selectedSet = new Set(selectedArr);
        const correctSet = new Set(correctOptions);

        const allCorrectSelected = correctOptions.every((idx) =>
          selectedSet.has(idx),
        );
        const noWrongSelected = selectedArr.every((idx) => correctSet.has(idx));

        if (
          allCorrectSelected &&
          noWrongSelected &&
          selectedArr.length === correctOptions.length
        ) {
          isCorrect = true;
          correct++;
          totalScore += qMarks;
        } else if (noWrongSelected && selectedArr.length > 0) {
          const partialCount = selectedArr.filter((idx) =>
            correctSet.has(idx),
          ).length;
          const partial = qMarks * (partialCount / correctOptions.length);
          totalScore += partial;
        } else {
          isWrong = true;
          wrong++;
          totalScore -= qNegMarks;
        }
      } else {
        const scored = scoreMcqAnswer({
          selectedOption,
          correctOption,
          positive: qMarks,
          negative: qNegMarks,
        });

        isCorrect = scored.isCorrect;
        isWrong = scored.isWrong;
        correct += scored.correct;
        wrong += scored.wrong;
        unattempted += scored.unattempted;
        totalScore += scored.delta;
      }

      evaluatedAnswers.push({
        questionId: question.id,
        selectedOption,
        isCorrect,
        isWrong,
        timeSpent: answer?.timeSpent || 0,
        marks: isCorrect ? qMarks : isWrong ? -qNegMarks : 0,
      });
    }

    const score = Number(totalScore.toFixed(2));
    const accuracy =
      correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : 0;

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
          // FE keys sectionTimers by section name; DB may use section_id.
          // Match either so section scorecards stay accurate.
          const sectionQuestions = questions.filter((q) => {
            const key = String(sectionId);
            if (String(q.section_id ?? q.sectionId ?? "") === key) return true;
            const name = String(
              q.section || q.subject || q.section_name || "",
            ).trim();
            return name.toLowerCase() === key.toLowerCase();
          });
          const secCorrect = evaluatedAnswers.filter(
            (a) =>
              a.isCorrect &&
              sectionQuestions.some(
                (sq) => String(sq.id) === String(a.questionId),
              ),
          ).length;
          const secWrong = evaluatedAnswers.filter(
            (a) =>
              a.isWrong &&
              sectionQuestions.some(
                (sq) => String(sq.id) === String(a.questionId),
              ),
          ).length;
          const secUnattempted =
            sectionQuestions.length - secCorrect - secWrong;
          const secScore = evaluatedAnswers
            .filter((a) =>
              sectionQuestions.some(
                (sq) => String(sq.id) === String(a.questionId),
              ),
            )
            .reduce((sum, a) => sum + (a.marks || 0), 0);
          const secTotalMarks = sectionQuestions.reduce(
            (sum, q) =>
              sum + Number(q.marks ?? q.junction_marks ?? fallbackMarksPerQ),
            0,
          );
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

      // Persist to results table for analytics, leaderboards, and certificates
      try {
        const percentage =
          totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
        await client.query(
          `INSERT INTO results (
            attempt_id, user_id, test_id, series_id, score,
            total_marks, percentage, time_taken, submitted_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT DO NOTHING`,
          [
            attempt.id,
            userId,
            test.id,
            test.seriesId || test.series_id || null,
            score,
            totalMarks,
            percentage,
            Number(timeSpent) || 0,
          ],
        );
      } catch (resultsErr) {
        console.warn(
          "[attempt.service] Failed to persist to results table:",
          resultsErr.message,
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    await emitDomainEvent("test_submitted", {
      userId,
      testId: test.id,
      attemptId: attempt.id,
      title: "Test Submitted",
      message: `Your ${test.title} result is ready`,
      source: test.isLive || test.is_live ? "live-tests" : undefined,
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

  async transitionAttempt(attemptId, targetState) {
    const attempt = await repo.findById(attemptId);
    if (!attempt) throw new Error("Attempt not found");

    const { isValidAttemptTransition } =
      await import("../../constants/lifecycle.constants.js");
    const currentState = attempt.status || "created";

    if (!isValidAttemptTransition(currentState, targetState)) {
      throw new Error(
        `Invalid attempt state transition from '${currentState}' to '${targetState}'`,
      );
    }

    return repo.update(attemptId, {
      status: targetState,
      updatedAt: new Date().toISOString(),
    });
  },

  async createReattempt(userId, parentAttemptId, reattemptType = "full") {
    if (!parentAttemptId) {
      throw new Error("Parent attempt ID is required");
    }

    const normalizedType =
      reattemptType === "smart_improvement"
        ? "smart"
        : reattemptType.toLowerCase();
    const validTypes = ["full", "wrong", "unattempted", "slow", "smart"];
    if (!validTypes.includes(normalizedType)) {
      throw new Error(
        `Invalid reattempt type: ${reattemptType}. Valid types: ${validTypes.join(", ")}`,
      );
    }

    const { rows: parentRows } = await pool.query(
      `SELECT * FROM attempts WHERE id = $1`,
      [parentAttemptId],
    );
    const parent = parentRows[0];
    if (!parent) {
      throw new Error("Parent attempt not found");
    }

    if (String(parent.user_id) !== String(userId) && userId !== "admin") {
      throw new Error("Not authorized to reattempt this attempt");
    }

    const allQuestions = await testRepo.getQuestions(parent.test_id);
    const { rows: parentAnswers } = await pool.query(
      `SELECT * FROM attempt_answers WHERE attempt_id = $1`,
      [parentAttemptId],
    );

    let eligibleQuestions = [];
    let titleSuffix = "Reattempt";

    switch (normalizedType) {
      case "full":
        eligibleQuestions = allQuestions;
        titleSuffix = "Full Reattempt";
        break;

      case "wrong": {
        const wrongQIds = new Set(
          parentAnswers
            .filter((a) => a.is_correct === false)
            .map((a) => String(a.question_id)),
        );
        eligibleQuestions = allQuestions.filter((q) =>
          wrongQIds.has(String(q.id)),
        );
        titleSuffix = "Wrong Questions";
        break;
      }

      case "unattempted": {
        const answeredQIds = new Set(
          parentAnswers
            .filter(
              (a) =>
                a.selected_option !== null && a.selected_option !== undefined,
            )
            .map((a) => String(a.question_id)),
        );
        eligibleQuestions = allQuestions.filter(
          (q) => !answeredQIds.has(String(q.id)),
        );
        titleSuffix = "Unattempted Questions";
        break;
      }

      case "slow": {
        const slowQIds = new Set(
          parentAnswers
            .filter((a) => Number(a.time_spent || 0) > 90)
            .map((a) => String(a.question_id)),
        );
        eligibleQuestions = allQuestions.filter((q) =>
          slowQIds.has(String(q.id)),
        );
        titleSuffix = "Slow Questions";
        break;
      }

      case "smart": {
        const wrongQIds = new Set(
          parentAnswers
            .filter((a) => a.is_correct === false)
            .map((a) => String(a.question_id)),
        );
        const answeredQIds = new Set(
          parentAnswers
            .filter(
              (a) =>
                a.selected_option !== null && a.selected_option !== undefined,
            )
            .map((a) => String(a.question_id)),
        );
        const slowQIds = new Set(
          parentAnswers
            .filter((a) => Number(a.time_spent || 0) > 90)
            .map((a) => String(a.question_id)),
        );

        eligibleQuestions = allQuestions.filter(
          (q) =>
            wrongQIds.has(String(q.id)) ||
            !answeredQIds.has(String(q.id)) ||
            slowQIds.has(String(q.id)),
        );
        titleSuffix = "Smart Improvement";
        break;
      }

      default:
        eligibleQuestions = allQuestions;
    }

    if (!eligibleQuestions || eligibleQuestions.length === 0) {
      const err = new Error(
        "No eligible questions available for this reattempt mode.",
      );
      err.code = "NO_QUESTIONS_FOR_REATTEMPT";
      throw err;
    }

    const testTitle = `${parent.test_title || "Practice Test"} - ${titleSuffix}`;
    const nextAttemptNo = (Number(parent.attempt_number) || 1) + 1;

    // Single atomic INSERT
    const { rows: newAttemptRows } = await pool.query(
      `INSERT INTO attempts (
        user_id, test_id, test_title, attempt_number, is_reattempt, reattempt_type,
        parent_attempt_id, series_id, status, is_completed, started_at, created_at
      ) VALUES ($1, $2, $3, $4, true, $5, $6, $7, 'in_progress', false, NOW(), NOW())
      RETURNING *`,
      [
        parent.user_id,
        parent.test_id,
        testTitle,
        nextAttemptNo,
        normalizedType,
        parent.id,
        parent.series_id || null,
      ],
    );

    return {
      attempt: newAttemptRows[0],
      questions: eligibleQuestions,
    };
  },
};
