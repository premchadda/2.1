import { useEffect, useRef } from "react";
import Telemetry from "../../../shared/lib/telemetry";
import { toast } from "react-hot-toast";

export function useTestTelemetry({
  reviewMode,
  attemptId,
  test,
  isPaused,
  showSubmitSummary,
  currentQuestion,
  timeLeft,
  questions,
  navigate,
}) {
  const currentQuestionRef = useRef(currentQuestion);
  const timeLeftRef = useRef(timeLeft);
  const questionsRef = useRef(questions);
  const tabSwitchCountRef = useRef(0);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    if (reviewMode || !attemptId || !test || isPaused || showSubmitSummary)
      return;

    Telemetry.start({
      attemptId,
      testId: test._id || test.id,
      getCurrentQuestion: () => {
        const qIdx = currentQuestionRef.current;
        const qList = questionsRef.current;
        return qList[qIdx]?.id || qList[qIdx]?._id || null;
      },
      getTimeLeft: () => timeLeftRef.current,
      onViolation: (type, e) => {
        if (type === "tab_switch") {
          tabSwitchCountRef.current += 1;
          toast.error(
            `Tab switching detected (${tabSwitchCountRef.current}). This may disqualify your attempt.`,
            { duration: 4000, icon: "⚠️" },
          );
        } else if (type === "fullscreen_exit") {
          toast.error("Please return to fullscreen mode", { icon: "⚠️" });
        } else if (type === "copy" || type === "cut" || type === "paste") {
          if (e) e.preventDefault();
          toast.error("Copy/Paste is not allowed during the test", {
            icon: "⚠️",
          });
        } else if (type === "context_menu") {
          if (e) e.preventDefault();
        } else if (type === "attempt_revoked") {
          toast.error(
            `Test attempt has been ${e?.status || "revoked"}. Redirecting...`,
            { duration: 5000, icon: "❌" },
          );
          setTimeout(() => {
            navigate(`/test-series/${test?.seriesId || test?.series_id || ""}`);
          }, 3000);
        }
      },
    });

    return () => {
      Telemetry.stop();
    };
  }, [attemptId, test, reviewMode, isPaused, showSubmitSummary, navigate]);

  return { tabSwitchCountRef };
}

export default useTestTelemetry;
