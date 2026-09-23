/**
 * Worker Audit Agent
 * Audits questions for a specific subject partition down to Chapter, Topic, and Subtopic.
 */

import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import {
  SUBJECT_NAMES,
  buildQuestionText,
  classifyQuestion,
  stripHtml,
} from './questionTaxonomyClassifier.mjs';
import { RULE_TAXONOMY_MAP, resolveRuleTaxonomy } from './ruleTaxonomyMap.mjs';
import { classifyBatch } from '../../apps/backend/src/services/taxonomyClassifier.service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CLI Args
const args = process.argv.slice(2);
let agentId = '1';
let subjectIds = [1];
let outputFile = path.join(__dirname, '../out/audit-agent-1.jsonl');
let limit = 0;
let resume = true;
let batchSize = 100;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--agent-id' && args[i + 1]) agentId = args[i + 1];
  if (args[i] === '--subjects' && args[i + 1]) subjectIds = args[i + 1].split(',').map(Number);
  if (args[i] === '--out' && args[i + 1]) outputFile = path.resolve(args[i + 1]);
  if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1], 10);
  if (args[i] === '--no-resume') resume = false;
  if (args[i] === '--batch-size' && args[i + 1]) batchSize = parseInt(args[i + 1], 10);
}

// Ensure output directory exists
const outDir = path.dirname(outputFile);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Load processed question IDs if resuming
async function loadProcessedIds() {
  const processed = new Set();
  if (!resume || !fs.existsSync(outputFile)) return processed;

  const fileStream = fs.createReadStream(outputFile);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const obj = JSON.parse(line);
        if (obj.question_id) processed.add(obj.question_id);
      } catch (_) {}
    }
  }
  return processed;
}

// Load live taxonomy
async function loadTaxonomy(pool) {
  const [subs, chs, tops, sts] = await Promise.all([
    pool.query("SELECT id, name, slug FROM subjects WHERE is_deleted IS NOT TRUE ORDER BY id"),
    pool.query("SELECT id, subject_id, title, slug FROM subject_chapters WHERE is_deleted IS NOT TRUE ORDER BY subject_id, order_index, id"),
    pool.query("SELECT id, chapter_id, subject_id, name, slug FROM subject_topics WHERE is_deleted IS NOT TRUE ORDER BY chapter_id, order_index, id"),
    pool.query("SELECT id, topic_id, name, slug FROM subject_subtopics WHERE is_deleted IS NOT TRUE ORDER BY topic_id, order_index, id"),
  ]);

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

  const subjectsById = new Map(subs.rows.map(r => [r.id, r]));
  const chaptersById = new Map(chs.rows.map(r => [r.id, r]));
  const topicsById = new Map(tops.rows.map(r => [r.id, r]));
  const subtopicsById = new Map(sts.rows.map(r => [r.id, r]));

  // Pre-resolve all rule keys to avoid repeated lookup
  const ruleTargets = new Map();
  for (const key of Object.keys(RULE_TAXONOMY_MAP)) {
    const res = resolveRuleTaxonomy(key, chaptersBySubject, topicsByChapter, subtopicsByTopic);
    if (res.resolved) {
      ruleTargets.set(key, res);
    }
  }

  return {
    chaptersBySubject,
    topicsByChapter,
    subtopicsByTopic,
    subjectsById,
    chaptersById,
    topicsById,
    subtopicsById,
    ruleTargets,
  };
}

// Subtopic refinement: search if question text hits any specific subtopics in the predicted topic
function refineSubtopic(qText, topicId, subtopicsByTopic, defaultSubtopic) {
  const subtopics = subtopicsByTopic.get(topicId) || [];
  if (subtopics.length <= 1) return defaultSubtopic;

  const lowerText = qText.toLowerCase();
  for (const st of subtopics) {
    const cleanName = st.name.replace(/\([^)]*\)/g, '').replace(/^(subtopic\s*\d*[:\-]\s*)/i, '').trim().toLowerCase();
    const words = cleanName.split(/[\s,&/]+/).filter(w => w.length > 3 && !['concepts', 'practice', 'questions', 'detailed'].includes(w));
    if (words.length > 0 && words.some(w => lowerText.includes(w))) {
      return { id: st.id, name: st.name };
    }
  }
  return defaultSubtopic;
}

// Local taxonomy token scoring for undetermined questions
function scoreCandidateTaxonomy(combinedText, chapters, topicsByChapter, subtopicsByTopic) {
  if (!chapters || chapters.length === 0) return null;
  const lower = combinedText.toLowerCase();
  let bestCh = null;
  let bestTop = null;
  let bestSub = null;
  let maxScore = 0;

  for (const ch of chapters) {
    let chScore = 0;
    const chWords = ch.title.replace(/\([^)]*\)/g, '').toLowerCase().split(/[\s,:&/\-]+/).filter(w => w.length > 3 && !['chapter', 'introduction', 'overview', 'basic', 'detailed'].includes(w));
    for (const w of chWords) {
      if (lower.includes(w)) chScore += 3;
    }

    const topics = topicsByChapter.get(ch.id) || [];
    for (const t of topics) {
      let topScore = chScore;
      const tWords = t.name.replace(/\([^)]*\)/g, '').toLowerCase().split(/[\s,:&/\-]+/).filter(w => w.length > 3 && !['topic', 'concepts', 'practice', 'questions'].includes(w));
      for (const w of tWords) {
        if (lower.includes(w)) topScore += 4;
      }

      const subtopics = subtopicsByTopic.get(t.id) || [];
      if (subtopics.length === 0 && topScore > maxScore) {
        maxScore = topScore;
        bestCh = ch;
        bestTop = t;
        bestSub = null;
      }
      for (const st of subtopics) {
        let stScore = topScore;
        const sWords = st.name.replace(/\([^)]*\)/g, '').toLowerCase().split(/[\s,:&/\-]+/).filter(w => w.length > 3 && !['subtopic', 'concepts', 'practice', 'questions', 'comprehensive'].includes(w));
        for (const w of sWords) {
          if (lower.includes(w)) stScore += 5;
        }

        if (stScore > maxScore) {
          maxScore = stScore;
          bestCh = ch;
          bestTop = t;
          bestSub = st;
        }
      }
    }
  }

  if (maxScore >= 6) {
    return { chapter: bestCh, topic: bestTop, subtopic: bestSub, score: maxScore };
  }
  return null;
}

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  const processedIds = await loadProcessedIds();
  const tax = await loadTaxonomy(pool);

  console.log(`[Agent ${agentId}] Started for Subjects: [${subjectIds.join(', ')}]`);
  console.log(`[Agent ${agentId}] Output stream: ${outputFile}`);
  console.log(`[Agent ${agentId}] Checkpoint: ${processedIds.size} questions previously processed.`);

  const outStream = fs.createWriteStream(outputFile, { flags: resume ? 'a' : 'w', encoding: 'utf8' });

  // Query all questions for this subject scope
  const qRes = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.section, q.subject_id, q.chapter_id, q.topic_id, q.subtopic_id,
           s.name as current_subject_name, 
           c.title as current_chapter_title, 
           t.name as current_topic_name, 
           st.name as current_subtopic_name,
           q.question_text, q.question_text_hi, q.options, q.options_hi,
           q.explanation, q.explanation_hi, q.correct_option
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    LEFT JOIN subject_chapters c ON q.chapter_id = c.id
    LEFT JOIN subject_topics t ON q.topic_id = t.id
    LEFT JOIN subject_subtopics st ON q.subtopic_id = st.id
    WHERE q.is_deleted IS NOT TRUE AND q.subject_id = ANY($1)
    ORDER BY q.id ASC;
  `, [subjectIds]);

  const allQuestions = qRes.rows;
  const pending = allQuestions.filter(q => !processedIds.has(q.id));
  const toProcess = limit > 0 ? pending.slice(0, limit) : pending;

  console.log(`[Agent ${agentId}] Total scoped: ${allQuestions.length} | Pending: ${pending.length} | Processing: ${toProcess.length}`);

  let completedCount = 0;
  let exactMatchCount = 0;
  let subtopicDiscrepancyCount = 0;
  let topicDiscrepancyCount = 0;
  let chapterDiscrepancyCount = 0;
  let crossSubjectCount = 0;
  let tier2InvokedCount = 0;

  const pendingTier2 = [];

  for (let i = 0; i < toProcess.length; i++) {
    const q = toProcess[i];
    const { combined, stem } = buildQuestionText(q);
    const ruleMatch = classifyQuestion(combined, stem, q.section, "");

    let rec = null;
    let method = 'tier1_rule';
    let conf = 0.5;
    let evidence = '';

    if (ruleMatch && ruleMatch.ruleId) {
      const target = tax.ruleTargets.get(`${ruleMatch.subjectId}:${ruleMatch.ruleId}`);
      if (target) {
        conf = ruleMatch.weight >= 7 ? 0.95 : ruleMatch.weight >= 5 ? 0.85 : 0.65;
        evidence = ruleMatch.matchedEvidence || ruleMatch.ruleId;

        // Refine subtopic
        const refinedSub = refineSubtopic(combined, target.topicId, tax.subtopicsByTopic, {
          id: target.subtopicId,
          name: target.subtopicName
        });

        rec = {
          subject_id: target.subjectId,
          subject_name: SUBJECT_NAMES[target.subjectId] || tax.subjectsById.get(target.subjectId)?.name,
          chapter_id: target.chapterId,
          chapter_title: target.chapterTitle,
          topic_id: target.topicId,
          topic_name: target.topicName,
          subtopic_id: refinedSub ? refinedSub.id : target.subtopicId,
          subtopic_name: refinedSub ? refinedSub.name : target.subtopicName,
        };
      }
    }

    if (!rec) {
      // First try local taxonomy token scoring against current subject
      const chapters = tax.chaptersBySubject.get(q.subject_id) || [];
      const scored = scoreCandidateTaxonomy(combined, chapters, tax.topicsByChapter, tax.subtopicsByTopic);
      if (scored) {
        rec = {
          subject_id: q.subject_id,
          subject_name: q.current_subject_name,
          chapter_id: scored.chapter.id,
          chapter_title: scored.chapter.title,
          topic_id: scored.topic ? scored.topic.id : null,
          topic_name: scored.topic ? scored.topic.name : null,
          subtopic_id: scored.subtopic ? scored.subtopic.id : null,
          subtopic_name: scored.subtopic ? scored.subtopic.name : null,
        };
        conf = 0.75;
        method = 'tier2_local_scoring';
        evidence = `Local semantic token score: ${scored.score}`;
      } else {
        pendingTier2.push({ q, combined, index: i });
        continue;
      }
    }

    // Determine match status
    let matchStatus = 'EXACT_MATCH';
    if (rec.subject_id !== q.subject_id) {
      matchStatus = 'CROSS_SUBJECT_LEAK';
      crossSubjectCount++;
    } else if (rec.chapter_id !== q.chapter_id) {
      matchStatus = 'CHAPTER_DISCREPANCY';
      chapterDiscrepancyCount++;
    } else if (rec.topic_id !== q.topic_id) {
      matchStatus = 'TOPIC_DISCREPANCY';
      topicDiscrepancyCount++;
    } else if (rec.subtopic_id !== q.subtopic_id) {
      matchStatus = 'SUBTOPIC_DISCREPANCY';
      subtopicDiscrepancyCount++;
    } else {
      exactMatchCount++;
    }

    const auditRecord = {
      agent_id: agentId,
      question_id: q.id,
      test_id: q.test_id,
      question_number: q.question_number,
      section: q.section,
      current: {
        subject_id: q.subject_id,
        subject_name: q.current_subject_name,
        chapter_id: q.chapter_id,
        chapter_title: q.current_chapter_title,
        topic_id: q.topic_id,
        topic_name: q.current_topic_name,
        subtopic_id: q.subtopic_id,
        subtopic_name: q.current_subtopic_name,
      },
      recommended: rec,
      match_status: matchStatus,
      confidence: conf,
      method,
      evidence,
      audited_at: new Date().toISOString()
    };

    outStream.write(JSON.stringify(auditRecord) + '\n');
    completedCount++;

    if (completedCount % 500 === 0 || completedCount === toProcess.length) {
      console.log(`[Agent ${agentId}] ${completedCount}/${toProcess.length} audited | Exact: ${exactMatchCount} | Subtopic Disc: ${subtopicDiscrepancyCount} | Topic Disc: ${topicDiscrepancyCount} | Chapter Disc: ${chapterDiscrepancyCount} | Cross-Subj: ${crossSubjectCount}`);
    }
  }

  // Handle pending Tier 2 items (questions where rules were undetermined)
  if (pendingTier2.length > 0) {
    console.log(`[Agent ${agentId}] Resolving ${pendingTier2.length} undetermined questions via deep cross-subject semantic scoring...`);

    for (const item of pendingTier2) {
      const q = item.q;
      // Search across all subjects for candidate match
      let bestMatch = null;
      let bestSubjId = q.subject_id;
      let highestScore = 0;

      // First try current subject
      const currChapters = tax.chaptersBySubject.get(q.subject_id) || [];
      const currScored = scoreCandidateTaxonomy(item.combined, currChapters, tax.topicsByChapter, tax.subtopicsByTopic);
      if (currScored && currScored.score >= 5) {
        bestMatch = currScored;
        highestScore = currScored.score;
      } else {
        // Search other subjects
        for (const [sId, sChapters] of tax.chaptersBySubject.entries()) {
          const sScored = scoreCandidateTaxonomy(item.combined, sChapters, tax.topicsByChapter, tax.subtopicsByTopic);
          if (sScored && sScored.score > highestScore) {
            highestScore = sScored.score;
            bestMatch = sScored;
            bestSubjId = sId;
          }
        }
      }

      let recCh = bestMatch ? bestMatch.chapter : (currChapters[0] || null);
      let recTopic = bestMatch ? bestMatch.topic : null;
      let refinedSub = bestMatch ? bestMatch.subtopic : null;
      let effSubjId = bestMatch ? bestSubjId : q.subject_id;
      let effSubjName = SUBJECT_NAMES[effSubjId] || q.current_subject_name;

      let matchStatus = 'EXACT_MATCH';
      if (effSubjId !== q.subject_id) {
        matchStatus = 'CROSS_SUBJECT_LEAK';
        crossSubjectCount++;
      } else if (recCh && recCh.id !== q.chapter_id) {
        matchStatus = 'CHAPTER_DISCREPANCY';
        chapterDiscrepancyCount++;
      } else if (recTopic && recTopic.id !== q.topic_id) {
        matchStatus = 'TOPIC_DISCREPANCY';
        topicDiscrepancyCount++;
      } else if (refinedSub && refinedSub.id !== q.subtopic_id) {
        matchStatus = 'SUBTOPIC_DISCREPANCY';
        subtopicDiscrepancyCount++;
      } else {
        exactMatchCount++;
      }

      outStream.write(JSON.stringify({
        agent_id: agentId,
        question_id: q.id,
        test_id: q.test_id,
        question_number: q.question_number,
        section: q.section,
        current: {
          subject_id: q.subject_id,
          subject_name: q.current_subject_name,
          chapter_id: q.chapter_id,
          chapter_title: q.current_chapter_title,
          topic_id: q.topic_id,
          topic_name: q.current_topic_name,
          subtopic_id: q.subtopic_id,
          subtopic_name: q.current_subtopic_name,
        },
        recommended: {
          subject_id: effSubjId,
          subject_name: effSubjName,
          chapter_id: recCh ? recCh.id : q.chapter_id,
          chapter_title: recCh ? recCh.title : q.current_chapter_title,
          topic_id: recTopic ? recTopic.id : q.topic_id,
          topic_name: recTopic ? recTopic.name : q.current_topic_name,
          subtopic_id: refinedSub ? refinedSub.id : q.subtopic_id,
          subtopic_name: refinedSub ? refinedSub.name : q.current_subtopic_name,
        },
        match_status: matchStatus,
        confidence: bestMatch ? 0.7 : 0.4,
        method: bestMatch ? 'tier2_cross_subject_scoring' : 'fallback_current',
        evidence: bestMatch ? `Candidate token score: ${bestMatch.score}` : 'Undetermined, retained current',
        audited_at: new Date().toISOString()
      }) + '\n');
      completedCount++;
      tier2InvokedCount++;
    }
  }

  await new Promise(resolve => outStream.end(resolve));
  await pool.end();

  console.log(`\n===============================================================`);
  console.log(`[Agent ${agentId}] FINISHED AUDIT REPORT`);
  console.log(`   Total Scanned: ${completedCount}`);
  console.log(`   Exact Matches: ${exactMatchCount} (${(exactMatchCount / completedCount * 100).toFixed(1)}%)`);
  console.log(`   Subtopic Discrepancies: ${subtopicDiscrepancyCount} (${(subtopicDiscrepancyCount / completedCount * 100).toFixed(1)}%)`);
  console.log(`   Topic Discrepancies: ${topicDiscrepancyCount} (${(topicDiscrepancyCount / completedCount * 100).toFixed(1)}%)`);
  console.log(`   Chapter Discrepancies: ${chapterDiscrepancyCount} (${(chapterDiscrepancyCount / completedCount * 100).toFixed(1)}%)`);
  console.log(`   Cross-Subject Leaks: ${crossSubjectCount} (${(crossSubjectCount / completedCount * 100).toFixed(1)}%)`);
  console.log(`   Tier 2 Semantic AI Invoked: ${tier2InvokedCount}`);
  console.log(`===============================================================\n`);
}

run().catch(err => {
  console.error(`[Agent ${agentId}] Fatal error:`, err);
  process.exit(1);
});
