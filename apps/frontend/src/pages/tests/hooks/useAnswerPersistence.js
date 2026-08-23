import { useEffect, useRef } from "react";
import { apiClient } from "../../../shared/lib/api";
import { API_BASE_URL } from "../../../shared/lib/apiBase.js";

const ANSWERS_KEY = (id) => `trstprep_answers_${id}`;
const OFFLINE_BUFFER_TTL_MS = 24 * 60 * 60 * 1000;

export const persistLocalAnswers = (id, payload) => {
  try {
    const record = { ...payload, savedAt: Date.now() };
    localStorage.setItem(ANSWERS_KEY(id), JSON.stringify(record));
  } catch (e) {
    const isQuota = e?.name === "QuotaExceededError" || e?.code === 22;
    if (isQuota) {
      try {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("trstprep_answers_") && k !== ANSWERS_KEY(id)) {
            try {
              const v = JSON.parse(localStorage.getItem(k) || "{}");
              if (v.savedAt && v.savedAt < oldestTime) {
                oldestTime = v.savedAt;
                oldestKey = k;
              }
            } catch {}
          }
        }
        if (oldestKey) localStorage.removeItem(oldestKey);
        try {
          localStorage.setItem(
            ANSWERS_KEY(id),
            JSON.stringify({ ...payload, savedAt: Date.now() }),
          );
        } catch {}
      } catch {}
    }
  }
};

export const readLocalAnswers = (id) => {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.savedAt &&
      Date.now() - parsed.savedAt > OFFLINE_BUFFER_TTL_MS
    ) {
      try {
        localStorage.removeItem(ANSWERS_KEY(id));
      } catch {}
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearLocalAnswers = (id) => {
  try {
    localStorage.removeItem(ANSWERS_KEY(id));
  } catch {}
};

export function useAnswerPersistence({
  testId,
  test,
  questions,
  answers,
  markedForReview,
  currentSection,
  timeLeft,
  attemptId,
  reviewMode,
  loading,
  isPaused,
  isSubmitting,
  computeSectionTimers,
}) {
  const autosaveStateRef = useRef({});

  useEffect(() => {
    autosaveStateRef.current = {
      answers,
      markedForReview,
      timeLeft,
      test,
      questions,
      testId,
      attemptId,
      computeSectionTimers,
      currentSection,
    };
  });

  useEffect(() => {
    if (
      reviewMode ||
      !attemptId ||
      isSubmitting ||
      timeLeft <= 0 ||
      loading ||
      isPaused
    )
      return;

    const autosave = async () => {
      try {
        const s = autosaveStateRef.current;
        const currentAnswers = s.questions
          .map((question, index) => {
            const selectedOption = s.answers[index];
            if (selectedOption === undefined || selectedOption === null)
              return null;
            return {
              questionId: question.id || question._id,
              questionIndex: index,
              selectedOption,
            };
          })
          .filter(Boolean);

        const localAnswersMap = {};
        Object.entries(s.answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null)
            localAnswersMap[idx] = selectedOption;
        });
        persistLocalAnswers(s.testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(s.markedForReview),
          currentSection: s.currentSection,
        });

        let actualTestId = s.test?.id || s.test?._id || s.testId;
        if (typeof actualTestId === "string" && actualTestId.includes("-")) {
          if (typeof s.test?.id === "number") actualTestId = s.test.id;
          else if (typeof s.test?._id === "number") actualTestId = s.test._id;
        }

        await apiClient.put(`/api/tests/${actualTestId}/autosave`, {
          attemptId: s.attemptId,
          timeSpent: (s.test?.duration || 60) * 60 - s.timeLeft,
          answers: currentAnswers,
          markedForReview: Array.from(s.markedForReview),
          sectionTimers: s.computeSectionTimers(),
          currentSection: s.currentSection,
        });
      } catch {}
    };

    const interval = setInterval(autosave, 30000);
    const handleOnline = () => {
      autosave();
    };
    window.addEventListener("online", handleOnline);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") autosave();
    };
    window.addEventListener("visibilitychange", handleVisibility);
    const handleBeforeUnload = () => {
      try {
        const s = autosaveStateRef.current;
        const localAnswersMap = {};
        Object.entries(s.answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null)
            localAnswersMap[idx] = selectedOption;
        });
        persistLocalAnswers(s.testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(s.markedForReview),
          currentSection: s.currentSection,
        });
        let actualTestId = s.test?.id || s.test?._id || s.testId;
        if (typeof actualTestId === "string" && actualTestId.includes("-")) {
          if (typeof s.test?.id === "number") actualTestId = s.test.id;
          else if (typeof s.test?._id === "number") actualTestId = s.test._id;
        }
        const unloadAnswers = s.questions
          .map((question, index) => {
            const selectedOption = s.answers[index];
            if (selectedOption === undefined || selectedOption === null)
              return null;
            return {
              questionId: question.id || question._id,
              questionIndex: index,
              selectedOption,
            };
          })
          .filter(Boolean);
        const payload = {
          attemptId: s.attemptId,
          timeSpent: (s.test?.duration || 60) * 60 - s.timeLeft,
          answers: unloadAnswers,
          markedForReview: Array.from(s.markedForReview),
          sectionTimers: s.computeSectionTimers(),
          currentSection: s.currentSection,
        };
        const autosaveEndpoint = `${API_BASE_URL || ""}/api/tests/${actualTestId}/autosave`;
        fetch(autosaveEndpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [reviewMode, attemptId, isSubmitting, timeLeft <= 0, loading, isPaused]);

  useEffect(() => {
    if (reviewMode || !testId) return;
    const t = setTimeout(() => {
      try {
        const localAnswersMap = {};
        Object.entries(answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null)
            localAnswersMap[idx] = selectedOption;
        });
        persistLocalAnswers(testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(markedForReview),
          currentSection,
        });
      } catch {}
    }, 1000);
    return () => clearTimeout(t);
  }, [answers, markedForReview, currentSection, testId, reviewMode]);
}

export default useAnswerPersistence;
