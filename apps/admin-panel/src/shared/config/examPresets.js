export const EXAM_PRESETS = [
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
