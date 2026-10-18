import { logger } from "@trstprep/shared-config";

// Onboarding state is per-account: on a shared device a single global key meant
// user B was auto-marked as onboarded because user A had completed the wizard.
// Keys are therefore namespaced by user id.
const LEGACY_STORAGE_KEY = "trstprep_onboarding";
const STORAGE_KEY_PREFIX = "trstprep_onboarding:";
const ONBOARDING_VERSION = 1;

const resolveUserId = (user) =>
  user?.id ?? user?._id ?? user?.userId ?? user?.user_id ?? null;

const storageKeyFor = (user) => {
  const userId = resolveUserId(user);
  return userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;
};

const parse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Read the record for `user`, migrating the legacy global key on first read so
 * users who already completed onboarding before this change are not re-onboarded.
 * Returns null when there is no record or no identifiable user.
 */
function readForUser(user) {
  const key = storageKeyFor(user);
  if (!key) return null;

  const scoped = parse(localStorage.getItem(key));
  if (scoped) return scoped;

  // First read for this account since the keys became user-scoped. Adopt the
  // old global value (if any) once, then delete it so it cannot be handed to a
  // second account on the same device.
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return null;
  const legacy = parse(legacyRaw);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  if (!legacy) return null;

  try {
    localStorage.setItem(key, legacyRaw);
  } catch {
    /* quota/private mode — the in-memory read below still works */
  }
  return legacy;
}

export function hasCompletedOnboarding(user = null) {
  try {
    const data = readForUser(user);
    if (
      data &&
      data.version === ONBOARDING_VERSION &&
      data.completed === true
    ) {
      return true;
    }
    // If returning user already has target exam/education/preferences set in DB profile
    if (
      user &&
      (user.education ||
        user.targetExam ||
        user.target_exam ||
        user.onboarded ||
        user.has_completed_onboarding)
    ) {
      saveOnboardingPrefs(
        {
          completed: true,
          skipped: false,
          selectedExam:
            user.targetExam || user.target_exam
              ? { name: user.targetExam || user.target_exam }
              : null,
        },
        user,
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getOnboardingPrefs(user = null) {
  try {
    return readForUser(user);
  } catch {
    return null;
  }
}

export function saveOnboardingPrefs(prefs, user = null) {
  const key = storageKeyFor(user);
  if (!key) {
    // No identity to scope the write to — deliberately a no-op rather than a
    // write to a shared global key, which is the bug this replaced.
    if (import.meta.env.DEV)
      logger.warn(
        "saveOnboardingPrefs called without a user — skipping unscoped write",
      );
    return;
  }
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: ONBOARDING_VERSION,
        completed: true,
        completedAt: new Date().toISOString(),
        ...prefs,
      }),
    );
  } catch (e) {
    if (import.meta.env.DEV)
      logger.warn("Failed to save onboarding preferences to localStorage", e);
  }
}
