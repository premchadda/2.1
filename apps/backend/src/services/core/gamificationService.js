/**
 * Gamification, Study Streaks & Milestone Badges Engine
 * Computes XP points, user levels, streak freeze protection,
 * and automated milestone badge unlock triggers.
 */

export const BADGE_DEFINITIONS = [
  {
    id: "first-steps",
    title: "First Steps",
    description: "Complete your first test attempt",
    icon: "🎯",
    xpReward: 50,
    check: (stats) => (stats.testsCompleted || 0) >= 1,
  },
  {
    id: "dedicated-learner",
    title: "Dedicated Learner",
    description: "Complete 10 test attempts",
    icon: "📚",
    xpReward: 150,
    check: (stats) => (stats.testsCompleted || 0) >= 10,
  },
  {
    id: "test-champion",
    title: "Test Champion",
    description: "Complete 50 test attempts",
    icon: "🏆",
    xpReward: 500,
    check: (stats) => (stats.testsCompleted || 0) >= 50,
  },
  {
    id: "century-club",
    title: "Century Club",
    description: "Complete 100 test attempts",
    icon: "💯",
    xpReward: 1000,
    check: (stats) => (stats.testsCompleted || 0) >= 100,
  },
  {
    id: "week-warrior",
    title: "Week Warrior",
    description: "Maintain a 7-day study streak",
    icon: "🔥",
    xpReward: 200,
    check: (stats) => (stats.streakDays || 0) >= 7,
  },
  {
    id: "monthly-master",
    title: "Monthly Master",
    description: "Maintain a 30-day study streak",
    icon: "💪",
    xpReward: 1000,
    check: (stats) => (stats.streakDays || 0) >= 30,
  },
  {
    id: "precision-master",
    title: "Precision Master",
    description: "Achieve 90% or higher accuracy on a test",
    icon: "🎯",
    xpReward: 100,
    check: (stats) => (stats.accuracy || 0) >= 90,
  },
  {
    id: "perfect-score",
    title: "Perfect Score",
    description: "Achieve 100% accuracy on a test",
    icon: "⭐",
    xpReward: 250,
    check: (stats) => (stats.accuracy || 0) >= 100,
  },
  {
    id: "speed-demon",
    title: "Speed Demon",
    description: "Complete a test with 2+ minutes remaining",
    icon: "⚡",
    xpReward: 120,
    check: (stats) => (stats.timeRemainingSeconds || 0) >= 120,
  },
  {
    id: "night-owl",
    title: "Night Owl",
    description: "Complete a test late at night (10 PM to 6 AM)",
    icon: "🦉",
    xpReward: 75,
    check: (stats) => {
      const hour =
        typeof stats.hourOfDay === "number"
          ? stats.hourOfDay
          : new Date().getHours();
      return hour >= 22 || hour < 6;
    },
  },
  {
    id: "early-bird",
    title: "Early Bird",
    description: "Complete a test in the early morning (before 8 AM)",
    icon: "🐦",
    xpReward: 75,
    check: (stats) => {
      const hour =
        typeof stats.hourOfDay === "number"
          ? stats.hourOfDay
          : new Date().getHours();
      return hour >= 5 && hour < 8;
    },
  },
  {
    id: "quant-wizard",
    title: "Quant Wizard",
    description: "Complete 20 Quantitative Aptitude tests",
    icon: "🔢",
    xpReward: 300,
    check: (stats) => (stats.quantTestsCompleted || 0) >= 20,
  },
  {
    id: "reasoning-expert",
    title: "Reasoning Expert",
    description: "Complete 20 Reasoning tests",
    icon: "🧩",
    xpReward: 300,
    check: (stats) => (stats.reasoningTestsCompleted || 0) >= 20,
  },
];

/**
 * Calculates XP earned from a test attempt
 */
export function calculateAttemptXP({
  score = 0,
  accuracy = 0,
  speedSeconds = 60,
  isFirstAttemptToday = false,
  isLiveMock = false,
} = {}) {
  let xp = 0;

  // Base XP: 2 XP per positive mark scored
  if (score > 0) {
    xp += Math.round(score * 2);
  }

  // Accuracy bonus
  if (accuracy >= 100) {
    xp += 100;
  } else if (accuracy >= 90) {
    xp += 50;
  } else if (accuracy >= 75) {
    xp += 25;
  }

  // Speed bonus (fast and deliberate solving)
  if (speedSeconds > 0 && speedSeconds <= 45 && accuracy >= 70) {
    xp += 30;
  } else if (speedSeconds > 0 && speedSeconds <= 60 && accuracy >= 60) {
    xp += 15;
  }

  // Daily first test bonus
  if (isFirstAttemptToday) {
    xp += 50;
  }

  // Live mock competition bonus
  if (isLiveMock) {
    xp += 75;
  }

  return Math.max(10, xp);
}

/**
 * Calculates candidate level from total accumulated XP
 */
export function calculateUserLevel(totalXp = 0) {
  const safeXp = Math.max(0, Number(totalXp) || 0);

  // Level formula: level = floor(1 + sqrt(xp / 100))
  // Level 1: 0 - 99 XP
  // Level 2: 100 - 399 XP
  // Level 3: 400 - 899 XP
  // Level 4: 900 - 1599 XP
  const level = Math.floor(1 + Math.sqrt(safeXp / 100));

  const currentLevelBaseXp = Math.pow(level - 1, 2) * 100;
  const nextLevelTargetXp = Math.pow(level, 2) * 100;

  const xpInCurrentLevel = safeXp - currentLevelBaseXp;
  const xpNeededForNextLevel = nextLevelTargetXp - safeXp;
  const levelSpan = nextLevelTargetXp - currentLevelBaseXp;

  const progressPercent =
    levelSpan > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((xpInCurrentLevel / levelSpan) * 100)),
        )
      : 100;

  return {
    level,
    totalXp: safeXp,
    currentLevelBaseXp,
    nextLevelTargetXp,
    xpNeededForNextLevel: Math.max(0, xpNeededForNextLevel),
    progressPercent,
  };
}

// In-memory freeze state tracking per user (userId -> { month, usedCount })
const freezeStateStore = new Map();

/**
 * Gets streak freeze availability for the current month
 */
export function getStreakFreezeStatus(userId, isProUser = false) {
  const currentMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  let record = freezeStateStore.get(String(userId));

  // Initialize or reset if new month
  if (!record || record.month !== currentMonthKey) {
    record = { month: currentMonthKey, usedCount: 0 };
    freezeStateStore.set(String(userId), record);
  }

  const maxFreezes = isProUser ? 2 : 1;
  const availableFreezes = Math.max(0, maxFreezes - record.usedCount);

  return {
    month: currentMonthKey,
    maxFreezes,
    usedCount: record.usedCount,
    availableFreezes,
    canFreeze: availableFreezes > 0,
  };
}

/**
 * Applies a streak freeze when a candidate misses a study day
 */
export function applyStreakFreeze(
  userId,
  currentStreak = 0,
  isProUser = false,
) {
  const status = getStreakFreezeStatus(userId, isProUser);

  if (!status.canFreeze) {
    return {
      frozen: false,
      preservedStreak: 0,
      availableFreezes: 0,
      reason: "NO_FREEZES_AVAILABLE",
    };
  }

  // Consume freeze token
  const record = freezeStateStore.get(String(userId)) || {
    month: status.month,
    usedCount: 0,
  };
  record.usedCount += 1;
  freezeStateStore.set(String(userId), record);

  return {
    frozen: true,
    preservedStreak: currentStreak,
    availableFreezes: status.availableFreezes - 1,
    reason: "STREAK_PRESERVED_VIA_FREEZE",
  };
}

/**
 * Evaluates candidate stats and returns newly unlocked milestone badges
 */
export function evaluateMilestoneBadges(userStats = {}, existingBadgeIds = []) {
  const earnedSet = new Set(existingBadgeIds.map(String));
  const newlyUnlocked = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (earnedSet.has(badge.id)) {
      continue;
    }

    if (badge.check(userStats)) {
      newlyUnlocked.push({
        id: badge.id,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        xpReward: badge.xpReward,
        unlockedAt: new Date().toISOString(),
      });
    }
  }

  return newlyUnlocked;
}
