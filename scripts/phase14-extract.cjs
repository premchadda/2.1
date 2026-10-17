/**
 * Phase 14 -> Full-Test-Import JSON converter
 * Reads Phase 14/*.html (MOCKS + META + EXAM), outputs uploadable JSON
 * Compatible with POST /api/import/full-test/preview + /import-selected
 * (admin FullTestImportModal expects an ARRAY of test objects)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PHASE_DIR = path.join(__dirname, '..', 'Phase 14');
const OUT_DIR = path.join(PHASE_DIR, 'uploadable-json');

// Stage model: stages are EXAM PHASES (Tier 1 / Tier 2 / CBT-1 / CBT-2), not
// qualification levels. There is no level concept anywhere in the schema or
// frontend (verified: no level column/filter; TestDetails filters by stage;
// series ssc-selection-post-2026 declares stages [1,2]). RRB precedent:
// "RRB NTPC CBT1 (Undergraduate) - Full Test" keeps stage=CBT-1 with the level
// in title+tags. Same here: ALL Phase-14 tests -> tier-1-pre, level lives in
// titles + tags only.
const TIER1 = 'tier-1-pre';
// Target shapes mirror the existing DB rows exactly:
//   full:      Mock Tests / "Full Mock Tests" / cat 21 / series 30 / stage 1
//   sectional: Mock Tests / "Sectional Tests"  / cat 57-60 / series 30 / stage 1
// ("Full Mock Tests"/"Sectional Tests" and series-30/stage-1 are the DB values.)
const MOCK_SERIES = 'ssc-selection-post-2027';
const LEVELS = {
  '10th':     { label: 'Matriculation (10th)', short: '10th', stageId: TIER1, levelTag: 'matriculation', seriesId: MOCK_SERIES },
  '12th':     { label: 'Higher Secondary (12th)', short: '12th', stageId: TIER1, levelTag: 'higher-secondary', seriesId: MOCK_SERIES },
  'Graduate': { label: 'Graduate', short: 'grad', stageId: TIER1, levelTag: 'graduate', seriesId: MOCK_SERIES },
};

const SUBJECTS = {
  Reasoning: { fileTag: 'Reasoning', label: 'Reasoning', sectionName: 'General Intelligence and Reasoning', subjectId: 'general-intelligence-and-reasoning', short: 'reasoning', order: 1, sectionalCategory: 'pyp-reasoning-sectional' },
  GS:        { fileTag: 'GS', label: 'General Awareness', sectionName: 'General Awareness', subjectId: 'general-awareness', short: 'ga', order: 2, sectionalCategory: 'pyp-ga-sectional' },
  Maths:     { fileTag: 'Maths', label: 'Quantitative Aptitude', sectionName: 'Quantitative Aptitude', subjectId: 'quantitative-aptitude', short: 'quant', order: 3, sectionalCategory: 'pyp-quant-sectional' },
  English:   { fileTag: 'English', label: 'English Language', sectionName: 'English Language', subjectId: 'english-language', short: 'english', order: 4, sectionalCategory: 'pyp-english-sectional' },
};

function extractBalanced(s, startIdx) {
  // startIdx points at '[' ; return balanced [...] string
  let depth = 0, inStr = false, esc = false, quote = null;
  for (let i = startIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) { inStr = false; quote = null; }
      continue;
    } else {
      if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) return s.slice(startIdx, i + 1); }
    }
  }
  return null;
}

function parseHtmlFile(filePath) {
  const p = fs.readFileSync(filePath, 'utf8');
  // EXAM
  const mExam = p.match(/const EXAM=(\{[\s\S]*?\});/);
  let exam = {};
  try { exam = eval('(' + mExam[1] + ')'); } catch (e) { exam = {}; }
  // MOCKS
  const idxMocks = p.indexOf('const MOCKS=');
  if (idxMocks < 0) throw new Error('MOCKS not found in ' + filePath);
  const arrStart = p.indexOf('[', idxMocks);
  const mocksStr = extractBalanced(p, arrStart);
  if (!mocksStr) throw new Error('MOCKS balanced extract failed ' + filePath);
  const sandbox = {};
  vm.runInNewContext('MOCKS=' + mocksStr + ';', sandbox, { timeout: 10000 });
  const mocks = sandbox.MOCKS;
  // META (optional)
  let meta = null;
  const idxMeta = p.indexOf('const META=');
  if (idxMeta >= 0) {
    const metaStart = p.indexOf('[', idxMeta);
    const metaStr = extractBalanced(p, metaStart);
    try {
      const sb2 = {};
      vm.runInNewContext('META=' + metaStr + ';', sb2, { timeout: 5000 });
      meta = sb2.META;
    } catch (e) { meta = null; }
  }
  return { exam, mocks, meta };
}

function toImporterQuestion(src, subjectSlug, qId, tags, provenance) {
  let enQ, hiQ, enO, hiO;
  let mathsFallback = false;
  if (src.hx && typeof src.hx.q === 'string' && src.hx.q.length > 0) {
    // Maths: hx holds Hindi text (+ unicode maths). English in source is image-only.
    hiQ = src.hx.q;
    hiO = Array.isArray(src.hx.o) ? src.hx.o.slice() : [];
    enQ = hiQ;   // fallback: duplicate Hindi so EN mode still has content
    enO = hiO.slice();
    mathsFallback = true;
  } else {
    enQ = (src.en && src.en.q) || '';
    hiQ = (src.hi && src.hi.q) || '';
    enO = (src.en && Array.isArray(src.en.o)) ? src.en.o.slice() : [];
    hiO = (src.hi && Array.isArray(src.hi.o)) ? src.hi.o.slice() : [];
  }
  const correct1 = (typeof src.a === 'number' ? src.a : 0) + 1;
  const qTags = tags.slice();
  if (mathsFallback) qTags.push('maths-english-image-source-needs-review');
  return {
    id: qId,
    questionType: 'mcq',
    question: enQ,
    question_text_hi: hiQ,
    text: { en: enQ, hi: hiQ },
    options: enO,
    options_bilingual: { en: enO, hi: hiO },
    correctAnswer: correct1,
    solution: '',
    explanation: '',
    solution_bilingual: { en: '', hi: '' },
    difficulty: 'medium',
    marks: 2,
    negativeMarks: 0.5,
    languages: ['en', 'hi'],
    subjectId: subjectSlug,
    tags: qTags,
    _provenance: provenance,
  };
}

function buildSection(name, subjectId, questions, secId) {
  return {
    id: secId,
    name,
    subjectId,
    description: name + ' — SSC Selection Post Phase-XIV',
    duration: 900,
    questionCount: questions.length,
    maxMarks: questions.length * 2,
    negativeMarking: 0.5,
    mandatory: true,
    optional: false,
    qualifying: false,
    instructions: [],
    questions,
  };
}

function buildTest({ id, title, shortTitle, slug, description, level, categoryId, category, testType, duration, sections, tags }) {
  const totalQ = sections.reduce((s, x) => s + x.questions.length, 0);
  const totalM = sections.reduce((s, x) => s + (x.maxMarks || x.questions.length * 2), 0);
  // Shape: Mock Tests tree placement (cat 21 / 57-60) + 2026-paper identity.
  // - NO subCategory field: the importer resolves subCategory into
  //   test_category_id and would hijack it (past "Phase 14" stray-row bug).
  // - isPyq:true + explicit pyqYear:2026 makes the importer derive
  //   sub_category="2026" (matches admin L2-2026 pills + PYP year grouping).
  //   Explicit pyqYear MUST stay: otherwise extractYear would take 2027 from
  //   the series slug. 'pyp' tag keeps learner pyp-public route matching.
  const PYP_YEAR = 2026;
  return {
    id,
    title,
    shortTitle,
    slug,
    description,
    examCategoryId: 'ssc',
    examId: 'ssc-selection-post',
    stageId: level.stageId,
    testSeriesId: level.seriesId,
    categoryId,
    category,
    isPyq: true,
    year: PYP_YEAR,
    pyqYear: PYP_YEAR,
    testType,
    status: 'published',
    difficulty: 'medium',
    duration,
    totalQuestions: totalQ,
    totalMarks: totalM,
    negativeMarking: 0.5,
    questionLanguageMode: 'bilingual',
    languages: ['en', 'hi'],
    tags,
    instructions: [
      'Total questions: ' + totalQ + ', Total marks: ' + totalM + ', Duration: ' + duration + ' minutes.',
      'Each correct answer carries 2 marks. Each wrong answer deducts 0.5 marks.',
      'Questions are available in English and Hindi. Use the language toggle during the test.',
    ],
    showCalculator: false,
    showQuestionPalette: true,
    showSectionPalette: true,
    showTimer: true,
    allowBookmark: true,
    allowReportIssue: true,
    shuffleQuestions: false,
    shuffleOptions: true,
    allowReview: true,
    sections,
  };
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Load all 12 files: level -> subject -> {mocks, meta}
  const store = {}; // store[levelShort][subjectKey] = {mocks, meta, file}
  const files = fs.readdirSync(PHASE_DIR).filter(f => f.endsWith('.html'));
  console.log('Found ' + files.length + ' HTML files');
  for (const f of files) {
    let levelKey = null;
    if (f.includes('_10th_')) levelKey = '10th';
    else if (f.includes('_12th_')) levelKey = '12th';
    else if (f.includes('_Graduate_')) levelKey = 'Graduate';
    else { console.log('SKIP (no level): ' + f); continue; }
    let subjKey = null;
    for (const k of Object.keys(SUBJECTS)) {
      if (f.includes('_' + SUBJECTS[k].fileTag + '_') || f.includes(SUBJECTS[k].fileTag)) { subjKey = k; break; }
    }
    // Fallback by filename token
    if (!subjKey) {
      if (f.includes('Reasoning')) subjKey = 'Reasoning';
      else if (f.includes('English')) subjKey = 'English';
      else if (f.includes('Maths')) subjKey = 'Maths';
      else if (f.includes('GS_')) subjKey = 'GS';
    }
    if (!subjKey) { console.log('SKIP (no subject): ' + f); continue; }
    const full = path.join(PHASE_DIR, f);
    const { exam, mocks, meta } = parseHtmlFile(full);
    console.log(`Parsed ${f}: level=${levelKey} subject=${subjKey} mocks=${mocks.length} perMock=${mocks.map(m=>m.length).join(',')}`);
    store[levelKey] = store[levelKey] || {};
    store[levelKey][subjKey] = { mocks, meta, file: f, exam };
  }

  // Validate all levels have all 4 subjects x 9 mocks x 25Q
  for (const lk of Object.keys(LEVELS)) {
    const s = store[lk];
    if (!s) throw new Error('Missing level ' + lk);
    for (const sk of Object.keys(SUBJECTS)) {
      if (!s[sk]) throw new Error(`Missing ${lk}/${sk}`);
      if (s[sk].mocks.length !== 9) console.log(`WARN ${lk}/${sk} mocks=${s[sk].mocks.length} (expected 9)`);
      s[sk].mocks.forEach((m, i) => {
        if (m.length !== 25) console.log(`WARN ${lk}/${sk} mock${i} len=${m.length} (expected 25)`);
      });
    }
  }

  const summary = {};

  for (const lk of Object.keys(LEVELS)) {
    const level = LEVELS[lk];
    const dateMeta = (store[lk].Reasoning && store[lk].Reasoning.meta) || store[lk].GS.meta;

    // ---- FULL TESTS (9 x 100Q) ----
    const fullTests = [];
    for (let mi = 0; mi < 9; mi++) {
      const nn = String(mi + 1).padStart(2, '0');
      const dateEn = (dateMeta && dateMeta[mi] && dateMeta[mi].en && dateMeta[mi].en.d) || ('Mock ' + nn);
      const sections = ['Reasoning', 'GS', 'Maths', 'English'].map(sk => {
        const subj = SUBJECTS[sk];
        const srcMocks = store[lk][sk].mocks;
        const srcQ = srcMocks[mi];
        const questions = srcQ.map((q, qi) => {
          const qid = `p14-${level.short}-full-${nn}-${subj.short}-q${String(qi + 1).padStart(2, '0')}`;
          return toImporterQuestion(q, subj.subjectId, qid,
            ['phase-14', 'ssc-selection-post', level.levelTag, subj.subjectId, 'full-mock'],
            { sourceFile: store[lk][sk].file, mockIndex: mi, qIndex: qi });
        });
        return buildSection(subj.sectionName, subj.subjectId, questions,
          `p14-${level.short}-full-${nn}-${subj.short}`);
      });
      // Enforce SSC section order Reasoning(1) GA(2) Quant(3) English(4) — already in order
      const title = `SSC Selection Post Phase-XIV ${level.label} Full Mock ${nn} – ${dateEn}`;
      fullTests.push(buildTest({
        id: `p14-${level.short}-full-mock-${nn}`,
        title,
        shortTitle: `${level.label} Full Mock ${nn}`,
        slug: `p14-${level.short}-full-mock-${nn}`,
        description: `SSC Selection Post Phase-XIV (${level.label}) Full-Length Mock ${nn} (${dateEn}): 100 questions across General Intelligence & Reasoning (25), General Awareness (25), Quantitative Aptitude (25), English (25). 200 marks, 60 minutes, -0.5 negative marking.`,
        level, testType: 'full-length', duration: 60, sections,
        categoryId: '2026',
        category: 'PYPs',
        tags: ['phase-14', 'ssc-selection-post', level.levelTag, 'tier-1', 'pyp', '2026', 'full-mock'],
      }));
    }

    // ---- SECTIONAL TESTS (36 x 25Q) ----
    const sectionalTests = [];
    for (const sk of Object.keys(SUBJECTS)) {
      const subj = SUBJECTS[sk];
      const srcMocks = store[lk][sk].mocks;
      const meta = store[lk][sk].meta || dateMeta;
      for (let mi = 0; mi < srcMocks.length; mi++) {
        const nn = String(mi + 1).padStart(2, '0');
        const dateEn = (meta && meta[mi] && meta[mi].en && meta[mi].en.d) || ('Mock ' + nn);
        const questions = srcMocks[mi].map((q, qi) => {
          const qid = `p14-${level.short}-${subj.short}-sec-${nn}-q${String(qi + 1).padStart(2, '0')}`;
          return toImporterQuestion(q, subj.subjectId, qid,
            ['phase-14', 'ssc-selection-post', level.levelTag, subj.subjectId, 'sectional'],
            { sourceFile: store[lk][sk].file, mockIndex: mi, qIndex: qi });
        });
        const section = buildSection(subj.sectionName, subj.subjectId, questions,
          `p14-${level.short}-${subj.short}-sec-${nn}`);
        const title = `SSC Selection Post Phase-XIV ${level.label} ${subj.label} Sectional Mock ${nn} – ${dateEn}`;
        sectionalTests.push(buildTest({
          id: `p14-${level.short}-${subj.short}-sectional-${nn}`,
          title,
          shortTitle: `${level.label} ${subj.label} Sec ${nn}`,
          slug: `p14-${level.short}-${subj.short}-sectional-${nn}`,
          description: `SSC Selection Post Phase-XIV (${level.label}) ${subj.label} Sectional Mock ${nn} (${dateEn}): 25 questions, 50 marks, 15 minutes, -0.5 negative marking.`,
          level, testType: 'sectional', duration: 15, sections: [section],
          categoryId: subj.sectionalCategory,
          category: 'PYPs',
          tags: ['phase-14', 'ssc-selection-post', level.levelTag, subj.subjectId, 'tier-1', 'pyp', '2026', 'sectional'],
        }));
      }
    }

    const fullFile = path.join(OUT_DIR, `p14-${level.short}-full-tests.json`);
    const secFile = path.join(OUT_DIR, `p14-${level.short}-sectional-tests.json`);
    fs.writeFileSync(fullFile, JSON.stringify(fullTests, (k, v) => k === '_provenance' ? undefined : v, 2), 'utf8');
    fs.writeFileSync(secFile, JSON.stringify(sectionalTests, (k, v) => k === '_provenance' ? undefined : v, 2), 'utf8');
    console.log(`Wrote ${path.basename(fullFile)}: ${fullTests.length} tests, ${fullTests.reduce((s,t)=>s+t.totalQuestions,0)} Q`);
    console.log(`Wrote ${path.basename(secFile)}: ${sectionalTests.length} tests, ${sectionalTests.reduce((s,t)=>s+t.totalQuestions,0)} Q`);
    summary[lk] = { full: fullTests.length, sectional: sectionalTests.length };
  }

  // Combined files (optional convenience)
  // (skip combining to keep uploads small; admin modal handles one file per upload)

  console.log('DONE ' + JSON.stringify(summary));
}

main();
