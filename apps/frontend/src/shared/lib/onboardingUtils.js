const STORAGE_KEY = 'trstprep_onboarding'
const ONBOARDING_VERSION = 1

export function hasCompletedOnboarding(user = null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && data.version === ONBOARDING_VERSION && data.completed === true) {
        return true
      }
    }
    // If returning user already has target exam/education/preferences set in DB profile
    if (user && (user.education || user.targetExam || user.target_exam || user.onboarded || user.has_completed_onboarding)) {
      saveOnboardingPrefs({
        completed: true,
        skipped: false,
        selectedExam: (user.targetExam || user.target_exam) ? { name: user.targetExam || user.target_exam } : null,
      })
      return true
    }
    return false
  } catch {
    return false
  }
}

export function getOnboardingPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveOnboardingPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: ONBOARDING_VERSION,
      completed: true,
      completedAt: new Date().toISOString(),
      ...prefs
    }))
  } catch (e) {
    console.warn('Failed to save onboarding preferences to localStorage', e)
  }
}
