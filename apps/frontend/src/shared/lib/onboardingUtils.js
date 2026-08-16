const STORAGE_KEY = 'trstprep_onboarding'
const ONBOARDING_VERSION = 1

export function hasCompletedOnboarding() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return data && data.version === ONBOARDING_VERSION && data.completed === true
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
