import { useEffect, useRef, useCallback } from "react";
import { apiClient } from "../../../shared/lib/api";

export function useTestTimer({
  test,
  reviewMode,
  loading,
  attemptId,
  timeLeft,
  setTimeLeft,
  isPaused,
  setIsPaused,
  showPauseModal,
  setShowPauseModal,
  showSubmitSummary,
  questions,
  currentQuestion,
  questionTimers,
  setQuestionTimers,
  setSectionTimers,
  computeSectionTimers,
  questionStartTimeRef,
}) {
  const endTimeRef = useRef(Date.now() + (test?.duration || 60) * 60 * 1000);

  useEffect(() => {
    endTimeRef.current = Date.now() + (test?.duration || 60) * 60 * 1000;
  }, [test?.duration]);

  useEffect(() => {
    if (
      reviewMode ||
      loading ||
      !test ||
      isPaused ||
      showPauseModal ||
      showSubmitSummary
    )
      return;
    endTimeRef.current = Date.now() + timeLeft * 1000;
    const tick = () => {
      const remaining = Math.max(0, endTimeRef.current - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [
    reviewMode,
    loading,
    test,
    isPaused,
    showPauseModal,
    showSubmitSummary,
    timeLeft,
    setTimeLeft,
  ]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const formatSectionTime = useCallback((seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const handlePause = useCallback(async () => {
    if (reviewMode || !attemptId) return;
    try {
      const currentQt = {
        questionId:
          questions[currentQuestion]?.id ||
          questions[currentQuestion]?._id ||
          currentQuestion,
        timeSpent: questionTimers[currentQuestion] || 0,
        timeSpentDelta: questionStartTimeRef.current
          ? Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
          : 0,
        visits: questionTimers[`${currentQuestion}_visits`] || 0,
        newVisit: false,
      };
      await apiClient.post("/api/attempt/pause", {
        attemptId,
        remainingTime: timeLeft,
        currentQuestionIndex: currentQuestion,
        questionTimers: [currentQt],
      });
      setIsPaused(true);
      setShowPauseModal(true);
      questionStartTimeRef.current = null;
    } catch {}
  }, [
    reviewMode,
    attemptId,
    questions,
    currentQuestion,
    questionTimers,
    timeLeft,
    setIsPaused,
    setShowPauseModal,
    questionStartTimeRef,
  ]);

  const handleResume = useCallback(async () => {
    if (reviewMode || !attemptId) return;
    try {
      const response = await apiClient.post("/api/attempt/resume", {
        attemptId,
      });
      const data = response.data?.data;
      if (data?.remainingTime) setTimeLeft(data.remainingTime);
      questionStartTimeRef.current = Date.now();
      if (data?.questionAttempts) {
        const restoredTimers = {};
        data.questionAttempts.forEach((qa) => {
          const questionIndex = questions.findIndex(
            (q) => String(q.id || q._id) === String(qa.questionId),
          );
          if (questionIndex >= 0)
            restoredTimers[questionIndex] = qa.timeSpentSeconds || 0;
        });
        setQuestionTimers(restoredTimers);
        setSectionTimers(computeSectionTimers(restoredTimers));
      }
      setIsPaused(false);
      setShowPauseModal(false);
    } catch {}
  }, [
    reviewMode,
    attemptId,
    questions,
    computeSectionTimers,
    setIsPaused,
    setShowPauseModal,
    setQuestionTimers,
    setSectionTimers,
    setTimeLeft,
    questionStartTimeRef,
  ]);

  const getSectionTimeColor = useCallback((remaining) => {
    if (remaining > 300)
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
    if (remaining > 120)
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
  }, []);

  return {
    endTimeRef,
    formatTime,
    formatSectionTime,
    getSectionTimeColor,
    handlePause,
    handleResume,
  };
}

export default useTestTimer;
