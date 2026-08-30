import { useEffect } from "react";
import {
  apiClient,
  isCancel,
  getTestById,
  getQuestionsByTestId,
} from "../../../shared/lib/dataService";
import { readLocalAnswers, clearLocalAnswers } from "./useAnswerPersistence";

export function useTestData({
  testId,
  seriesId,
  navigate,
  location,
  reviewMode,
  reviewResultData,
  setTest,
  setQuestions,
  setLoading,
  setIsError,
  setErrorMessage,
  setCurrentSection,
  setVisitedQuestions,
  setAnswers,
  setMarkedForReview,
  setTimeLeft,
  setAttemptId,
  setSectionTimers,
  questions,
  test,
  user,
}) {
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        if (reviewMode) {
          let rawResultData = reviewResultData;
          if (!rawResultData?.questions?.length) {
            const attemptId = location.state?.attemptId;
            const endpoint = attemptId
              ? `/api/tests/${testId}/result/${attemptId}`
              : `/api/tests/${testId}/result`;
            const response = await apiClient.get(endpoint, {
              signal: controller.signal,
            });
            rawResultData = response.data?.data || response.data;
          }
          if (rawResultData?.questions?.length) {
            const normalizedQuestions = rawResultData.questions.map(
              (q, index) => {
                const rawSection = q.section || q.subject || "General";
                return {
                  ...q,
                  id: q.id || q._id || q.questionId || index,
                  _id: q._id || q.id || q.questionId || index,
                  text:
                    typeof q.text === "object"
                      ? q.text
                      : { en: q.text || q.questionText || q.question || "" },
                  options: Array.isArray(q.options)
                    ? { en: q.options }
                    : q.options || { en: [] },
                  section: rawSection,
                  subject: q.subject || rawSection,
                  correctOption:
                    q.correctOption ?? q.correctAnswer ?? q.correct,
                  explanation:
                    typeof q.explanation === "object"
                      ? q.explanation
                      : {
                          en: q.explanation || "",
                          hi: q.explanationHi || q.explanation_hi || null,
                        },
                  userAnswer:
                    q.userAnswer ??
                    q.selectedOption ??
                    q.user_answer ??
                    q.userChoice,
                };
              },
            );
            setTest({
              id: testId,
              _id: testId,
              title: rawResultData.testTitle || "Test Review",
              duration: Math.ceil(
                (rawResultData.timeSpent || rawResultData.timeTaken || 0) / 60,
              ),
            });
            // Keep review order aligned with live test section order
            const standardOrderMap = {
              reasoning: 1,
              "general intelligence & reasoning": 1,
              "general intelligence and reasoning": 1,
              "general intelligence": 1,
              "logical reasoning": 1,
              "general awareness": 2,
              "general knowledge": 2,
              gk: 2,
              "current affairs": 2,
              "quantitative aptitude": 3,
              mathematics: 3,
              math: 3,
              maths: 3,
              arithmetic: 3,
              "english language": 4,
              "english comprehension": 4,
              english: 4,
            };
            const getSecOrder = (name) => {
              const key = (name || "").toLowerCase().trim();
              return standardOrderMap[key] ?? 99;
            };
            const orderedReview = [...normalizedQuestions].sort(
              (a, b) => getSecOrder(a.section) - getSecOrder(b.section),
            );
            setQuestions(orderedReview);
            setCurrentSection(orderedReview[0]?.section || "General");
            setVisitedQuestions(
              new Set(orderedReview.map((_, index) => index)),
            );
            setAnswers(
              orderedReview.reduce((acc, question, index) => {
                if (
                  question.userAnswer !== undefined &&
                  question.userAnswer !== null
                )
                  acc[index] = question.userAnswer;
                return acc;
              }, {}),
            );
            setMarkedForReview(
              new Set(
                orderedReview.reduce((acc, question, index) => {
                  if (question.isMarked) acc.push(index);
                  return acc;
                }, []),
              ),
            );
            setTimeLeft(0);
            return;
          }
        }

        const testData = await getTestById(testId);
        if (testData) {
          const sectionTimeLimits = {};
          if (testData.sections && Array.isArray(testData.sections)) {
            testData.sections.forEach((s) => {
              if (s.duration > 0) {
                const name = s.name || s.subject || "General";
                sectionTimeLimits[name] = s.duration * 60;
              }
            });
          }
          testData.sectionTimeLimits = sectionTimeLimits;
          setTest(testData);
          setTimeLeft((testData.duration || 60) * 60);
          const questionsData = await getQuestionsByTestId(
            testData._id || testId,
          );
          let finalQuestions = Array.isArray(questionsData)
            ? questionsData
            : [];
          const testSections =
            Array.isArray(testData?.sections) && testData.sections.length > 0
              ? testData.sections
              : typeof testData?.testSections === "string" &&
                  testData.testSections.trim()
                ? testData.testSections
                    .split(",")
                    .map((s) => ({ name: s.trim() }))
                : testData?.totalQuestions === 100 ||
                    finalQuestions.length === 100
                  ? [
                      {
                        name: "General Intelligence & Reasoning",
                        questionCount: 25,
                      },
                      { name: "General Awareness", questionCount: 25 },
                      { name: "Quantitative Aptitude", questionCount: 25 },
                      { name: "English Comprehension", questionCount: 25 },
                    ]
                  : null;
          const hasExplicitSections = finalQuestions.some(
            (q) =>
              q.section && q.section !== "General" && q.section !== "Full Test",
          );
          if (
            !hasExplicitSections &&
            testSections &&
            testSections.length > 1 &&
            finalQuestions.length > 0
          ) {
            const totalQ = finalQuestions.length;
            const qPerSec = Math.floor(totalQ / testSections.length);
            finalQuestions = finalQuestions.map((q, idx) => {
              let accumulated = 0;
              let assignedSection =
                testSections[testSections.length - 1]?.name ||
                (typeof testSections[testSections.length - 1] === "string"
                  ? testSections[testSections.length - 1]
                  : "General");
              for (let sIdx = 0; sIdx < testSections.length; sIdx++) {
                const secCount =
                  testSections[sIdx]?.questionCount ||
                  (sIdx === testSections.length - 1
                    ? totalQ - qPerSec * (testSections.length - 1)
                    : qPerSec);
                if (idx < accumulated + secCount) {
                  assignedSection =
                    testSections[sIdx]?.name ||
                    (typeof testSections[sIdx] === "string"
                      ? testSections[sIdx]
                      : "General");
                  break;
                }
                accumulated += secCount;
              }
              return {
                ...q,
                section: assignedSection,
                subject: q.subject || assignedSection,
              };
            });
          } else {
            finalQuestions = finalQuestions.map((q) => {
              const rawSection = q.section || q.subject || "General";
              return {
                ...q,
                section: rawSection,
                subject: q.subject || rawSection,
              };
            });
          }
          const standardOrderMap = {
            reasoning: 1,
            "general intelligence & reasoning": 1,
            "general intelligence and reasoning": 1,
            "general intelligence": 1,
            "logical reasoning": 1,
            "general awareness": 2,
            "general knowledge": 2,
            gk: 2,
            "current affairs": 2,
            "quantitative aptitude": 3,
            mathematics: 3,
            math: 3,
            maths: 3,
            arithmetic: 3,
            "english language": 4,
            "english comprehension": 4,
            english: 4,
          };

          const configuredOrderMap = {};
          if (
            Array.isArray(testData?.sections) &&
            testData.sections.length > 0
          ) {
            testData.sections.forEach((s, idx) => {
              const name =
                s.name ||
                s.title ||
                s.subject ||
                (typeof s === "string" ? s : "");
              if (name) {
                const order =
                  s.display_order ?? s.displayOrder ?? s.order ?? idx + 1;
                configuredOrderMap[name.toLowerCase().trim()] = Number(order);
              }
            });
          }

          const getSecOrder = (name) => {
            const key = (name || "").toLowerCase().trim();
            return configuredOrderMap[key] ?? standardOrderMap[key] ?? 99;
          };
          finalQuestions.sort(
            (a, b) => getSecOrder(a.section) - getSecOrder(b.section),
          );
          setQuestions(finalQuestions);
          if (finalQuestions.length > 0)
            setCurrentSection(finalQuestions[0].section);
          const isReattempt = Boolean(
            location.state?.isReattempt ||
            new URLSearchParams(location.search).get("attempt"),
          );
          if (isReattempt) clearLocalAnswers(testId);
          const attemptResponse = await apiClient.post(
            `/api/tests/${testData._id || testData.id || testId}/start`,
            { isReattempt },
            { signal: controller.signal },
          );
          const attemptData = attemptResponse.data?.data;
          if (attemptData?.attemptId) {
            setAttemptId(attemptData.attemptId);
            if (!isReattempt) {
              if (attemptData.timeSpent > 0)
                setTimeLeft(
                  Math.max(
                    1,
                    (testData.duration || 60) * 60 - attemptData.timeSpent,
                  ),
                );
              if (attemptData.answers && attemptData.answers.length > 0) {
                const restoredAnswers = {};
                const visited = new Set([0]);
                attemptData.answers.forEach((a) => {
                  restoredAnswers[a.questionIndex] = a.selectedOption;
                  visited.add(a.questionIndex);
                });
                setAnswers(restoredAnswers);
                setVisitedQuestions(visited);
              }
              if (
                attemptData.markedForReview &&
                attemptData.markedForReview.length > 0
              )
                setMarkedForReview(new Set(attemptData.markedForReview));
              if (attemptData.currentSection)
                setCurrentSection(attemptData.currentSection);
              const localBuffer = readLocalAnswers(testId);
              if (localBuffer) {
                const serverHasAnswers =
                  attemptData.answers && attemptData.answers.length > 0;
                const serverHasReview =
                  attemptData.markedForReview &&
                  attemptData.markedForReview.length > 0;
                const serverSavedAt =
                  attemptData.savedAt ||
                  attemptData.updatedAt ||
                  attemptData.lastSavedAt ||
                  null;
                const localSavedAt = localBuffer.savedAt || null;
                let localIsNewer;
                if (serverSavedAt !== null && localSavedAt !== null)
                  localIsNewer = localSavedAt >= serverSavedAt;
                else localIsNewer = !serverHasAnswers && localSavedAt !== null;
                if (
                  localBuffer.answers &&
                  Object.keys(localBuffer.answers).length > 0 &&
                  (!serverHasAnswers || localIsNewer)
                ) {
                  const restoredAnswers = {};
                  const visited = new Set([0]);
                  Object.entries(localBuffer.answers).forEach(
                    ([idx, selectedOption]) => {
                      restoredAnswers[idx] = selectedOption;
                      visited.add(Number(idx));
                    },
                  );
                  setAnswers(restoredAnswers);
                  setVisitedQuestions(visited);
                }
                if (
                  Array.isArray(localBuffer.markedForReview) &&
                  localBuffer.markedForReview.length > 0 &&
                  (!serverHasReview || localIsNewer)
                )
                  setMarkedForReview(new Set(localBuffer.markedForReview));
                if (
                  localBuffer.currentSection &&
                  (!attemptData.currentSection || localIsNewer)
                )
                  setCurrentSection(localBuffer.currentSection);
              }
            }
            if (
              attemptData.sectionTimers &&
              typeof attemptData.sectionTimers === "object"
            )
              setSectionTimers(attemptData.sectionTimers);
          }
        }
      } catch (error) {
        if (isCancel(error)) return;
        const status = error?.status ?? error?.response?.status;
        const data = error?.details ?? error?.response?.data;
        if (
          !(status === 401 || (status === 403 && data?.requiresAuth)) &&
          !(status === 403)
        ) {
          setIsError(true);
          setErrorMessage(
            data?.message || error?.message || "Failed to load test data",
          );
        }
        if (status === 401 || (status === 403 && data?.requiresAuth)) {
          navigate("/login", {
            state: {
              from: `/${seriesId}/tests/${testId}`,
              message: data?.message || "Please login to access this test",
            },
          });
          return;
        }
        if (status === 403) {
          const msg = (data?.message || error?.message || "").toLowerCase();
          const isProRequired = Boolean(
            data?.requiresPro ||
            msg.includes("pro pass") ||
            msg.includes("pro required") ||
            msg.includes("upgrade to continue"),
          );
          if (isProRequired) {
            navigate("/pass");
          } else if (data?.limitReached) {
            navigate("/pass");
          } else if (
            data?.code === "LIVE_TEST_NOT_STARTED" ||
            data?.code === "LIVE_TEST_EXPIRED"
          ) {
            setIsError(true);
            setErrorMessage(data.message);
          } else if (!user) {
            navigate("/login", {
              state: {
                from: `/${seriesId}/tests/${testId}`,
                message: data?.message || "Please login to access this test",
              },
            });
          } else {
            setIsError(true);
            setErrorMessage(data?.message || "Access denied for this test");
          }
          return;
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [
    testId,
    seriesId,
    navigate,
    reviewMode,
    reviewResultData,
    setTest,
    setQuestions,
    setLoading,
    setIsError,
    setErrorMessage,
    setCurrentSection,
    setVisitedQuestions,
    setAnswers,
    setMarkedForReview,
    setTimeLeft,
    setAttemptId,
    setSectionTimers,
    user,
    location,
  ]);
}

export default useTestData;
