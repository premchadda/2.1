// QUESTION ENGINE FIX #6 (MEDIUM): robust Hindi/English (mixed) rendering.
//
// Previously language selection relied on a single global `language` toggle
// (`en`/`hi`) with no fallback, so a question that only had, say, an English
// explanation but a Hindi question text would render an empty/undefined field.
// These helpers detect Devanagari script and always resolve to *some* value by
// falling back to the other language when the requested one is missing.

const DEVANAGARI_RE = /[\u0900-\u097F]/

export const hasDevanagari = (text) => typeof text === 'string' && DEVANAGARI_RE.test(text)

export const hasLatin = (text) => typeof text === 'string' && /[A-Za-z]/.test(text)

/**
 * Detect which language a piece of text is primarily written in.
 * @param {string} text
 * @returns {'hi' | 'en' | 'mixed' | 'unknown'}
 */
export const detectScript = (text) => {
  if (!text || typeof text !== 'string') return 'unknown'
  const hi = hasDevanagari(text)
  const en = hasLatin(text)
  if (hi && en) return 'mixed'
  if (hi) return 'hi'
  if (en) return 'en'
  return 'unknown'
}

/**
 * Resolve a localized field given the user's chosen language, with graceful
 * fallback to the other language so mixed-content questions never render blank.
 *
 * @param {Object} field - e.g. { en: '...', hi: '...' } or a plain string.
 * @param {'en'|'hi'} lang - preferred language.
 * @returns {string}
 */
export const getLocalizedField = (field, lang = 'en') => {
  // Arrays of option strings are already localized — return as-is.
  if (Array.isArray(field)) return field
  if (field === null || field === undefined) return ''
  if (typeof field === 'string') return field

  const preferred = field[lang]
  if (preferred !== null && preferred !== undefined && (Array.isArray(preferred) || String(preferred).trim() !== '')) {
    return preferred
  }

  const fallback = lang === 'hi' ? field.en : field.hi
  if (fallback !== null && fallback !== undefined && (Array.isArray(fallback) || String(fallback).trim() !== '')) {
    return fallback
  }

  // Last resort: whichever language key has content.
  const any = field.en || field.hi
  return any !== null && any !== undefined ? any : ''
}

/**
 * Given a question object with `text`/`options`/`explanation` localized fields,
 * decide the best default language for a toggle when the user hasn't explicitly
 * chosen. Picks the language with the most content present.
 *
 * @param {Object} question - frontend question (with {en,hi} fields)
 * @returns {'en'|'hi'}
 */
export const pickDefaultLanguage = (question) => {
  if (!question) return 'en'
  const enScore =
    [...(question.text?.en ? [question.text.en] : []), ...(question.options?.en || []), question.explanation?.en]
      .filter(Boolean)
      .join('').length
  const hiScore =
    [...(question.text?.hi ? [question.text.hi] : []), ...(question.options?.hi || []), question.explanation?.hi]
      .filter(Boolean)
      .join('').length
  return hiScore > enScore ? 'hi' : 'en'
}

export default { hasDevanagari, hasLatin, detectScript, getLocalizedField, pickDefaultLanguage }
