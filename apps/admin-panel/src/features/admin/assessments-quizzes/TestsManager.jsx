import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
  Radio,
  BookOpen,
  ExternalLink
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI, apiClient } from '../../../shared/lib/dataService'
import { coerceArray } from '../../../shared/utils/questionHelpers'
import { useExamCategories } from '../../../shared/hooks/useExamCategories'
import FullTestImportModal from './components/FullTestImportModal'

const TEST_CATEGORY_TABS = [
  { id: 'mock-tests', label: 'Mock Tests', icon: CheckSquare },
  { id: 'pyp', label: 'Previous Year Papers', icon: FileText },
  { id: 'practice', label: 'Practice & Quiz', icon: Layers },
  { id: 'live-tests', label: 'Live Tests', icon: Clock },
]

const TEST_CATEGORY_NAMES = {
  'mock-tests': 'Mock Tests',
  pyp: 'PYPs',
  practice: 'Practice',
  'live-tests': 'Live Tests',
}

const TEST_CATEGORY_ALIASES = {
  'mock-tests': ['mock-tests', 'mock', 'mock test', 'mock tests', 'Mock Tests'],
  pyp: ['pyp', 'pyps', 'previous-year', 'previous year', 'previous year papers', 'Previous Year Papers', 'PYPs'],
  practice: ['practice', 'quiz', 'practice-quiz', 'practice & quiz', 'Practice'],
  'live-tests': ['live-tests', 'live', 'live test', 'live tests', 'Live Tests'],
}

const UNASSIGNED_SUBCATEGORY_ID = '__unassigned__'

const SECTION_PRESETS = [
  // ───────────────────── SSC CGL ─────────────────────
  {
    id: 'ssc-cgl-tier-1',
    label: 'SSC CGL Tier-I',
    description: '4 sections, 100 Qs, 200 marks, 60 min, -0.50 neg, sectional timing 15 min/section',
    sections: [
      { name: 'General Intelligence & Reasoning', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '1', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
      { name: 'General Awareness', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '2', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
      { name: 'Quantitative Aptitude', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '3', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
      { name: 'English Comprehension', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '4', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
    ]
  },
  {
    id: 'ssc-cgl-tier-2-paper-1',
    label: 'SSC CGL Tier-II Paper-I',
    description: '150 Qs + DEST, 450 marks, 2 hr 30 min, -1.00 neg',
    sections: [
      { name: 'Mathematical Abilities', exam_stage: 'Tier-II', paper: 'Paper-I', session: 'Session-I', section_code: 'I-A', expected_questions: 30, total_marks: 90, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'Reasoning & General Intelligence', exam_stage: 'Tier-II', paper: 'Paper-I', session: 'Session-I', section_code: 'I-B', expected_questions: 30, total_marks: 90, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'English Language & Comprehension', exam_stage: 'Tier-II', paper: 'Paper-I', session: 'Session-I', section_code: 'II-A', expected_questions: 45, total_marks: 135, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'General Awareness', exam_stage: 'Tier-II', paper: 'Paper-I', session: 'Session-I', section_code: 'II-B', expected_questions: 25, total_marks: 75, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'Computer Knowledge Test', exam_stage: 'Tier-II', paper: 'Paper-I', session: 'Session-I', section_code: 'III', expected_questions: 20, total_marks: 60, marks_per_question: 3, negative_marks: 1, time_limit: 900, is_qualifying: true },
      { name: 'Data Entry Speed Test (DEST)', exam_stage: 'Tier-II', paper: 'Paper-I', session: 'Session-II', section_code: 'IV', expected_questions: 0, total_marks: 0, marks_per_question: 0, negative_marks: 0, time_limit: 900, is_qualifying: true },
    ]
  },
  {
    id: 'ssc-cgl-tier-2-paper-2',
    label: 'SSC CGL Tier-II Paper-II (Statistics)',
    description: 'Statistics paper for JSO / Statistical Investigator — 100 Qs, 200 marks, 2 hr',
    sections: [
      { name: 'Statistics', exam_stage: 'Tier-II', paper: 'Paper-II', section_code: 'Paper-II', expected_questions: 100, total_marks: 200, marks_per_question: 2, negative_marks: 0.5, time_limit: 7200 },
    ]
  },

  // ───────────────────── SSC CHSL ─────────────────────
  {
    id: 'ssc-chsl-tier-1',
    label: 'SSC CHSL Tier-I',
    description: '4 sections, 100 Qs, 200 marks, 60 min, -0.50 neg, sectional timing 15 min/section',
    sections: [
      { name: 'General Intelligence & Reasoning', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '1', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
      { name: 'General Awareness', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '2', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
      { name: 'Quantitative Aptitude', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '3', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
      { name: 'English Language', exam_stage: 'Tier-I', paper: 'Tier-I', section_code: '4', expected_questions: 25, total_marks: 50, marks_per_question: 2, negative_marks: 0.5, time_limit: 900 },
    ]
  },
  {
    id: 'ssc-chsl-tier-2-session-1',
    label: 'SSC CHSL Tier-II Session-I',
    description: '135 Qs, 405 marks, 2 hr 15 min, -1.00 neg',
    sections: [
      { name: 'Mathematical Abilities', exam_stage: 'Tier-II', paper: 'Session-I', session: 'Session-I', section_code: 'I-M1', expected_questions: 30, total_marks: 90, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'Reasoning & General Intelligence', exam_stage: 'Tier-II', paper: 'Session-I', session: 'Session-I', section_code: 'I-M2', expected_questions: 30, total_marks: 90, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'English Language & Comprehension', exam_stage: 'Tier-II', paper: 'Session-I', session: 'Session-I', section_code: 'II-M1', expected_questions: 40, total_marks: 120, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'General Awareness', exam_stage: 'Tier-II', paper: 'Session-I', session: 'Session-I', section_code: 'II-M2', expected_questions: 20, total_marks: 60, marks_per_question: 3, negative_marks: 1, time_limit: 3600 },
      { name: 'Computer Knowledge Test', exam_stage: 'Tier-II', paper: 'Session-I', session: 'Session-I', section_code: 'III-M1', expected_questions: 15, total_marks: 45, marks_per_question: 3, negative_marks: 1, time_limit: 900, is_qualifying: true },
    ]
  },

  // ───────────────────── SSC MTS ─────────────────────
  {
    id: 'ssc-mts-session-1',
    label: 'SSC MTS / Havaldar Session-I',
    description: '40 Qs, 120 marks, 45 min, NO negative marking',
    sections: [
      { name: 'Numerical & Mathematical Ability', exam_stage: 'Session-I', paper: 'Session-I', session: 'Session-I', section_code: '1', expected_questions: 20, total_marks: 60, marks_per_question: 3, negative_marks: 0, time_limit: 2700 },
      { name: 'Reasoning Ability & Problem Solving', exam_stage: 'Session-I', paper: 'Session-I', session: 'Session-I', section_code: '2', expected_questions: 20, total_marks: 60, marks_per_question: 3, negative_marks: 0, time_limit: 2700 },
    ]
  },
  {
    id: 'ssc-mts-session-2',
    label: 'SSC MTS / Havaldar Session-II',
    description: '50 Qs, 150 marks, 45 min, -1.00 neg',
    sections: [
      { name: 'General Awareness', exam_stage: 'Session-II', paper: 'Session-II', session: 'Session-II', section_code: '3', expected_questions: 25, total_marks: 75, marks_per_question: 3, negative_marks: 1, time_limit: 2700 },
      { name: 'English Language & Comprehension', exam_stage: 'Session-II', paper: 'Session-II', session: 'Session-II', section_code: '4', expected_questions: 25, total_marks: 75, marks_per_question: 3, negative_marks: 1, time_limit: 2700 },
    ]
  },

  // ───────────────────── SSC CPO ─────────────────────
  {
    id: 'ssc-cpo-paper-1',
    label: 'SSC CPO Paper-I',
    description: '200 Qs, 200 marks, 2 hr, -0.25 neg, sectional timing 30 min/section',
    sections: [
      { name: 'General Intelligence & Reasoning', exam_stage: 'Paper-I', paper: 'Paper-I', section_code: '1', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 1800 },
      { name: 'General Knowledge & General Awareness', exam_stage: 'Paper-I', paper: 'Paper-I', section_code: '2', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 1800 },
      { name: 'Quantitative Aptitude', exam_stage: 'Paper-I', paper: 'Paper-I', section_code: '3', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 1800 },
      { name: 'English Comprehension', exam_stage: 'Paper-I', paper: 'Paper-I', section_code: '4', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 1800 },
    ]
  },
  {
    id: 'ssc-cpo-paper-2',
    label: 'SSC CPO Paper-II',
    description: 'English Language & Comprehension — 200 Qs, 200 marks, 2 hr, -0.25 neg',
    sections: [
      { name: 'English Language & Comprehension', exam_stage: 'Paper-II', paper: 'Paper-II', section_code: 'Paper-II', expected_questions: 200, total_marks: 200, marks_per_question: 1, negative_marks: 0.25, time_limit: 7200 },
    ]
  },

  // ───────────────────── SSC Stenographer ─────────────────────
  {
    id: 'ssc-steno-cbt',
    label: 'SSC Stenographer CBT',
    description: '200 Qs, 200 marks, 2 hr, -0.25 neg, sectional timing',
    sections: [
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT', paper: 'CBT', section_code: '1', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 1800 },
      { name: 'General Awareness', exam_stage: 'CBT', paper: 'CBT', section_code: '2', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 1800 },
      { name: 'English Language & Comprehension', exam_stage: 'CBT', paper: 'CBT', section_code: '3', expected_questions: 100, total_marks: 100, marks_per_question: 1, negative_marks: 0.25, time_limit: 3600 },
    ]
  },

  // ───────────────────── SSC GD ─────────────────────
  {
    id: 'ssc-gd-constable',
    label: 'SSC GD Constable',
    description: '80 Qs, 160 marks, 60 min, -0.25 neg, sectional timing 15 min/section',
    sections: [
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT', paper: 'CBT', section_code: '1', expected_questions: 20, total_marks: 40, marks_per_question: 2, negative_marks: 0.25, time_limit: 900 },
      { name: 'General Knowledge & General Awareness', exam_stage: 'CBT', paper: 'CBT', section_code: '2', expected_questions: 20, total_marks: 40, marks_per_question: 2, negative_marks: 0.25, time_limit: 900 },
      { name: 'Elementary Mathematics', exam_stage: 'CBT', paper: 'CBT', section_code: '3', expected_questions: 20, total_marks: 40, marks_per_question: 2, negative_marks: 0.25, time_limit: 900 },
      { name: 'English / Hindi', exam_stage: 'CBT', paper: 'CBT', section_code: '4', expected_questions: 20, total_marks: 40, marks_per_question: 2, negative_marks: 0.25, time_limit: 900 },
    ]
  },

  // ───────────────────── SSC JE ─────────────────────
  {
    id: 'ssc-je-paper-1',
    label: 'SSC JE Paper-I',
    description: '200 Qs, 200 marks, 2 hr, -0.25 neg, no sectional timing',
    sections: [
      { name: 'General Intelligence & Reasoning', exam_stage: 'Paper-I', paper: 'Paper-I', section_code: '1', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 7200 },
      { name: 'General Awareness', exam_stage: 'Paper-I', paper: 'Paper-I', section_code: '2', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.25, time_limit: 7200 },
      { name: 'General Engineering (Civil/Electrical/Mechanical)', exam_stage: 'Paper-I', paper: 'Paper-I', section_code: '3', expected_questions: 100, total_marks: 100, marks_per_question: 1, negative_marks: 0.25, time_limit: 7200 },
    ]
  },
  {
    id: 'ssc-je-paper-2',
    label: 'SSC JE Paper-II',
    description: 'General Engineering — 100 Qs, 300 marks, 2 hr, -1.00 neg',
    sections: [
      { name: 'General Engineering (Civil/Electrical/Mechanical)', exam_stage: 'Paper-II', paper: 'Paper-II', section_code: 'Paper-II', expected_questions: 100, total_marks: 300, marks_per_question: 3, negative_marks: 1, time_limit: 7200 },
    ]
  },

  // ───────────────────── RRB NTPC ─────────────────────
  {
    id: 'rrb-ntpc-cbt-1',
    label: 'RRB NTPC CBT-1',
    description: '100 Qs, 100 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      { name: 'General Awareness', exam_stage: 'CBT-1', paper: 'CBT-1', section_code: '1', expected_questions: 40, total_marks: 40, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'Mathematics', exam_stage: 'CBT-1', paper: 'CBT-1', section_code: '2', expected_questions: 30, total_marks: 30, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT-1', paper: 'CBT-1', section_code: '3', expected_questions: 30, total_marks: 30, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
    ]
  },
  {
    id: 'rrb-ntpc-cbt-2',
    label: 'RRB NTPC CBT-2',
    description: '120 Qs, 120 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      { name: 'General Awareness', exam_stage: 'CBT-2', paper: 'CBT-2', section_code: '1', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'Mathematics', exam_stage: 'CBT-2', paper: 'CBT-2', section_code: '2', expected_questions: 35, total_marks: 35, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT-2', paper: 'CBT-2', section_code: '3', expected_questions: 35, total_marks: 35, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
    ]
  },

  // ───────────────────── RRB ALP ─────────────────────
  {
    id: 'rrb-alp-cbt-1',
    label: 'RRB ALP CBT-1',
    description: '75 Qs, 75 marks, 60 min, -1/3 neg, no sectional timing',
    sections: [
      { name: 'Mathematics', exam_stage: 'CBT-1', paper: 'CBT-1', section_code: '1', expected_questions: 20, total_marks: 20, marks_per_question: 1, negative_marks: 0.33, time_limit: 3600 },
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT-1', paper: 'CBT-1', section_code: '2', expected_questions: 25, total_marks: 25, marks_per_question: 1, negative_marks: 0.33, time_limit: 3600 },
      { name: 'General Science', exam_stage: 'CBT-1', paper: 'CBT-1', section_code: '3', expected_questions: 20, total_marks: 20, marks_per_question: 1, negative_marks: 0.33, time_limit: 3600 },
      { name: 'General Awareness & Current Affairs', exam_stage: 'CBT-1', paper: 'CBT-1', section_code: '4', expected_questions: 10, total_marks: 10, marks_per_question: 1, negative_marks: 0.33, time_limit: 3600 },
    ]
  },
  {
    id: 'rrb-alp-cbt-2-part-a',
    label: 'RRB ALP CBT-2 Part-A',
    description: '100 Qs, 100 marks, 90 min, -1/3 neg',
    sections: [
      { name: 'Mathematics', exam_stage: 'CBT-2', paper: 'Part-A', session: 'Part-A', section_code: '1', expected_questions: 0, total_marks: 0, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT-2', paper: 'Part-A', session: 'Part-A', section_code: '2', expected_questions: 0, total_marks: 0, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'Basic Science & Engineering', exam_stage: 'CBT-2', paper: 'Part-A', session: 'Part-A', section_code: '3', expected_questions: 0, total_marks: 0, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
    ]
  },
  {
    id: 'rrb-alp-cbt-2-part-b',
    label: 'RRB ALP CBT-2 Part-B (Trade)',
    description: 'Trade-specific — 75 Qs, 75 marks, 60 min, -1/3 neg',
    sections: [
      { name: 'Trade Specific (as per trade)', exam_stage: 'CBT-2', paper: 'Part-B', session: 'Part-B', section_code: 'Part-B', expected_questions: 75, total_marks: 75, marks_per_question: 1, negative_marks: 0.33, time_limit: 3600 },
    ]
  },

  // ───────────────────── RRB Group D ─────────────────────
  {
    id: 'rrb-group-d',
    label: 'RRB Group D (Level-1)',
    description: '100 Qs, 100 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      { name: 'General Science', exam_stage: 'CBT', paper: 'CBT', section_code: '1', expected_questions: 25, total_marks: 25, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'Mathematics', exam_stage: 'CBT', paper: 'CBT', section_code: '2', expected_questions: 25, total_marks: 25, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT', paper: 'CBT', section_code: '3', expected_questions: 30, total_marks: 30, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'General Awareness & Current Affairs', exam_stage: 'CBT', paper: 'CBT', section_code: '4', expected_questions: 20, total_marks: 20, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
    ]
  },

  // ───────────────────── RPF ─────────────────────
  {
    id: 'rpf-constable-si',
    label: 'RPF Constable / Sub-Inspector',
    description: '120 Qs, 120 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      { name: 'General Awareness', exam_stage: 'CBT', paper: 'CBT', section_code: '1', expected_questions: 50, total_marks: 50, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'Arithmetic', exam_stage: 'CBT', paper: 'CBT', section_code: '2', expected_questions: 35, total_marks: 35, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
      { name: 'General Intelligence & Reasoning', exam_stage: 'CBT', paper: 'CBT', section_code: '3', expected_questions: 35, total_marks: 35, marks_per_question: 1, negative_marks: 0.33, time_limit: 5400 },
    ]
  },
]

const DEFAULT_TEST_FORM = {
  title: '',
  slug: '',
  testSeriesId: '',
  testCategoryId: '',
  subCategoryLevel1: '',
  subCategoryLevel2: '',
  subCategoryLevel3: '',
  subCategoryLevel4: '',
  type: 'mock-tests',
  duration: 60,
  negativeMarking: 0.25,
  difficulty: 'medium',
  hasSectionalTiming: true,
  isPro: false,
  isComingSoon: false,
  isLive: false,
  tags: '',
  stageIds: '',
  sectionIds: '',
  scheduledAt: '',
  scheduledEnd: '',
}

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const idsEqual = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
const getEntityId = (item) => item?._id ?? item?.id ?? null
const getSeriesId = (series) => series?._id ?? series?.id ?? series?.public_id ?? null
const getTestId = (test) => test?._id ?? test?.id ?? test?.public_id ?? null
const getTestSeriesId = (test = {}) => test.testSeriesId ?? test.test_series_id ?? test.seriesId ?? test.series_id ?? null
const getStageIdFromTest = (test = {}) => test.stageId ?? test.stage_id ?? test.tierId ?? test.tier_id ?? null
const getSeriesExamId = (series) => {
  if (!series) return null
  return series.examId ?? series.exam_id ?? series.subcategory ?? series.subCategory ?? series.sub_category ?? series.subcategory_id ?? null
}
const getSeriesExamCategoryId = (series) => {
  if (!series) return null
  return series.category ?? series.category_id ?? series.examCategoryId ?? series.exam_category_id ?? null
}
const getTestQuestionsCount = (test = {}) =>
  Number(test.questionsCount ?? test.questions_count ?? test.totalQuestions ?? test.total_questions ?? test.question_count ?? 0)

const parseIdList = (value) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

const normalizeTest = (test) => ({
  ...test,
  title: test.title || test.name || '',
  slug: test.slug || '',
  testSeriesId: test.testSeriesId ?? test.test_series_id ?? test.seriesId ?? test.series_id ?? null,
  stageId: test.stageId ?? test.stage_id ?? test.tierId ?? test.tier_id ?? null,
  testCategoryId: test.testCategoryId ?? test.test_category_id ?? null,
  examId: test.examId ?? test.exam_id ?? null,
  category: test.category || '',
  type: test.type || 'mock-tests',
  duration: test.duration ?? test.time_limit ?? 60,
  totalQuestions: test.totalQuestions ?? test.total_questions ?? 0,
  totalMarks: test.totalMarks ?? test.total_marks ?? 0,
  negativeMarking: test.negativeMarking ?? test.negative_marking ?? 0.25,
  difficulty: test.difficulty || 'medium',
  isPro: Boolean(test.isPro ?? test.is_pro),
  isComingSoon: Boolean(test.isComingSoon ?? test.is_coming_soon),
  isLive: Boolean(test.isLive ?? test.is_live),
  tags: Array.isArray(test.tags) ? test.tags : (test.tags ? test.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
  stageIds: Array.isArray(test.stage_ids ?? test.stageIds) ? (test.stage_ids ?? test.stageIds) : [],
  questionsCount: getTestQuestionsCount(test),
})

const normalizeSectionForForm = (section) => ({
  ...section,
  duration: Math.max(1, Math.round((section.time_limit ?? section.timeLimit ?? 900) / 60)),
  marks_per_question: section.marks_per_question ?? section.marksPerQuestion ?? 2,
  negative_marks: section.negative_marks ?? section.negativeMarks ?? 0.5,
  expected_questions: section.expected_questions ?? section.expectedQuestions ?? 0,
  total_marks: section.total_marks ?? section.totalMarks ?? 0,
})

const flattenCategories = (categories = []) => {
  const flattened = []
  const walk = (items, parentId = '') => {
    items.forEach(item => {
      const id = getEntityId(item)
      flattened.push({ ...item, parentId: item.parentId ?? item.parent_id ?? parentId })
      if (Array.isArray(item.children) && item.children.length > 0) walk(item.children, id)
    })
  }
  walk(Array.isArray(categories) ? categories : [])
  return flattened
}

const refsFrom = (values) => {
  const refs = new Set()
  values.filter(Boolean).forEach(value => {
    refs.add(String(value))
    refs.add(normalizeKey(value))
  })
  return refs
}

const valueMatchesRefs = (values, refs) =>
  Boolean(refs?.size) && values.filter(value => value !== null && value !== undefined && value !== '').some(value => refs.has(String(value)) || refs.has(normalizeKey(value)))

const getTestCategoryValues = (item = {}) => [
  item.testCategoryId,
  item.test_category_id,
  item.subCategory,
  item.sub_category,
  item.categoryId,
  item.category_id,
  item.category,
  item.categoryName,
  item.category_name,
  item.testCategory,
  item.test_category,
  item.type,
].filter(value => value !== null && value !== undefined && value !== '')

const getSeriesCategoryValues = (series = {}) => [
  series.testCategoryId,
  series.test_category_id,
  ...coerceArray(series.testCategoryIds || series.test_category_ids),
  ...coerceArray(series.testCategories || series.test_categories),
  series.testCategory,
  series.test_category,
].filter(value => value !== null && value !== undefined && value !== '')

const buildExamCategoryRefs = (categoryId, categories = []) => {
  if (!categoryId) return new Set()
  const match = categories.find(cat => [cat.id, cat.categoryId, cat.slug, cat.label, cat.name].some(value => idsEqual(value, categoryId)))
  return refsFrom([categoryId, match?.id, match?.categoryId, match?.slug, match?.label, match?.name])
}

const buildExamRefs = (examId, exams = [], examInfo = []) => {
  if (!examId) return new Set()
  const allExams = [...(exams || []), ...(examInfo || [])]
  const match = allExams.find(exam =>
    [exam.id, exam._id, exam.examId, exam.exam_id, exam.slug, exam.name, exam.title, exam.value].some(value => idsEqual(value, examId))
  )
  return refsFrom([examId, match?.id, match?._id, match?.examId, match?.exam_id, match?.slug, match?.name, match?.title, match?.value])
}

const buildStageRefs = (stageId) => (stageId ? refsFrom([stageId]) : new Set())

const stageMatchesExam = (stage, examRefs) => valueMatchesRefs(coerceArray(stage?.examIds || stage?.exam_ids || stage?.exam_id || stage?.examId), examRefs)

const buildChildrenByParent = (flatCategories) => {
  const map = new Map()
  flatCategories.forEach(cat => {
    const key = String(cat.parentId || cat.parent_id || '')
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(cat)
  })
  return map
}

const buildTestCategoryRefs = (activeCategory, flatCategories = []) => {
  const refs = refsFrom([...(TEST_CATEGORY_ALIASES[activeCategory] || [activeCategory]), TEST_CATEGORY_NAMES[activeCategory]])
  const seeds = flatCategories.filter(cat =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).some(value => refs.has(String(value)) || refs.has(normalizeKey(value)))
  )
  const childrenByParent = buildChildrenByParent(flatCategories)
  const queue = [...seeds]
  const seen = new Set()
  while (queue.length) {
    const cat = queue.shift()
    const id = String(getEntityId(cat) || cat.categoryId || cat.slug || cat.name || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
      ;[cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })
      ; (childrenByParent.get(String(getEntityId(cat) || '')) || []).forEach(child => queue.push(child))
  }
  return refs
}

const buildRootTestCategoryRecord = (activeCategory, flatCategories = []) => {
  const refs = refsFrom([...(TEST_CATEGORY_ALIASES[activeCategory] || [activeCategory]), TEST_CATEGORY_NAMES[activeCategory]])
  return flatCategories.find(cat =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).some(value => refs.has(String(value)) || refs.has(normalizeKey(value)))
  ) || null
}

const buildCategorySelectionRefs = (categoryId, flatCategories = []) => {
  if (!categoryId) return new Set()
  const refs = refsFrom([categoryId])
  const seed = flatCategories.find(cat => [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).some(value => idsEqual(value, categoryId)))
  if (!seed) return refs
    ;[seed.id, seed._id, seed.slug, seed.name, seed.label, seed.categoryId].filter(Boolean).forEach(value => {
      refs.add(String(value))
      refs.add(normalizeKey(value))
    })
  const childrenByParent = buildChildrenByParent(flatCategories)
  const queue = [...(childrenByParent.get(String(getEntityId(seed) || '')) || [])]
  const seen = new Set([String(getEntityId(seed) || seed.categoryId || seed.slug || seed.name || categoryId)])
  while (queue.length) {
    const cat = queue.shift()
    const id = String(getEntityId(cat) || cat.categoryId || cat.slug || cat.name || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
      ;[cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })
      ; (childrenByParent.get(String(getEntityId(cat) || '')) || []).forEach(child => queue.push(child))
  }
  return refs
}

const recordMatchesTestCategory = (record, refs) => valueMatchesRefs(getTestCategoryValues(record), refs)
const seriesMatchesTestCategory = (series, refs, testsInSeries = []) =>
  valueMatchesRefs(getSeriesCategoryValues(series), refs) || testsInSeries.some(test => recordMatchesTestCategory(test, refs))

const categoryRecordMatchesRefs = (category, refs) =>
  valueMatchesRefs([category.id, category._id, category.slug, category.name, category.label, category.categoryId], refs)

const categoryLinksSeries = (category, seriesId) =>
  coerceArray(category.testSeriesId ?? category.test_series_id ?? category.seriesId ?? category.series_id).some(id => idsEqual(id, seriesId))

const getCategoryLabel = (category) => category?.label || category?.name || category?.slug || category?.categoryId || category?.id || 'Not linked'

const getCategoryPath = (categoryId, flatCategories = []) => {
  const path = []
  const visited = new Set()
  let current = flatCategories.find(cat => [cat.id, cat._id, cat.slug, cat.categoryId].some(value => idsEqual(value, categoryId)))
  while (current && path.length < 10) {
    const id = String(getEntityId(current) || '')
    if (visited.has(id)) break
    visited.add(id)
    path.unshift(current)
    const parentId = current.parentId || current.parent_id
    if (!parentId) break
    current = flatCategories.find(cat => idsEqual(cat.id, parentId) || idsEqual(cat._id, parentId))
  }
  return path
}

const getCategoryPathLabel = (categoryId, flatCategories = []) => {
  const path = getCategoryPath(categoryId, flatCategories)
  return path.map(cat => getCategoryLabel(cat)).join(' / ') || 'Not linked'
}

const getCategoryId = (category) => getEntityId(category) || category?.categoryId || category?.slug || null

const getCategoryRelationshipLabels = (category, flatCategories = [], fallbackCategory = 'Not linked') => {
  if (!category) {
    return {
      testCategory: fallbackCategory || 'Not linked',
      testSubcategory: 'Not linked',
    }
  }

  const path = getCategoryPath(getCategoryId(category), flatCategories)
  const root = path[0] || category
  const descendants = path.slice(1)

  return {
    testCategory: getCategoryPathLabel(getCategoryId(root), flatCategories),
    testSubcategory: descendants.length > 0
      ? descendants.map(cat => getCategoryLabel(cat)).join(' / ')
      : 'Not linked',
  }
}

const Badge = ({ children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${tones[tone] || tones.gray}`}>{children}</span>
}

const EmptyState = ({ title, description, icon: Icon = FileText }) => (
  <div className="bg-white rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center py-14 text-center px-4">
    <Icon className="w-12 h-12 text-gray-300 mb-3" />
    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
    <p className="text-sm text-gray-500 mt-1">{description}</p>
  </div>
)

const StatCard = ({ icon: Icon, value, label, tone, compact }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex items-center gap-2.5 p-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tones[tone] || tones.indigo}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
          <p className="text-[10px] text-gray-500 leading-tight truncate">{label}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone] || tones.indigo}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

// ─── Cascading Category Dropdown ────────────────────────────────────────────
// Shows progressive dropdowns: selecting L1 reveals L2, selecting L2 reveals L3, etc.
const CascadingCategorySelect = ({ allSubCategories = [], flatTestCategories = [], value, onChange }) => {
  // Derive which category is selected at each depth level from the current value.
  // allSubCategories items have _depth: 1 = direct child of root, 2 = grandchild, etc.
  const subCatIdSet = useMemo(() => new Set(allSubCategories.map(c => String(getEntityId(c) || ''))), [allSubCategories])

  const levels = useMemo(() => {
    if (!value) return ['', '', '', '']
    const path = getCategoryPath(String(value), flatTestCategories)
    const inSubs = path.filter(p => subCatIdSet.has(String(getEntityId(p) || '')))
    return [
      inSubs[0] ? String(getEntityId(inSubs[0]) || '') : '',
      inSubs[1] ? String(getEntityId(inSubs[1]) || '') : '',
      inSubs[2] ? String(getEntityId(inSubs[2]) || '') : '',
      inSubs[3] ? String(getEntityId(inSubs[3]) || '') : '',
    ]
  }, [value, flatTestCategories, subCatIdSet])

  // Options for each level
  const opts1 = useMemo(() => {
    return allSubCategories.filter(c => c._depth === 1)
  }, [allSubCategories])

  const opts2 = useMemo(() => levels[0] ? flatTestCategories.filter(c => String(c.parentId ?? c.parent_id ?? '') === levels[0] && c.isActive !== false) : [], [levels[0], flatTestCategories])
  const opts3 = useMemo(() => levels[1] ? flatTestCategories.filter(c => String(c.parentId ?? c.parent_id ?? '') === levels[1] && c.isActive !== false) : [], [levels[1], flatTestCategories])
  const opts4 = useMemo(() => levels[2] ? flatTestCategories.filter(c => String(c.parentId ?? c.parent_id ?? '') === levels[2] && c.isActive !== false) : [], [levels[2], flatTestCategories])

  const handleChange = (levelIdx, newId) => {
    const next = [...levels]
    next[levelIdx] = newId
    for (let i = levelIdx + 1; i < 4; i++) next[i] = ''
    // testCategoryId = deepest non-empty selection
    const deepest = [...next].reverse().find(id => id !== '') || ''
    onChange(deepest)
  }

  const selectCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white'
  const rowCls = (indent) => `flex items-center gap-2${indent ? ` ml-${indent}` : ''}`

  if (opts1.length === 0) {
    return <p className="text-sm text-gray-400 italic py-1">No subcategories available for this test type.</p>
  }

  return (
    <div className="space-y-2">
      {/* Level 1 — always visible */}
      <div className={rowCls(0)}>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-6 shrink-0">L1</span>
        <select value={levels[0]} onChange={e => handleChange(0, e.target.value)} className={selectCls}>
          <option value="">— Select type —</option>
          {opts1.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
        </select>
      </div>

      {/* Level 2 — revealed when L1 selected and has children */}
      {levels[0] && opts2.length > 0 && (
        <div className={rowCls(4)}>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-6 shrink-0">L2</span>
          <select value={levels[1]} onChange={e => handleChange(1, e.target.value)} className={selectCls}>
            <option value="">— Select —</option>
            {opts2.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
          </select>
        </div>
      )}

      {/* Level 3 — revealed when L2 selected and has children */}
      {levels[1] && opts3.length > 0 && (
        <div className={rowCls(8)}>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-6 shrink-0">L3</span>
          <select value={levels[2]} onChange={e => handleChange(2, e.target.value)} className={selectCls}>
            <option value="">— Select —</option>
            {opts3.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
          </select>
        </div>
      )}

      {/* Level 4 — revealed when L3 selected and has children */}
      {levels[2] && opts4.length > 0 && (
        <div className={rowCls(12)}>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-6 shrink-0">L4</span>
          <select value={levels[3]} onChange={e => handleChange(3, e.target.value)} className={selectCls}>
            <option value="">— Select —</option>
            {opts4.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
          </select>
        </div>
      )}

      {/* Selected path breadcrumb */}
      {value && (
        <p className="text-[11px] text-indigo-600 font-medium pl-8 truncate">
          ✓ {getCategoryPathLabel(String(value), flatTestCategories)}
        </p>
      )}
    </div>
  )
}


// ─── Compact Section Picker Component ──────────────────────────────────────
const CompactSectionPicker = ({ availableSections = [], value = '', onChange, contextLabel }) => {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const selectedIds = useMemo(() => {
    return parseIdList(value).map(String)
  }, [value])

  // Partition matching (exam/stage linked) vs other sections
  const { matchingSections, otherSections } = useMemo(() => {
    const matching = []
    const other = []

    const stageText = String(contextLabel || '').toLowerCase()

    const isSectionStageMatch = (sec) => {
      const secStageLower = String(sec.exam_stage || sec.stage_name || sec.paper || '').toLowerCase()
      const secNameLower = String(sec.name || '').toLowerCase()

      // Direct DB match
      if (secStageLower && (stageText.includes(secStageLower) || secStageLower.includes(stageText))) {
        return true
      }

      // Explicit Tier-I / Tier 1 stage matching
      const isTier1Target = (
        stageText.includes('tier-i') ||
        stageText.includes('tier 1') ||
        stageText.includes('tier i') ||
        stageText.includes('cbt-1') ||
        stageText.includes('cbt 1') ||
        stageText.includes('prelims') ||
        stageText.includes('paper-i') ||
        stageText.includes('paper 1')
      )

      if (isTier1Target) {
        // Tier-I section names
        const isTier1Section = (
          secNameLower.includes('general intelligence') ||
          secNameLower.includes('reasoning') ||
          secNameLower.includes('general awareness') ||
          secNameLower.includes('quantitative aptitude') ||
          secNameLower.includes('english comprehension') ||
          (secNameLower.includes('english') && !secNameLower.includes('computer') && (sec.expected_questions <= 25 || sec.expected_questions === 0))
        )
        // Exclude Tier-II exclusive sections
        const isTier2Exclusive = (
          secNameLower.includes('computer') ||
          secNameLower.includes('data entry') ||
          secNameLower.includes('dest') ||
          secNameLower.includes('statistics') ||
          secNameLower.includes('mathematical abilities')
        )
        return isTier1Section && !isTier2Exclusive
      }

      // Explicit Tier-II / Tier 2 stage matching
      const isTier2Target = (
        stageText.includes('tier-ii') ||
        stageText.includes('tier 2') ||
        stageText.includes('tier ii') ||
        stageText.includes('cbt-2') ||
        stageText.includes('cbt 2') ||
        stageText.includes('mains') ||
        stageText.includes('paper-ii') ||
        stageText.includes('paper 2')
      )

      if (isTier2Target) {
        return (
          secNameLower.includes('mathematical abilities') ||
          secNameLower.includes('reasoning & general intelligence') ||
          secNameLower.includes('computer') ||
          secNameLower.includes('data entry') ||
          secNameLower.includes('dest') ||
          secNameLower.includes('statistics') ||
          (secNameLower.includes('english') && sec.expected_questions > 25) ||
          (secNameLower.includes('awareness') && sec.expected_questions > 0)
        )
      }

      return sec.source === 'test' || sec.source === 'series_stage' || Boolean(sec.test_series_id) || Boolean(sec.exam_id)
    }

    availableSections.forEach(sec => {
      if (isSectionStageMatch(sec)) {
        matching.push(sec)
      } else {
        other.push(sec)
      }
    })

    return {
      matchingSections: matching.length > 0 ? matching : availableSections,
      otherSections: matching.length > 0 ? other : [],
    }
  }, [availableSections, contextLabel])

  const displayedList = useMemo(() => {
    let list = showAll ? [...matchingSections, ...otherSections] : matchingSections
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.exam_stage || '').toLowerCase().includes(q) ||
        (s.paper || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [matchingSections, otherSections, showAll, search])

  const toggleSection = (id) => {
    const strId = String(id)
    let newSelected = []
    if (selectedIds.includes(strId)) {
      newSelected = selectedIds.filter(i => i !== strId)
    } else {
      newSelected = [...selectedIds, strId]
    }
    onChange(newSelected.join(', '))
  }

  const selectAllDisplayed = () => {
    const newIds = new Set([...selectedIds, ...displayedList.map(s => String(s.id))])
    onChange(Array.from(newIds).join(', '))
  }

  const deselectAll = () => {
    onChange('')
  }

  if (availableSections.length === 0) {
    return (
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
        No sections available for this exam scheme. Select an exam scheme below or create sections.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header with Title & Quick Actions */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Test Sections
          <span className="ml-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            {selectedIds.length} selected
          </span>
        </label>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAllDisplayed}
            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-red-500 hover:text-red-700 font-semibold cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter sections by name..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>

        {otherSections.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(prev => !prev)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              showAll
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {showAll ? `Exam Linked (${matchingSections.length})` : `Show All (${availableSections.length})`}
          </button>
        )}
      </div>

      {/* Compact Interactive Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 border border-gray-200 rounded-xl bg-gray-50/50 scrollbar-thin">
        {displayedList.map(sec => {
          const isSelected = selectedIds.includes(String(sec.id))
          return (
            <div
              key={sec.id}
              onClick={() => toggleSection(sec.id)}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isSelected
                  ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 shadow-sm'
                  : 'bg-white hover:bg-gray-100/70 border-gray-200 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate leading-tight">{sec.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
                    <span>⏱️ {sec.duration} min</span>
                    {sec.expected_questions > 0 && <span>• ❓ {sec.expected_questions} Qs</span>}
                    {sec.exam_stage && (
                      <span className="px-1 py-0.2 rounded bg-gray-100 text-gray-600 font-medium">
                        {sec.exam_stage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {sec.source === 'series_stage' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold shrink-0">Stage</span>
              )}
              {sec.source === 'test' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-bold shrink-0">Test</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TestFormModal = ({ isOpen, onClose, onSubmit, formData, setFormData, editingId, contextLabel, saving, relationshipSummary, availableSections, allSubCategories, flatTestCategories, selectedPresetId, setSelectedPresetId, applySectionPreset, seriesList = [], selectedSeries = null }) => {
  if (!isOpen) return null
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(formData)
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in">
      <div className={`bg-white rounded-xl w-full ${editingId && relationshipSummary ? 'max-w-5xl' : 'max-w-3xl'} max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl`}>
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Test' : 'Create Test'}</h2>
            <p className="text-xs text-gray-500 mt-1">{contextLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className={editingId && relationshipSummary ? "grid grid-cols-1 md:grid-cols-3 gap-6 items-start" : "space-y-5"}>
              
              {/* LEFT COLUMN: Form Inputs & Configurations (Spans 2 columns if editing) */}
              <div className={`${editingId && relationshipSummary ? 'md:col-span-2' : ''} space-y-5`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {seriesList.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Series *</label>
                      <select
                        required
                        value={formData.testSeriesId || (selectedSeries ? String(getSeriesId(selectedSeries)) : '')}
                        onChange={(e) => setFormData({ ...formData, testSeriesId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm bg-white"
                      >
                        <option value="">Select Test Series...</option>
                        {seriesList.map(s => (
                          <option key={getSeriesId(s)} value={getSeriesId(s)}>
                            {s.title || s.name || s.slug}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      required
                      value={formData.title}
                      onChange={(e) => {
                        const newTitle = e.target.value
                        setFormData(prev => {
                          const autoSlug = normalizeKey(newTitle)
                          const isAutoSlug = !prev.isCustomSlug || !prev.slug || prev.slug === normalizeKey(prev.title)
                          return {
                            ...prev,
                            title: newTitle,
                            slug: isAutoSlug ? autoSlug : prev.slug,
                          }
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. SSC CGL Tier-I Full Mock Test 1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                    <input
                      value={formData.slug}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
                        setFormData(prev => ({
                          ...prev,
                          slug: val,
                          isCustomSlug: true,
                        }))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                      placeholder="auto-generated-from-title"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      URL Slug: <span className="font-mono font-semibold text-indigo-600">{formData.slug || normalizeKey(formData.title) || 'auto-generated-slug'}</span>
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Test Subcategory</label>
                    <CascadingCategorySelect
                      allSubCategories={allSubCategories}
                      flatTestCategories={flatTestCategories}
                      value={formData.testCategoryId || ''}
                      onChange={(selectedId) => {
                        if (!selectedId) {
                          setFormData({ ...formData, testCategoryId: '', subCategoryLevel1: '', subCategoryLevel2: '', subCategoryLevel3: '', subCategoryLevel4: '' })
                          return
                        }
                        const subIds = new Set(allSubCategories.map(c => String(getEntityId(c) || '')))
                        const path = getCategoryPath(selectedId, flatTestCategories).filter(p => subIds.has(String(getEntityId(p) || '')))
                        setFormData({
                          ...formData,
                          testCategoryId: selectedId,
                          subCategoryLevel1: path[0] ? String(getEntityId(path[0]) || '') : '',
                          subCategoryLevel2: path[1] ? String(getEntityId(path[1]) || '') : '',
                          subCategoryLevel3: path[2] ? String(getEntityId(path[2]) || '') : '',
                          subCategoryLevel4: path[3] ? String(getEntityId(path[3]) || '') : '',
                        })
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <CompactSectionPicker
                      availableSections={availableSections}
                      value={formData.sectionIds}
                      onChange={(newSectionIds) => setFormData({ ...formData, sectionIds: newSectionIds })}
                      contextLabel={contextLabel}
                    />
                    {editingId && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Exam Scheme:</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={selectedPresetId}
                            onChange={(e) => setSelectedPresetId(e.target.value)}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-left whitespace-normal break-words"
                            style={{ textOverflow: 'unset', whiteSpace: 'normal' }}
                          >
                            {SECTION_PRESETS.map(p => (
                              <option key={p.id} value={p.id}>{p.label} — {p.description}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={applySectionPreset}
                            disabled={saving}
                            className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap transition-colors shrink-0"
                          >
                            Apply to Test
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {[
                    ['duration', 'Duration (minutes)', 1, '1'],
                    ['negativeMarking', 'Negative Marking', 0, '0.25'],
                  ].map(([key, label, min, step]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                      <input type="number" min={min} step={step} value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    </div>
                  ))}
                  {editingId && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Total Questions (Auto)</label>
                        <input readOnly value={formData.totalQuestions || 0} className="w-full px-3 py-2 border border-gray-300 bg-gray-50/80 rounded-lg outline-none text-gray-500 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Total Marks (Auto)</label>
                        <input readOnly value={formData.totalMarks || 0} className="w-full px-3 py-2 border border-gray-300 bg-gray-50/80 rounded-lg outline-none text-gray-500 cursor-not-allowed" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select value={formData.difficulty} onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  {formData.isLive && (
                    <div className="sm:col-span-2 p-4 bg-red-50/60 border border-red-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                        <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">Live Test Schedule & Availability Window</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Live Start Time (Available From) *</label>
                          <input
                            type="datetime-local"
                            value={formData.scheduledAt ? String(formData.scheduledAt).slice(0, 16) : ''}
                            onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xs bg-white"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">Exact date & time when the live test becomes active</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Live End Time (Available Until) *</label>
                          <input
                            type="datetime-local"
                            value={formData.scheduledEnd ? String(formData.scheduledEnd).slice(0, 16) : ''}
                            onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xs bg-white"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">When the live contest window closes</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="comma, separated, tags" />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Timer Mode & Visibility Access</h4>
                  <div className="flex flex-wrap gap-4">
                    {[
                      ['hasSectionalTiming', '⏱️ Sectional Timing (On / Off)'],
                      ['isPro', 'Pro Pass Required'],
                      ['isComingSoon', 'Coming Soon'],
                      ['isLive', 'Live Test'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer group bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-all">
                        <input type="checkbox" checked={Boolean(formData[key])} onChange={(e) => {
                          const updates = { [key]: e.target.checked }
                          // Auto-connect Live Test with live-tests test category
                          if (key === 'isLive') {
                            updates.type = e.target.checked ? 'live-tests' : 'mock-tests'
                          }
                          setFormData({ ...formData, ...updates })
                        }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Linked Relationships (Sticky sidebar) */}
              {editingId && relationshipSummary && (
                <div className="md:col-span-1 md:sticky md:top-0">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-indigo-100/55 pb-2.5">
                      <Layers className="w-4.5 h-4.5 text-indigo-600" />
                      <h3 className="text-sm font-bold text-indigo-900">Linked Relationships</h3>
                    </div>
                    <div className="space-y-3.5">
                      {[
                        ['Test Series', relationshipSummary.series],
                        ['Stage', relationshipSummary.stage],
                        ['Test Category', relationshipSummary.testCategory],
                        ['Test Subcategory', relationshipSummary.testSubcategory],
                        ['Test Sections', relationshipSummary.sections],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-white/90 bg-white px-3.5 py-3 shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
                          <div className="mt-1 text-xs font-bold text-gray-800 break-words leading-relaxed">{value || 'Not linked'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ACTION BUTTONS (Fixed Footer) */}
          <div className="px-4 py-3 sm:px-6 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm font-semibold shadow-sm">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : `${editingId ? 'Update' : 'Create'} Test`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const BulkUploadModal = ({ isOpen, onClose, onUpload, onValidate, contextLabel, linkingInfo }) => {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null)
    setValidationResult(null)
  }

  const handleValidate = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    setValidating(true)
    try {
      const result = await onValidate(file)
      setValidationResult(result)
    } catch (error) {
      toast.error(error.message || 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }
    setUploading(true)
    try {
      await onUpload(file)
      setFile(null)
      setValidationResult(null)
      onClose()
    } catch (error) {
      toast.error(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Create Tests</h2>
            <p className="text-xs text-gray-500 mt-1">{contextLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {linkingInfo && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">Tests will be linked to:</p>
              <div className="space-y-1 text-xs text-indigo-700 dark:text-indigo-300">
                {linkingInfo.seriesName && <p><span className="font-medium">Series:</span> {linkingInfo.seriesName}</p>}
                {linkingInfo.examName && <p><span className="font-medium">Exam:</span> {linkingInfo.examName}</p>}
                {linkingInfo.stageName && <p><span className="font-medium">Stage:</span> {linkingInfo.stageName}</p>}
                {linkingInfo.categoryName && <p><span className="font-medium">Category:</span> {linkingInfo.categoryName}</p>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
            <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleFileChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            <p className="text-xs text-gray-500 mt-2">Supported columns include title, duration, totalQuestions, totalMarks, difficulty, type, and tags.</p>
          </div>

          {validationResult && (
            <div className={`p-4 rounded-lg ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`font-medium ${validationResult.isValid ? 'text-green-800' : 'text-amber-800'}`}>
                {validationResult.isValid ? '✓ Validation passed' : '⚠ Validation found issues'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {validationResult.validRows} valid rows out of {validationResult.totalRows}
              </p>
              {!validationResult.isValid && (
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {validationResult.errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-xs text-amber-700">Row {err.row}: {err.reason} {err.title ? `("${err.title}")` : ''}</p>
                  ))}
                  {validationResult.errors.length > 5 && (
                    <p className="text-xs text-amber-600">...and {validationResult.errors.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} disabled={uploading} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={handleValidate} disabled={uploading || !file || validating} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {validating ? 'Validating...' : 'Validate'}
            </button>
            <button type="submit" disabled={uploading || !file} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TestsManager() {
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkAppliedRef = useRef(false)
  const {
    categories: examCategories,
    exams: examsFromHook = [],
    examInfo,
    getSubcategories,
    loading: examFiltersLoading,
  } = useExamCategories()

  const [tests, setTests] = useState([])
  const [seriesList, setSeriesList] = useState([])
  const [stages, setStages] = useState([])
  const [testCategories, setTestCategories] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showFullTestImport, setShowFullTestImport] = useState(false)
  const getInitialTab = () => {
    const urlTab = searchParams.get('tab')
    return urlTab && TEST_CATEGORY_TABS.some(t => t.id === urlTab) ? urlTab : 'mock-tests'
  }
  const [activeTestCategory, setActiveTestCategory] = useState(getInitialTab)
  const [activeExamCategoryId, setActiveExamCategoryId] = useState('')
  const [activeExamId, setActiveExamId] = useState('')
  const [activeStageId, setActiveStageId] = useState('')
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [selectedTestSubCategoryId, setSelectedTestSubCategoryId] = useState('all')
  // Cascading subcategory levels
  const [subCategoryLevel1, setSubCategoryLevel1] = useState('') // Top level (Year Based, Exam Based)
  const [subCategoryLevel2, setSubCategoryLevel2] = useState('') // Second level (2025, 2024)
  const [subCategoryLevel3, setSubCategoryLevel3] = useState('') // Third level (if needed)
  const [subCategoryLevel4, setSubCategoryLevel4] = useState('') // Fourth level (if needed)
  const [showForm, setShowForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(DEFAULT_TEST_FORM)
  const [editingRelationshipSummary, setEditingRelationshipSummary] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})
  const [selectedPresetId, setSelectedPresetId] = useState(SECTION_PRESETS[0]?.id || '')
  const [scopedSections, setScopedSections] = useState([])
  const [scopedSectionsLoading, setScopedSectionsLoading] = useState(false)
  const [selectedTestIds, setSelectedTestIds] = useState([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [showSelectDropdown, setShowSelectDropdown] = useState(false)

  const fetchData = async (signal = null) => {
    try {
      setLoading(true)
      setErrors({})
      const [testsRes, seriesRes, stagesRes, catsRes, sectionsRes] = await Promise.allSettled([
        adminAPI.apiClient.get('/admin/tests', { ...(signal ? { signal } : {}) }),
        adminAPI.apiClient.get('/admin/test-series', { ...(signal ? { signal } : {}) }),
        adminAPI.apiClient.get('/admin/stages', { ...(signal ? { signal } : {}) }),
        adminAPI.apiClient.get('/admin/test-categories', { ...(signal ? { signal } : {}) }),
        adminAPI.apiClient.get('/admin/sections', { ...(signal ? { signal } : {}) }),
      ])

      if (signal?.aborted) return

      const isCanceled = (res) => {
        if (!res || res.status === 'fulfilled') return false
        const reason = res.reason
        return (
          reason?.name === 'CanceledError' ||
          reason?.name === 'AbortError' ||
          reason?.code === 'ERR_CANCELED'
        )
      }

      const newErrors = {}

      if (testsRes.status === 'fulfilled' && testsRes.value.data?.data) {
        setTests(testsRes.value.data.data.map(normalizeTest))
      } else if (!isCanceled(testsRes)) {
        newErrors.tests = 'Failed to load tests'
      }

      if (seriesRes.status === 'fulfilled' && seriesRes.value.data?.data) {
        setSeriesList(seriesRes.value.data.data)
      } else if (!isCanceled(seriesRes)) {
        newErrors.series = 'Failed to load test series'
      }

      if (stagesRes.status === 'fulfilled' && stagesRes.value.data?.data) {
        setStages(stagesRes.value.data.data)
      } else if (!isCanceled(stagesRes)) {
        newErrors.stages = 'Failed to load stages'
      }

      if (catsRes.status === 'fulfilled' && catsRes.value.data?.data) {
        setTestCategories(catsRes.value.data.data)
      } else if (!isCanceled(catsRes)) {
        newErrors.categories = 'Failed to load categories'
      }

      if (sectionsRes.status === 'fulfilled' && sectionsRes.value.data?.data) {
        setSections(sectionsRes.value.data.data)
      } else if (!isCanceled(sectionsRes)) {
        newErrors.sections = 'Failed to load sections'
      }

      if (!signal?.aborted && Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        const errorCount = Object.keys(newErrors).length
        toast.error(`Failed to load ${errorCount} data source${errorCount > 1 ? 's' : ''}`)
      }
    } catch (error) {
      if (signal?.aborted) return
      console.error('Tests fetch error:', error)
      toast.error('Failed to load tests')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [])

  // Auto-fetch sections scoped to the currently selected series+stage when
  // the test form is open. Falls back through test_id → series+stage → defaults.
  useEffect(() => {
    if (!showForm) return
    let cancelled = false
    const seriesId = selectedSeries ? getSeriesId(selectedSeries) : null
    const params = {}
    if (editingId) params.testId = editingId
    else if (seriesId) params.testSeriesId = seriesId
    if (activeStageId) params.stageId = activeStageId
    if (activeExamId) params.examId = activeExamId

    setScopedSectionsLoading(true)
    adminAPI.getSectionsForTest(params)
      .then(res => {
        if (cancelled) return
        const rows = res?.data?.data || []
        setScopedSections(rows.map(normalizeSectionForForm))
      })
      .catch(err => {
        console.error('Failed to load scoped sections:', err)
        if (!cancelled) setScopedSections([])
      })
      .finally(() => { if (!cancelled) setScopedSectionsLoading(false) })

    return () => { cancelled = true }
  }, [showForm, editingId, selectedSeries, activeStageId, activeExamId])

  // Keep URL in sync with the active tab (?tab=...)
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    const validTab = urlTab && TEST_CATEGORY_TABS.some(t => t.id === urlTab) ? urlTab : 'mock-tests'
    if (urlTab && urlTab !== activeTestCategory) {
      setActiveTestCategory(validTab)
      setSelectedSeries(null)
    } else if (!urlTab && activeTestCategory !== 'mock-tests') {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'mock-tests')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams])

  const handleTabChange = (tabId) => {
    setActiveTestCategory(tabId)
    setSelectedSeries(null)
    setSelectedTestSubCategoryId('all')
    setSubCategoryLevel1('')
    setSubCategoryLevel2('')
    setSubCategoryLevel3('')
    setSubCategoryLevel4('')
    const next = new URLSearchParams(searchParams)
    next.set('tab', tabId)
    setSearchParams(next, { replace: true })
  }

  const flatTestCategories = useMemo(() => flattenCategories(testCategories), [testCategories])
  const activeTestCategoryRefs = useMemo(() => buildTestCategoryRefs(activeTestCategory, flatTestCategories), [activeTestCategory, flatTestCategories])
  const activeTestCategoryRecord = useMemo(() => buildRootTestCategoryRecord(activeTestCategory, flatTestCategories), [activeTestCategory, flatTestCategories])
  const activeCatLabel = TEST_CATEGORY_TABS.find(tab => tab.id === activeTestCategory)?.label || TEST_CATEGORY_NAMES[activeTestCategory] || activeTestCategory

  const activeTestSubCategories = useMemo(() => {
    if (!activeTestCategoryRecord) return []
    const rootId = String(getEntityId(activeTestCategoryRecord) || '')
    // Build children map for quick lookup
    const childrenByParent = new Map()
    flatTestCategories.forEach(cat => {
      const pid = String(cat.parentId || cat.parent_id || '')
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid).push(cat)
    })
    // DFS to get all descendants with depth
    const result = []
    const visited = new Set()
    const processChildren = (parentId, depth) => {
      const children = (childrenByParent.get(parentId) || [])
        .filter(cat => cat.isActive !== false)
        .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
      children.forEach(child => {
        const childId = String(getEntityId(child) || '')
        if (visited.has(childId)) return
        visited.add(childId)
        result.push({ ...child, _depth: depth })
        processChildren(childId, depth + 1)
      })
    }
    processChildren(rootId, 1)
    return result
  }, [activeTestCategoryRecord, flatTestCategories])

  const modalSubCategories = useMemo(() => {
    const targetType = formData.isLive ? 'live-tests' : (formData.type || activeTestCategory)
    const targetRecord = buildRootTestCategoryRecord(targetType, flatTestCategories)
    if (!targetRecord) return activeTestSubCategories
    const rootId = String(getEntityId(targetRecord) || '')
    const childrenByParent = new Map()
    flatTestCategories.forEach(cat => {
      const pid = String(cat.parentId || cat.parent_id || '')
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid).push(cat)
    })
    const result = []
    const visited = new Set()
    const processChildren = (parentId, depth) => {
      const children = (childrenByParent.get(parentId) || [])
        .filter(cat => cat.isActive !== false)
        .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
      children.forEach(child => {
        const childId = String(getEntityId(child) || '')
        if (visited.has(childId)) return
        visited.add(childId)
        result.push({ ...child, _depth: depth })
        processChildren(childId, depth + 1)
      })
    }
    processChildren(rootId, 1)
    return result.length > 0 ? result : activeTestSubCategories
  }, [formData.isLive, formData.type, activeTestCategory, flatTestCategories, activeTestSubCategories])

  // Cascading subcategory dropdowns - get children for each level
  const subCategoryOptionsLevel1 = useMemo(() => {
    if (!activeTestCategoryRecord) return []
    const rootId = String(getEntityId(activeTestCategoryRecord) || '')
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === rootId && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [activeTestCategoryRecord, flatTestCategories])

  const subCategoryOptionsLevel2 = useMemo(() => {
    if (!subCategoryLevel1) return []
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === String(subCategoryLevel1) && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [subCategoryLevel1, flatTestCategories])

  const subCategoryOptionsLevel3 = useMemo(() => {
    if (!subCategoryLevel2) return []
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === String(subCategoryLevel2) && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [subCategoryLevel2, flatTestCategories])

  const subCategoryOptionsLevel4 = useMemo(() => {
    if (!subCategoryLevel3) return []
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === String(subCategoryLevel3) && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [subCategoryLevel3, flatTestCategories])

  // Compute the final selectedTestSubCategoryId from cascading levels
  const cascadingSelectedSubCategoryId = useMemo(() => {
    return subCategoryLevel4 || subCategoryLevel3 || subCategoryLevel2 || subCategoryLevel1 || 'all'
  }, [subCategoryLevel1, subCategoryLevel2, subCategoryLevel3, subCategoryLevel4])

  // Sync cascading selection with selectedTestSubCategoryId
  useEffect(() => {
    if (selectedTestSubCategoryId === 'all') {
      setSubCategoryLevel1('')
      setSubCategoryLevel2('')
      setSubCategoryLevel3('')
      setSubCategoryLevel4('')
    } else if (selectedTestSubCategoryId) {
      // Find the category and build its path
      const cat = flatTestCategories.find(c => [c.id, c._id, c.categoryId, c.slug].some(value => idsEqual(value, selectedTestSubCategoryId)))
      if (cat) {
        const path = getCategoryPath(selectedTestSubCategoryId, flatTestCategories)
        if (path.length >= 1) setSubCategoryLevel1(getEntityId(path[0]) || '')
        if (path.length >= 2) setSubCategoryLevel2(getEntityId(path[1]) || '')
        if (path.length >= 3) setSubCategoryLevel3(getEntityId(path[2]) || '')
        if (path.length >= 4) setSubCategoryLevel4(getEntityId(path[3]) || '')
      }
    }
  }, [])

  const editingTest = useMemo(
    () => tests.find(test => idsEqual(getTestId(test), editingId)) || null,
    [tests, editingId]
  )

  const examsForActiveCategory = useMemo(() => {
    if (!activeExamCategoryId) return []
    return getSubcategories(activeExamCategoryId) || []
  }, [activeExamCategoryId, getSubcategories])

  const activeExamCategoryRefs = useMemo(() => buildExamCategoryRefs(activeExamCategoryId, examCategories), [activeExamCategoryId, examCategories])
  const activeExamRefs = useMemo(() => buildExamRefs(activeExamId, examsFromHook, examInfo), [activeExamId, examsFromHook, examInfo])
  const activeStageRefs = useMemo(() => buildStageRefs(activeStageId), [activeStageId])

  const stagesForActiveExam = useMemo(() => {
    if (!activeExamId || activeExamRefs.size === 0) return []
    const linked = stages.filter(stage => stageMatchesExam(stage, activeExamRefs))
    return linked.length > 0 ? linked : stages
  }, [activeExamId, activeExamRefs, stages])

  useEffect(() => {
    const hasPendingDeepLink = !deepLinkAppliedRef.current && (searchParams.get('seriesId') || searchParams.get('stageId'))
    if (!activeExamCategoryId && examCategories.length > 0 && !hasPendingDeepLink) {
      const first = examCategories[0]
      setActiveExamCategoryId(first.categoryId || first.slug || first.id)
    }
  }, [activeExamCategoryId, examCategories, searchParams])

  useEffect(() => {
    const hasPendingDeepLink = !deepLinkAppliedRef.current && (searchParams.get('seriesId') || searchParams.get('stageId'))
    if (hasPendingDeepLink) return
    if (!activeExamCategoryId) {
      setActiveExamId('')
      return
    }
    if (examsForActiveCategory.length === 0) return
    const stillValid = examsForActiveCategory.some(exam => idsEqual(exam.value, activeExamId))
    if (!stillValid) setActiveExamId(examsForActiveCategory[0].value)
  }, [activeExamCategoryId, examsForActiveCategory, activeExamId, searchParams])

  useEffect(() => {
    const hasPendingDeepLink = !deepLinkAppliedRef.current && (searchParams.get('seriesId') || searchParams.get('stageId'))
    if (hasPendingDeepLink) return
    const isValidStage = activeStageId && stagesForActiveExam.some(stage => idsEqual(getEntityId(stage), activeStageId))
    if (!isValidStage && stagesForActiveExam.length > 0) {
      const firstStageId = getEntityId(stagesForActiveExam[0])
      if (firstStageId) setActiveStageId(firstStageId)
    }
  }, [stagesForActiveExam, activeStageId, searchParams])

  useEffect(() => {
    if (searchParams.get('seriesId')) return
    setSelectedSeries(null)
    setSelectedTestSubCategoryId('all')
  }, [activeTestCategory, activeExamCategoryId, activeExamId, activeStageId, searchParams])




  useEffect(() => {
    if (deepLinkAppliedRef.current || seriesList.length === 0) return
    const seriesId = searchParams.get('seriesId')
    const stageId = searchParams.get('stageId')
    if (!seriesId && !stageId) return
    if (seriesId) {
      const series = seriesList.find(item => idsEqual(getSeriesId(item), seriesId))
      if (series) {
        const categoryId = getSeriesExamCategoryId(series)
        const examId = getSeriesExamId(series)
        if (categoryId) setActiveExamCategoryId(String(categoryId))
        if (examId) setActiveExamId(String(examId))
        setSelectedSeries(series)
        deepLinkAppliedRef.current = true
      }
      return
    }
    if (stageId) {
      setActiveStageId(String(stageId))
      deepLinkAppliedRef.current = true
    }
  }, [seriesList, searchParams])

  const testsBySeriesId = useMemo(() => {
    const map = new Map()
    tests.forEach(test => {
      const seriesId = String(getTestSeriesId(test) || '')
      if (!seriesId) return
      if (!map.has(seriesId)) map.set(seriesId, [])
      map.get(seriesId).push(test)
    })
    return map
  }, [tests])

  // Precomputed stats map to eliminate O(series * tests) filtering during card render
  const seriesLinkedTestsStatsMap = useMemo(() => {
    const map = new Map()
    for (const [seriesIdKey, testsInSeries] of testsBySeriesId.entries()) {
      const linkedTests = testsInSeries.filter(test =>
        recordMatchesTestCategory(test, activeTestCategoryRefs) &&
        (activeStageRefs.size === 0 || valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs))
      )
      const totalQuestions = linkedTests.reduce((sum, test) => sum + getTestQuestionsCount(test), 0)
      map.set(seriesIdKey, { linkedTests, count: linkedTests.length, totalQuestions })
    }
    return map
  }, [testsBySeriesId, activeTestCategoryRefs, activeStageRefs])

  const filteredSeriesList = useMemo(() => {
    if (!activeExamCategoryId || !activeExamId) return []
    return seriesList.filter(series => {
      const seriesId = String(getSeriesId(series) || '')
      const testsInSeries = testsBySeriesId.get(seriesId) || []
      if (activeExamCategoryRefs.size > 0 && !valueMatchesRefs([getSeriesExamCategoryId(series)], activeExamCategoryRefs)) return false
      if (activeExamRefs.size > 0 && !valueMatchesRefs([getSeriesExamId(series)], activeExamRefs)) return false
      if (activeStageRefs.size > 0) {
        const seriesStages = coerceArray(series.stages || series.stageIds || series.stage_ids)
        const seriesHasStage = valueMatchesRefs(seriesStages, activeStageRefs)
        const testHasStage = testsInSeries.some(test => valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs))
        if (!seriesHasStage && !testHasStage) return false
      }
      const linkedFromCategory = flatTestCategories.some(category =>
        categoryRecordMatchesRefs(category, activeTestCategoryRefs) && categoryLinksSeries(category, seriesId)
      )
      return linkedFromCategory || seriesMatchesTestCategory(series, activeTestCategoryRefs, testsInSeries)
    })
  }, [seriesList, testsBySeriesId, activeExamCategoryRefs, activeExamRefs, activeStageRefs, activeTestCategoryRefs, activeExamCategoryId, activeExamId, flatTestCategories])

  const seriesTests = useMemo(() => {
    if (!selectedSeries) return []
    const seriesId = String(getSeriesId(selectedSeries) || '')
    return tests
      .filter(test => {
        if (!idsEqual(getTestSeriesId(test), seriesId)) return false
        if (activeTestCategory === 'live-tests') {
          if (!test.isLive && !recordMatchesTestCategory(test, activeTestCategoryRefs)) return false
        } else {
          if (!recordMatchesTestCategory(test, activeTestCategoryRefs)) return false
        }
        if (activeStageRefs.size > 0 && !valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs)) return false
        return true
      })
      .sort((a, b) => {
        const aOrder = a.orderIndex ?? a.order_index ?? a.order ?? 0
        const bOrder = b.orderIndex ?? b.order_index ?? b.order ?? 0
        return aOrder - bOrder || String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''))
      })
  }, [selectedSeries, tests, activeTestCategoryRefs, activeStageRefs])

  // Test matches selected subcategory (including descendants)
  const testMatchesSubCategory = (test, selectedId) => {
    if (!selectedId || selectedId === 'all') return true
    if (selectedId === UNASSIGNED_SUBCATEGORY_ID) {
      return !activeTestSubCategories.some((category) => {
        const categoryId = getEntityId(category)
        return categoryId && testMatchesSubCategory(test, categoryId)
      })
    }
    const refs = buildCategorySelectionRefs(selectedId, flatTestCategories)
    return recordMatchesTestCategory(test, refs)
  }

  // Get test count for a category (including its descendants)
  // NOTE: Must count from seriesTests (pre-subcategory filter), not workspaceTests,
  // to avoid a circular dependency where the selected subcategory zeroes out all sibling counts.
  const getCategoryTestCount = (categoryId) => {
    if (!categoryId || categoryId === 'all') return seriesTests.length
    if (categoryId === UNASSIGNED_SUBCATEGORY_ID) {
      return seriesTests.filter(test => testMatchesSubCategory(test, UNASSIGNED_SUBCATEGORY_ID)).length
    }
    const refs = buildCategorySelectionRefs(categoryId, flatTestCategories)
    return seriesTests.filter(test => recordMatchesTestCategory(test, refs)).length
  }

  const workspaceTests = useMemo(() => {
    if (!selectedTestSubCategoryId || selectedTestSubCategoryId === 'all') return seriesTests
    return seriesTests.filter(test => testMatchesSubCategory(test, selectedTestSubCategoryId))
  }, [seriesTests, selectedTestSubCategoryId, flatTestCategories])
  const selectedExamCategoryLabel = examCategories.find(category => idsEqual(category.categoryId || category.slug || category.id, activeExamCategoryId))?.label || activeExamCategoryId || 'Select exam category'
  const selectedExamLabel = examsForActiveCategory.find(exam => idsEqual(exam.value, activeExamId))?.label || activeExamId || 'Select exam'
  const selectedStageLabel = activeStageId ? stages.find(stage => idsEqual(getEntityId(stage), activeStageId))?.name || activeStageId : 'No stage selected'
  const unassignedSubCategoryCount = getCategoryTestCount(UNASSIGNED_SUBCATEGORY_ID)
  const selectedTestSubCategoryLabel = selectedTestSubCategoryId === 'all'
    ? 'All test subcategories'
    : selectedTestSubCategoryId === UNASSIGNED_SUBCATEGORY_ID
      ? 'Unassigned test subcategory'
      : getCategoryPathLabel(selectedTestSubCategoryId, flatTestCategories)
  const contextSubCategoryLabel = selectedTestSubCategoryId !== 'all'
    ? selectedTestSubCategoryId === UNASSIGNED_SUBCATEGORY_ID
      ? 'Unassigned test subcategory'
      : getCategoryPathLabel(selectedTestSubCategoryId, flatTestCategories)
    : 'All test subcategories'
  const contextLabel = `${selectedSeries?.title || selectedSeries?.name || 'Select series'} / ${selectedStageLabel} / ${activeCatLabel} / ${contextSubCategoryLabel}`

  const linkingInfo = {
    seriesName: selectedSeries?.title || selectedSeries?.name || null,
    examName: activeExamId ? examsForActiveCategory.find(e => idsEqual(e.value, activeExamId))?.label || activeExamId : null,
    stageName: activeStageId ? stages.find(s => idsEqual(getEntityId(s), activeStageId))?.name || null : null,
    categoryName: activeCatLabel || null,
  }

  const categoryCounts = useMemo(() => TEST_CATEGORY_TABS.reduce((acc, tab) => {
    if (tab.id === 'live-tests') {
      acc[tab.id] = tests.filter(test => test.isLive || recordMatchesTestCategory(test, buildTestCategoryRefs(tab.id, flatTestCategories))).length
    } else {
      const refs = buildTestCategoryRefs(tab.id, flatTestCategories)
      acc[tab.id] = tests.filter(test => recordMatchesTestCategory(test, refs)).length
    }
    return acc
  }, {}), [tests, flatTestCategories])

  const tabScopedStats = useMemo(() => {
    const tabTests = tests.filter(test => recordMatchesTestCategory(test, activeTestCategoryRefs))
    const tabPublished = tabTests.filter(test => test.status === 'published').length
    const tabSeries = seriesList.filter(series => {
      if (!(series.isActive !== false && series.is_active !== false)) return false
      const seriesId = String(getSeriesId(series) || '')
      const testsInSeries = testsBySeriesId.get(seriesId) || []
      return seriesMatchesTestCategory(series, activeTestCategoryRefs, testsInSeries)
    })
    const tabCategoryIds = new Set()
    flatTestCategories.forEach(cat => {
      if (categoryRecordMatchesRefs(cat, activeTestCategoryRefs)) {
        tabCategoryIds.add(String(getEntityId(cat) || ''))
      }
    })
    return {
      totalTests: tabTests.length,
      activeSeries: tabSeries.length,
      testCategories: tabCategoryIds.size,
      publishedTests: tabPublished,
    }
  }, [tests, seriesList, testsBySeriesId, flatTestCategories, activeTestCategoryRefs])

  // Stats further scoped by exam category / exam / stage / selected series.
  // This is what the user sees in the four top cards.
  const filteredScopeStats = useMemo(() => {
    const scopedTests = tests.filter(test => {
      // tab
      if (activeTestCategory === 'live-tests') {
        if (!test.isLive && !recordMatchesTestCategory(test, activeTestCategoryRefs)) return false
      } else if (!recordMatchesTestCategory(test, activeTestCategoryRefs)) {
        return false
      }
      // exam category (tests may carry their own copy of examCategory/categoryId)
      if (activeExamCategoryRefs.size > 0) {
        const testCat = test.category || test.examCategoryId || test.categoryId
        if (!valueMatchesRefs([testCat], activeExamCategoryRefs)) {
          // Fallback: derive from the linked series
          const seriesId = String(getTestSeriesId(test) || '')
          const linkedSeries = seriesList.find(s => idsEqual(getSeriesId(s), seriesId))
          if (!linkedSeries || !valueMatchesRefs([getSeriesExamCategoryId(linkedSeries)], activeExamCategoryRefs)) return false
        }
      }
      // exam
      if (activeExamRefs.size > 0) {
        const testExam = test.examId || test.exam_id
        if (!valueMatchesRefs([testExam], activeExamRefs)) {
          const seriesId = String(getTestSeriesId(test) || '')
          const linkedSeries = seriesList.find(s => idsEqual(getSeriesId(s), seriesId))
          if (!linkedSeries || !valueMatchesRefs([getSeriesExamId(linkedSeries)], activeExamRefs)) return false
        }
      }
      // stage
      if (activeStageRefs.size > 0 && !valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs)) return false
      // selected series
      if (selectedSeries && !idsEqual(getTestSeriesId(test), getSeriesId(selectedSeries))) return false
      return true
    })

    const scopedSeries = seriesList.filter(series => {
      if (!(series.isActive !== false && series.is_active !== false)) return false
      const seriesId = String(getSeriesId(series) || '')
      const testsInSeries = testsBySeriesId.get(seriesId) || []
      if (!seriesMatchesTestCategory(series, activeTestCategoryRefs, testsInSeries)) return false
      if (activeExamCategoryRefs.size > 0 && !valueMatchesRefs([getSeriesExamCategoryId(series)], activeExamCategoryRefs)) return false
      if (activeExamRefs.size > 0 && !valueMatchesRefs([getSeriesExamId(series)], activeExamRefs)) return false
      if (activeStageRefs.size > 0) {
        const seriesStages = coerceArray(series.stages || series.stageIds || series.stage_ids)
        const seriesHasStage = valueMatchesRefs(seriesStages, activeStageRefs)
        const testHasStage = testsInSeries.some(test => valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs))
        if (!seriesHasStage && !testHasStage) return false
      }
      if (selectedSeries && !idsEqual(getSeriesId(series), getSeriesId(selectedSeries))) return false
      return true
    })

    // Test categories that are actually used in this scope
    const scopedCategoryIds = new Set()
    scopedTests.forEach(test => {
      getTestCategoryValues(test).forEach(v => { if (v) scopedCategoryIds.add(String(v)) })
    })
    scopedSeries.forEach(series => {
      getSeriesCategoryValues(series).forEach(v => { if (v) scopedCategoryIds.add(String(v)) })
      flatTestCategories.forEach(cat => {
        if (categoryLinksSeries(cat, getSeriesId(series))) scopedCategoryIds.add(String(getEntityId(cat) || ''))
      })
    })

    return {
      totalTests: scopedTests.length,
      activeSeries: scopedSeries.length,
      testCategories: scopedCategoryIds.size,
      publishedTests: scopedTests.filter(t => t.status === 'published').length,
    }
  }, [tests, seriesList, testsBySeriesId, flatTestCategories, activeTestCategory, activeTestCategoryRefs, activeExamCategoryRefs, activeExamRefs, activeStageRefs, selectedSeries])

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setEditingRelationshipSummary(null)
    setFormData(DEFAULT_TEST_FORM)
  }

  const openCreateForm = () => {
    const type = activeTestCategory === 'pyp' ? 'pyp' : activeTestCategory === 'practice' ? 'practice' : activeTestCategory === 'live-tests' ? 'live-tests' : 'mock-tests'
    let l1 = '', l2 = '', l3 = '', l4 = ''
    if (selectedTestSubCategoryId !== 'all' && selectedTestSubCategoryId !== UNASSIGNED_SUBCATEGORY_ID) {
      const path = getCategoryPath(selectedTestSubCategoryId, flatTestCategories)
      const subPath = path.length > 1 ? path.slice(1) : path
      if (subPath.length >= 1) l1 = String(getEntityId(subPath[0]) || '')
      if (subPath.length >= 2) l2 = String(getEntityId(subPath[1]) || '')
      if (subPath.length >= 3) l3 = String(getEntityId(subPath[2]) || '')
      if (subPath.length >= 4) l4 = String(getEntityId(subPath[3]) || '')
    }
    setFormData({
      ...DEFAULT_TEST_FORM,
      testSeriesId: selectedSeries ? String(getSeriesId(selectedSeries) || '') : '',
      type,
      isLive: activeTestCategory === 'live-tests',
      testCategoryId: selectedTestSubCategoryId !== 'all' && selectedTestSubCategoryId !== UNASSIGNED_SUBCATEGORY_ID ? selectedTestSubCategoryId : '',
      subCategoryLevel1: l1,
      subCategoryLevel2: l2,
      subCategoryLevel3: l3,
      subCategoryLevel4: l4,
    })
    setEditingId(null)
    setEditingRelationshipSummary(null)
    setShowForm(true)
  }

  const applySectionPreset = async () => {
    const testId = editingId
    if (!testId) {
      toast.error('Save the test first, then apply an exam scheme')
      return
    }
    const preset = SECTION_PRESETS.find(p => p.id === selectedPresetId)
    if (!preset) return
    try {
      setSaving(true)
      const res = await adminAPI.applySectionPreset({ testId, sections: preset.sections })
      if (res.data?.success) {
        const { linked, created, skipped } = res.data.data
        const parts = []
        if (created.length) parts.push(`${created.length} created`)
        if (linked.length) parts.push(`${linked.length} linked`)
        if (skipped.length) parts.push(`${skipped.length} already linked`)
        toast.success(`Scheme applied: ${parts.join(', ')}`)
        const sectionsRes = await adminAPI.getSections()
        if (sectionsRes.data?.data) setSections(sectionsRes.data.data)
        const allSectionIds = [...created, ...linked].map(s => s.id)
        if (allSectionIds.length > 0) {
          const currentIds = parseIdList(formData.sectionIds).map(Number)
          const merged = [...new Set([...currentIds, ...allSectionIds])].filter(Boolean)
          setFormData(prev => ({ ...prev, sectionIds: merged.join(', ') }))
        }
      }
    } catch (error) {
      console.error('Preset error:', error)
      toast.error(error.response?.data?.message || 'Failed to apply scheme')
    } finally {
      setSaving(false)
    }
  }

  const openEditForm = (test) => {
    const linkedSeries = seriesList.find(item => idsEqual(getSeriesId(item), getTestSeriesId(test)))
    const linkedStage = stages.find(item => idsEqual(getEntityId(item), getStageIdFromTest(test)))

    // Prioritize exact relational test_category_id, then leaf sub_category, then category string fallback
    const testCatId = test.test_category_id || test.testCategoryId
    let linkedTestCategory = null
    if (testCatId) {
      linkedTestCategory = flatTestCategories.find(c => idsEqual(getEntityId(c) || c.categoryId, testCatId)) || null
    }
    if (!linkedTestCategory && (test.sub_category || test.subCategory)) {
      const subVal = test.sub_category || test.subCategory
      linkedTestCategory = flatTestCategories.find(c =>
        [c.id, c._id, c.categoryId, c.slug, c.name, c.label].some(v => idsEqual(v, subVal))
      ) || null
    }
    if (!linkedTestCategory && test.category) {
      linkedTestCategory = flatTestCategories.find(c =>
        [c.id, c._id, c.categoryId, c.slug, c.name, c.label].some(v => idsEqual(v, test.category))
      ) || null
    }

    let l1 = '', l2 = '', l3 = '', l4 = ''
    if (linkedTestCategory) {
      const path = getCategoryPath(getEntityId(linkedTestCategory), flatTestCategories)
      const subPath = path.length > 1 ? path.slice(1) : path
      if (subPath.length >= 1) l1 = String(getEntityId(subPath[0]) || '')
      if (subPath.length >= 2) l2 = String(getEntityId(subPath[1]) || '')
      if (subPath.length >= 3) l3 = String(getEntityId(subPath[2]) || '')
      if (subPath.length >= 4) l4 = String(getEntityId(subPath[3]) || '')
    }

    setFormData({
      ...DEFAULT_TEST_FORM,
      title: test.title || test.name || '',
      slug: test.slug || '',
      testSeriesId: getTestSeriesId(test) || (selectedSeries ? String(getSeriesId(selectedSeries)) : ''),
      testCategoryId: linkedTestCategory ? (getEntityId(linkedTestCategory) || '') : (test.testCategoryId || test.test_category_id || test.subCategory || test.sub_category || ''),
      subCategoryLevel1: l1,
      subCategoryLevel2: l2,
      subCategoryLevel3: l3,
      subCategoryLevel4: l4,
      type: test.type || (activeTestCategory === 'pyp' ? 'pyp' : activeTestCategory === 'practice' ? 'practice' : 'mock-tests'),
      duration: test.duration || test.time_limit || 60,
      totalQuestions: test.totalQuestions || test.total_questions || 0,
      totalMarks: test.totalMarks || test.total_marks || 0,
      negativeMarking: test.negativeMarking || test.negative_marking || 0.25,
      difficulty: test.difficulty || 'medium',
      hasSectionalTiming: Boolean(test.hasSectionalTiming ?? test.has_sectional_timing ?? test.sectionalTiming ?? true),
      isPro: Boolean(test.isPro || test.is_pro),
      isComingSoon: Boolean(test.isComingSoon || test.is_coming_soon),
      isLive: Boolean(test.isLive || test.is_live),
      scheduledAt: test.scheduledAt || test.scheduled_at || '',
      scheduledEnd: test.scheduledEnd || test.scheduled_end || test.dateEnd || test.date_end || '',
      tags: Array.isArray(test.tags) ? test.tags.join(', ') : (test.tags || ''),
      stageIds: Array.isArray(test.stage_ids || test.stageIds) ? (test.stage_ids || test.stageIds).join(', ') : '',
      sectionIds: sections.filter(s => String(s.test_id) === String(getTestId(test))).map(s => s.id).join(', '),
    })

    const categoryLabels = getCategoryRelationshipLabels(
      linkedTestCategory,
      flatTestCategories,
      test.category || 'Not linked'
    )

    const resolvedSubCategoryLabel = categoryLabels.testSubcategory !== 'Not linked' 
      ? categoryLabels.testSubcategory 
      : (test.sub_category || test.subCategory || 'Not linked')

    setEditingRelationshipSummary({
      series: linkedSeries?.title || linkedSeries?.name || linkedSeries?.slug || linkedSeries?.public_id || getTestSeriesId(test) || 'Not linked',
      stage: linkedStage?.name || linkedStage?.title || linkedStage?.slug || getStageIdFromTest(test) || 'Not linked',
      testCategory: categoryLabels.testCategory,
      testSubcategory: resolvedSubCategoryLabel,
      sections: sections.filter(s => String(s.test_id) === String(getTestId(test))).map(s => s.name).join(', ') || 'Not linked',
    })
    setEditingId(getTestId(test))
    setShowForm(true)
  }

  const handleSubmit = async (data) => {
    if (!data.title?.trim()) {
      toast.error('Test title is required')
      return
    }
    const targetSeriesId = data.testSeriesId || (editingTest ? getTestSeriesId(editingTest) : (selectedSeries ? getSeriesId(selectedSeries) : null))
    if (!targetSeriesId && !editingId) {
      toast.error('Select a test series first')
      return
    }
    const currentSeries = seriesList.find(s => idsEqual(getSeriesId(s), targetSeriesId)) || selectedSeries
    try {
      setSaving(true)
      const baseSlug = (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const targetStageId = editingTest ? (getStageIdFromTest(editingTest) || activeStageId || null) : (activeStageId || null)
      const liveCatRecord = flatTestCategories.find(c => c.slug === 'live-tests' || c.name === 'Live Tests')
      const defaultLiveId = liveCatRecord ? getEntityId(liveCatRecord) : 'live-tests'
      const chosenTestCategoryId = data.isLive
        ? (data.testCategoryId || (editingTest ? (editingTest.testCategoryId || editingTest.test_category_id) : defaultLiveId))
        : (data.testCategoryId || (editingTest ? (editingTest.testCategoryId || editingTest.test_category_id || editingTest.subCategory || editingTest.sub_category) : getLinkedTestCategoryId()))

      const parsedDuration = Number(data.duration)
      const payload = {
        title: data.title.trim(),
        slug: data.slug || (editingId ? undefined : `${baseSlug}-${Date.now()}`),
        testSeriesId: targetSeriesId,
        stageId: targetStageId,
        category: getSeriesExamCategoryId(currentSeries) || activeExamCategoryId || '',
        testCategoryId: chosenTestCategoryId,
        subCategory: chosenTestCategoryId,
        type: data.isLive ? 'live-tests' : data.type,
        duration: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60,
        negativeMarking: Number(data.negativeMarking) || 0,
        difficulty: data.difficulty,
        hasSectionalTiming: Boolean(data.hasSectionalTiming),
        has_sectional_timing: Boolean(data.hasSectionalTiming),
        sectionalTiming: Boolean(data.hasSectionalTiming),
        isPro: Boolean(data.isPro),
        isComingSoon: Boolean(data.isComingSoon),
        isLive: Boolean(data.isLive),
        sectionIds: parseIdList(data.sectionIds).map(id => parseInt(id, 10)).filter(id => !Number.isNaN(id)),
        ...(data.isLive && data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
        ...(data.isLive && data.scheduledEnd ? { scheduledEnd: data.scheduledEnd } : {}),
        ...(data.tags ? { tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean) } : {}),
        ...((() => {
          const ids = data.stageIds
            ? data.stageIds.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s))
            : targetStageId ? [parseInt(targetStageId)] : []
          return ids.length > 0 ? { stageIds: ids } : {}
        })()),
      }

      // Only include examId if it has a valid value
      const examId = getSeriesExamId(currentSeries) || activeExamId
      if (examId) {
        payload.examId = examId
      }

      // Remove undefined and null values for optional ID and string fields to avoid validation errors
      Object.keys(payload).forEach(key => {
        if ((key === 'slug' || key.endsWith('Id') || key.endsWith('_id') || key === 'category' || key === 'type' || key === 'difficulty') &&
          (payload[key] === undefined || payload[key] === null || payload[key] === '')) {
          delete payload[key]
        }
      })

      if (editingId) {
        await adminAPI.updateTest(editingId, payload)
        toast.success('Test updated successfully')
      } else {
        await adminAPI.createTest(payload)
        toast.success('Test created successfully')
      }
      closeForm()
      await fetchData()
    } catch (error) {
      console.error('Failed to save test:', error)
      toast.error(error.response?.data?.message || 'Failed to save test')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkUpload = async (file, options = {}) => {
    if (!selectedSeries) throw new Error('Select a test series first')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('testSeriesId', String(getSeriesId(selectedSeries)))
    fd.append('category', String(getSeriesExamCategoryId(selectedSeries) || activeExamCategoryId || ''))

    const examId = getSeriesExamId(selectedSeries) || activeExamId
    if (examId) fd.append('examId', String(examId))

    if (activeStageId) fd.append('stageId', String(activeStageId))
    const linkedCategoryId = getLinkedTestCategoryId()
    if (linkedCategoryId) fd.append('testCategoryId', String(linkedCategoryId))

    if (options.validateOnly) {
      fd.append('validateOnly', 'true')
    }

    const response = await adminAPI.bulkUploadTests(fd)

    if (options.validateOnly) {
      return response.data
    }

    const count = response.data?.data?.length || response.data?.count || 0
    const skipped = response.data?.skipped || 0

    if (skipped > 0) {
      toast.success(`${count} tests uploaded, ${skipped} skipped (duplicates/invalid)`)
    } else {
      toast.success(response.data?.message || `${count} tests uploaded successfully`)
    }

    await fetchData()
  }

  const validateBulkUpload = async (file) => {
    if (!selectedSeries) throw new Error('Select a test series first')

    const existingTitles = new Set(tests.map(t => t.title?.toLowerCase().trim()).filter(Boolean))
    const duplicateErrors = []

    const fd = new FormData()
    fd.append('file', file)
    fd.append('validateOnly', 'true')

    try {
      const response = await adminAPI.bulkUploadTests(fd)
      const validationResult = response.data

      if (validationResult?.validation) {
        const rows = validationResult.validation
        rows.forEach((row, idx) => {
          if (existingTitles.has(String(row.title || '').toLowerCase().trim())) {
            duplicateErrors.push({ row: idx + 1, title: row.title, reason: 'Duplicate test title' })
          }
          if (!row.title || String(row.title).trim().length < 2) {
            duplicateErrors.push({ row: idx + 1, title: row.title || 'Unknown', reason: 'Missing/invalid title' })
          }
        })
      }

      return {
        isValid: duplicateErrors.length === 0,
        errors: duplicateErrors,
        totalRows: validationResult?.totalRows || 0,
        validRows: validationResult?.validRows || 0
      }
    } catch (error) {
      return { isValid: false, errors: [{ row: 0, title: '', reason: error.message }], totalRows: 0, validRows: 0 }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminAPI.deleteTest(deleteTarget.id)
      setTests(prev => prev.filter(test => !idsEqual(getTestId(test), deleteTarget.id)))
      toast.success('Test deleted successfully')
      setDeleteTarget(null)
    } catch (error) {
      console.error('Failed to delete test:', error)
      toast.error('Failed to delete test')
    }
  }

  const handlePublish = async (test) => {
    const testId = getTestId(test)
    const qCount = getTestQuestionsCount(test)
    if (qCount === 0) {
      toast.error('Cannot publish test with 0 questions. Please add questions first.')
      return
    }

    try {
      const response = await adminAPI.publishTest(testId)
      setTests(prev => prev.map(t =>
        idsEqual(getTestId(t), testId) ? { ...t, status: 'published', isActive: true, total_questions: response.data.data?.total_questions, total_marks: response.data.data?.total_marks } : t
      ))
      toast.success('Test published successfully')
    } catch (error) {
      console.error('Failed to publish test:', error)
      const backendErrors = error.response?.data?.errors
      if (backendErrors && backendErrors.length > 0) {
        backendErrors.forEach(err => toast.error(`${err.field}: ${err.message}`))
      } else {
        toast.error(error.response?.data?.message || 'Failed to publish test')
      }
    }
  }

  const handleUnpublish = async (test) => {
    const testId = getTestId(test)
    try {
      await adminAPI.unpublishTest(testId)
      setTests(prev => prev.map(t =>
        idsEqual(getTestId(t), testId) ? { ...t, status: 'draft', isActive: false } : t
      ))
      toast.success('Test unpublished (reverted to draft)')
    } catch (error) {
      console.error('Failed to unpublish test:', error)
      toast.error(error.response?.data?.message || 'Failed to unpublish test')
    }
  }

  const handleExport = async () => {
    try {
      const response = await adminAPI.apiClient.get('/admin/tests/export', { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tests_export_${Date.now()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Tests exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export tests')
    }
  }

  const toggleSelectMode = () => {
    setIsSelectMode(prev => {
      const next = !prev
      if (!next) setSelectedTestIds([])
      return next
    })
    setShowSelectDropdown(false)
  }

  const toggleSelectTest = (testId) => {
    const idStr = String(testId)
    setSelectedTestIds(prev => {
      const exists = prev.some(id => String(id) === idStr)
      if (exists) {
        return prev.filter(id => String(id) !== idStr)
      } else {
        return [...prev, testId]
      }
    })
  }

  const handleSelectAll = () => {
    const allIds = workspaceTests.map(t => getTestId(t))
    if (selectedTestIds.length === allIds.length && allIds.length > 0) {
      setSelectedTestIds([])
    } else {
      setSelectedTestIds(allIds)
      setIsSelectMode(true)
    }
    setShowSelectDropdown(false)
  }

  const handleSelectPublished = () => {
    const publishedIds = workspaceTests
      .filter(t => t.status === 'published' || t.status === 'active')
      .map(t => getTestId(t))
    setSelectedTestIds(publishedIds)
    setIsSelectMode(true)
    setShowSelectDropdown(false)
  }

  const handleSelectDrafts = () => {
    const draftIds = workspaceTests
      .filter(t => t.status !== 'published' && t.status !== 'active')
      .map(t => getTestId(t))
    setSelectedTestIds(draftIds)
    setIsSelectMode(true)
    setShowSelectDropdown(false)
  }

  const handleDeselectAll = () => {
    setSelectedTestIds([])
    setShowSelectDropdown(false)
  }

  const handleBulkPublishSelected = async () => {
    if (selectedTestIds.length === 0) {
      toast.error('No tests selected')
      return
    }
    try {
      setBulkProcessing(true)
      await adminAPI.bulkStatusTests(selectedTestIds, 'published')
      setTests(prev => prev.map(t =>
        selectedTestIds.some(id => idsEqual(id, getTestId(t)))
          ? { ...t, status: 'published', isActive: true }
          : t
      ))
      toast.success(`Published ${selectedTestIds.length} test(s) successfully`)
      setSelectedTestIds([])
    } catch (error) {
      console.error('Bulk publish error:', error)
      toast.error(error.response?.data?.message || 'Failed to publish selected tests')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkUnpublishSelected = async () => {
    if (selectedTestIds.length === 0) {
      toast.error('No tests selected')
      return
    }
    try {
      setBulkProcessing(true)
      await adminAPI.bulkStatusTests(selectedTestIds, 'draft')
      setTests(prev => prev.map(t =>
        selectedTestIds.some(id => idsEqual(id, getTestId(t)))
          ? { ...t, status: 'draft', isActive: false }
          : t
      ))
      toast.success(`Unpublished ${selectedTestIds.length} test(s)`)
      setSelectedTestIds([])
    } catch (error) {
      console.error('Bulk unpublish error:', error)
      toast.error(error.response?.data?.message || 'Failed to unpublish selected tests')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (selectedTestIds.length === 0) return
    try {
      setBulkProcessing(true)
      await adminAPI.bulkDeleteTests(selectedTestIds)
      setTests(prev => prev.filter(t => !selectedTestIds.some(id => idsEqual(id, getTestId(t)))))
      toast.success(`Deleted ${selectedTestIds.length} test(s) successfully`)
      setSelectedTestIds([])
      setShowBulkDeleteConfirm(false)
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error.response?.data?.message || 'Failed to delete selected tests')
    } finally {
      setBulkProcessing(false)
    }
  }

  const isLoading = loading || examFiltersLoading
  const hasErrors = Object.keys(errors).length > 0
  const hasNoTests = tests.length === 0 && !hasErrors && !isLoading

  if (isLoading && tests.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 font-medium">Loading tests and resources...</p>
      </div>
    )
  }

  if (hasErrors && !isLoading && tests.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <p className="text-red-800 dark:text-red-200 font-medium">Failed to load tests</p>
          <ul className="mt-2 text-sm text-red-600 dark:text-red-400">
            {Object.entries(errors).map(([key, value]) => (
              <li key={key}>• {key}: {value}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex flex-nowrap border-b border-gray-200 bg-white rounded-t-xl px-4 pt-4 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
        {TEST_CATEGORY_TABS.map(tab => {
          const isActive = activeTestCategory === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap shrink-0 ${isActive
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 p-3">
        <StatCard icon={CheckSquare} value={filteredScopeStats.totalTests} label={`Total ${activeCatLabel}`} tone="indigo" compact />
        <StatCard icon={Layers} value={filteredScopeStats.activeSeries} label="Active Test Series" tone="green" compact />
        <StatCard icon={FileText} value={filteredScopeStats.testCategories} label="Test Categories" tone="amber" compact />
        <StatCard icon={Shield} value={filteredScopeStats.publishedTests} label="Published Tests" tone="blue" compact />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manager Filters</h3>
          </div>

          <div className="flex overflow-x-auto flex-nowrap items-center gap-3 scrollbar-thin pb-1">
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Exam Category:</span>
            {examCategories.length === 0 ? (
              <span className="text-sm text-gray-400 whitespace-nowrap">No exam categories found</span>
            ) : examCategories.map(category => {
              const categoryValue = category.categoryId || category.slug || category.id
              const isActive = idsEqual(activeExamCategoryId, categoryValue)
              return (
                <button
                  key={categoryValue}
                  type="button"
                  onClick={() => {
                    setActiveExamCategoryId(categoryValue)
                    setActiveExamId('')
                    setActiveStageId('')
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap ${isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {category.label || category.name || categoryValue}
                </button>
              )
            })}
          </div>

          <div className="flex overflow-x-auto flex-nowrap items-center gap-3 scrollbar-thin pb-1">
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Exam:</span>
            {examsForActiveCategory.length === 0 ? (
              <span className="text-sm text-gray-400 whitespace-nowrap">No exams found</span>
            ) : examsForActiveCategory
              .filter(exam => {
                // Skip entries with no meaningful label
                const display = String(exam.label || exam.fullName || '').trim()
                if (!display) return false
                if (display === String(exam.value)) return false
                if (/^\d+$/.test(display)) return false
                return true
              })
              .map(exam => {
                const isActive = idsEqual(activeExamId, exam.value)
                return (
                  <button
                    key={exam.value}
                    type="button"
                    onClick={() => {
                      setActiveExamId(exam.value)
                      setActiveStageId('')
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap ${isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    {exam.label || exam.fullName || exam.value}
                  </button>
                )
              })}
          </div>

          <div className="flex overflow-x-auto flex-nowrap items-center gap-3 scrollbar-thin pb-1">
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Stage:</span>
            {stagesForActiveExam.map(stage => {
              const stageId = getEntityId(stage)
              const isActive = idsEqual(activeStageId, stageId)
              return (
                <button key={stageId} type="button" onClick={() => setActiveStageId(stageId)} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap ${isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                  {stage.name || stage.title || stage.slug || stageId}
                </button>
              )
            })}
          </div>

          <div className="flex overflow-x-auto flex-nowrap items-center gap-2 pt-3 border-t border-gray-100 scrollbar-thin pb-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Selected Path</span>
            {[selectedExamCategoryLabel, selectedExamLabel, selectedSeries?.title || selectedSeries?.name, selectedStageLabel, activeCatLabel, selectedTestSubCategoryLabel]
              .filter(label => label)
              .map((label, index) => (
                <span key={`${label}-${index}`} className="inline-flex items-center gap-2 whitespace-nowrap">
                  {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                  <span className={`px-2.5 py-1 border rounded-lg text-xs whitespace-nowrap ${label === activeCatLabel ? 'bg-indigo-50 border-indigo-100 font-semibold text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>{label}</span>
                </span>
              ))}
          </div>
        </div>
      </div>

      {hasNoTests && (
        <div className="p-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
            <p className="text-amber-800 dark:text-amber-200">
              No tests found. Select a test series above, then use “Create Test”, “Bulk Create”, or “Import JSON” to add your first test.
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Test Series</h2>
          <p className="text-sm text-gray-500">{filteredSeriesList.length} series match the current exam, stage, and test category.</p>
        </div>
        <button type="button" onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <FileText className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {!activeStageId ? (
          <EmptyState icon={Layers} title="Stage Selection Required" description="Please select a stage from the filters above to view and manage test series." />
        ) : filteredSeriesList.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No Test Series Found" description="Choose an exam category and exam, or link a test series to this test category." />
        ) : filteredSeriesList.map(series => {
          const seriesId = getSeriesId(series)
          const seriesStats = seriesLinkedTestsStatsMap.get(String(seriesId || '')) || { count: 0, totalQuestions: 0 }
          const totalQuestions = seriesStats.totalQuestions
          return (
            <div
              key={seriesId}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedSeries(series)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedSeries(series)
                }
              }}
              className="group bg-white border border-gray-200 rounded-xl cursor-pointer transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden hover:border-indigo-300 hover:shadow-md"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-500 transition-colors" />
              <div className="flex items-start gap-4 min-w-0 flex-1 pl-1">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge tone="indigo">{activeCatLabel}</Badge>
                    <Badge tone="blue">{selectedExamLabel}</Badge>
                    <Badge tone={series.isActive === false || series.is_active === false ? 'gray' : 'green'}>{series.isActive === false || series.is_active === false ? 'Inactive' : 'Active'}</Badge>
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{series.title || series.name || 'Untitled Series'}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{series.description || 'No description available'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 md:gap-6 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-0 border-gray-100">
                <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-3 sm:gap-6 text-gray-600 w-full md:w-auto">
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><FileText className="w-4 h-4 text-gray-400" />{seriesStats.count} Tests</span>
                  <span className="text-sm font-bold text-indigo-600 flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-indigo-400" />{totalQuestions} Qs</span>
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" />{selectedStageLabel}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 hidden md:block" />
              </div>
            </div>
          )
        })}
      </div>

      {selectedSeries && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedSeries(null); setSelectedTestSubCategoryId('all'); closeForm() } }}>
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 bg-gray-50">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{selectedSeries.title || selectedSeries.name || 'Test Series'}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {[selectedExamCategoryLabel, selectedExamLabel, selectedStageLabel, activeCatLabel].map((label, index) => (
                    <span key={`${label}-${index}`} className="inline-flex items-center gap-2">
                      {index > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                      <span className={`px-2 py-1 border rounded ${index === 3 ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-semibold' : 'bg-white border-gray-200'}`}>{label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => { setSelectedSeries(null); setSelectedTestSubCategoryId('all'); closeForm() }} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-gray-200 p-3 flex flex-col gap-2">
              {activeStageId ? (
                <>
                  {/* Level 1 - Top level row (Year Based, Exam Based) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">Test Subcategory</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSubCategoryLevel1('')
                        setSubCategoryLevel2('')
                        setSubCategoryLevel3('')
                        setSubCategoryLevel4('')
                        setSelectedTestSubCategoryId('all')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${!subCategoryLevel1
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      All ({seriesTests.length})
                    </button>
                    {subCategoryOptionsLevel1.map((cat) => {
                      const catId = getEntityId(cat) || ''
                      const isSelected = subCategoryLevel1 === catId
                      const count = getCategoryTestCount(catId)
                      return (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => {
                            const newVal = isSelected ? '' : catId
                            setSubCategoryLevel1(newVal)
                            setSubCategoryLevel2('')
                            setSubCategoryLevel3('')
                            setSubCategoryLevel4('')
                            setSelectedTestSubCategoryId(newVal || 'all')
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                          {getCategoryLabel(cat)} ({count})
                        </button>
                      )
                    })}
                  </div>

                  {/* Level 2 - Second row (2025, 2024, etc.) */}
                  {subCategoryLevel1 && subCategoryOptionsLevel2.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap ml-4">
                      {subCategoryOptionsLevel2.map((cat) => {
                        const catId = getEntityId(cat) || ''
                        const isSelected = subCategoryLevel2 === catId
                        const count = getCategoryTestCount(catId)
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? '' : catId
                              setSubCategoryLevel2(newVal)
                              setSubCategoryLevel3('')
                              setSubCategoryLevel4('')
                              setSelectedTestSubCategoryId(newVal || subCategoryLevel1 || 'all')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {getCategoryLabel(cat)} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Level 3 - Third row */}
                  {subCategoryLevel2 && subCategoryOptionsLevel3.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap ml-8">
                      {subCategoryOptionsLevel3.map((cat) => {
                        const catId = getEntityId(cat) || ''
                        const isSelected = subCategoryLevel3 === catId
                        const count = getCategoryTestCount(catId)
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? '' : catId
                              setSubCategoryLevel3(newVal)
                              setSubCategoryLevel4('')
                              setSelectedTestSubCategoryId(newVal || subCategoryLevel2 || subCategoryLevel1 || 'all')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {getCategoryLabel(cat)} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Level 4 - Fourth row */}
                  {subCategoryLevel3 && subCategoryOptionsLevel4.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap ml-12">
                      {subCategoryOptionsLevel4.map((cat) => {
                        const catId = getEntityId(cat) || ''
                        const isSelected = subCategoryLevel4 === catId
                        const count = getCategoryTestCount(catId)
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? '' : catId
                              setSubCategoryLevel4(newVal)
                              setSelectedTestSubCategoryId(newVal || subCategoryLevel3 || subCategoryLevel2 || subCategoryLevel1 || 'all')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {getCategoryLabel(cat)} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {subCategoryOptionsLevel1.length === 0 && (
                    <span className="text-sm text-gray-400 px-2">No child categories under {activeCatLabel}</span>
                  )}
                </>
              ) : (
                <span className="text-sm font-medium text-amber-600 px-2">Please select a stage to view subcategories</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">Tests</h3>
                  <p className="text-sm text-gray-500">{workspaceTests.length} tests linked to the selected test subcategory.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Bulk Select Dropdown Button */}
                  <div className="relative inline-block text-left">
                    <div className="inline-flex rounded-lg shadow-sm">
                      <button
                        type="button"
                        onClick={toggleSelectMode}
                        className={`px-3 py-2 border rounded-l-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                          isSelectMode || selectedTestIds.length > 0
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                        <span>{isSelectMode ? `Select Mode (${selectedTestIds.length})` : 'Select'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSelectDropdown(prev => !prev)}
                        className={`px-2 py-2 border-y border-r rounded-r-lg text-sm transition-colors ${
                          isSelectMode || selectedTestIds.length > 0
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Selection options"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {showSelectDropdown && (
                      <div className="origin-top-right absolute right-0 mt-2 w-52 rounded-xl shadow-xl bg-white ring-1 ring-black/10 z-30 py-1 text-xs divide-y divide-gray-100 animate-fade-in">
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={handleSelectAll}
                            className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between transition-colors"
                          >
                            <span className="font-bold">Select All</span>
                            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-black text-[10px]">
                              {workspaceTests.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSelectPublished}
                            className="w-full text-left px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between transition-colors"
                          >
                            <span>Select Published</span>
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              {workspaceTests.filter(t => t.status === 'published' || t.status === 'active').length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSelectDrafts}
                            className="w-full text-left px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between transition-colors"
                          >
                            <span>Select Drafts</span>
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              {workspaceTests.filter(t => t.status !== 'published' && t.status !== 'active').length}
                            </span>
                          </button>
                        </div>
                        {selectedTestIds.length > 0 && (
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={handleDeselectAll}
                              className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 font-semibold transition-colors"
                            >
                              Deselect All
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={() => setShowFullTestImport(true)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Import JSON
                  </button>
                  <button type="button" onClick={() => setShowBulkUpload(true)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Bulk Create
                  </button>
                  <button type="button" onClick={openCreateForm} className="px-3 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                    <Plus className="w-4 h-4" /> Create Test
                  </button>
                </div>
              </div>

              {/* Bulk Actions Floating Bar */}
              {(isSelectMode || selectedTestIds.length > 0) && workspaceTests.length > 0 && (
                <div className="mb-4 bg-indigo-50/95 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm animate-fade-in">
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-950 select-none">
                      <input
                        type="checkbox"
                        checked={selectedTestIds.length > 0 && selectedTestIds.length === workspaceTests.length}
                        ref={el => {
                          if (el) {
                            el.indeterminate = selectedTestIds.length > 0 && selectedTestIds.length < workspaceTests.length
                          }
                        }}
                        onChange={handleSelectAll}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span>{selectedTestIds.length} of {workspaceTests.length} tests selected</span>
                    </label>

                    <div className="flex items-center gap-2 border-l border-indigo-200 pl-3">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold underline underline-offset-2"
                      >
                        {selectedTestIds.length === workspaceTests.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    <button
                      type="button"
                      disabled={bulkProcessing || selectedTestIds.length === 0}
                      onClick={handleBulkPublishSelected}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span>Publish ({selectedTestIds.length})</span>
                    </button>
                    <button
                      type="button"
                      disabled={bulkProcessing || selectedTestIds.length === 0}
                      onClick={handleBulkUnpublishSelected}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span>Set Draft ({selectedTestIds.length})</span>
                    </button>
                    <button
                      type="button"
                      disabled={bulkProcessing || selectedTestIds.length === 0}
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete ({selectedTestIds.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleSelectMode}
                      className="px-2.5 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-lg font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-8 my-6 animate-fade-in text-center space-y-4 max-w-lg mx-auto">
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-600 animate-spin"></div>
                    <div className="absolute w-8 h-8 rounded-full bg-indigo-500/20 animate-ping"></div>
                    <div className="absolute w-3.5 h-3.5 rounded-full bg-indigo-600"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-wide">Loading Tests & Categories...</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Synchronizing test structures, categories & exam schemes</p>
                  </div>
                </div>
              ) : workspaceTests.length === 0 ? (
                <EmptyState icon={FileText} title="No Tests Linked" description="Create a test or bulk upload tests for this series and selected test subcategory." />
              ) : (
                <div className="flex flex-col gap-3">
                  {workspaceTests.map(test => {
                    const testId = getTestId(test)
                    const qCount = getTestQuestionsCount(test)
                    const expectedQuestions = test.totalQuestions || test.total_questions || 0
                    const isQuestionCountBalanced = expectedQuestions > 0 ? qCount >= expectedQuestions : qCount > 0
                    const isSelected = selectedTestIds.some(id => idsEqual(id, testId))

                    return (
                      <div
                        key={testId}
                        onClick={(e) => {
                          if (isSelectMode) {
                            if (e.target.closest('button') || e.target.closest('a')) return
                            toggleSelectTest(testId)
                          }
                        }}
                        className={`w-full bg-white border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-400/40 shadow-sm'
                            : 'border-gray-200 hover:border-indigo-200 hover:shadow-sm'
                        } ${isSelectMode ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Checkbox for Card */}
                          <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectTest(testId)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge tone={test.status === 'active' || test.status === 'published' ? 'green' : 'gray'}>
                                {test.status === 'published' ? '● Published' : test.status === 'active' ? '● Active' : '○ Draft'}
                              </Badge>
                              <Badge tone="indigo">{test.type || activeTestCategory}</Badge>
                              {test.difficulty && <Badge tone="blue">{test.difficulty}</Badge>}
                            </div>
                            <h4 className="font-bold text-gray-900 truncate">{test.title || test.name || 'Untitled Test'}</h4>
                            <p className="text-xs text-gray-500 mt-1 truncate">{test.description || 'No description'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-gray-600 shrink-0 flex-wrap pl-7 md:pl-0">
                          <span className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />{test.duration || test.time_limit || '--'} min</span>
                          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${isQuestionCountBalanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            <FileText className="w-3.5 h-3.5" />
                            {expectedQuestions > 0 ? `${qCount}/${expectedQuestions} Qs` : `${qCount} Qs`}
                          </span>
                          {(test.totalMarks || test.total_marks) && (
                            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                              {test.totalMarks || test.total_marks} Marks
                            </span>
                          )}
                          <Link
                            to={`/admin/questions?testId=${testId}`}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
                            title="Open Question Bank for this Test"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Questions</span>
                          </Link>
                          {(test.isLive || activeTestCategory === 'live-tests') && (
                            <Link
                              to={`/admin/live-monitor?testId=${testId}`}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-semibold border border-cyan-200 transition-colors"
                              title="Monitor live candidates for this test"
                            >
                              <Radio className="w-3.5 h-3.5 text-cyan-600" />
                              <span>Monitor</span>
                            </Link>
                          )}
                          {test.status === 'published' ? (
                            <button type="button" onClick={() => handleUnpublish(test)} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs font-semibold" title="Unpublish">
                              Unpublish
                            </button>
                          ) : (
                            <button type="button" onClick={() => handlePublish(test)} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-sm" title="Publish">
                              Publish
                            </button>
                          )}
                          <button type="button" onClick={() => openEditForm(test)} className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget({ id: testId, title: test.title || test.name || 'Untitled Test' })} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TestFormModal
        key={editingId || `create-${getSeriesId(selectedSeries) || 'none'}-${activeStageId || 'all'}-${selectedTestSubCategoryId}`}
        isOpen={showForm}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        editingId={editingId}
        contextLabel={contextLabel}
        saving={saving}
        relationshipSummary={editingRelationshipSummary}
        availableSections={scopedSections}
        allSubCategories={modalSubCategories}
        flatTestCategories={flatTestCategories}
        selectedPresetId={selectedPresetId}
        setSelectedPresetId={setSelectedPresetId}
        applySectionPreset={applySectionPreset}
        seriesList={seriesList}
        selectedSeries={selectedSeries}
      />
      <BulkUploadModal isOpen={showBulkUpload} onClose={() => setShowBulkUpload(false)} onUpload={handleBulkUpload} onValidate={validateBulkUpload} contextLabel={contextLabel} linkingInfo={linkingInfo} />
      <FullTestImportModal isOpen={showFullTestImport} onClose={() => setShowFullTestImport(false)} onImported={fetchData} />

      {/* Single Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Test</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete "<strong>{deleteTarget.title}</strong>"?</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bulk Delete Tests</h3>
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to delete <strong className="text-rose-600 font-bold">{selectedTestIds.length} selected tests</strong>? This will move them to trash.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 max-h-36 overflow-y-auto mb-6 text-xs text-gray-600 space-y-1.5 border border-gray-200">
              {workspaceTests
                .filter(t => selectedTestIds.some(id => idsEqual(id, getTestId(t))))
                .slice(0, 6)
                .map((t, idx) => (
                  <p key={idx} className="truncate">• {t.title || t.name}</p>
                ))}
              {selectedTestIds.length > 6 && (
                <p className="text-gray-400 font-semibold pl-2">...and {selectedTestIds.length - 6} more tests</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkProcessing}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold shadow-sm"
              >
                {bulkProcessing ? 'Deleting...' : `Delete ${selectedTestIds.length} Tests`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
