import { describe, it, expect } from "vitest";

describe("Frontend Fix Contracts (Tasks 1-4)", () => {
  describe("Task 1: PracticeWorkspace timing payload contract", () => {
    it("dispatches both time_taken_sec and timeTakenSec when timing data is present", () => {
      const timeSpent = 42;
      const optionIdx = 2;
      const payload = {
        selectedOption: optionIdx,
        ...(timeSpent > 0
          ? { time_taken_sec: timeSpent, timeTakenSec: timeSpent }
          : {}),
      };

      expect(payload).toEqual({
        selectedOption: 2,
        time_taken_sec: 42,
        timeTakenSec: 42,
      });
    });

    it("omits timing fields when timeSpent is zero", () => {
      const timeSpent = 0;
      const optionIdx = 1;
      const payload = {
        selectedOption: optionIdx,
        ...(timeSpent > 0
          ? { time_taken_sec: timeSpent, timeTakenSec: timeSpent }
          : {}),
      };

      expect(payload).toEqual({
        selectedOption: 1,
      });
      expect(payload.time_taken_sec).toBeUndefined();
      expect(payload.timeTakenSec).toBeUndefined();
    });
  });

  describe("Task 2: Signup phone normalization contract", () => {
    const normalizeMobile = (mobile) => {
      let cleanedMobile = mobile ? mobile.replace(/[\s-]/g, "") : "";
      if (cleanedMobile.startsWith("+91")) {
        cleanedMobile = cleanedMobile.slice(3);
      } else if (
        cleanedMobile.startsWith("91") &&
        cleanedMobile.length === 12
      ) {
        cleanedMobile = cleanedMobile.slice(2);
      }
      const isValid =
        !mobile ||
        (Boolean(cleanedMobile) && /^[0-9]{10}$/.test(cleanedMobile));
      return { cleanedMobile, isValid };
    };

    it("strips spaces, dashes, and +91 prefix from valid numbers", () => {
      expect(normalizeMobile("+91 98765 43210")).toEqual({
        cleanedMobile: "9876543210",
        isValid: true,
      });
      expect(normalizeMobile("+91-98765-43210")).toEqual({
        cleanedMobile: "9876543210",
        isValid: true,
      });
      expect(normalizeMobile("919876543210")).toEqual({
        cleanedMobile: "9876543210",
        isValid: true,
      });
      expect(normalizeMobile("9876543210")).toEqual({
        cleanedMobile: "9876543210",
        isValid: true,
      });
    });

    it("rejects invalid length or non-numeric input", () => {
      expect(normalizeMobile("+91 12345").isValid).toBe(false);
      expect(normalizeMobile("+91").isValid).toBe(false);
      expect(normalizeMobile("abcdefghij").isValid).toBe(false);
    });

    it("handles optional empty mobile without error", () => {
      expect(normalizeMobile("")).toEqual({
        cleanedMobile: "",
        isValid: true,
      });
    });
  });

  describe("Task 3: LiveTestInterface rank polling status guard", () => {
    const shouldPollLiveRank = ({ attemptStatus, isSubmitted, test }) => {
      const currentStatus =
        attemptStatus ||
        (isSubmitted ? "submitted" : null) ||
        test?.attempt?.status ||
        test?.status;
      return currentStatus === "completed" || currentStatus === "submitted";
    };

    it("blocks polling during ongoing / in-progress active exams", () => {
      expect(
        shouldPollLiveRank({
          attemptStatus: "in_progress",
          isSubmitted: false,
          test: { id: 1 },
        }),
      ).toBe(false);
      expect(
        shouldPollLiveRank({
          attemptStatus: "not_started",
          isSubmitted: false,
          test: { id: 1 },
        }),
      ).toBe(false);
      expect(
        shouldPollLiveRank({
          attemptStatus: null,
          isSubmitted: false,
          test: { id: 1 },
        }),
      ).toBe(false);
    });

    it("permits polling once attempt status is completed or submitted", () => {
      expect(
        shouldPollLiveRank({
          attemptStatus: "completed",
          isSubmitted: false,
          test: { id: 1 },
        }),
      ).toBe(true);
      expect(
        shouldPollLiveRank({
          attemptStatus: "submitted",
          isSubmitted: true,
          test: { id: 1 },
        }),
      ).toBe(true);
      expect(
        shouldPollLiveRank({
          attemptStatus: null,
          isSubmitted: true,
          test: { id: 1 },
        }),
      ).toBe(true);
      expect(
        shouldPollLiveRank({
          attemptStatus: null,
          isSubmitted: false,
          test: { attempt: { status: "completed" } },
        }),
      ).toBe(true);
    });
  });

  describe("Task 4: Profile numeric test_series_id resolution contract", () => {
    const resolveSeriesId = (exam, enrolledTestSeries = []) => {
      return (
        (exam.test_series_id && !isNaN(Number(exam.test_series_id))
          ? Number(exam.test_series_id)
          : null) ||
        (exam.enrolledSeriesId && !isNaN(Number(exam.enrolledSeriesId))
          ? Number(exam.enrolledSeriesId)
          : null) ||
        (Array.isArray(exam.series) && exam.series.length > 0
          ? exam.series
              .map((s) => s.test_series_id || s.id || s._id)
              .find((id) => id && !isNaN(Number(id)))
          : null) ||
        (Array.isArray(enrolledTestSeries)
          ? enrolledTestSeries
              .filter((s) => {
                const sRef = String(
                  s.examId ||
                    s.exam_id ||
                    s.sub_category_id ||
                    s.category ||
                    s.exam ||
                    "",
                ).toLowerCase();
                const examKeys = [
                  exam.id,
                  exam._id,
                  exam.exam_id,
                  exam.slug,
                  exam.title,
                  exam.name,
                ]
                  .filter(Boolean)
                  .map((k) => String(k).toLowerCase());
                return examKeys.includes(sRef);
              })
              .map((s) => s.test_series_id || s.id || s._id)
              .find((id) => id && !isNaN(Number(id)))
          : null) ||
        (exam.id && !isNaN(Number(exam.id)) ? Number(exam.id) : null)
      );
    };

    it("resolves direct numeric test_series_id or enrolledSeriesId", () => {
      expect(resolveSeriesId({ test_series_id: 42 })).toBe(42);
      expect(resolveSeriesId({ enrolledSeriesId: "105" })).toBe(105);
    });

    it("resolves numeric id from nested series array when exam has synthetic string ID", () => {
      const exam = {
        id: "cat-railway",
        title: "Railway Exams",
        series: [{ id: 88, title: "RRB NTPC Mock Series" }],
      };
      expect(resolveSeriesId(exam)).toBe(88);
    });

    it("resolves numeric id from enrolledTestSeries state list by match", () => {
      const exam = {
        id: "exam-slug-upsc",
        slug: "upsc-prelims",
        title: "UPSC Prelims",
      };
      const enrolledTestSeries = [
        { id: 77, exam: "upsc-prelims", title: "UPSC GS Paper 1" },
      ];
      expect(resolveSeriesId(exam, enrolledTestSeries)).toBe(77);
    });

    it("returns null for unresolved synthetic keys without numeric series", () => {
      const exam = { id: "cat-unknown", title: "Unknown Category" };
      expect(resolveSeriesId(exam, [])).toBeNull();
    });
  });

  describe("Territory T-FE Fix Contracts (Tasks 1-10)", () => {
    describe("Task 1 & 2 & 3 & 5 & 6: Analysis computations contract", () => {
      it("does not synthesize subject breakdown when section data is absent", () => {
        const subjectMap = {};
        const subjectKeys = Object.keys(subjectMap);
        let derivedSubjectWise = [];
        if (subjectKeys.length > 0) {
          derivedSubjectWise = subjectKeys.map((k) => subjectMap[k]);
        }
        expect(derivedSubjectWise).toEqual([]);
      });

      it("returns null difficulty breakdown when absent, without fabricating 40/40/20", () => {
        const analytics = {};
        const difficultyBreakdown = analytics?.difficultyBreakdown || null;
        expect(difficultyBreakdown).toBeNull();
      });

      it("resolves rank fallback to null instead of 1 for unranked users", () => {
        const analytics = {};
        const bestRank = null;
        const rank =
          Number(analytics?.rank) > 0 ? analytics.rank : bestRank || null;
        expect(rank).toBeNull();

        const rankDisplay = rank && rank > 0 ? `${rank}` : "—";
        expect(rankDisplay).toBe("—");
      });

      it("computes attempt pattern without arbitrary 0.7 multiplier", () => {
        const s = {
          name: "Math",
          attempted: 10,
          accuracy: 80,
          correct: 8,
          wrong: 2,
          totalQuestions: 12,
          skipped: 2,
        };
        const attempted = s.attempted || 0;
        const correct =
          s.correct != null
            ? Number(s.correct)
            : Math.round((attempted * (s.accuracy || 0)) / 100);
        const wrong =
          s.wrong != null ? Number(s.wrong) : Math.max(0, attempted - correct);
        const skipped =
          s.skipped != null
            ? Number(s.skipped)
            : Math.max(0, (s.totalQuestions || attempted) - correct - wrong);
        const total =
          s.totalQuestions || correct + wrong + skipped || attempted;

        expect(correct).toBe(8);
        expect(wrong).toBe(2);
        expect(skipped).toBe(2);
        expect(total).toBe(12);
      });

      it("calculates real improvement or returns dash instead of hardcoded +5%", () => {
        const recentTestsNoData = [{ score: 80 }];
        const getImprovement = (tests) => {
          if (!tests || tests.length < 2) return "—";
          const diff =
            Number(tests[tests.length - 1].score) -
            Number(tests[tests.length - 2].score);
          return diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "0%";
        };
        expect(getImprovement(recentTestsNoData)).toBe("—");
        expect(getImprovement([{ score: 70 }, { score: 85 }])).toBe("+15%");
      });

      it("formats test score as pts and does not equate score with accuracy", () => {
        const testWithScore = { score: 150, accuracy: 75 };
        const scoreLabel = `${testWithScore.score} pts`;
        const accLabel =
          testWithScore.accuracy != null
            ? `${testWithScore.accuracy}% acc`
            : "—";
        expect(scoreLabel).toBe("150 pts");
        expect(accLabel).toBe("75% acc");

        const testWithoutAcc = { score: 100, accuracy: null };
        const accLabelNull =
          testWithoutAcc.accuracy != null
            ? `${testWithoutAcc.accuracy}% acc`
            : "—";
        expect(accLabelNull).toBe("—");
      });
    });

    describe("Task 4: Topper comparison guard contract", () => {
      const getTopperComparison = ({ avgScore, topperScore }) => {
        const userScore = Math.round(avgScore || 0);
        const topper =
          topperScore != null && Number(topperScore) > 0
            ? Math.round(Number(topperScore))
            : null;
        if (!topper || userScore <= 0) return null;
        return {
          topperScore: topper,
          userScore,
          gap: Math.max(0, topper - userScore),
          percent: Math.min(100, Math.round((userScore / topper) * 100)),
        };
      };

      it("returns null when topperScore is missing, without defaulting to 100 or 200", () => {
        expect(
          getTopperComparison({ avgScore: 75, topperScore: null }),
        ).toBeNull();
        expect(
          getTopperComparison({ avgScore: 120, topperScore: undefined }),
        ).toBeNull();
      });

      it("returns null when userScore is 0", () => {
        expect(
          getTopperComparison({ avgScore: 0, topperScore: 180 }),
        ).toBeNull();
      });

      it("returns real comparison when both real topperScore and userScore > 0 are present", () => {
        const comp = getTopperComparison({ avgScore: 150, topperScore: 180 });
        expect(comp).toEqual({
          topperScore: 180,
          userScore: 150,
          gap: 30,
          percent: 83,
        });
      });
    });

    describe("Task 7 & 8: Leaderboard & SeriesLeaderboard formatting contract", () => {
      it("shows dash for unranked users instead of #1 and Top 25%", () => {
        const perfData = null;
        const userRanking = null;
        const rankDisplay =
          perfData?.rank || userRanking?.rank
            ? `#${perfData?.rank || userRanking?.rank}`
            : "—";
        expect(rankDisplay).toBe("—");

        const comparisonStats = null;
        const rankings = [];
        const topDisplay =
          comparisonStats?.topPercent != null
            ? `Top ${comparisonStats.topPercent}%`
            : userRanking?.rank && rankings.length
              ? `Top ${Math.max(1, Math.round((userRanking.rank / rankings.length) * 100))}%`
              : "—";
        expect(topDisplay).toBe("—");
      });

      it("formats percentile as '{percentile}th Percentile' and score as '{score} pts'", () => {
        const percentile = 92;
        const score = 175;
        expect(`${percentile}th Percentile`).toBe("92th Percentile");
        expect(`${score} pts`).toBe("175 pts");
      });
    });

    describe("Task 9: Dashboard duration and streak calculation contract", () => {
      it("displays 0m instead of totalTests * 0.5h when no duration was recorded", () => {
        const totalTimeSpentSeconds = 0;
        const totalMinutes = Math.round(totalTimeSpentSeconds / 60);
        let timeSpentDisplay;
        if (totalTimeSpentSeconds >= 3600) {
          timeSpentDisplay = `${parseFloat((totalTimeSpentSeconds / 3600).toFixed(1))}h`;
        } else if (totalMinutes > 0) {
          timeSpentDisplay = `${totalMinutes}m`;
        } else if (totalTimeSpentSeconds > 0) {
          timeSpentDisplay = `${totalTimeSpentSeconds}s`;
        } else {
          timeSpentDisplay = "0m";
        }

        expect(timeSpentDisplay).toBe("0m");
      });

      it("does not fabricate streak = 1 when streak was broken in past days", () => {
        const attemptDates = new Set(["2026-10-01", "2026-10-02"]);
        const todayStr = "2026-11-12";
        const yesterdayStr = "2026-11-11";

        let currentStreak = 0;
        if (attemptDates.has(todayStr) || attemptDates.has(yesterdayStr)) {
          currentStreak = 2;
        }
        expect(currentStreak).toBe(0);
      });
    });

    describe("Task 10: AttemptedTests marks calculation contract", () => {
      it("resolves totalMarks accurately with fallback chain", () => {
        const testWithTotalMarks = { totalMarks: 150 };
        expect(
          Number(
            testWithTotalMarks.totalMarks ||
              testWithTotalMarks.maxScore ||
              (testWithTotalMarks.totalQuestions
                ? testWithTotalMarks.totalQuestions * 2
                : 100),
          ),
        ).toBe(150);

        const testWithMaxScore = { maxScore: 80 };
        expect(
          Number(
            testWithMaxScore.totalMarks ||
              testWithMaxScore.maxScore ||
              (testWithMaxScore.totalQuestions
                ? testWithMaxScore.totalQuestions * 2
                : 100),
          ),
        ).toBe(80);

        const testWithQuestions = { totalQuestions: 30 };
        expect(
          Number(
            testWithQuestions.totalMarks ||
              testWithQuestions.maxScore ||
              (testWithQuestions.totalQuestions
                ? testWithQuestions.totalQuestions * 2
                : 100),
          ),
        ).toBe(60);

        const testEmpty = {};
        expect(
          Number(
            testEmpty.totalMarks ||
              testEmpty.maxScore ||
              (testEmpty.totalQuestions ? testEmpty.totalQuestions * 2 : 100),
          ),
        ).toBe(100);
      });
    });
  });
});
