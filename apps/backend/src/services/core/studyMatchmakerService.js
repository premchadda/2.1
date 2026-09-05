/**
 * Peer Study Group Matchmaker & 1v1 Live Quiz Arena Service
 * Pairs students based on exam targets and complementary strength profiles,
 * and manages synchronized 1v1 rapid-fire quiz duels with live scoring.
 */

/**
 * Evaluates study compatibility between two candidate profiles
 */
export function calculateMatchScore(userA = {}, userB = {}) {
  let score = 0.0;
  const matchFactors = [];

  // 1. Target Exam Alignment (40%)
  const examA = (userA.targetExam || userA.exam || "").trim().toLowerCase();
  const examB = (userB.targetExam || userB.exam || "").trim().toLowerCase();
  if (examA && examB && examA === examB) {
    score += 0.4;
    matchFactors.push("SAME_TARGET_EXAM");
  }

  // 2. Complementary Strengths (35%)
  // If User A is strong where User B is weak, they can tutor/reinforce each other
  const strongA = (userA.strongSubject || "").trim().toLowerCase();
  const weakA = (userA.weakSubject || "").trim().toLowerCase();
  const strongB = (userB.strongSubject || "").trim().toLowerCase();
  const weakB = (userB.weakSubject || "").trim().toLowerCase();

  let complementaryCount = 0;
  if (strongA && weakB && strongA === weakB) complementaryCount += 1;
  if (strongB && weakA && strongB === weakA) complementaryCount += 1;

  if (complementaryCount === 2) {
    score += 0.35;
    matchFactors.push("MUTUALLY_COMPLEMENTARY_SKILLS");
  } else if (complementaryCount === 1) {
    score += 0.2;
    matchFactors.push("COMPLEMENTARY_SKILL_PAIR");
  }

  // 3. Preferred Study Time Window (15%)
  const slotA = (userA.preferredSlot || "").trim().toLowerCase();
  const slotB = (userB.preferredSlot || "").trim().toLowerCase();
  if (slotA && slotB && slotA === slotB) {
    score += 0.15;
    matchFactors.push("SHARED_STUDY_TIME");
  }

  // 4. Target Study Ambition / Daily Goal (10%)
  const goalA = Number(userA.dailyGoalMinutes) || 60;
  const goalB = Number(userB.dailyGoalMinutes) || 60;
  const goalDiff = Math.abs(goalA - goalB);
  if (goalDiff <= 30) {
    score += 0.1;
    matchFactors.push("SIMILAR_STUDY_PACE");
  }

  return {
    compatibilityScore: Number(Math.min(1.0, score).toFixed(2)),
    matchFactors,
  };
}

/**
 * Finds best peer matches for a student from a candidate pool
 */
export function findPeerMatches(targetUser = {}, pool = [], limit = 5) {
  const matches = [];

  for (const peer of pool) {
    if (String(peer.id) === String(targetUser.id)) {
      continue;
    }

    const { compatibilityScore, matchFactors } = calculateMatchScore(
      targetUser,
      peer,
    );

    matches.push({
      peerId: peer.id,
      name: peer.name || `Learner #${peer.id}`,
      targetExam: peer.targetExam || peer.exam || "General",
      strongSubject: peer.strongSubject || "Quantitative Aptitude",
      weakSubject: peer.weakSubject || "General Awareness",
      preferredSlot: peer.preferredSlot || "Evening",
      compatibilityScore,
      matchFactors,
    });
  }

  return matches
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, limit);
}

// In-memory active duel sessions store
const activeDuels = new Map();

/**
 * Creates a new 1v1 Rapid Quiz Duel session
 */
export function createQuizDuel(initiator, opponent, options = {}) {
  if (!initiator?.id || !opponent?.id) {
    throw new Error("Both initiator and opponent are required");
  }

  const duelId = `duel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const subject = options.subject || "Quantitative Aptitude";
  const defaultQuestions = options.questions || [
    {
      id: 1,
      text: "What is 15% of 240?",
      options: ["32", "36", "40", "42"],
      correctOption: 1,
    },
    {
      id: 2,
      text: "If a car travels at 60 km/h for 2.5 hours, what distance does it cover?",
      options: ["120 km", "140 km", "150 km", "160 km"],
      correctOption: 2,
    },
    {
      id: 3,
      text: "Solve: 12 * 8 - 24 / 4",
      options: ["90", "92", "94", "96"],
      correctOption: 0,
    },
    {
      id: 4,
      text: "What is the sum of angles of a quadrilateral?",
      options: ["180°", "270°", "360°", "540°"],
      correctOption: 2,
    },
    {
      id: 5,
      text: "If x + 5 = 12, what is the value of 2x - 3?",
      options: ["10", "11", "12", "14"],
      correctOption: 1,
    },
  ];

  const duel = {
    duelId,
    subject,
    status: "active",
    totalQuestions: defaultQuestions.length,
    questions: defaultQuestions,
    startedAt: new Date().toISOString(),
    participants: {
      [String(initiator.id)]: {
        userId: initiator.id,
        name: initiator.name || "Player 1",
        score: 0,
        correctCount: 0,
        answers: [],
        completed: false,
      },
      [String(opponent.id)]: {
        userId: opponent.id,
        name: opponent.name || "Player 2",
        score: 0,
        correctCount: 0,
        answers: [],
        completed: false,
      },
    },
    winnerId: null,
    isTie: false,
  };

  activeDuels.set(duelId, duel);
  return duel;
}

/**
 * Submits an answer for a question in an active duel
 */
export function submitDuelAnswer(
  duelId,
  userId,
  { questionIndex, selectedOption, responseTimeMs = 5000 },
) {
  const duel = activeDuels.get(String(duelId));
  if (!duel) {
    throw new Error("Duel not found");
  }

  if (duel.status !== "active") {
    throw new Error(`Duel is already ${duel.status}`);
  }

  const participant = duel.participants[String(userId)];
  if (!participant) {
    throw new Error("User is not a participant in this duel");
  }

  const question = duel.questions[questionIndex];
  if (!question) {
    throw new Error("Invalid questionIndex");
  }

  const isCorrect = selectedOption === question.correctOption;

  // Points: +10 base points if correct + speed bonus (up to 10 points)
  let earnedPoints = 0;
  if (isCorrect) {
    const speedBonus = Math.max(0, 10 - Math.floor(responseTimeMs / 3000));
    earnedPoints = 10 + speedBonus;
    participant.correctCount += 1;
  }

  participant.score += earnedPoints;
  participant.answers.push({
    questionIndex,
    selectedOption,
    isCorrect,
    earnedPoints,
    responseTimeMs,
    submittedAt: new Date().toISOString(),
  });

  if (participant.answers.length >= duel.totalQuestions) {
    participant.completed = true;
  }

  // Check if both participants finished
  const allParticipants = Object.values(duel.participants);
  const bothCompleted = allParticipants.every((p) => p.completed);

  if (bothCompleted) {
    duel.status = "completed";
    const [p1, p2] = allParticipants;
    if (p1.score > p2.score) {
      duel.winnerId = p1.userId;
      duel.isTie = false;
    } else if (p2.score > p1.score) {
      duel.winnerId = p2.userId;
      duel.isTie = false;
    } else {
      duel.winnerId = null;
      duel.isTie = true;
    }
  }

  return {
    duelId: duel.duelId,
    status: duel.status,
    questionIndex,
    isCorrect,
    earnedPoints,
    participantScore: participant.score,
    isCompleted: participant.completed,
    winnerId: duel.winnerId,
    isTie: duel.isTie,
  };
}

/**
 * Retrieves duel status and scores
 */
export function getDuelStatus(duelId) {
  const duel = activeDuels.get(String(duelId));
  if (!duel) {
    throw new Error("Duel not found");
  }
  return duel;
}

/**
 * Resets active duel cache (for tests)
 */
export function clearDuelStore() {
  activeDuels.clear();
}
