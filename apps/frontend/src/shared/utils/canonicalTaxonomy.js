/**
 * TRSTPrep Canonical Examination & Taxonomy Specification (Frontend)
 *
 * Hierarchy:
 * EXAM -> STAGE -> PAPER -> SECTION/MODULE -> SUBJECT -> TOPIC -> SUBTOPIC -> QUESTION
 */

// 1. CANONICAL SECTIONS SPECIFICATION
export const CANONICAL_SECTIONS = {
  "general-intelligence-and-reasoning": {
    id: "general-intelligence-and-reasoning",
    name: "General Intelligence & Reasoning",
    shortName: "Reasoning",
    type: "core_section",
    icon: "🧠",
    displayOrder: 1,
  },
  "quantitative-aptitude": {
    id: "quantitative-aptitude",
    name: "Quantitative Aptitude",
    shortName: "Quant",
    type: "core_section",
    icon: "🔢",
    displayOrder: 2,
  },
  "english-language": {
    id: "english-language",
    name: "English Language",
    shortName: "English",
    type: "core_section",
    icon: "📖",
    displayOrder: 3,
  },
  "general-awareness": {
    id: "general-awareness",
    name: "General Awareness",
    shortName: "GA",
    type: "umbrella_section",
    icon: "🌍",
    displayOrder: 4,
  },
};

// 2. CANONICAL SUBJECTS SPECIFICATION
export const CANONICAL_SUBJECTS = {
  // Core Domain Subjects
  "general-intelligence-and-reasoning": {
    slug: "general-intelligence-and-reasoning",
    name: "General Intelligence & Reasoning",
    section: "general-intelligence-and-reasoning",
    cluster: "Core",
    icon: "🧠",
  },
  "quantitative-aptitude": {
    slug: "quantitative-aptitude",
    name: "Quantitative Aptitude",
    section: "quantitative-aptitude",
    cluster: "Core",
    icon: "🔢",
  },
  "english-language": {
    slug: "english-language",
    name: "English Language",
    section: "english-language",
    cluster: "Core",
    icon: "📖",
  },

  // General Awareness - General Knowledge Cluster
  history: {
    slug: "history",
    name: "History",
    section: "general-awareness",
    cluster: "General Knowledge",
    icon: "🏛️",
  },
  polity: {
    slug: "polity",
    name: "Polity",
    section: "general-awareness",
    cluster: "General Knowledge",
    icon: "📜",
  },
  geography: {
    slug: "geography",
    name: "Geography",
    section: "general-awareness",
    cluster: "General Knowledge",
    icon: "🗺️",
  },
  economy: {
    slug: "economy",
    name: "Economy",
    section: "general-awareness",
    cluster: "General Knowledge",
    icon: "📈",
  },
  "static-gk": {
    slug: "static-gk",
    name: "Static GK",
    section: "general-awareness",
    cluster: "General Knowledge",
    icon: "📚",
  },
  "current-affairs": {
    slug: "current-affairs",
    name: "Current Affairs",
    section: "general-awareness",
    cluster: "General Knowledge",
    icon: "📰",
  },

  // General Awareness - General Science Cluster
  physics: {
    slug: "physics",
    name: "Physics",
    section: "general-awareness",
    cluster: "General Science",
    icon: "⚛️",
  },
  chemistry: {
    slug: "chemistry",
    name: "Chemistry",
    section: "general-awareness",
    cluster: "General Science",
    icon: "🧪",
  },
  biology: {
    slug: "biology",
    name: "Biology",
    section: "general-awareness",
    cluster: "General Science",
    icon: "🧬",
  },

  // Specialized / Tier-2 Subjects & Modules
  "computer-knowledge": {
    slug: "computer-knowledge",
    name: "Computer Knowledge",
    section: "computer-knowledge",
    cluster: "Specialized Module",
    icon: "💻",
    isSpecialized: true,
  },
  statistics: {
    slug: "statistics",
    name: "Statistics",
    section: "statistics",
    cluster: "Specialized Paper",
    icon: "📊",
    isSpecialized: true,
  },
  "finance-and-economics": {
    slug: "finance-and-economics",
    name: "General Studies (Finance & Economics)",
    section: "finance-and-economics",
    cluster: "Specialized Paper",
    icon: "💼",
    isSpecialized: true,
  },
};

// 3. RAW-LABEL TO CANONICAL ENTITY RESOLVER
export const RAW_LABEL_MAP = {
  // --- Quantitative Aptitude ---
  "quantitative aptitude": {
    type: "section",
    canonical: "quantitative-aptitude",
  },
  mathematics: { type: "section", canonical: "quantitative-aptitude" },
  "mathematical abilities": {
    type: "section",
    canonical: "quantitative-aptitude",
  },
  "numerical ability": { type: "section", canonical: "quantitative-aptitude" },
  quant: { type: "section", canonical: "quantitative-aptitude" },
  maths: { type: "section", canonical: "quantitative-aptitude" },
  "part-c (quantitative aptitude)": {
    type: "section",
    canonical: "quantitative-aptitude",
  },
  "part c (quantitative aptitude)": {
    type: "section",
    canonical: "quantitative-aptitude",
  },

  // --- General Intelligence & Reasoning ---
  "general intelligence and reasoning": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "general intelligence & reasoning": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "general intelligence": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "reasoning and general intelligence": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "logical reasoning": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  reasoning: {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "reasoning ability": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "gi & reasoning": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "part-a (general intelligence and reasoning)": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },
  "part a (general intelligence and reasoning)": {
    type: "section",
    canonical: "general-intelligence-and-reasoning",
  },

  // --- English Language ---
  "english language": { type: "section", canonical: "english-language" },
  "english language and comprehension": {
    type: "section",
    canonical: "english-language",
  },
  "english language & comprehension": {
    type: "section",
    canonical: "english-language",
  },
  "english comprehension": { type: "section", canonical: "english-language" },
  "general english": { type: "section", canonical: "english-language" },
  "part-d (english comprehension)": {
    type: "section",
    canonical: "english-language",
  },
  "part d (english comprehension)": {
    type: "section",
    canonical: "english-language",
  },
  english: { type: "section", canonical: "english-language" },

  // --- General Awareness (Section) ---
  "general awareness": { type: "section", canonical: "general-awareness" },
  "general studies": { type: "section", canonical: "general-awareness" },
  "general knowledge": { type: "section", canonical: "general-awareness" },
  "general awareness & current affairs": {
    type: "section",
    canonical: "general-awareness",
  },
  "general science & awareness": {
    type: "section",
    canonical: "general-awareness",
  },
  ga: { type: "section", canonical: "general-awareness" },
  gk: { type: "section", canonical: "general-awareness" },
  "part-b (general awareness)": {
    type: "section",
    canonical: "general-awareness",
  },
  "part b (general awareness)": {
    type: "section",
    canonical: "general-awareness",
  },
  "nda gat - part b - general knowledge": {
    type: "section",
    canonical: "general-awareness",
  },
  "nda gat part b general knowledge": {
    type: "section",
    canonical: "general-awareness",
  },

  // --- General Awareness Subjects ---
  history: {
    type: "subject",
    canonical: "history",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "ancient history": {
    type: "subject",
    canonical: "history",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "medieval history": {
    type: "subject",
    canonical: "history",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "modern history": {
    type: "subject",
    canonical: "history",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  polity: {
    type: "subject",
    canonical: "polity",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "indian polity": {
    type: "subject",
    canonical: "polity",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  constitution: {
    type: "subject",
    canonical: "polity",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  geography: {
    type: "subject",
    canonical: "geography",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "indian geography": {
    type: "subject",
    canonical: "geography",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "world geography": {
    type: "subject",
    canonical: "geography",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  economy: {
    type: "subject",
    canonical: "economy",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "indian economy": {
    type: "subject",
    canonical: "economy",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  economics: {
    type: "subject",
    canonical: "economy",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "static gk": {
    type: "subject",
    canonical: "static-gk",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  "current affairs": {
    type: "subject",
    canonical: "current-affairs",
    section: "general-awareness",
    cluster: "General Knowledge",
  },
  physics: {
    type: "subject",
    canonical: "physics",
    section: "general-awareness",
    cluster: "General Science",
  },
  chemistry: {
    type: "subject",
    canonical: "chemistry",
    section: "general-awareness",
    cluster: "General Science",
  },
  biology: {
    type: "subject",
    canonical: "biology",
    section: "general-awareness",
    cluster: "General Science",
  },

  // --- Specialized Modules / Papers ---
  "computer knowledge": {
    type: "section",
    canonical: "computer-knowledge",
    isSpecialized: true,
  },
  "computer knowledge test": {
    type: "section",
    canonical: "computer-knowledge",
    isSpecialized: true,
  },
  "computer aptitude": {
    type: "section",
    canonical: "computer-knowledge",
    isSpecialized: true,
  },
  statistics: {
    type: "paper",
    canonical: "statistics",
    exam: "ssc-cgl",
    stage: "tier-2",
    paper: "paper-ii",
    isSpecialized: true,
  },
  "general studies - finance and economics": {
    type: "paper",
    canonical: "finance-and-economics",
    exam: "ssc-cgl",
    stage: "tier-2",
    paper: "paper-iii",
    isSpecialized: true,
  },
  "data entry speed test": {
    type: "skill_test",
    canonical: "data-entry-speed-test",
    exam: "ssc-cgl",
    stage: "tier-2",
  },

  // --- Exam Stages (NOT subjects or sections) ---
  "tier-1": { type: "stage", canonical: "tier-1" },
  "tier 1": { type: "stage", canonical: "tier-1" },
  "tier-i": { type: "stage", canonical: "tier-1" },
  "tier-2": { type: "stage", canonical: "tier-2" },
  "tier 2": { type: "stage", canonical: "tier-2" },
  "tier-ii": { type: "stage", canonical: "tier-2" },
  cbt: { type: "stage", canonical: "cbt" },
  "cbt-1": { type: "stage", canonical: "cbt-1" },
  "cbt 1": { type: "stage", canonical: "cbt-1" },
  "cbt -1": { type: "stage", canonical: "cbt-1" },
  "cbt--1": { type: "stage", canonical: "cbt-1" },
  "cbt-2": { type: "stage", canonical: "cbt-2" },
  "cbt 2": { type: "stage", canonical: "cbt-2" },
  "rrb ntpc graduate cbt 1": {
    type: "stage",
    canonical: "cbt-1",
    exam: "rrb-ntpc",
  },
  "rrb ntpc cbt-1": { type: "stage", canonical: "cbt-1", exam: "rrb-ntpc" },
};

/**
 * Resolves any raw section/subject string into its canonical entity.
 * @param {string} rawString
 * @returns {object|null}
 */
export function resolveRawLabel(rawString) {
  if (!rawString || typeof rawString !== "string") return null;
  const normalized = rawString.trim().toLowerCase();

  if (RAW_LABEL_MAP[normalized]) {
    return RAW_LABEL_MAP[normalized];
  }

  // Punctuation-stripped fallback
  const stripped = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (RAW_LABEL_MAP[stripped]) {
    return RAW_LABEL_MAP[stripped];
  }

  return null;
}
