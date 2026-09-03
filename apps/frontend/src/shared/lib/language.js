import {
  decodeHtmlEntities,
  cleanHtmlWrapper,
  extractBilingualContent,
} from "./htmlSanitizer";

// QUESTION ENGINE FIX #6 (MEDIUM): robust Hindi/English (mixed) rendering.
//
// Previously language selection relied on a single global `language` toggle
// (`en`/`hi`) with no fallback, so a question that only had, say, an English
// explanation but a Hindi question text would render an empty/undefined field.
// These helpers detect Devanagari script and always resolve to *some* value by
// falling back to the other language when the requested one is missing.

const DEVANAGARI_RE = /[\u0900-\u097F]/;

export const hasDevanagari = (text) =>
  typeof text === "string" && DEVANAGARI_RE.test(text);

export const hasLatin = (text) =>
  typeof text === "string" && /[A-Za-z]/.test(text);

/**
 * Detect which language a piece of text is primarily written in.
 * @param {string} text
 * @returns {'hi' | 'en' | 'mixed' | 'unknown'}
 */
export const detectScript = (text) => {
  if (!text || typeof text !== "string") return "unknown";
  const hi = hasDevanagari(text);
  const en = hasLatin(text);
  if (hi && en) return "mixed";
  if (hi) return "hi";
  if (en) return "en";
  return "unknown";
};

/**
 * Resolve a localized field given the user's chosen language, with graceful
 * fallback to the other language, automatic extraction of <span class="eqt"> /
 * <span class="hqt"> bilingual spans, entity decoding, and HTML wrapper cleanup.
 *
 * @param {Object|Array|string} field - e.g. { en: '...', hi: '...' }, string, or Array.
 * @param {'en'|'hi'} lang - preferred language ('en' | 'hi').
 * @returns {string|Array}
 */
export const getLocalizedField = (field, lang = "en") => {
  if (field === null || field === undefined) return "";

  // If array of options, resolve each option item individually
  if (Array.isArray(field)) {
    return field.map((item) => getLocalizedField(item, lang));
  }

  if (typeof field === "string") {
    // Check if the string contains embedded <span class="eqt"> / <span class="hqt">
    if (/<span[^>]*class=["'][^"']*(?:eqt|hqt)[^"']*["'][^>]*>/i.test(field)) {
      const { en, hi } = extractBilingualContent(field);
      if (lang === "hi") {
        return hi && hi.trim() !== "" ? hi : en;
      }
      return en && en.trim() !== "" ? en : hi;
    }
    return cleanHtmlWrapper(decodeHtmlEntities(field));
  }

  if (typeof field === "object") {
    const isPresent = (val) => {
      if (val === null || val === undefined) return false;
      if (Array.isArray(val)) return val.length > 0;
      return String(val).trim() !== "";
    };

    const preferred = field[lang];
    if (isPresent(preferred)) {
      if (Array.isArray(preferred)) {
        return preferred.map((item) => getLocalizedField(item, lang));
      }
      return getLocalizedField(preferred, lang);
    }

    const fallback = lang === "hi" ? field.en : field.hi;
    if (isPresent(fallback)) {
      if (Array.isArray(fallback)) {
        return fallback.map((item) => getLocalizedField(item, lang));
      }
      return getLocalizedField(fallback, lang);
    }

    // Last resort: whichever language key or text key has content
    const any = field.en || field.hi || field.text || field.value;
    if (isPresent(any)) {
      if (Array.isArray(any)) {
        return any.map((item) => getLocalizedField(item, lang));
      }
      return getLocalizedField(any, lang);
    }
    return "";
  }

  return cleanHtmlWrapper(decodeHtmlEntities(String(field)));
};

/**
 * Given a question object with `text`/`options`/`explanation` localized fields,
 * decide the best default language for a toggle when the user hasn't explicitly
 * chosen. Picks the language with the most content present.
 *
 * @param {Object} question - frontend question (with {en,hi} fields)
 * @returns {'en'|'hi'}
 */
export const pickDefaultLanguage = (question) => {
  if (!question) return "en";
  const enScore = [
    ...(question.text?.en ? [question.text.en] : []),
    ...(question.options?.en || []),
    question.explanation?.en,
  ]
    .filter(Boolean)
    .join("").length;
  const hiScore = [
    ...(question.text?.hi ? [question.text.hi] : []),
    ...(question.options?.hi || []),
    question.explanation?.hi,
  ]
    .filter(Boolean)
    .join("").length;
  return hiScore > enScore ? "hi" : "en";
};

export const LANGUAGE_DISPLAY_NAMES = {
  en: "English",
  eng: "English",
  english: "English",
  hi: "Hindi",
  hin: "Hindi",
  hindi: "Hindi",
  bn: "Bengali",
  ben: "Bengali",
  bengali: "Bengali",
  bangla: "Bengali",
  ta: "Tamil",
  tam: "Tamil",
  tamil: "Tamil",
  te: "Telugu",
  tel: "Telugu",
  telugu: "Telugu",
  mr: "Marathi",
  mar: "Marathi",
  marathi: "Marathi",
  gu: "Gujarati",
  guj: "Gujarati",
  gujarati: "Gujarati",
  kn: "Kannada",
  kan: "Kannada",
  kannada: "Kannada",
  ml: "Malayalam",
  mal: "Malayalam",
  malayalam: "Malayalam",
  pa: "Punjabi",
  pan: "Punjabi",
  pun: "Punjabi",
  punjabi: "Punjabi",
  or: "Odia",
  od: "Odia",
  ori: "Odia",
  odi: "Odia",
  odia: "Odia",
  oriya: "Odia",
  ur: "Urdu",
  urd: "Urdu",
  urdu: "Urdu",
  as: "Assamese",
  asm: "Assamese",
  assamese: "Assamese",
  sa: "Sanskrit",
  san: "Sanskrit",
  sanskrit: "Sanskrit",
  ne: "Nepali",
  nep: "Nepali",
  nepali: "Nepali",
  ks: "Kashmiri",
  kas: "Kashmiri",
  kashmiri: "Kashmiri",
  sd: "Sindhi",
  snd: "Sindhi",
  sindhi: "Sindhi",
  mai: "Maithili",
  maithili: "Maithili",
  bho: "Bhojpuri",
  bhojpuri: "Bhojpuri",
  doi: "Dogri",
  dogri: "Dogri",
  kok: "Konkani",
  konkani: "Konkani",
  mni: "Manipuri",
  manipuri: "Manipuri",
  brx: "Bodo",
  bodo: "Bodo",
  sat: "Santali",
  santali: "Santali",
  lus: "Mizo",
  mizo: "Mizo",
  fr: "French",
  fre: "French",
  fra: "French",
  french: "French",
  de: "German",
  ger: "German",
  deu: "German",
  german: "German",
  es: "Spanish",
  spa: "Spanish",
  spanish: "Spanish",
  ru: "Russian",
  rus: "Russian",
  russian: "Russian",
  zh: "Chinese",
  chi: "Chinese",
  zho: "Chinese",
  chinese: "Chinese",
  ja: "Japanese",
  jpn: "Japanese",
  japanese: "Japanese",
  ar: "Arabic",
  ara: "Arabic",
  arabic: "Arabic",
};

/**
 * Convert a language code, abbreviation, or string to its full proper display name.
 * e.g. "en" -> "English", "hi" -> "Hindi", "bn" -> "Bengali"
 * @param {string} code
 * @returns {string}
 */
export const getLanguageDisplayName = (code) => {
  if (!code || typeof code !== "string") return "";
  const trimmed = code.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (LANGUAGE_DISPLAY_NAMES[lower]) {
    return LANGUAGE_DISPLAY_NAMES[lower];
  }
  // If not in map, capitalize first letter if all lowercase, or preserve casing
  if (trimmed === lower) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
};

/**
 * Parse any raw languages representation (array, JSON string, comma-separated string, single code)
 * into an array of full proper language names.
 * e.g. ["en", "hi"] -> ["English", "Hindi"]
 *      "en, hi" -> ["English", "Hindi"]
 *      '["en","hi"]' -> ["English", "Hindi"]
 * @param {any} raw
 * @param {string[]} [defaultLanguages=["English", "Hindi"]]
 * @returns {string[]}
 */
export const parseLanguageList = (
  raw,
  defaultLanguages = ["English", "Hindi"],
) => {
  if (!raw) return defaultLanguages ? [...defaultLanguages] : [];

  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return defaultLanguages ? [...defaultLanguages] : [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      } catch {
        list = trimmed
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      }
    }
    if (list.length === 0) {
      if (trimmed.includes(",")) {
        list = trimmed.split(",").map((s) => s.trim());
      } else if (trimmed.includes("/")) {
        list = trimmed.split("/").map((s) => s.trim());
      } else {
        list = [trimmed];
      }
    }
  }

  const result = list
    .filter(Boolean)
    .map((item) => getLanguageDisplayName(String(item)))
    .filter(Boolean);

  // Remove duplicates while preserving order
  const unique = [...new Set(result)];
  if (unique.length > 0) return unique;
  return defaultLanguages ? [...defaultLanguages] : [];
};

/**
 * Format language list with optional overflow truncation.
 * e.g. (["en", "hi"], 2) -> "English, Hindi"
 *      (["en", "hi", "te"], 2) -> "English, Hindi +1"
 * @param {any} raw
 * @param {number} [maxDisplay=2]
 * @param {number} [extraCountOverride]
 * @returns {string}
 */
export const formatLanguagesDisplay = (
  raw,
  maxDisplay = 2,
  extraCountOverride,
) => {
  const languages = parseLanguageList(raw);
  const extraCount =
    typeof extraCountOverride === "number"
      ? extraCountOverride
      : languages.length > maxDisplay
        ? languages.length - maxDisplay
        : 0;
  const displayLangs = languages.slice(0, maxDisplay);
  if (extraCount > 0) {
    return `${displayLangs.join(", ")} +${extraCount}`;
  }
  return languages.join(", ");
};

export default {
  hasDevanagari,
  hasLatin,
  detectScript,
  getLocalizedField,
  pickDefaultLanguage,
  LANGUAGE_DISPLAY_NAMES,
  getLanguageDisplayName,
  parseLanguageList,
  formatLanguagesDisplay,
};
