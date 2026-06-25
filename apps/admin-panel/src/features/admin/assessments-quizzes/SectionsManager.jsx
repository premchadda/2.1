import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Edit, Trash2, X, Save, Clock, FileText,
  ChevronDown, ChevronUp, Search, AlertCircle, CheckCircle,
  Link, AlertTriangle, Filter, Layers, GitBranch, Settings
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient, adminAPI } from '../../../shared/lib/dataService'
import api from '../../../shared/lib/api'

const DEFAULT_SECTION_FORM = {
  name: '',
  category_id: '',
  test_id: '',
  test_series_id: '',
  stage_id: '',
  description: '',
  duration: 60,           // Legacy field (use time_limit instead)
  passing_marks: 0,
  marks_per_question: 2, // Marks per question for this section
  negative_marks: 0.5, // Negative marks per question
  time_limit: 900,       // Time limit in seconds (15 min default)
  is_locked: false,       // Can user revisit after submission
  is_active: true,
  display_order: 0,
  instructions: '',    // Instructions shown before section
  difficulty: 'medium', // easy | medium | hard
  shuffle_questions: false,
  shuffle_options: false,
  expected_questions: 0,
  total_marks: 0,
  exam_stage: '',
  paper: '',
  session: '',
  section_code: '',
  is_qualifying: false,
  exam_alias: ''
}

let sectionAliasMap = {}

async function fetchSectionAliases() {
  try {
    const res = await adminAPI.getSectionAliases()
    const rows = res.data?.data || []
    sectionAliasMap = {}
    for (const row of rows) {
      sectionAliasMap[row.alias_name.toLowerCase()] = row.canonical_name
    }
  } catch {
    sectionAliasMap = {}
  }
}

function resolveCanonical(alias) {
  return sectionAliasMap[(alias || '').toLowerCase()] || alias
}

const EXAM_PRESETS = [
  // ───────────────────── SSC CGL ─────────────────────
  {
    id: 'ssc-cgl-tier-1',
    exam_category: 'SSC',
    exam: 'CGL',
    stage: 'Tier-I',
    label: 'SSC CGL Tier-I',
    description: '4 sections, 100 Qs, 200 marks, 60 min, -0.50 neg, sectional timing 15 min/section',
    sections: [
      ['General Intelligence & Reasoning', 'Tier-I', 'Tier-I', '', '1', 25, 50, 2, 0.5, 900, false],
      ['General Awareness', 'Tier-I', 'Tier-I', '', '2', 25, 50, 2, 0.5, 900, false],
      ['Quantitative Aptitude', 'Tier-I', 'Tier-I', '', '3', 25, 50, 2, 0.5, 900, false],
      ['English Comprehension', 'Tier-I', 'Tier-I', '', '4', 25, 50, 2, 0.5, 900, false],
    ]
  },
  {
    id: 'ssc-cgl-tier-2-paper-1',
    exam_category: 'SSC',
    exam: 'CGL',
    stage: 'Tier-II',
    label: 'SSC CGL Tier-II Paper-I',
    description: '150 Qs + DEST, 450 marks, 2 hr 30 min, -1.00 neg',
    sections: [
      ['Mathematical Abilities', 'Tier-II', 'Paper-I', 'Session-I', 'I-A', 30, 90, 3, 1, 3600, false],
      ['Reasoning & General Intelligence', 'Tier-II', 'Paper-I', 'Session-I', 'I-B', 30, 90, 3, 1, 3600, false],
      ['English Language & Comprehension', 'Tier-II', 'Paper-I', 'Session-I', 'II-A', 45, 135, 3, 1, 3600, false],
      ['General Awareness', 'Tier-II', 'Paper-I', 'Session-I', 'II-B', 25, 75, 3, 1, 3600, false],
      ['Computer Knowledge Test', 'Tier-II', 'Paper-I', 'Session-I', 'III', 20, 60, 3, 1, 900, true],
      ['Data Entry Speed Test (DEST)', 'Tier-II', 'Paper-I', 'Session-II', 'IV', 0, 0, 0, 0, 900, true],
    ]
  },
  {
    id: 'ssc-cgl-tier-2-paper-2',
    exam_category: 'SSC',
    exam: 'CGL',
    stage: 'Tier-II',
    label: 'SSC CGL Tier-II Paper-II (Statistics)',
    description: 'Statistics paper for JSO / Statistical Investigator — 100 Qs, 200 marks, 2 hr',
    sections: [
      ['Statistics', 'Tier-II', 'Paper-II', '', 'Paper-II', 100, 200, 2, 0.5, 7200, false],
    ]
  },

  // ───────────────────── SSC CHSL ─────────────────────
  {
    id: 'ssc-chsl-tier-1',
    exam_category: 'SSC',
    exam: 'CHSL',
    stage: 'Tier-I',
    label: 'SSC CHSL Tier-I',
    description: '4 sections, 100 Qs, 200 marks, 60 min, -0.50 neg, sectional timing 15 min/section',
    sections: [
      ['General Intelligence & Reasoning', 'Tier-I', 'Tier-I', '', '1', 25, 50, 2, 0.5, 900, false],
      ['General Awareness', 'Tier-I', 'Tier-I', '', '2', 25, 50, 2, 0.5, 900, false],
      ['Quantitative Aptitude', 'Tier-I', 'Tier-I', '', '3', 25, 50, 2, 0.5, 900, false],
      ['English Language', 'Tier-I', 'Tier-I', '', '4', 25, 50, 2, 0.5, 900, false],
    ]
  },
  {
    id: 'ssc-chsl-tier-2-session-1',
    exam_category: 'SSC',
    exam: 'CHSL',
    stage: 'Tier-II',
    label: 'SSC CHSL Tier-II Session-I',
    description: '135 Qs, 405 marks, 2 hr 15 min, -1.00 neg',
    sections: [
      ['Mathematical Abilities', 'Tier-II', 'Session-I', 'Session-I', 'I-M1', 30, 90, 3, 1, 3600, false],
      ['Reasoning & General Intelligence', 'Tier-II', 'Session-I', 'Session-I', 'I-M2', 30, 90, 3, 1, 3600, false],
      ['English Language & Comprehension', 'Tier-II', 'Session-I', 'Session-I', 'II-M1', 40, 120, 3, 1, 3600, false],
      ['General Awareness', 'Tier-II', 'Session-I', 'Session-I', 'II-M2', 20, 60, 3, 1, 3600, false],
      ['Computer Knowledge Test', 'Tier-II', 'Session-I', 'Session-I', 'III-M1', 15, 45, 3, 1, 900, true],
    ]
  },

  // ───────────────────── SSC MTS ─────────────────────
  {
    id: 'ssc-mts-session-1',
    exam_category: 'SSC',
    exam: 'MTS',
    stage: 'Session-I',
    label: 'SSC MTS / Havaldar Session-I',
    description: '40 Qs, 120 marks, 45 min, NO negative marking',
    sections: [
      ['Numerical & Mathematical Ability', 'Session-I', 'Session-I', 'Session-I', '1', 20, 60, 3, 0, 2700, false],
      ['Reasoning Ability & Problem Solving', 'Session-I', 'Session-I', 'Session-I', '2', 20, 60, 3, 0, 2700, false],
    ]
  },
  {
    id: 'ssc-mts-session-2',
    exam_category: 'SSC',
    exam: 'MTS',
    stage: 'Session-II',
    label: 'SSC MTS / Havaldar Session-II',
    description: '50 Qs, 150 marks, 45 min, -1.00 neg',
    sections: [
      ['General Awareness', 'Session-II', 'Session-II', 'Session-II', '3', 25, 75, 3, 1, 2700, false],
      ['English Language & Comprehension', 'Session-II', 'Session-II', 'Session-II', '4', 25, 75, 3, 1, 2700, false],
    ]
  },

  // ───────────────────── SSC CPO ─────────────────────
  {
    id: 'ssc-cpo-paper-1',
    exam_category: 'SSC',
    exam: 'CPO',
    stage: 'Paper-I',
    label: 'SSC CPO Paper-I',
    description: '200 Qs, 200 marks, 2 hr, -0.25 neg, sectional timing 30 min/section',
    sections: [
      ['General Intelligence & Reasoning', 'Paper-I', 'Paper-I', '', '1', 50, 50, 1, 0.25, 1800, false],
      ['General Knowledge & General Awareness', 'Paper-I', 'Paper-I', '', '2', 50, 50, 1, 0.25, 1800, false],
      ['Quantitative Aptitude', 'Paper-I', 'Paper-I', '', '3', 50, 50, 1, 0.25, 1800, false],
      ['English Comprehension', 'Paper-I', 'Paper-I', '', '4', 50, 50, 1, 0.25, 1800, false],
    ]
  },
  {
    id: 'ssc-cpo-paper-2',
    exam_category: 'SSC',
    exam: 'CPO',
    stage: 'Paper-II',
    label: 'SSC CPO Paper-II',
    description: 'English Language & Comprehension — 200 Qs, 200 marks, 2 hr, -0.25 neg',
    sections: [
      ['English Language & Comprehension', 'Paper-II', 'Paper-II', '', 'Paper-II', 200, 200, 1, 0.25, 7200, false],
    ]
  },

  // ───────────────────── SSC Stenographer ─────────────────────
  {
    id: 'ssc-steno-cbt',
    exam_category: 'SSC',
    exam: 'Stenographer',
    stage: 'CBT',
    label: 'SSC Stenographer CBT',
    description: '200 Qs, 200 marks, 2 hr, -0.25 neg, sectional timing',
    sections: [
      ['General Intelligence & Reasoning', 'CBT', 'CBT', '', '1', 50, 50, 1, 0.25, 1800, false],
      ['General Awareness', 'CBT', 'CBT', '', '2', 50, 50, 1, 0.25, 1800, false],
      ['English Language & Comprehension', 'CBT', 'CBT', '', '3', 100, 100, 1, 0.25, 3600, false],
    ]
  },

  // ───────────────────── SSC GD ─────────────────────
  {
    id: 'ssc-gd-constable',
    exam_category: 'SSC',
    exam: 'GD',
    stage: 'CBT',
    label: 'SSC GD Constable',
    description: '80 Qs, 160 marks, 60 min, -0.25 neg, sectional timing 15 min/section',
    sections: [
      ['General Intelligence & Reasoning', 'CBT', 'CBT', '', '1', 20, 40, 2, 0.25, 900, false],
      ['General Knowledge & General Awareness', 'CBT', 'CBT', '', '2', 20, 40, 2, 0.25, 900, false],
      ['Elementary Mathematics', 'CBT', 'CBT', '', '3', 20, 40, 2, 0.25, 900, false],
      ['English / Hindi', 'CBT', 'CBT', '', '4', 20, 40, 2, 0.25, 900, false],
    ]
  },

  // ───────────────────── SSC JE ─────────────────────
  {
    id: 'ssc-je-paper-1',
    exam_category: 'SSC',
    exam: 'JE',
    stage: 'Paper-I',
    label: 'SSC JE Paper-I',
    description: '200 Qs, 200 marks, 2 hr, -0.25 neg, no sectional timing',
    sections: [
      ['General Intelligence & Reasoning', 'Paper-I', 'Paper-I', '', '1', 50, 50, 1, 0.25, 7200, false],
      ['General Awareness', 'Paper-I', 'Paper-I', '', '2', 50, 50, 1, 0.25, 7200, false],
      ['General Engineering (Civil/Electrical/Mechanical)', 'Paper-I', 'Paper-I', '', '3', 100, 100, 1, 0.25, 7200, false],
    ]
  },
  {
    id: 'ssc-je-paper-2',
    exam_category: 'SSC',
    exam: 'JE',
    stage: 'Paper-II',
    label: 'SSC JE Paper-II',
    description: 'General Engineering — 100 Qs, 300 marks, 2 hr, -1.00 neg',
    sections: [
      ['General Engineering (Civil/Electrical/Mechanical)', 'Paper-II', 'Paper-II', '', 'Paper-II', 100, 300, 3, 1, 7200, false],
    ]
  },

  // ───────────────────── RRB NTPC ─────────────────────
  {
    id: 'rrb-ntpc-cbt-1',
    exam_category: 'RRB',
    exam: 'NTPC',
    stage: 'CBT-1',
    label: 'RRB NTPC CBT-1',
    description: '100 Qs, 100 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      ['General Awareness', 'CBT-1', 'CBT-1', '', '1', 40, 40, 1, 0.33, 5400, false],
      ['Mathematics', 'CBT-1', 'CBT-1', '', '2', 30, 30, 1, 0.33, 5400, false],
      ['General Intelligence & Reasoning', 'CBT-1', 'CBT-1', '', '3', 30, 30, 1, 0.33, 5400, false],
    ]
  },
  {
    id: 'rrb-ntpc-cbt-2',
    exam_category: 'RRB',
    exam: 'NTPC',
    stage: 'CBT-2',
    label: 'RRB NTPC CBT-2',
    description: '120 Qs, 120 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      ['General Awareness', 'CBT-2', 'CBT-2', '', '1', 50, 50, 1, 0.33, 5400, false],
      ['Mathematics', 'CBT-2', 'CBT-2', '', '2', 35, 35, 1, 0.33, 5400, false],
      ['General Intelligence & Reasoning', 'CBT-2', 'CBT-2', '', '3', 35, 35, 1, 0.33, 5400, false],
    ]
  },

  // ───────────────────── RRB ALP ─────────────────────
  {
    id: 'rrb-alp-cbt-1',
    exam_category: 'RRB',
    exam: 'ALP',
    stage: 'CBT-1',
    label: 'RRB ALP CBT-1',
    description: '75 Qs, 75 marks, 60 min, -1/3 neg, no sectional timing',
    sections: [
      ['Mathematics', 'CBT-1', 'CBT-1', '', '1', 20, 20, 1, 0.33, 3600, false],
      ['General Intelligence & Reasoning', 'CBT-1', 'CBT-1', '', '2', 25, 25, 1, 0.33, 3600, false],
      ['General Science', 'CBT-1', 'CBT-1', '', '3', 20, 20, 1, 0.33, 3600, false],
      ['General Awareness & Current Affairs', 'CBT-1', 'CBT-1', '', '4', 10, 10, 1, 0.33, 3600, false],
    ]
  },
  {
    id: 'rrb-alp-cbt-2-part-a',
    exam_category: 'RRB',
    exam: 'ALP',
    stage: 'CBT-2',
    label: 'RRB ALP CBT-2 Part-A',
    description: '100 Qs, 100 marks, 90 min, -1/3 neg',
    sections: [
      ['Mathematics', 'CBT-2', 'Part-A', 'Part-A', '1', 0, 0, 1, 0.33, 5400, false],
      ['General Intelligence & Reasoning', 'CBT-2', 'Part-A', 'Part-A', '2', 0, 0, 1, 0.33, 5400, false],
      ['Basic Science & Engineering', 'CBT-2', 'Part-A', 'Part-A', '3', 0, 0, 1, 0.33, 5400, false],
    ]
  },
  {
    id: 'rrb-alp-cbt-2-part-b',
    exam_category: 'RRB',
    exam: 'ALP',
    stage: 'CBT-2',
    label: 'RRB ALP CBT-2 Part-B (Trade)',
    description: 'Trade-specific — 75 Qs, 75 marks, 60 min, -1/3 neg',
    sections: [
      ['Trade Specific (as per trade)', 'CBT-2', 'Part-B', 'Part-B', 'Part-B', 75, 75, 1, 0.33, 3600, false],
    ]
  },

  // ───────────────────── RRB Group D ─────────────────────
  {
    id: 'rrb-group-d',
    exam_category: 'RRB',
    exam: 'Group D',
    stage: 'CBT',
    label: 'RRB Group D (Level-1)',
    description: '100 Qs, 100 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      ['General Science', 'CBT', 'CBT', '', '1', 25, 25, 1, 0.33, 5400, false],
      ['Mathematics', 'CBT', 'CBT', '', '2', 25, 25, 1, 0.33, 5400, false],
      ['General Intelligence & Reasoning', 'CBT', 'CBT', '', '3', 30, 30, 1, 0.33, 5400, false],
      ['General Awareness & Current Affairs', 'CBT', 'CBT', '', '4', 20, 20, 1, 0.33, 5400, false],
    ]
  },

  // ───────────────────── RPF ─────────────────────
  {
    id: 'rpf-constable-si',
    exam_category: 'RRB',
    exam: 'RPF',
    stage: 'CBT',
    label: 'RPF Constable / Sub-Inspector',
    description: '120 Qs, 120 marks, 90 min, -1/3 neg, no sectional timing',
    sections: [
      ['General Awareness', 'CBT', 'CBT', '', '1', 50, 50, 1, 0.33, 5400, false],
      ['Arithmetic', 'CBT', 'CBT', '', '2', 35, 35, 1, 0.33, 5400, false],
      ['General Intelligence & Reasoning', 'CBT', 'CBT', '', '3', 35, 35, 1, 0.33, 5400, false],
    ]
  },
]

function SectionPreview({ existingSections, preset, seriesName, stageName }) {
  if (!preset) return null

  const existingNames = new Set(existingSections.map(s => (s.name || '').toLowerCase()))
  const presetSections = (preset.sections || []).map(row => {
    const [alias, examStage, paper, session, sectionCode, expectedQuestions, totalMarks, marksPerQuestion, negativeMarks, timeLimit, isQualifying] = row
    const canonicalName = resolveCanonical(alias)
    return {
      name: canonicalName,
      exam_alias: alias !== canonicalName ? alias : null,
      exam_stage: examStage,
      paper,
      session,
      section_code: sectionCode,
      expected_questions: expectedQuestions,
      total_marks: totalMarks,
      marks_per_question: marksPerQuestion,
      negative_marks: negativeMarks,
      time_limit: timeLimit,
      is_qualifying: isQualifying
    }
  })

  const willCreate = presetSections.filter(s => !existingNames.has(s.name.toLowerCase()))
  const alreadyExist = presetSections.filter(s => existingNames.has(s.name.toLowerCase()))

  const totalNewMarks = willCreate.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
  const totalNewQs = willCreate.reduce((sum, s) => sum + (Number(s.expected_questions) || 0), 0)
  const totalNewTime = willCreate.reduce((sum, s) => sum + (Number(s.time_limit) || 0), 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-gray-700">Section Preview</h3>
          <span className="text-xs text-gray-400">—</span>
          <span className="text-xs font-medium text-gray-500">{seriesName} / {stageName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {willCreate.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
              <Plus className="w-3 h-3" /> {willCreate.length} new
            </span>
          )}
          {alreadyExist.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
              <CheckCircle className="w-3 h-3" /> {alreadyExist.length} exist
            </span>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 bg-indigo-50/50 border-b border-indigo-100 flex items-center gap-4 text-xs text-indigo-700">
        <span className="font-semibold">{preset.label}</span>
        <span className="text-indigo-400">|</span>
        <span>{presetSections.length} sections total</span>
        {totalNewQs > 0 && <span>{totalNewQs} new questions</span>}
        {totalNewMarks > 0 && <span>{totalNewMarks} new marks</span>}
        {totalNewTime > 0 && <span>{Math.round(totalNewTime / 60)} min new time</span>}
      </div>

      {/* Sections list */}
      <div className="divide-y divide-gray-100">
        {/* Will be created */}
        {willCreate.map((section, idx) => (
          <div key={`new-${idx}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-green-50/50 transition-colors">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">
              {section.section_code || idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">{section.name}</span>
                {section.exam_alias && <span className="text-xs text-gray-400">({section.exam_alias})</span>}
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">New</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] mt-1">
                {section.exam_stage && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium border border-indigo-100">Stage: {section.exam_stage}</span>}
                {section.paper && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium border border-indigo-100">Paper: {section.paper}</span>}
                {section.session && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium border border-indigo-100">Session: {section.session}</span>}
                <div className="w-px h-3 bg-gray-300 mx-1"></div>
                <span className="text-gray-500">
                  {section.expected_questions > 0 && <span>{section.expected_questions} Qs • </span>}
                  {section.total_marks > 0 && <span>{section.total_marks} marks • </span>}
                  {section.marks_per_question > 0 && <span>{section.marks_per_question} marks/Q • </span>}
                  {section.negative_marks > 0 && <span className="text-red-500">-{section.negative_marks} neg • </span>}
                  {section.time_limit > 0 && <span>{Math.round(section.time_limit / 60)} min</span>}
                </span>
                {section.is_qualifying && <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 font-semibold rounded">Qualifying</span>}
              </div>
            </div>
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          </div>
        ))}

        {/* Already exist */}
        {alreadyExist.map((section, idx) => {
          const existing = existingSections.find(s => (s.name || '').toLowerCase() === section.name.toLowerCase())
          return (
            <div key={`exist-${idx}`} className="px-4 py-2.5 flex items-center gap-3 bg-gray-50/50 opacity-70">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs font-bold shrink-0">
                {section.section_code || idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 truncate line-through decoration-gray-300">{section.name}</span>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Exists</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  {existing && (
                    <>
                      <span>DB: {existing.expected_questions || 0} Qs / {existing.total_marks || 0} marks</span>
                      <span>Preset: {section.expected_questions} Qs / {section.total_marks} marks</span>
                    </>
                  )}
                  {!existing && <span>Will be skipped</span>}
                </div>
              </div>
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" title="Already exists — will be skipped" />
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {willCreate.length === 0 && alreadyExist.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-center">
          <p className="text-sm text-amber-700 font-medium">All sections from this scheme already exist for this scope.</p>
          <p className="text-xs text-amber-500 mt-0.5">Applying the scheme will have no effect.</p>
        </div>
      )}
      {willCreate.length > 0 && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-200 text-center">
          <p className="text-sm text-green-700 font-medium">
            Click <strong>Apply to Scope</strong> to create {willCreate.length} section{willCreate.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-green-500 mt-0.5">
            {alreadyExist.length > 0 ? `${alreadyExist.length} existing section${alreadyExist.length > 1 ? 's' : ''} will be skipped.` : 'All sections will be created fresh.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function SectionsManager({ testId: propTestId } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const initialTab = ['all sections', 'linking', 'presets'].includes(urlTab) ? urlTab : 'all sections'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [sections, setSections] = useState([])
  const [categories, setCategories] = useState([])
  const [tests, setTests] = useState([])
  const [seriesList, setSeriesList] = useState([])
  const [stages, setStages] = useState([])
  const [linkingSeriesId, setLinkingSeriesId] = useState(searchParams.get('series') || '')
  const [linkingStageId, setLinkingStageId] = useState(searchParams.get('stage') || '')
  const [linkingExamCategoryId, setLinkingExamCategoryId] = useState(searchParams.get('examCat') || '')
  const [linkingExamId, setLinkingExamId] = useState(searchParams.get('exam') || '')
  const [examCategories, setExamCategories] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(DEFAULT_SECTION_FORM)
  const [errors, setErrors] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [testId, setTestId] = useState(propTestId || '')
  const [selectedPresetId, setSelectedPresetId] = useState(EXAM_PRESETS[0].id)
  const [deletingId, setDeletingId] = useState(null)
  const [formTab, setFormTab] = useState('basic')
  const [linkSectionPickerOpen, setLinkSectionPickerOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [testId, activeTab, linkingSeriesId, linkingStageId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setErrors({})

      await fetchSectionAliases()

      // Build the right sections query based on tab + filters.
      const sectionParams = {}
      if (testId) sectionParams.testId = testId
      if (activeTab === 'all sections') sectionParams.scope = 'templates'
      else if (activeTab === 'linking') {
        sectionParams.scope = 'linking'
        if (linkingSeriesId) sectionParams.testSeriesId = linkingSeriesId
        if (linkingStageId) sectionParams.stageId = linkingStageId
      }

      // Batch metadata + sections into 2 requests instead of 7
      const [batchRes, sectionsRes] = await Promise.allSettled([
        api.get('/admin/sections/batch'),
        adminAPI.getSections(sectionParams),
      ])

      if (batchRes.status === 'fulfilled' && batchRes.value.data?.data) {
        const d = batchRes.value.data.data
        setCategories(d.categories || [])
        setTests(d.tests || [])
        setSeriesList(d.series || [])
        setStages(d.stages || [])
        setExamCategories(d.examCategories || [])
        setExams(d.exams || [])
      }

      if (sectionsRes.status === 'fulfilled' && sectionsRes.value.data?.data) {
        setSections(sectionsRes.value.data.data)
      } else {
        setErrors(prev => ({ ...prev, sections: 'Failed to load sections' }))
      }
    } catch (error) {
      console.error('Fetch error:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Keep URL in sync so the tab + linking scope is shareable
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (activeTab === 'all sections') {
      next.delete('tab')
    } else {
      next.set('tab', activeTab)
    }
    
    if (activeTab === 'linking') {
      if (linkingExamCategoryId) next.set('examCat', linkingExamCategoryId); else next.delete('examCat')
      if (linkingExamId) next.set('exam', linkingExamId); else next.delete('exam')
      if (linkingSeriesId) next.set('series', linkingSeriesId); else next.delete('series')
      if (linkingStageId) next.set('stage', linkingStageId); else next.delete('stage')
    } else {
      next.delete('examCat')
      next.delete('exam')
      next.delete('series')
      next.delete('stage')
    }
    setSearchParams(next, { replace: true })
  }, [activeTab, linkingExamCategoryId, linkingExamId, linkingSeriesId, linkingStageId])

  useEffect(() => {
    if (!linkSectionPickerOpen) return
    const handler = (e) => {
      if (!e.target.closest('[data-section-picker]')) {
        setLinkSectionPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [linkSectionPickerOpen])

  const switchTab = (tabId) => {
    setActiveTab(tabId)
    if (tabId !== 'linking') {
      setLinkingExamCategoryId('')
      setLinkingExamId('')
      setLinkingSeriesId('')
      setLinkingStageId('')
    }
    setShowForm(false)
  }

  const normalizeSection = (section) => ({
    ...section,
    name: section.name || section.title || '',
    category_id: section.category_id ?? section.categoryId ?? null,
    test_id: section.test_id ?? section.testId ?? null,
    test_series_id: section.test_series_id ?? section.testSeriesId ?? null,
    stage_id: section.stage_id ?? section.stageId ?? null,
    description: section.description || '',
    duration: section.duration ?? 60,
    passing_marks: section.passing_marks ?? section.passingMarks ?? 0,
    marks_per_question: section.marks_per_question ?? section.marksPerQuestion ?? 2,
    negative_marks: section.negative_marks ?? section.negativeMarks ?? 0.5,
    time_limit: section.time_limit ?? section.timeLimit ?? 900,
    is_locked: section.is_locked ?? section.isLocked ?? false,
    is_active: section.is_active ?? section.isActive ?? true,
    display_order: section.display_order ?? section.displayOrder ?? 0,
    question_count: section.question_count ?? 0,
    instructions: section.instructions || '',
    difficulty: section.difficulty || 'medium',
    shuffle_questions: section.shuffle_questions ?? section.shuffleQuestions ?? false,
    shuffle_options: section.shuffle_options ?? section.shuffleOptions ?? false,
    expected_questions: section.expected_questions ?? section.expectedQuestions ?? 0,
    total_marks: section.total_marks ?? section.totalMarks ?? 0,
    exam_stage: section.exam_stage ?? section.examStage ?? '',
    paper: section.paper || '',
    session: section.session || '',
    section_code: section.section_code ?? section.sectionCode ?? '',
    is_qualifying: section.is_qualifying ?? section.isQualifying ?? false,
    exam_alias: section.exam_alias ?? section.examAlias ?? ''
  })

  // Validation
  const validateSection = useCallback((data, excludeId = null) => {
    const validationErrors = {}

    // Required name
    if (!data.name?.trim()) {
      validationErrors.name = 'Section name is required'
    } else {
      // Check duplicate name (within same test if testId provided)
      const duplicate = sections.find(s =>
        s.name?.toLowerCase() === data.name.trim().toLowerCase() &&
        s.id !== excludeId &&
        (!testId || s.test_id === testId)
      )
      if (duplicate) {
        validationErrors.name = 'A section with this name already exists'
      }
    }

    // Duration validation (in seconds now)
    const timeLimit = parseInt(data.time_limit) || 0
    if (timeLimit < 60) {
      validationErrors.time_limit = 'Time limit must be at least 60 seconds'
    }

    // Marks validation
    const marksPerQ = parseFloat(data.marks_per_question) || 0
    if (marksPerQ <= 0) {
      const isNonQuestionActivity = parseInt(data.expected_questions) === 0 && parseFloat(data.total_marks) === 0
      if (!isNonQuestionActivity) validationErrors.marks_per_question = 'Marks per question must be greater than 0'
    }

    // Negative marks validation (should be <= marks per question)
    const negMarks = parseFloat(data.negative_marks) || 0
    if (negMarks < 0) {
      validationErrors.negative_marks = 'Negative marks cannot be negative'
    }
    if (negMarks > marksPerQ) {
      validationErrors.negative_marks = 'Negative marks cannot exceed marks per question'
    }

    return validationErrors
  }, [sections, testId])

  // Filter stages based on selected series
  const linkedStages = useMemo(() => {
    if (!linkingSeriesId) return stages
    const selectedSeries = seriesList.find(s => String(s.id || s._id || s.public_id) === String(linkingSeriesId))
    if (!selectedSeries) return stages
    const stageIds = selectedSeries.stages || selectedSeries.stage_ids || []
    if (!Array.isArray(stageIds) || stageIds.length === 0) return stages
    return stages.filter(s => stageIds.includes(s.id) || stageIds.includes(Number(s.id)))
  }, [linkingSeriesId, seriesList, stages])

  // Filter series by exam category + exam
  const linkedSeriesList = useMemo(() => {
    let list = seriesList
    if (linkingExamCategoryId) {
      list = list.filter(s => {
        const cat = s.category || s.examCategoryId || s.exam_category_id || s.subcategory || ''
        return String(cat).toLowerCase() === String(linkingExamCategoryId).toLowerCase()
      })
    }
    if (linkingExamId) {
      list = list.filter(s => {
        const exam = s.examId || s.exam_id || s.subcategory || ''
        return String(exam).toLowerCase() === String(linkingExamId).toLowerCase()
      })
    }
    return list
  }, [seriesList, linkingExamCategoryId, linkingExamId])

  // Filter exams by exam category
  const linkedExams = useMemo(() => {
    if (!linkingExamCategoryId) return exams
    return exams.filter(e => {
      const cat = e.examCategoryId || e.exam_category_id || e.category || ''
      return String(cat).toLowerCase() === String(linkingExamCategoryId).toLowerCase()
    })
  }, [exams, linkingExamCategoryId])

  // Filter series for form modal by form's exam_category_id
  const formSeriesList = useMemo(() => {
    if (!formData.exam_category_id) return seriesList
    return seriesList.filter(s => {
      const cat = s.category || s.examCategoryId || s.exam_category_id || s.subcategory || ''
      return String(cat).toLowerCase() === String(formData.exam_category_id).toLowerCase()
    })
  }, [seriesList, formData.exam_category_id])

  const filteredSections = useMemo(() => {
    let normalized = sections.map(normalizeSection)

    // Filter by testId if provided
    if (testId) {
      normalized = normalized.filter(s => String(s.test_id) === String(testId))
    }

    if (!searchQuery.trim()) return normalized

    const query = searchQuery.toLowerCase()
    return normalized.filter(s =>
      s.name?.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query)
    )
  }, [sections, searchQuery, testId])

  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'No category'
    const cat = categories.find(c => c.id === categoryId || c.categoryId === categoryId)
    return cat?.name || cat?.label || 'Unknown'
  }

  const getTestName = (testIdVal) => {
    if (!testIdVal) return 'No test'
    const test = tests.find(t => t.id === testIdVal || t._id === testIdVal)
    return test?.title || test?.name || 'Unknown Test'
  }

  const getSeriesName = (seriesIdVal) => {
    if (!seriesIdVal) return null
    const s = seriesList.find(item => String(item.id || item._id || item.public_id) === String(seriesIdVal))
    return s?.title || s?.name || 'Series'
  }

  const getStageName = (stageIdVal) => {
    if (!stageIdVal) return null
    const s = stages.find(item => String(item.id || item._id) === String(stageIdVal))
    return s?.name || s?.title || 'Stage'
  }

  const getExamCategoryName = (catIdVal) => {
    if (!catIdVal) return null
    const c = examCategories.find(item => String(item.id || item.categoryId || item.slug) === String(catIdVal))
    return c?.name || c?.label || 'Category'
  }

  const getExamName = (examIdVal) => {
    if (!examIdVal) return null
    const e = exams.find(item => String(item.id || item._id || item.public_id) === String(examIdVal))
    return e?.name || e?.title || 'Exam'
  }

  const getSeriesNumericId = (seriesIdVal) => {
    if (!seriesIdVal) return null
    const s = seriesList.find(item => String(item.id || item._id || item.public_id) === String(seriesIdVal))
    return s?.id || s?._id || null
  }

  const getStageNumericId = (stageIdVal) => {
    if (!stageIdVal) return null
    const s = stages.find(item => String(item.id || item._id) === String(stageIdVal))
    return s?.id || s?._id || null
  }

  const openCreateForm = () => {
    // Auto-assign display order
    const maxOrder = sections.length > 0
      ? Math.max(...sections.map(s => s.display_order || 0))
      : 0

    // On the Linking tab, prefill with the active series/stage so admins don't have to.
    const prefill = { ...DEFAULT_SECTION_FORM, display_order: maxOrder + 1 }
    if (activeTab === 'linking') {
      if (linkingSeriesId) prefill.test_series_id = linkingSeriesId
      if (linkingStageId) prefill.stage_id = linkingStageId
    }
    if (testId) prefill.test_id = testId

    setFormData(prefill)
    setEditingId(null)
    setErrors({})
    setFormTab('basic')
    setShowForm(true)
  }

  const openEditForm = (section) => {
    const norm = normalizeSection(section)
    setFormData({
      name: norm.name,
      category_id: norm.category_id || '',
      test_id: norm.test_id || '',
      test_series_id: norm.test_series_id || '',
      stage_id: norm.stage_id || '',
      description: norm.description,
      duration: norm.duration,
      passing_marks: norm.passing_marks,
      marks_per_question: norm.marks_per_question,
      negative_marks: norm.negative_marks,
      time_limit: norm.time_limit,
      is_locked: norm.is_locked,
      is_active: norm.is_active,
      display_order: norm.display_order,
      instructions: norm.instructions || '',
      difficulty: norm.difficulty || 'medium',
      shuffle_questions: norm.shuffle_questions,
      shuffle_options: norm.shuffle_options,
      expected_questions: norm.expected_questions,
      total_marks: norm.total_marks,
      exam_stage: norm.exam_stage,
      paper: norm.paper,
      session: norm.session,
      section_code: norm.section_code,
      is_qualifying: norm.is_qualifying,
      exam_alias: norm.exam_alias || ''
    })
    setEditingId(norm.id)
    setErrors({})
    setFormTab('basic')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(DEFAULT_SECTION_FORM)
    setErrors({})
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate before submit
    const validationErrors = validateSection(formData, editingId)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      toast.error('Please fix validation errors')
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: formData.name.trim(),
        category_id: formData.category_id || null,
        test_id: formData.test_id || null,
        test_series_id: formData.test_series_id || null,
        stage_id: formData.stage_id || null,
        description: formData.description || '',
        passing_marks: parseInt(formData.passing_marks) || 0,
        marks_per_question: parseFloat(formData.marks_per_question) || 2,
        negative_marks: parseFloat(formData.negative_marks) || 0,
        time_limit: parseInt(formData.time_limit) || 900,
        is_locked: Boolean(formData.is_locked),
        is_active: formData.is_active,
        display_order: parseInt(formData.display_order) || sections.length + 1,
        instructions: formData.instructions || '',
        difficulty: formData.difficulty || 'medium',
        shuffle_questions: Boolean(formData.shuffle_questions),
        shuffle_options: Boolean(formData.shuffle_options),
        expected_questions: parseInt(formData.expected_questions) || 0,
        total_marks: parseFloat(formData.total_marks) || 0,
        exam_stage: formData.exam_stage || null,
        paper: formData.paper || null,
        session: formData.session || null,
        section_code: formData.section_code || null,
        is_qualifying: Boolean(formData.is_qualifying),
        exam_alias: formData.exam_alias || null
      }

      if (editingId) {
        await apiClient.put(`/admin/sections/${editingId}`, payload)
        toast.success('Section updated')
      } else {
        await apiClient.post('/admin/sections', payload)
        toast.success('Section created')
      }

      closeForm()
      await fetchData()
    } catch (error) {
      console.error('Save error:', error)
      toast.error(error.response?.data?.message || 'Failed to save section')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this section?')) return

    try {
      setDeletingId(sectionId)
      const res = await apiClient.delete(`/admin/sections/${sectionId}`)
      const deletedQs = res.data?.data?.deletedQuestions || 0
      if (deletedQs > 0) {
        toast.success(`Section deleted. ${deletedQs} linked question${deletedQs > 1 ? 's' : ''} were unlinked.`)
      } else {
        toast.success('Section deleted')
      }
      await fetchData()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error.response?.data?.message || 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const handleLinkSection = async (templateSection) => {
    if (!linkingSeriesId || !linkingStageId) {
      toast.error('Select a test series and stage first')
      return
    }

    const canonicalName = resolveCanonical(templateSection.name)
    const examAlias = canonicalName !== templateSection.name ? templateSection.name : null

    const existingLinked = sections.find(s =>
      String(s.name).toLowerCase() === canonicalName.toLowerCase() &&
      String(s.test_series_id || '') === String(linkingSeriesId) &&
      String(s.stage_id || '') === String(linkingStageId)
    )
    if (existingLinked) {
      toast.error(`"${canonicalName}" is already linked to this scope`)
      return
    }

    try {
      setSaving(true)
      const maxOrder = sections
        .filter(s => String(s.test_series_id || '') === String(linkingSeriesId) && String(s.stage_id || '') === String(linkingStageId))
        .reduce((max, s) => Math.max(max, Number(s.display_order) || 0), 0)

      await apiClient.post('/admin/sections', {
        name: canonicalName,
        exam_alias: examAlias,
        test_series_id: linkingSeriesId,
        stage_id: linkingStageId,
        test_id: templateSection.test_id || null,
        category_id: templateSection.category_id || null,
        description: templateSection.description || '',
        duration: templateSection.duration || 60,
        passing_marks: templateSection.passing_marks || 0,
        marks_per_question: templateSection.marks_per_question || 2,
        negative_marks: templateSection.negative_marks || 0.5,
        time_limit: templateSection.time_limit || 900,
        is_locked: templateSection.is_locked || false,
        is_active: true,
        display_order: maxOrder + 1,
        instructions: templateSection.instructions || '',
        difficulty: templateSection.difficulty || 'medium',
        shuffle_questions: templateSection.shuffle_questions || false,
        shuffle_options: templateSection.shuffle_options || false,
        expected_questions: templateSection.expected_questions || 0,
        total_marks: templateSection.total_marks || 0,
        exam_stage: templateSection.exam_stage || null,
        paper: templateSection.paper || null,
        session: templateSection.session || null,
        section_code: templateSection.section_code || null,
        is_qualifying: templateSection.is_qualifying || false
      })

      toast.success(`Linked "${canonicalName}" to scope`)
      setLinkSectionPickerOpen(false)
      await fetchData()
    } catch (error) {
      console.error('Link error:', error)
      toast.error(error.response?.data?.message || 'Failed to link section')
    } finally {
      setSaving(false)
    }
  }

  const applyPreset = async () => {
    // Resolve scope: linking tab uses series+stage; otherwise requires a test.
    const scope = {}
    if (activeTab === 'linking') {
      if (!linkingSeriesId || !linkingStageId) {
        toast.error('Select both a test series and a stage before applying a scheme')
        return
      }
      scope.testSeriesId = linkingSeriesId
      scope.stageId = linkingStageId
    } else if (testId) {
      scope.testId = testId
    } else {
      toast.error('Select a test, or switch to the Linking tab and pick series + stage')
      return
    }

    const preset = EXAM_PRESETS.find(item => item.id === selectedPresetId)
    if (!preset) return

    try {
      setSaving(true)
      const existingNames = new Set(
        sections
          .filter(s => scope.testId
            ? String(s.test_id || '') === String(scope.testId)
            : String(s.test_series_id || '') === String(scope.testSeriesId) && String(s.stage_id || '') === String(scope.stageId))
          .map(s => String(s.name || '').toLowerCase())
      )
      const baseOrder = sections
        .filter(s => scope.testId
          ? String(s.test_id || '') === String(scope.testId)
          : String(s.test_series_id || '') === String(scope.testSeriesId) && String(s.stage_id || '') === String(scope.stageId))
        .reduce((max, s) => Math.max(max, Number(s.display_order) || 0), 0)

      const rowsToCreate = preset.sections.filter(([alias]) => !existingNames.has(resolveCanonical(alias).toLowerCase()))
      if (rowsToCreate.length === 0) {
        toast('All sections from this scheme already exist for the selected scope')
        return
      }

      await Promise.all(rowsToCreate.map((row, index) => {
        const [alias, examStage, paper, session, sectionCode, expectedQuestions, totalMarks, marksPerQuestion, negativeMarks, timeLimit, isQualifying] = row
        const canonicalName = resolveCanonical(alias)
        return apiClient.post('/admin/sections', {
          name: canonicalName,
          exam_alias: alias !== canonicalName ? alias : null,
          test_id: scope.testId || null,
          test_series_id: scope.testSeriesId || null,
          stage_id: scope.stageId || null,
          description: `${preset.label}${sectionCode ? ` - Section ${sectionCode}` : ''}`,
          duration: Math.max(1, Math.round(timeLimit / 60)),
          passing_marks: 0,
          marks_per_question: marksPerQuestion,
          negative_marks: negativeMarks,
          time_limit: timeLimit,
          is_locked: false,
          is_active: true,
          display_order: baseOrder + index + 1,
          instructions: preset.description,
          difficulty: 'medium',
          shuffle_questions: false,
          shuffle_options: false,
          expected_questions: expectedQuestions,
          total_marks: totalMarks,
          exam_stage: examStage,
          paper,
          session,
          section_code: sectionCode,
          is_qualifying: isQualifying
        })
      }))

      toast.success(`Created ${rowsToCreate.length} section${rowsToCreate.length > 1 ? 's' : ''} for ${scope.testId ? 'this test' : `${getSeriesName(scope.testSeriesId)} / ${getStageName(scope.stageId)}`}`)
      await fetchData()
    } catch (error) {
      console.error('Preset error:', error)
      toast.error(error.response?.data?.message || 'Failed to apply scheme')
    } finally {
      setSaving(false)
    }
  }

  const handleReorder = async (sectionId, newOrder) => {
    try {
      await apiClient.put(`/admin/sections/${sectionId}`, { display_order: newOrder })
      await fetchData()
    } catch (error) {
      console.error('Reorder error:', error)
      toast.error('Failed to reorder')
    }
  }

  // Stats
  const stats = useMemo(() => {
    const scopedSections = testId
      ? sections.filter(s => String(s.test_id ?? s.testId ?? '') === String(testId))
      : sections
    const total = scopedSections.length
    const active = scopedSections.filter(s => s.is_active !== false).length
    const withQuestions = scopedSections.filter(s => (s.question_count || 0) > 0).length
    const plannedQuestions = scopedSections.reduce((sum, s) => sum + (Number(s.expected_questions) || 0), 0)
    const plannedMarks = scopedSections.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    return { total, active, withQuestions, plannedQuestions, plannedMarks }
  }, [sections, testId])

  return (
    <div className="p-6">
      {/* Header and Tabs Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Section Manager</h1>
          <p className="text-sm text-gray-500 hidden sm:block">Template sections. Use Linking to bind to a test series.</p>
        </div>

        {/* Tabs - Middle */}
        <div className="flex p-1 bg-slate-100 rounded-xl overflow-x-auto whitespace-nowrap scrollbar-hide border border-slate-200 shadow-inner w-fit xl:mx-auto">
          {[
            { id: 'all sections', label: 'All Sections', icon: FileText, hint: 'Default templates, no linkage' },
            { id: 'linking', label: 'Linking', icon: GitBranch, hint: 'Sections linked to a test series + stage' },
            { id: 'presets', label: 'Exam Presets', icon: Layers, hint: 'View exam preset schemes' },
          ].map(tab => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 font-medium text-sm transition-all shrink-0 rounded-lg ${isActive ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'}`}
                title={tab.hint}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button onClick={openCreateForm} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            <Plus className="w-4 h-4" /> New Section
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Linking scope picker + preview (only on Linking tab) */}
          {activeTab === 'linking' && (
            <div className="mb-6 space-y-4">
              {/* Scope Selector */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Linking Scope</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Exam Category</label>
                    <select
                      value={linkingExamCategoryId}
                      onChange={(e) => {
                        setLinkingExamCategoryId(e.target.value)
                        setLinkingExamId('')
                        setLinkingSeriesId('')
                        setLinkingStageId('')
                      }}
                      className={`w-full px-3 py-1.5 text-sm rounded-lg border transition-colors ${linkingExamCategoryId ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                    >
                      <option value="">All categories</option>
                      {examCategories.map(c => (
                        <option key={c.id || c.categoryId || c.slug} value={c.id || c.categoryId || c.slug}>{c.name || c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Exam</label>
                    <select
                      value={linkingExamId}
                      onChange={(e) => {
                        setLinkingExamId(e.target.value)
                        setLinkingSeriesId('')
                        setLinkingStageId('')
                      }}
                      className={`w-full px-3 py-1.5 text-sm rounded-lg border transition-colors ${linkingExamId ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      disabled={false}
                    >
                      <option value="">All exams</option>
                      {linkedExams.map(e => (
                        <option key={e.id || e._id || e.public_id} value={e.id || e._id || e.public_id}>{e.name || e.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Test Series</label>
                    <select
                      value={linkingSeriesId}
                      onChange={(e) => {
                        setLinkingSeriesId(e.target.value)
                        setLinkingStageId('')
                        setLinkSectionPickerOpen(false)
                      }}
                      className={`w-full px-3 py-1.5 text-sm rounded-lg border transition-colors ${linkingSeriesId ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                    >
                      <option value="">All series</option>
                      {linkedSeriesList.map(s => (
                        <option key={s.id || s._id || s.public_id} value={s.id || s._id || s.public_id}>{s.title || s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Stage</label>
                    <select
                      value={linkingStageId}
                      onChange={(e) => {
                        setLinkingStageId(e.target.value)
                        setLinkSectionPickerOpen(false)
                      }}
                      className={`w-full px-3 py-1.5 text-sm rounded-lg border transition-colors ${linkingStageId ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      disabled={!linkingSeriesId}
                    >
                      <option value="">All stages</option>
                      {linkedStages.map(s => (
                        <option key={s.id || s._id} value={s.id || s._id}>{s.name || s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {linkingSeriesId && linkingStageId && (
                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Link Section:</span>
                    <div className="relative" data-section-picker>
                      <button
                        type="button"
                        onClick={() => setLinkSectionPickerOpen(!linkSectionPickerOpen)}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" /> Add Section
                      </button>
                      {linkSectionPickerOpen && (
                        <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {sections.filter(s => !s.test_series_id && !s.stage_id).length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">No template sections available</div>
                          ) : (
                            sections.filter(s => !s.test_series_id && !s.stage_id).map(s => {
                              const canonical = resolveCanonical(s.name)
                              const alreadyLinked = sections.some(ls =>
                                String(ls.name).toLowerCase() === canonical.toLowerCase() &&
                                String(ls.test_series_id || '') === String(linkingSeriesId) &&
                                String(ls.stage_id || '') === String(linkingStageId)
                              )
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => !alreadyLinked && handleLinkSection(s)}
                                  disabled={alreadyLinked}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 ${alreadyLinked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  <span className="font-medium text-gray-900">{s.name}</span>
                                  {alreadyLinked ? (
                                    <span className="text-xs text-green-600">Linked</span>
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                </button>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Apply Scheme:</span>
                    <select
                      value={selectedPresetId}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                    >
                      {EXAM_PRESETS.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applyPreset}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
                    >
                      <Layers className="w-4 h-4" /> Apply to Scope
                    </button>
                  </div>
                )}
              </div>

              {/* Section Preview - shows existing sections and what preset will create */}
              {linkingSeriesId && linkingStageId && (
                <SectionPreview
                  existingSections={sections.filter(s => {
                    const numSeriesId = getSeriesNumericId(linkingSeriesId)
                    const numStageId = getStageNumericId(linkingStageId)
                    return String(s.test_series_id || '') === String(numSeriesId) &&
                      (String(s.stage_id || '') === String(numStageId) || !s.stage_id)
                  })}
                  preset={EXAM_PRESETS.find(p => p.id === selectedPresetId)}
                  seriesName={getSeriesName(linkingSeriesId)}
                  stageName={getStageName(linkingStageId)}
                />
              )}
            </div>
          )}

          {/* Preset View */}
          {activeTab === 'presets' && (
            <div className="space-y-6 mb-8">
              {EXAM_PRESETS.map(preset => (
                <SectionPreview
                  key={preset.id}
                  existingSections={[]}
                  preset={preset}
                  seriesName="Preset Scheme"
                  stageName={preset.label}
                />
              ))}
            </div>
          )}

          {activeTab !== 'presets' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                  <div className="text-sm text-gray-500">Total Sections</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                  <div className="text-sm text-gray-500">Active</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.withQuestions}</div>
                  <div className="text-sm text-gray-500">With Questions</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-gray-900">{stats.plannedQuestions}</div>
                  <div className="text-sm text-gray-500">Planned Qs</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-gray-900">{stats.plannedMarks}</div>
                  <div className="text-sm text-gray-500">Planned Marks</div>
                </div>
              </div>

              {/* Search */}
              {activeTab !== 'all sections' && (
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search sections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              {filteredSections.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No sections found</p>
                  <p className="text-sm text-gray-400">Create your first test section</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Alias Name</th>
                        {activeTab === 'linking' && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Series / Stage</th>}
                        {!propTestId && activeTab !== 'linking' && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Exams Linked</th>}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Qs</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marks</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Neg</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Locked</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredSections.map((section) => (
                        <tr key={section.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">{section.display_order}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{section.name}</p>
                              {!section.test_id && !section.test_series_id && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded" title="Not linked to any test">
                                  <Link className="w-3 h-3 inline" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="font-medium text-gray-900">
                              {section.exam_alias ? section.exam_alias : <span className="text-gray-400 italic">Same as name</span>}
                            </div>
                          </td>
                          {activeTab === 'linking' && (
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <div className="font-medium text-gray-900">{getSeriesName(section.test_series_id) || '—'}</div>
                              <div className="text-xs text-gray-500">{getStageName(section.stage_id) || 'All stages'}</div>
                            </td>
                          )}
                          {!propTestId && activeTab !== 'linking' && (
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {section.test_id ? getTestName(section.test_id) : <span className="text-gray-400">—</span>}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${(section.question_count || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {section.question_count || 0}
                            </span>
                            {(section.question_count || 0) === 0 && (
                              <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-1" title="No questions linked" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div>{section.expected_questions || 0} Q</div>
                            <div className="text-xs text-gray-400">{section.total_marks || 0} marks</div>
                            {section.is_qualifying && <div className="text-xs text-amber-700">Qualifying</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {Math.floor((section.time_limit || 900) / 60)}m
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {section.marks_per_question || 2}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {section.negative_marks || 0}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {section.is_locked ? (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Yes</span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {section.is_active ? (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Inactive</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditForm(section)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(section.id)}
                                disabled={deletingId === section.id}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingId === section.id ? (
                                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl my-8 bg-white shadow-2xl rounded-2xl ring-1 ring-slate-900/5 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="relative px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl ring-1 ring-white/20">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {editingId ? 'Edit Section' : 'Create Section'}
                    </h2>
                    <p className="text-xs text-indigo-100/90 mt-0.5">
                      Configure section details, scoring, timing and linking
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeForm}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Tabs */}
            <div className="px-6 bg-slate-50 border-b border-slate-200">
              <div className="flex gap-1">
                {[
                  { id: 'basic', label: 'Basic Config', icon: Settings },
                  { id: 'linking', label: 'Linking', icon: GitBranch },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFormTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${formTab === tab.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {formTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {formTab === 'basic' && (
                <>
                  {/* Section Name */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Section Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value })
                        if (errors.name) setErrors({ ...errors, name: null })
                      }}
                      className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 hover:border-slate-400'}`}
                      placeholder="e.g., Quant, Reasoning, English"
                    />
                    {errors.name && (
                      <p className="flex items-center gap-1 mt-1.5 text-xs text-rose-600">
                        <AlertCircle className="w-3 h-3" />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Scoring & Timing Card */}
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Scoring & Timing</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Time (sec)
                        </label>
                        <input
                          type="number"
                          value={formData.time_limit}
                          onChange={(e) => {
                            setFormData({ ...formData, time_limit: e.target.value })
                            if (errors.time_limit) setErrors({ ...errors, time_limit: null })
                          }}
                          className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors ${errors.time_limit ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'}`}
                          min={60}
                          step={60}
                        />
                        <p className="mt-1 text-[11px] font-medium text-indigo-600">
                          {Math.floor((parseInt(formData.time_limit) || 900) / 60)} minutes
                        </p>
                        {errors.time_limit && (
                          <p className="flex items-center gap-1 mt-1 text-xs text-rose-600">
                            <AlertCircle className="w-3 h-3" />
                            {errors.time_limit}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Planned Qs
                        </label>
                        <input
                          type="number"
                          value={formData.expected_questions}
                          onChange={(e) => setFormData({ ...formData, expected_questions: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Total Marks
                        </label>
                        <input
                          type="number"
                          value={formData.total_marks}
                          onChange={(e) => setFormData({ ...formData, total_marks: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                          min={0}
                          step={0.5}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Marks/Q
                        </label>
                        <input
                          type="number"
                          value={formData.marks_per_question}
                          onChange={(e) => {
                            setFormData({ ...formData, marks_per_question: e.target.value })
                            if (errors.marks_per_question) setErrors({ ...errors, marks_per_question: null })
                          }}
                          className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors ${errors.marks_per_question ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'}`}
                          min={0}
                          step={0.5}
                        />
                        {errors.marks_per_question && (
                          <p className="flex items-center gap-1 mt-1 text-xs text-rose-600">
                            <AlertCircle className="w-3 h-3" />
                            {errors.marks_per_question}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Negative
                        </label>
                        <input
                          type="number"
                          value={formData.negative_marks}
                          onChange={(e) => {
                            setFormData({ ...formData, negative_marks: e.target.value })
                            if (errors.negative_marks) setErrors({ ...errors, negative_marks: null })
                          }}
                          className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors ${errors.negative_marks ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'}`}
                          min={0}
                          step={0.25}
                        />
                        {errors.negative_marks && (
                          <p className="flex items-center gap-1 mt-1 text-xs text-rose-600">
                            <AlertCircle className="w-3 h-3" />
                            {errors.negative_marks}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Difficulty & Section Controls Card */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2 p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-rose-100">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Difficulty</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'easy', label: 'Easy', color: 'emerald' },
                          { value: 'medium', label: 'Medium', color: 'amber' },
                          { value: 'hard', label: 'Hard', color: 'rose' },
                        ].map(opt => {
                          const active = formData.difficulty === opt.value
                          const colorMap = {
                            emerald: { active: 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30', idle: 'border-slate-200 hover:border-emerald-300 text-slate-600' },
                            amber: { active: 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/30', idle: 'border-slate-200 hover:border-amber-300 text-slate-600' },
                            rose: { active: 'bg-rose-500 border-rose-500 text-white shadow-sm shadow-rose-500/30', idle: 'border-slate-200 hover:border-rose-300 text-slate-600' },
                          }
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, difficulty: opt.value })}
                              className={`py-2 text-xs font-semibold rounded-lg border transition-all ${active ? colorMap[opt.color].active : colorMap[opt.color].idle}`}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3 flex-1 flex flex-col">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Display Order</label>
                          <input
                            type="number"
                            value={formData.display_order}
                            onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                            min={0}
                          />
                        </div>
                        <label className="flex items-center justify-between gap-3 px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200/80 cursor-pointer mt-auto">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base leading-none">✅</span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-700 leading-tight">Active</div>
                              <div className="text-[11px] text-slate-500 leading-tight truncate">Visible to candidates</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={formData.is_active}
                            onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${formData.is_active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                          </button>
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-100">
                          <Settings className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Section Controls</h3>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { key: 'is_locked', label: 'Lock Section', desc: 'No revisit after submission', icon: '🔒' },
                          { key: 'shuffle_questions', label: 'Shuffle Questions', desc: 'Randomize question order', icon: '🔀' },
                          { key: 'shuffle_options', label: 'Shuffle Options', desc: 'Randomize answer choices', icon: '🎲' },
                          { key: 'is_qualifying', label: 'Qualifying Section', desc: 'Must pass to continue', icon: '⭐' },
                        ].map(toggle => (
                          <label key={toggle.key} className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg hover:bg-white/60 cursor-pointer transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-base leading-none">{toggle.icon}</span>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-700 leading-tight">{toggle.label}</div>
                                <div className="text-[11px] text-slate-500 leading-tight">{toggle.desc}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={formData[toggle.key]}
                              onClick={() => setFormData({ ...formData, [toggle.key]: !formData[toggle.key] })}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${formData[toggle.key] ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${formData[toggle.key] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Instructions <span className="text-xs font-normal text-slate-500">(shown before section starts)</span>
                    </label>
                    <textarea
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
                      rows={3}
                      placeholder="e.g., This section contains 25 questions. You have 30 minutes..."
                    />
                  </div>
                </>
              )}

              {formTab === 'linking' && (
                <div className="space-y-4">
                  {/* Exam Scheme Card */}
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100">
                        <Filter className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Exam Scheme</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
                        <input
                          type="text"
                          value={formData.exam_stage}
                          onChange={(e) => setFormData({ ...formData, exam_stage: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                          placeholder="Tier-I"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Paper</label>
                        <input
                          type="text"
                          value={formData.paper}
                          onChange={(e) => setFormData({ ...formData, paper: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                          placeholder="Paper-I"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Session</label>
                        <input
                          type="text"
                          value={formData.session}
                          onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                          placeholder="Session-I"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
                        <input
                          type="text"
                          value={formData.section_code}
                          onChange={(e) => setFormData({ ...formData, section_code: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                          placeholder="I-A"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section Linking Card */}
                  <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-violet-50/50 p-5 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white shadow-sm ring-1 ring-indigo-200">
                        <GitBranch className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Section Linking</h3>
                        <p className="text-xs text-slate-500">Link to a Test Series + Stage, or override for a specific test.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Exam Category</label>
                        <select
                          value={formData.exam_category_id || ''}
                          onChange={(e) => setFormData({ ...formData, exam_category_id: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                        >
                          <option value="">Any category</option>
                          {examCategories.map(c => (
                            <option key={c.id || c.categoryId || c.slug} value={c.id || c.categoryId || c.slug}>{c.name || c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Test Series</label>
                        <select
                          value={formData.test_series_id}
                          onChange={(e) => setFormData({ ...formData, test_series_id: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                        >
                          <option value="">No series (template)</option>
                          {formSeriesList.map(s => (
                            <option key={s.id || s._id || s.public_id} value={s.id || s._id || s.public_id}>{s.title || s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
                        <select
                          value={formData.stage_id}
                          onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 transition-colors"
                          disabled={!formData.test_series_id}
                        >
                          <option value="">All stages</option>
                          {linkedStages.map(s => (
                            <option key={s.id || s._id} value={s.id || s._id}>{s.name || s.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Specific Test (override)</label>
                        <select
                          value={formData.test_id}
                          onChange={(e) => setFormData({ ...formData, test_id: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                        >
                          <option value="">No test</option>
                          {tests.map(test => (
                            <option key={test.id || test._id} value={test.id || test._id}>
                              {test.title || test.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-5 mt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg shadow-sm shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingId ? 'Update Section' : 'Create Section'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
