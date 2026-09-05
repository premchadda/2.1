/**
 * Candidate Personalized Study Roadmaps & Milestone Time Machine Service (Wave 17)
 * Generates dynamic syllabus-aligned study roadmaps with exam countdowns,
 * topic mastery velocities, and logarithmic learning curve scenario simulations (30/45/60/90 min/day).
 */

export const DEFAULT_SYLLABUS = [
  {
    subject: "Quantitative Aptitude",
    topics: [
      {
        name: "Percentage & Ratio",
        estimatedHours: 12,
        completedHours: 8,
        mastery: "proficient",
      },
      {
        name: "Time, Speed & Distance",
        estimatedHours: 14,
        completedHours: 7,
        mastery: "intermediate",
      },
      {
        name: "Profit, Loss & Discount",
        estimatedHours: 10,
        completedHours: 4,
        mastery: "intermediate",
      },
      {
        name: "Algebra & Quadratic Equations",
        estimatedHours: 16,
        completedHours: 3,
        mastery: "novice",
      },
      {
        name: "Geometry & Mensuration",
        estimatedHours: 20,
        completedHours: 2,
        mastery: "novice",
      },
    ],
  },
  {
    subject: "General Intelligence & Reasoning",
    topics: [
      {
        name: "Analogies & Classification",
        estimatedHours: 8,
        completedHours: 8,
        mastery: "master",
      },
      {
        name: "Number & Alphabet Series",
        estimatedHours: 10,
        completedHours: 9,
        mastery: "proficient",
      },
      {
        name: "Coding-Decoding",
        estimatedHours: 8,
        completedHours: 6,
        mastery: "proficient",
      },
      {
        name: "Syllogism & Venn Diagrams",
        estimatedHours: 12,
        completedHours: 4,
        mastery: "intermediate",
      },
      {
        name: "Blood Relations & Direction",
        estimatedHours: 8,
        completedHours: 3,
        mastery: "novice",
      },
    ],
  },
  {
    subject: "English Comprehension",
    topics: [
      {
        name: "Error Spotting & Grammar",
        estimatedHours: 12,
        completedHours: 10,
        mastery: "proficient",
      },
      {
        name: "Reading Comprehension",
        estimatedHours: 15,
        completedHours: 6,
        mastery: "intermediate",
      },
      {
        name: "Cloze Test & Para Jumbles",
        estimatedHours: 10,
        completedHours: 3,
        mastery: "novice",
      },
      {
        name: "Idioms, Phrases & Vocab",
        estimatedHours: 14,
        completedHours: 7,
        mastery: "intermediate",
      },
    ],
  },
  {
    subject: "General Awareness",
    topics: [
      {
        name: "Indian Polity & Constitution",
        estimatedHours: 14,
        completedHours: 8,
        mastery: "intermediate",
      },
      {
        name: "Modern Indian History",
        estimatedHours: 12,
        completedHours: 6,
        mastery: "intermediate",
      },
      {
        name: "General Science (PCB)",
        estimatedHours: 16,
        completedHours: 5,
        mastery: "novice",
      },
      {
        name: "Current Affairs & Economy",
        estimatedHours: 18,
        completedHours: 4,
        mastery: "novice",
      },
    ],
  },
];

/**
 * Calculates exam countdown and day deltas
 */
export function calculateExamCountdown(targetDate) {
  const now = new Date();
  const exam = targetDate
    ? new Date(targetDate)
    : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const diffMs = exam.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return {
    targetExamDate: exam.toISOString().slice(0, 10),
    daysRemaining,
    isUrgent: daysRemaining <= 30,
  };
}

/**
 * Generates personalized study roadmap for a candidate
 */
export async function generatePersonalizedRoadmap(userId, options = {}) {
  const examName = options.examName || "SSC CGL 2026 Tier-1";
  const { targetExamDate, daysRemaining, isUrgent } = calculateExamCountdown(
    options.targetDate,
  );

  let totalEstimatedHours = 0;
  let totalCompletedHours = 0;
  let totalTopics = 0;
  let masteredTopics = 0;

  const subjects = DEFAULT_SYLLABUS.map((subj) => {
    let subjEst = 0;
    let subjComp = 0;

    const topics = subj.topics.map((t) => {
      subjEst += t.estimatedHours;
      subjComp += t.completedHours;
      totalTopics += 1;
      if (["proficient", "master"].includes(t.mastery)) {
        masteredTopics += 1;
      }
      return { ...t };
    });

    totalEstimatedHours += subjEst;
    totalCompletedHours += subjComp;

    return {
      subject: subj.subject,
      progressPct: Math.round((subjComp / subjEst) * 100),
      estimatedHours: subjEst,
      completedHours: subjComp,
      topics,
    };
  });

  const remainingHours = Math.max(0, totalEstimatedHours - totalCompletedHours);
  const overallProgressPct = Math.round(
    (totalCompletedHours / totalEstimatedHours) * 100,
  );
  const baseAccuracy = options.baseAccuracy || 64.5;

  // Dynamic milestone generation based on days remaining
  const m1Days = Math.max(7, Math.round(daysRemaining * 0.25));
  const m2Days = Math.max(14, Math.round(daysRemaining * 0.5));
  const m3Days = Math.max(21, Math.round(daysRemaining * 0.75));
  const m4Days = daysRemaining;

  const milestones = [
    {
      id: "m1",
      title: "Foundation & Core Theory Revision",
      targetDay: m1Days,
      targetDate: new Date(Date.now() + m1Days * 86400000)
        .toISOString()
        .slice(0, 10),
      targetProgressPct: 50,
      status: overallProgressPct >= 50 ? "completed" : "in_progress",
    },
    {
      id: "m2",
      title: "Speed & Accuracy Problem Sets",
      targetDay: m2Days,
      targetDate: new Date(Date.now() + m2Days * 86400000)
        .toISOString()
        .slice(0, 10),
      targetProgressPct: 75,
      status: overallProgressPct >= 75 ? "completed" : "upcoming",
    },
    {
      id: "m3",
      title: "Weak Topic Remediation & Sectional Drills",
      targetDay: m3Days,
      targetDate: new Date(Date.now() + m3Days * 86400000)
        .toISOString()
        .slice(0, 10),
      targetProgressPct: 90,
      status: overallProgressPct >= 90 ? "completed" : "upcoming",
    },
    {
      id: "m4",
      title: "Full-Length Exam Simulation Sprint",
      targetDay: m4Days,
      targetDate: new Date(Date.now() + m4Days * 86400000)
        .toISOString()
        .slice(0, 10),
      targetProgressPct: 100,
      status: overallProgressPct >= 100 ? "completed" : "upcoming",
    },
  ];

  return {
    userId: String(userId),
    targetExam: examName,
    targetExamDate,
    daysRemaining,
    isUrgent,
    overallProgressPct,
    totalEstimatedHours,
    totalCompletedHours,
    remainingHours,
    baseAccuracy,
    totalTopics,
    masteredTopics,
    subjects,
    milestones,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Simulates milestone time machine projections for custom daily study commitments
 */
export function simulateMilestoneTimeMachine(roadmap, options = {}) {
  const dailyPlans = [30, 45, 60, 90];
  const daysRemaining = roadmap.daysRemaining || 90;
  const remainingHours = roadmap.remainingHours || 100;
  const baseAccuracy = roadmap.baseAccuracy || 65;

  const scenarios = dailyPlans.map((dailyMinutes) => {
    const hoursPerDay = dailyMinutes / 60;
    const projectedCompletionDays = Math.ceil(remainingHours / hoursPerDay);
    const totalPotentialHours = Number(
      (hoursPerDay * daysRemaining).toFixed(1),
    );

    // Logarithmic learning curve retention projection
    // Diminishing returns modeled with natural logarithm
    const studyIntensity = dailyMinutes / 30; // 1.0 to 3.0
    const logarithmicGain = Number(
      (Math.log(1 + studyIntensity * 1.5) * 7.2).toFixed(1),
    );
    const projectedAccuracy = Math.min(
      96,
      Number((baseAccuracy + logarithmicGain).toFixed(1)),
    );

    // Exam readiness index (0 - 100 scale)
    const hoursCoverageRatio = Math.min(
      1,
      totalPotentialHours / remainingHours,
    );
    const readinessScore = Math.min(
      100,
      Math.round(hoursCoverageRatio * 60 + (projectedAccuracy / 100) * 40),
    );

    const projectedSyllabusFinishDate = new Date(
      Date.now() + projectedCompletionDays * 86400000,
    )
      .toISOString()
      .slice(0, 10);

    const isFinishedBeforeExam = projectedCompletionDays <= daysRemaining;

    return {
      dailyMinutes,
      hoursPerDay,
      totalPotentialHours,
      projectedCompletionDays,
      projectedSyllabusFinishDate,
      isFinishedBeforeExam,
      logarithmicGain,
      projectedAccuracy,
      readinessScore,
      statusRecommendation: isFinishedBeforeExam
        ? readinessScore >= 85
          ? "OPTIMAL"
          : "ON_TRACK"
        : "NEEDS_MORE_DAILY_TIME",
    };
  });

  const optimalScenario =
    scenarios.find((s) => s.isFinishedBeforeExam && s.readinessScore >= 80) ||
    scenarios[scenarios.length - 1];

  return {
    targetExam: roadmap.targetExam,
    daysRemaining,
    remainingHours,
    baseAccuracy,
    scenarios,
    recommendedPlan: {
      dailyMinutes: optimalScenario.dailyMinutes,
      projectedAccuracy: optimalScenario.projectedAccuracy,
      readinessScore: optimalScenario.readinessScore,
      projectedFinishDate: optimalScenario.projectedSyllabusFinishDate,
    },
    simulatedAt: new Date().toISOString(),
  };
}
