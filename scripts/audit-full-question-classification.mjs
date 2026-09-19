/**
 * Full-corpus question taxonomy audit (READ-ONLY).
 *
 * Reads every question record in full (stem + Hindi stem + options + Hindi options
 * + explanation + Hindi explanation) and re-derives subject -> chapter -> topic ->
 * subtopic using the phrase/context classifier in scripts/lib/questionTaxonomyClassifier.mjs.
 *
 * It reports, with evidence and confidence:
 *   A. Structural anomalies  (NULLs, chapter/topic/subtopic ancestry mismatches)
 *   B. Section <-> subject conflicts
 *   C. Content subject mismatches (full-text classifier)
 *   D. Within-subject chapter mismatch (high-confidence only)
 *
 * NOTHING IS WRITTEN TO THE DATABASE. Output: JSON + Markdown report.
 *
 * Usage:
 *   node scripts/audit-full-question-classification.mjs            # full scan
 *   node scripts/audit-full-question-classification.mjs --self-test
 *   node scripts/audit-full-question-classification.mjs --limit=2000
 */
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  SUBJECT_NAMES,
  buildQuestionText,
  classifyQuestion,
} from "./lib/questionTaxonomyClassifier.mjs";
import { RULE_TAXONOMY_MAP, resolveRuleTaxonomy } from "./lib/ruleTaxonomyMap.mjs";
import { BOUNDARY_PAIRS } from "./lib/questionTaxonomyClassifier.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../apps/backend/.env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
});

const args = process.argv.slice(2);
const SELF_TEST = args.includes("--self-test");
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || 0;
const DATE = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Ground-truth self-test cases (real questions observed in the corpus)
// ---------------------------------------------------------------------------
export const SELF_TEST_CASES = [
  { text: "What is the primary function of the Taskbar in Windows 7? To show open programs. Inkjet printer output device.", subject: 13 },
  { text: "If 'when' means 'x', 'she' means '÷' , 'will' means '+' and 'come' means '-' , then what will the value of '8 when 12 will 16 she 2 come 10'?", subject: 1 },
  { text: "What was the strategic focus of the 10th India-Sri Lanka Mitra Shakti exercise in August 2024?", subject: 12 },
  { text: "One of the major events of Ashoka's reign was the convening of the ______ Buddhist Sangha (council) in 250 BCE in the capital Pataliputra.", subject: 4 },
  { text: "Tansen, who was included in the Navaratnas of Akbar, was an expert in playing which of the following musical instruments?", subject: 4 },
  { text: "In which year was the battle of Buxar fought?", subject: 4 },
  { text: "The Indian National Congress adopted the goal of Poorna Swaraj in which session?", subject: 4 },
  { text: "Find the odd one out: Chicken pox, Rubella, Flu, Meningitis", subject: 1 },
  { text: "D has a brother A. D is the son of C. B is C's father. In terms of relationship, what is A of B?", subject: 1 },
  { text: "Sushma walked 80 m towards North, took a left turn and walked 30 m. He again took a left turn", subject: 1 },
  { text: "Find the missing (?) in the series HG, IJ, LK, MN, ?, .....", subject: 1 },
  { text: "In a certain code, TRIPPLE is written as SQHOOKD. How is EXOTIC coded in that code?", subject: 1 },
  { text: "Select the set in which the numbers are related in the same way as are the numbers of the following set.", subject: 1 },
  { text: "There are 5 friends working together, all having different vehicles and living on different floors of a building.", subject: 1 },
  { text: "The place of Gautama Buddha's birth was a grove known as ______. Lumbini", subject: 4 },
  { text: "Which type of soil is most suitable for cotton cultivation in India?", subject: 6 },
  { text: "Which output device is specifically designed to produce high-quality printed graphics and text? Inkjet Printer", subject: 13 },
  { text: "Consider the following statements regarding the Fundamental Duties (Article 51A) of the Indian Constitution.", subject: 5 },
  { text: "Who is the constitutional head of the state appointed by the President? The Governor", subject: 5 },
  { text: "Read the following statements about the photoelectric effect: The kinetic energy of emitted photoelectrons increases with frequency.", subject: 8 },
  { text: "A person on a railway platform observes that the pitch (frequency) of an approaching train's whistle changes as the train passes.", subject: 8 },
  { text: "To obtain an enlarged real inverted image beyond 2F2 after refraction by a convex lens", subject: 8 },
  { text: "Find the part of the sentence that contains an error: Were he to have responded swiftly (1) / the situation might have been better.", subject: 3 },
  { text: "Choose the synonym of the word 'abundant' from the given options.", subject: 3 },
  { text: "A right circular cone has a radius of 7 cm. Its slant height is 25 cm. What is the volume?", subject: 2 },
  { text: "Two pipes can fill a cistern, individually, in 44 min and 84 min, respectively.", subject: 2 },
  { text: "Smita can finish a work in 12 days and Sam can finish the same work in 9 days. Working together, how long?", subject: 2 },
  { text: "Simplify: (2 0.5 + 3.6) - 1.9", subject: 2 },
  { text: "The least common multiple of two numbers is 21 times the first number, and the highest common factor is 21.", subject: 2 },
  { text: "Anil Kumar sold an article to Rajat for Rs 15,000 by losing 25%. The profit percentage earned by Rajat is:", subject: 2 },
  { text: "Which of the following is the national flower of India? Lotus", subject: 11 },
  { text: "Who wrote the book 'Discovery of India'? Jawaharlal Nehru", subject: 11 },
  { text: "Which classical dance form originated in Kerala? Kathakali", subject: 11 },
  { text: "Which of the following is NOT a greenhouse gas? Nitrogen", subject: 10 },
];

function runSelfTest() {
  let pass = 0;
  const failures = [];
  for (const c of SELF_TEST_CASES) {
    const r = classifyQuestion(c.text.toLowerCase(), c.text.toLowerCase(), null, "");
    if (r.subjectId === c.subject) pass++;
    else failures.push({ expected: c.subject, got: r.subjectId, rule: r.ruleId, text: c.text.slice(0, 70) });
  }
  return { total: SELF_TEST_CASES.length, pass, failures };
}

// ---------------------------------------------------------------------------
// Taxonomy loading
// ---------------------------------------------------------------------------
async function loadTaxonomy() {
  const [subs, chs, tops, sts] = await Promise.all([
    pool.query("SELECT id, name, slug FROM subjects ORDER BY id"),
    pool.query("SELECT id, subject_id, title, slug FROM subject_chapters ORDER BY subject_id, order_index, id"),
    pool.query("SELECT id, chapter_id, subject_id, name, slug FROM subject_topics ORDER BY chapter_id, order_index, id"),
    pool.query("SELECT id, topic_id, name, slug FROM subject_subtopics ORDER BY topic_id, order_index, id"),
  ]);

  const subjectsById = new Map(subs.rows.map((r) => [r.id, r]));
  const chaptersById = new Map(chs.rows.map((r) => [r.id, r]));
  const topicsById = new Map(tops.rows.map((r) => [r.id, r]));
  const subtopicsById = new Map(sts.rows.map((r) => [r.id, r]));

  const chaptersBySubject = new Map();
  for (const c of chs.rows) {
    if (!chaptersBySubject.has(c.subject_id)) chaptersBySubject.set(c.subject_id, []);
    chaptersBySubject.get(c.subject_id).push(c);
  }
  const topicsByChapter = new Map();
  for (const t of tops.rows) {
    if (!topicsByChapter.has(t.chapter_id)) topicsByChapter.set(t.chapter_id, []);
    topicsByChapter.get(t.chapter_id).push(t);
  }
  const subtopicsByTopic = new Map();
  for (const s of sts.rows) {
    if (!subtopicsByTopic.has(s.topic_id)) subtopicsByTopic.set(s.topic_id, []);
    subtopicsByTopic.get(s.topic_id).push(s);
  }

  return { subjectsById, chaptersById, topicsById, subtopicsById, chaptersBySubject, topicsByChapter, subtopicsByTopic };
}

// Resolve every rule key once so per-question work is a map lookup.
function resolveAllRules(tax) {
  const resolved = new Map();
  const unresolved = [];
  for (const key of Object.keys(RULE_TAXONOMY_MAP)) {
    const r = resolveRuleTaxonomy(key, tax.chaptersBySubject, tax.topicsByChapter, tax.subtopicsByTopic);
    if (r.resolved) resolved.set(key, r);
    else unresolved.push({ key, reason: r.reason });
  }
  return { resolved, unresolved };
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------
async function main() {
  const tax = await loadTaxonomy();
  const { resolved: ruleTargets, unresolved: unresolvedRules } = resolveAllRules(tax);

  const findings = {
    structural: [],
    sectionConflict: [],
    subjectMismatch: [],
    boundary: [],
    chapterMismatch: [],
    undetermined: [],
  };
  const stats = {
    scanned: 0,
    classified: 0,
    unclassified: 0,
    byConfidence: { high: 0, medium: 0, low: 0, none: 0 },
    proposedSubjectCounts: {},
    currentSubjectCounts: {},
    ruleUsage: {},
    unresolvedRuleTargets: unresolvedRules,
  };

  const BATCH = 500;
  let offset = 0;
  while (true) {
    const batch = await pool.query(
      `SELECT id, test_id, question_number, section, subject_id, chapter_id, topic_id, subtopic_id,
              subject, chapter, topic,
              question_text, question_text_hi, options, options_hi,
              explanation, explanation_hi, correct_option
       FROM questions
       ORDER BY id
       LIMIT $1 OFFSET $2;`,
      [BATCH, offset]
    );
    if (!batch.rows.length) break;
    offset += batch.rows.length;

    for (const q of batch.rows) {
      processOne(q, tax, ruleTargets, findings, stats);
      if (LIMIT && stats.scanned >= LIMIT) break;
    }
    if (LIMIT && stats.scanned >= LIMIT) break;
  }

  return { findings, stats, ruleTargets, tax };
}

// ---------------------------------------------------------------------------
// Per-question audit
// ---------------------------------------------------------------------------
function processOne(q, tax, ruleTargets, findings, stats) {
  stats.scanned++;
  const { combined, stem } = buildQuestionText(q);
  const curSubj = q.subject_id;
  const curChap = q.chapter_id;
  const curTop = q.topic_id;
  const curSubtop = q.subtopic_id;

  stats.currentSubjectCounts[curSubj] = (stats.currentSubjectCounts[curSubj] || 0) + 1;

  // ---- A. Structural anomalies -------------------------------------------
  const chapRow = curChap ? tax.chaptersById.get(curChap) : null;
  const topRow = curTop ? tax.topicsById.get(curTop) : null;
  const subtopRow = curSubtop ? tax.subtopicsById.get(curSubtop) : null;
  const structural = [];
  if (!curSubj) structural.push("null_subject_id");
  if (!curChap) structural.push("null_chapter_id");
  if (!curTop) structural.push("null_topic_id");
  if (!curSubtop) structural.push("null_subtopic_id");
  if (chapRow && curSubj && chapRow.subject_id !== curSubj) structural.push("chapter_not_in_subject");
  if (topRow && chapRow && topRow.chapter_id !== curChap) structural.push("topic_not_in_chapter");
  if (subtopRow && topRow && subtopRow.topic_id !== curTop) structural.push("subtopic_not_in_topic");
  if (structural.length) {
    findings.structural.push({
      id: q.id, test_id: q.test_id, q_num: q.question_number,
      issues: structural,
      current: { subject: curSubj, chapter: curChap, topic: curTop, subtopic: curSubtop },
      section: q.section,
      snippet: combined.slice(0, 120),
    });
  }

  // ---- B/C/D. Full-text classification -----------------------------------
  const res = classifyQuestion(combined, stem, curSubj, q.section);
  stats.byConfidence[res.confidence] = (stats.byConfidence[res.confidence] || 0) + 1;

  if (res.subjectId === null) {
    stats.unclassified++;
    if (findings.undetermined.length < 500) {
      findings.undetermined.push({
        id: q.id, section: q.section, current_subject: curSubj,
        snippet: combined.slice(0, 140),
      });
    }
    return;
  }
  stats.classified++;
  if (res.ruleId) {
    const ukey = `${res.subjectId}:${res.ruleId}`;
    stats.ruleUsage[ukey] = (stats.ruleUsage[ukey] || 0) + 1;
  }
  stats.proposedSubjectCounts[res.subjectId] = (stats.proposedSubjectCounts[res.subjectId] || 0) + 1;

  // B. Section <-> subject conflict
  if (res.sectionConsistent === false) {
    findings.sectionConflict.push({
      id: q.id, test_id: q.test_id, q_num: q.question_number,
      section: q.section, current_subject: curSubj,
      current_subject_name: SUBJECT_NAMES[curSubj] || String(curSubj),
      detected_subject: res.subjectId,
      detected_subject_name: SUBJECT_NAMES[res.subjectId],
      rule: `${res.subjectId}:${res.ruleId}`,
      weight: res.weight, effectiveWeight: res.effectiveWeight, inStem: res.inStem,
      confidence: res.confidence, evidence: res.evidence,
      snippet: combined.slice(0, 160),
    });
  }

  const target = ruleTargets.get(`${res.subjectId}:${res.ruleId}`) || null;

  // C. Content subject mismatch
  if (curSubj !== res.subjectId && res.confidence !== "low") {
    const finding = {
      id: q.id, test_id: q.test_id, q_num: q.question_number, section: q.section,
      from: { subject: curSubj, subject_name: SUBJECT_NAMES[curSubj] || String(curSubj) },
      to: { subject: res.subjectId, subject_name: SUBJECT_NAMES[res.subjectId] },
      proposed: target
        ? {
            chapter_id: target.chapterId, chapter: target.chapterTitle,
            topic_id: target.topicId, topic: target.topicName,
            subtopic_id: target.subtopicId, subtopic: target.subtopicName,
          }
        : null,
      rule: `${res.subjectId}:${res.ruleId}`,
      basis: res.basis, weight: res.weight, effectiveWeight: res.effectiveWeight,
      inStem: res.inStem, confidence: res.confidence,
      section_consistent: res.sectionConsistent,
      evidence: res.evidence, alternatives: res.alternatives,
      snippet: combined.slice(0, 180),
    };
    // Current Affairs <-> Static GK is recency-dependent; keep as a review list,
    // not a hard misclassification.
    if (BOUNDARY_PAIRS.has(`${curSubj}:${res.subjectId}`)) findings.boundary.push(finding);
    else findings.subjectMismatch.push(finding);
    return;
  }

  // D. Same subject, different chapter (high confidence only)
  if (curSubj === res.subjectId && res.confidence === "high" && curChap && target && target.chapterId !== curChap) {
    findings.chapterMismatch.push({
      id: q.id, test_id: q.test_id, q_num: q.question_number, section: q.section,
      subject: res.subjectId, subject_name: SUBJECT_NAMES[res.subjectId],
      from_chapter: { id: curChap, title: chapRow ? chapRow.title : null },
      to_chapter: { id: target.chapterId, title: target.chapterTitle },
      from_topic: { id: curTop, name: topRow ? topRow.name : null },
      to_topic: { id: target.topicId, name: target.topicName },
      proposed_subtopic_id: target.subtopicId,
      rule: `${res.subjectId}:${res.ruleId}`,
      weight: res.weight, evidence: res.evidence,
      snippet: combined.slice(0, 180),
    });
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function pct(n, d) {
  return d ? ((n / d) * 100).toFixed(1) + "%" : "0%";
}

function subjectName(id) {
  return SUBJECT_NAMES[id] || `Subject ${id}`;
}

function toMarkdown(result, selfTest) {
  const { findings, stats } = result;
  const L = [];
  L.push(`# Question Classification Audit (full-text) — ${DATE}`);
  L.push("");
  L.push("Generated by `scripts/audit-full-question-classification.mjs`. **Read-only — no DB writes.**");
  L.push("");
  L.push("## Method");
  L.push("");
  L.push("- Reads the **full** question record: stem, Hindi stem, all options, Hindi options,");
  L.push("  explanation and Hindi explanation (HTML stripped).");
  L.push("- Matches **phrase / format signatures** with AND-of-OR group semantics — never lone");
  L.push('  ambiguous tokens. (Reason the earlier regex pass produced junk such as English');
  L.push('  "Direct Speech" questions flagged as Quant because they contained the word "interest".)');
  L.push("- Reasoning *format* signatures (e.g. \"odd one out\", \"in a certain code\") outrank");
  L.push("  topical keywords, so GK-flavoured reasoning questions stay in Reasoning.");
  L.push("- Every finding carries the matched evidence span + confidence for human review.");
  L.push("");
  L.push("## Self-test");
  L.push("");
  if (selfTest) {
    L.push(`- Ground-truth cases: **${selfTest.total}**, passed: **${selfTest.pass}** (${pct(selfTest.pass, selfTest.total)})`);
    if (selfTest.failures.length) {
      L.push("");
      L.push("| Expected | Detected | Rule | Text |");
      L.push("|---|---|---|---|");
      for (const f of selfTest.failures) {
        L.push(`| ${subjectName(f.expected)} | ${f.got === null ? "—" : subjectName(f.got)} | ${f.rule || "—"} | ${f.text.replace(/\|/g, "/")} |`);
      }
    }
  } else {
    L.push("- not run (pass `--self-test`)");
  }
  L.push("");
  L.push("## Scan summary");
  L.push("");
  L.push("| Metric | Value |");
  L.push("|--------|-------|");
  L.push(`| Questions scanned | ${stats.scanned} |`);
  L.push(`| Classified by full-text rules | ${stats.classified} (${pct(stats.classified, stats.scanned)}) |`);
  L.push(`| No rule matched (undetermined) | ${stats.unclassified} (${pct(stats.unclassified, stats.scanned)}) |`);
  L.push(`| High confidence | ${stats.byConfidence.high} |`);
  L.push(`| Medium confidence | ${stats.byConfidence.medium} |`);
  L.push(`| Low confidence | ${stats.byConfidence.low} |`);
  L.push("");
  L.push("## Findings");
  L.push("");
  L.push("| # | Finding | Count |");
  L.push("|---|---------|-------|");
  L.push(`| A | Structural anomalies (NULL / ancestry mismatch) | ${findings.structural.length} |`);
  L.push(`| B | Section ↔ subject conflicts (detected subject not allowed by section) | ${findings.sectionConflict.length} |`);
  L.push(`| C | Content subject mismatch (high/medium confidence) | ${findings.subjectMismatch.length} |`);
  L.push(`| — | Boundary review only: Current Affairs ↔ Static GK (recency-dependent) | ${findings.boundary.length} |`);
  L.push(`| D | Within-subject chapter mismatch (high confidence) | ${findings.chapterMismatch.length} |`);
  L.push(`| — | Undetermined (no phrase rule matched) | ${stats.unclassified} |`);
  L.push("");

  L.push("## C. Content subject mismatches — by transition");
  L.push("");
  L.push("| From | To | Count |");
  L.push("|------|----|-------|");
  const trans = new Map();
  for (const f of findings.subjectMismatch) {
    const k = `${f.from.subject_name} → ${f.to.subject_name}`;
    trans.set(k, (trans.get(k) || 0) + 1);
  }
  for (const [k, v] of [...trans.entries()].sort((a, b) => b[1] - a[1])) {
    L.push(`| ${k.replace(" → ", " | ")} | ${v} |`);
  }
  L.push("");

  L.push("### C. Worked examples (first 40, strongest evidence first)");
  L.push("");
  L.push("| Q ID | Section | Current | Proposed | Rule | W | Evidence | Snippet |");
  L.push("|------|---------|---------|----------|------|---|----------|---------|");
  const strongFirst = [...findings.subjectMismatch].sort((a, b) => (b.effectiveWeight || 0) - (a.effectiveWeight || 0));
  for (const f of strongFirst.slice(0, 40)) {
    L.push(
      `| ${f.id} | ${f.section} | ${f.from.subject_name} | ${f.to.subject_name} | ${f.rule} | ${f.effectiveWeight || f.weight}${f.inStem ? "" : " (opts)"} | ${(f.evidence || []).join(" · ").replace(/\|/g, "/")} | ${f.snippet.replace(/\|/g, "/").slice(0, 90)} |`
    );
  }
  L.push("");

  L.push("## D. Within-subject chapter mismatches — top chapters");
  L.push("");
  L.push("| From chapter | To chapter | Count |");
  L.push("|--------------|------------|-------|");
  const chTrans = new Map();
  for (const f of findings.chapterMismatch) {
    const k = `${(f.from_chapter.title || "?").replace(" | ", " ")}||${(f.to_chapter.title || "?").replace(" | ", " ")}`;
    chTrans.set(k, (chTrans.get(k) || 0) + 1);
  }
  for (const [k, v] of [...chTrans.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    const [a, b] = k.split("||");
    L.push(`| ${a} | ${b} | ${v} |`);
  }
  L.push("");

  L.push("## Proposed subject distribution vs current");
  L.push("");
  L.push("| Subject | Current | Proposed |");
  L.push("|---------|---------|----------|");
  const allSubs = new Set([...Object.keys(stats.currentSubjectCounts), ...Object.keys(stats.proposedSubjectCounts)]);
  for (const s of [...allSubs].map(Number).sort((a, b) => a - b)) {
    L.push(`| ${subjectName(s)} | ${stats.currentSubjectCounts[s] || 0} | ${stats.proposedSubjectCounts[s] || 0} |`);
  }
  L.push("");

  if (stats.unresolvedRuleTargets.length) {
    L.push("## Rule→taxonomy targets that could not be resolved (need taxonomy work)");
    L.push("");
    L.push("| Rule | Reason |");
    L.push("|------|--------|");
    for (const u of stats.unresolvedRuleTargets) L.push(`| ${u.key} | ${u.reason} |`);
    L.push("");
  }

  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
(async () => {
  const t0 = Date.now();
  try {
    const selfTest = runSelfTest();
    console.log("=== SELF-TEST ===");
    console.log(`ground-truth cases: ${selfTest.total}, passed: ${selfTest.pass}`);
    for (const f of selfTest.failures) {
      console.log(`  FAIL expected=${subjectName(f.expected)} got=${f.got === null ? "—" : subjectName(f.got)} rule=${f.rule || "—"} :: ${f.text}`);
    }
    if (SELF_TEST) {
      await pool.end();
      process.exit(selfTest.pass === selfTest.total ? 0 : 2);
    }

    console.log("\n=== SCANNING QUESTIONS (full text) ===");
    const result = await main();

    const jsonPath = path.join(__dirname, `question-classification-audit-${DATE}.json`);
    const mdPath = path.join(__dirname, `question-classification-audit-${DATE}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify({ generated_at: new Date().toISOString(), selfTest, ...result.findings, stats: result.stats }, null, 1));
    fs.writeFileSync(mdPath, toMarkdown(result, selfTest));

    console.log(`\nScanned ${result.stats.scanned} questions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`classified=${result.stats.classified} undetermined=${result.stats.unclassified}`);
    console.log(`A structural=${result.findings.structural.length}`);
    console.log(`B section-conflicts=${result.findings.sectionConflict.length}`);
    console.log(`C subject-mismatch=${result.findings.subjectMismatch.length}`);
    console.log(`  boundary CA<->StaticGK (review only)=${result.findings.boundary.length}`);
    console.log(`D chapter-mismatch=${result.findings.chapterMismatch.length}`);
    if (result.stats.unresolvedRuleTargets.length) {
      console.log(`\nUnresolved rule->taxonomy targets (${result.stats.unresolvedRuleTargets.length}):`);
      for (const u of result.stats.unresolvedRuleTargets) console.log(`  ${u.key} (${u.reason})`);
    }
    console.log(`\nReport: ${mdPath}`);
    console.log(`Data:   ${jsonPath}`);
  } catch (err) {
    console.error("AUDIT FAILED:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();