import { decodeHtmlEntities, cleanHtmlWrapper, extractBilingualContent } from './htmlSanitizer'

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
 * fallback to the other language, automatic extraction of <span class="eqt"> /
 * <span class="hqt"> bilingual spans, entity decoding, and HTML wrapper cleanup.
 *
 * @param {Object|Array|string} field - e.g. { en: '...', hi: '...' }, string, or Array.
 * @param {'en'|'hi'} lang - preferred language ('en' | 'hi').
 * @returns {string|Array}
 */
export const getLocalizedField = (field, lang = 'en') => {
  if (field === null || field === undefined) return ''

  // If array of options, resolve each option item individually
  if (Array.isArray(field)) {
    return field.map((item) => getLocalizedField(item, lang))
  }

  if (typeof field === 'string') {
    // Check if the string contains embedded <span class="eqt"> / <span class="hqt">
    if (/<span[^>]*class=["'][^"']*(?:eqt|hqt)[^"']*["'][^>]*>/i.test(field)) {
      const { en, hi } = extractBilingualContent(field)
      if (lang === 'hi') {
        return hi && hi.trim() !== '' ? hi : en
      }
      return en && en.trim() !== '' ? en : hi
    }
    return cleanHtmlWrapper(decodeHtmlEntities(field))
  }

  if (typeof field === 'object') {
    const isPresent = (val) => {
      if (val === null || val === undefined) return false
      if (Array.isArray(val)) return val.length > 0
      return String(val).trim() !== ''
    }

    const preferred = field[lang]
    if (isPresent(preferred)) {
      if (Array.isArray(preferred)) {
        return preferred.map((item) => getLocalizedField(item, lang))
      }
      return getLocalizedField(preferred, lang)
    }

    const fallback = lang === 'hi' ? field.en : field.hi
    if (isPresent(fallback)) {
      if (Array.isArray(fallback)) {
        return fallback.map((item) => getLocalizedField(item, lang))
      }
      return getLocalizedField(fallback, lang)
    }

    // Last resort: whichever language key or text key has content
    const any = field.en || field.hi || field.text || field.value
    if (isPresent(any)) {
      if (Array.isArray(any)) {
        return any.map((item) => getLocalizedField(item, lang))
      }
      return getLocalizedField(any, lang)
    }
    return ''
  }

  return cleanHtmlWrapper(decodeHtmlEntities(String(field)))
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

