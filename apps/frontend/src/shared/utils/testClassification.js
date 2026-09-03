/**
 * Shared test classification utilities — single source of truth for
 * determining test type (live, quiz, upcoming, expired) and extracting
 * date fields. All pages must import from here instead of re-implementing
 * the logic inline (was causing 5+ different isLive definitions).
 *
 * Canonical field priority: camelCase first, then snake_case, then aliases.
 */

export const checkIsLive = (test) => {
  if (!test) return false;
  return (
    test.isLive === true ||
    test.is_live === true ||
    test.type === "live" ||
    test.type === "live-tests" ||
    test.test_type === "live" ||
    test.test_type === "live-tests" ||
    test.testType === "live" ||
    test.testType === "live-tests" ||
    test.testCategoryId === 20 ||
    test.test_category_id === 20 ||
    String(test.test_category_id) === "20" ||
    String(test.testCategoryId) === "20" ||
    test.category === "live-tests" ||
    String(test.subCategory || test.sub_category || "")
      .toLowerCase()
      .includes("live") ||
    (Array.isArray(test.tags) &&
      test.tags.some((t) => {
        const tag = String(t).toLowerCase();
        return tag === "live" || tag === "live-tests";
      }))
  );
};

export const checkIsQuiz = (test) => {
  if (!test) return false;
  if (
    test.itemType === "quiz" ||
    test.item_type === "quiz" ||
    test.isQuiz === true ||
    test.is_quiz === true
  )
    return true;
  const type = String(
    test.type || test.test_type || test.testType || "",
  ).toLowerCase();
  const category = String(test.category || "").toLowerCase();
  const subCategory = String(
    test.subCategory || test.sub_category || "",
  ).toLowerCase();
  const tags = Array.isArray(test.tags)
    ? test.tags.map((t) => String(t).toLowerCase())
    : [];
  return (
    ["quiz", "quizzes", "live-quiz", "live-quizzes"].includes(type) ||
    category.includes("quiz") ||
    subCategory.includes("quiz") ||
    [
      "quiz",
      "quizzes",
      "live-quiz",
      "live-quizzes",
      "daily-quiz",
      "speed-quiz",
    ].some((t) => tags.includes(t))
  );
};

export const checkIsPermanentTest = (test) => {
  if (!test || checkIsLive(test) || checkIsQuiz(test)) return false;
  const type = String(
    test.type || test.test_type || test.testType || "",
  ).toLowerCase();
  const cat = String(test.category || "").toLowerCase();
  if (
    ["live-tests", "live", "quiz", "live-quiz", "live-quizzes"].includes(
      type,
    ) ||
    ["live-tests", "live", "quiz"].includes(cat)
  )
    return false;
  if (
    [20, "20"].includes(test.testCategoryId) ||
    [20, "20"].includes(test.test_category_id)
  )
    return false;
  return true;
};

export const checkIsUpcoming = (test) => {
  if (!test) return false;
  const dateVal = getTestStartDate(test);
  if (!dateVal) return false;
  const d = new Date(dateVal);
  return !isNaN(d.getTime()) && d > new Date();
};

export const checkIsLiveExpired = (test) => {
  if (!test) return false;
  if (test.status === "expired") return true;
  const endDate = getTestEndDate(test);
  if (!endDate) return false;
  const d = new Date(endDate);
  return !isNaN(d.getTime()) && d < new Date();
};

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const getEffectiveTestEndDate = (test) => {
  const endDate = getTestEndDate(test);
  if (endDate) {
    const d = new Date(endDate);
    if (!isNaN(d.getTime())) return d;
  }
  const startDate = getTestStartDate(test);
  if (startDate) {
    const s = new Date(startDate);
    if (!isNaN(s.getTime())) {
      const durationMins = Number(
        test.duration || test.durationMinutes || test.duration_minutes || 60,
      );
      return new Date(s.getTime() + durationMins * 60000);
    }
  }
  return null;
};

export const checkIsPostLiveWindow = (test) => {
  if (!test) return false;
  const isLiveItem =
    checkIsLive(test) ||
    checkIsQuiz(test) ||
    test.type === "live-tests" ||
    test.test_category_id === 20 ||
    test.testCategoryId === 20;
  if (!isLiveItem) return false;
  const end = getEffectiveTestEndDate(test);
  if (!end) return false;
  const now = new Date();
  return now > end && now <= new Date(end.getTime() + SEVEN_DAYS_MS);
};

export const checkIsArchivedLive = (test) => {
  if (!test) return false;
  const isLiveItem =
    checkIsLive(test) ||
    checkIsQuiz(test) ||
    test.type === "live-tests" ||
    test.test_category_id === 20 ||
    test.testCategoryId === 20;
  if (!isLiveItem) return false;
  const end = getEffectiveTestEndDate(test);
  if (!end) return false;
  return new Date() > new Date(end.getTime() + SEVEN_DAYS_MS);
};

export const checkIsSolutionExpired = (test) => checkIsArchivedLive(test);

export const checkShouldShowInLiveOrSeriesListing = (test) => {
  if (!test) return true;
  const isLiveItem =
    checkIsLive(test) ||
    checkIsQuiz(test) ||
    test.type === "live-tests" ||
    test.test_category_id === 20 ||
    test.testCategoryId === 20;
  return !isLiveItem || !checkIsArchivedLive(test);
};

export const checkIsLiveOngoing = (test) => {
  if (!test || !checkIsLive(test)) return false;
  if (checkIsLiveExpired(test) || checkIsUpcoming(test)) return false;
  return true;
};

export const checkIsComingSoon = (test) => {
  if (!test || checkIsLive(test) || checkIsUpcoming(test)) return false;
  const isComingSoon = test.isComingSoon || test.is_coming_soon;
  if (!isComingSoon) return false;
  const releaseDate = test.comingSoonDate || test.coming_soon_date;
  if (!releaseDate) return true;
  return new Date(releaseDate) > new Date();
};

export const getTestStartDate = (test) => {
  if (!test) return null;
  return (
    test.scheduledAt ||
    test.scheduled_at ||
    test.liveSchedule ||
    test.live_schedule ||
    test.startTime ||
    test.start_time ||
    test.dateStart ||
    test.date_start ||
    test.publishedAt ||
    test.published_at ||
    test.createdAt ||
    test.created_at ||
    null
  );
};

export const getTestEndDate = (test) => {
  if (!test) return null;
  return (
    test.endTime ||
    test.end_time ||
    test.scheduledEnd ||
    test.scheduled_end ||
    test.dateEnd ||
    test.date_end ||
    test.expiredAt ||
    test.expired_at ||
    test.availability?.scheduledEnd ||
    test.availability?.availableTill ||
    null
  );
};

export const formatDateRange = (startDate, endDate, durationMins = 60) => {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;
  let end = endDate ? new Date(endDate) : null;
  if (!end || isNaN(end.getTime()))
    end = new Date(start.getTime() + Number(durationMins || 60) * 60000);
  const fmt = (d) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return new Date() >= start
    ? `Till: ${fmt(end)}`
    : `From: ${fmt(start)} To: ${fmt(end)}`;
};

export const getTimeUntil = (dateStr) => {
  if (!dateStr) return "";
  const diff = new Date(dateStr) - new Date();
  if (diff <= 0) return "Live Now!";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const getTestId = (test) =>
  String(
    test?.public_id_uuid ||
      test?.public_id ||
      test?.uuid ||
      test?.id ||
      test?._id ||
      test?.slug ||
      "",
  );

export const standardSectionOrderMap = {
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

export const normalizeTestQuestions = (rawQuestions, testData) => {
  let finalQuestions = Array.isArray(rawQuestions) ? [...rawQuestions] : [];
  if (finalQuestions.length === 0) return [];

  const testSections =
    Array.isArray(testData?.sections) && testData.sections.length > 0
      ? testData.sections
      : typeof testData?.testSections === "string" &&
          testData.testSections.trim()
        ? testData.testSections.split(",").map((s) => ({ name: s.trim() }))
        : testData?.totalQuestions === 100 || finalQuestions.length === 100
          ? [
              { name: "General Intelligence & Reasoning", questionCount: 25 },
              { name: "General Awareness", questionCount: 25 },
              { name: "Quantitative Aptitude", questionCount: 25 },
              { name: "English Comprehension", questionCount: 25 },
            ]
          : null;

  const hasExplicitSections = finalQuestions.some(
    (q) => q.section && q.section !== "General" && q.section !== "Full Test",
  );

  if (!hasExplicitSections && testSections && testSections.length > 1) {
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
      return { ...q, section: rawSection, subject: q.subject || rawSection };
    });
  }

  const configuredOrder = new Map();
  (testSections || []).forEach((section, index) => {
    const name = typeof section === "string" ? section : section?.name;
    if (name) configuredOrder.set(String(name).toLowerCase().trim(), index);
  });

  const getSecOrder = (name) => {
    const key = (name || "").toLowerCase().trim();
    return configuredOrder.has(key)
      ? configuredOrder.get(key)
      : (standardSectionOrderMap[key] ?? 99);
  };

  finalQuestions.sort((a, b) => {
    const orderDiff = getSecOrder(a.section) - getSecOrder(b.section);
    if (orderDiff !== 0) return orderDiff;
    const numA = Number(
      a.questionNumber ??
        a.question_number ??
        a.orderIndex ??
        a.order_index ??
        0,
    );
    const numB = Number(
      b.questionNumber ??
        b.question_number ??
        b.orderIndex ??
        b.order_index ??
        0,
    );
    if (numA !== 0 && numB !== 0 && numA !== numB) return numA - numB;
    return 0;
  });

  return finalQuestions;
};
