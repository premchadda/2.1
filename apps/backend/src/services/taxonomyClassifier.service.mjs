/**
 * Taxonomy Classification Service using classifier.dev (bulk-classify)
 * Performs hierarchical classification: Subject -> Chapter -> Topic -> Subtopic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Strip HTML tags and normalize text
export function sanitizeQuestionText(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean prefixes like "Chapter 12: ", "Topic 3 - " for purely semantic label matching
export function cleanLabel(name) {
  if (!name) return '';
  return name.replace(/^(chapter|topic|subtopic)\s*\d*\s*[:\-]\s*/i, '').trim();
}

/**
 * Call classifier.dev HTTP API with retry on 429 rate limit
 */
export async function classifyBatch({ labels, inputs, instructions = '', tier = 'fast' }) {
  if (!labels || labels.length < 2) {
    if (labels && labels.length === 1) {
      return inputs.map(() => ({
        label: labels[0],
        confidence: 1.0,
        scores: { [labels[0]]: 1.0 }
      }));
    }
    return inputs.map(() => ({ label: null, confidence: null, scores: {} }));
  }

  // Ensure labels <= 100
  const cappedLabels = labels.slice(0, 100);

  const payload = {
    labels: cappedLabels,
    inputs: inputs.map(t => (t && t.length > 0 ? t.slice(0, 2000) : 'empty')),
    tier
  };
  if (instructions) {
    payload.instructions = instructions;
  }

  const maxRetries = 3;
  let delay = 1000;

  const endpoint = process.env.CLASSIFIER_ENDPOINT || 'https://classifier.dev';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Trstprep-Taxonomy-Classifier/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 429) {
        throw new Error('classifier.dev rate limited (429)');
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`classifier.dev returned status ${response.status}: ${text}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      console.warn(`[classifier.dev] Request error: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw new Error('Failed to classify batch after retries');
}

/**
 * Hierarchical Taxonomy Classifier
 */
export class TaxonomyClassifier {
  constructor(taxonomyData) {
    this.taxonomy = taxonomyData;
    this.initLookups();
  }

  initLookups() {
    this.chaptersBySubject = new Map();
    this.topicsByChapter = new Map();
    this.subtopicsByTopic = new Map();

    this.chapterById = new Map();
    this.topicById = new Map();
    this.subtopicById = new Map();

    for (const ch of this.taxonomy.chapters || []) {
      this.chapterById.set(ch.id, ch);
      if (!this.chaptersBySubject.has(ch.subject_id)) {
        this.chaptersBySubject.set(ch.subject_id, []);
      }
      this.chaptersBySubject.get(ch.subject_id).push(ch);
    }

    for (const top of this.taxonomy.topics || []) {
      this.topicById.set(top.id, top);
      if (!this.topicsByChapter.has(top.chapter_id)) {
        this.topicsByChapter.set(top.chapter_id, []);
      }
      this.topicsByChapter.get(top.chapter_id).push(top);
    }

    for (const sub of this.taxonomy.subtopics || []) {
      this.subtopicById.set(sub.id, sub);
      if (!this.subtopicsByTopic.has(sub.topic_id)) {
        this.subtopicsByTopic.set(sub.topic_id, []);
      }
      this.subtopicsByTopic.get(sub.topic_id).push(sub);
    }
  }

  /**
   * Classify broad Subject (Tier 0) across all valid academic subjects
   */
  async classifySubjects(questions) {
    const subjects = (this.taxonomy.subjects || []).filter(s => s.name);
    const subjectLabels = subjects.map(s => s.name);
    const subjectNameMap = new Map(subjects.map(s => [s.name, s]));

    const questionTexts = questions.map(q => sanitizeQuestionText(q.question_text));

    const results = await classifyBatch({
      labels: subjectLabels,
      inputs: questionTexts,
      instructions: 'Identify which academic subject this exam question tests: e.g. History, Geography, Polity, Physics, Chemistry, Biology, Quantitative Aptitude, General Intelligence & Reasoning, English Language, Current Affairs, Static GK, or Computer Knowledge.'
    });

    return questions.map((q, idx) => {
      const res = results[idx] || {};
      const predictedSubject = subjectNameMap.get(res.label);
      return {
        question_id: q.id,
        predicted_subject: predictedSubject ? { id: predictedSubject.id, name: predictedSubject.name } : null,
        subject_confidence: res.confidence,
        subject_label: res.label
      };
    });
  }

  /**
   * Classify a batch of questions that belong to a single subject
   */
  async classifyQuestionsForSubject(subjectId, questions) {
    const chapters = this.chaptersBySubject.get(subjectId) || [];
    if (chapters.length === 0) {
      return questions.map(q => ({
        question_id: q.id,
        error: `No chapters found for subject_id ${subjectId}`
      }));
    }

    // Map clean title -> chapter
    const chapterCleanMap = new Map();
    const chapterLabels = [];
    for (const ch of chapters) {
      const clean = cleanLabel(ch.title);
      if (clean && !chapterCleanMap.has(clean)) {
        chapterCleanMap.set(clean, ch);
        chapterLabels.push(clean);
      }
    }

    const questionTexts = questions.map(q => sanitizeQuestionText(q.question_text));

    // Step 1: Predict Chapters in a single batch
    console.log(`[TaxonomyClassifier] Classifying chapters for ${questions.length} questions against ${chapterLabels.length} chapters...`);
    const chapterResults = await classifyBatch({
      labels: chapterLabels,
      inputs: questionTexts,
      instructions: 'Identify which curriculum chapter or broad syllabus unit this exam question belongs to.'
    });

    const enriched = questions.map((q, idx) => {
      const res = chapterResults[idx] || {};
      const predictedCh = chapterCleanMap.get(res.label);
      return {
        question_id: q.id,
        question_text: questionTexts[idx],
        actual: {
          chapter_id: q.chapter_id,
          topic_id: q.topic_id,
          subtopic_id: q.subtopic_id
        },
        predicted_chapter: predictedCh ? { id: predictedCh.id, title: predictedCh.title } : null,
        chapter_confidence: res.confidence,
        chapter_label: res.label
      };
    });

    // Step 2: Group questions by predicted chapter to classify Topic
    const questionsByChapter = new Map();
    for (let i = 0; i < enriched.length; i++) {
      const item = enriched[i];
      if (!item.predicted_chapter) continue;
      const chId = item.predicted_chapter.id;
      if (!questionsByChapter.has(chId)) {
        questionsByChapter.set(chId, []);
      }
      questionsByChapter.get(chId).push({ index: i, item });
    }

    console.log(`[TaxonomyClassifier] Classifying topics across ${questionsByChapter.size} unique predicted chapters...`);
    for (const [chId, group] of questionsByChapter.entries()) {
      const topics = this.topicsByChapter.get(chId) || [];
      if (topics.length === 0) {
        group.forEach(g => {
          g.item.predicted_topic = null;
          g.item.topic_confidence = null;
        });
        continue;
      }

      const topicCleanMap = new Map();
      const topicLabels = [];
      for (const t of topics) {
        const clean = cleanLabel(t.name);
        if (clean && !topicCleanMap.has(clean)) {
          topicCleanMap.set(clean, t);
          topicLabels.push(clean);
        }
      }

      const groupTexts = group.map(g => g.item.question_text);
      const topicResults = await classifyBatch({
        labels: topicLabels,
        inputs: groupTexts,
        instructions: 'Identify the specific topic or concept within this chapter that this question tests.'
      });

      group.forEach((g, idx) => {
        const res = topicResults[idx] || {};
        const predictedT = topicCleanMap.get(res.label);
        g.item.predicted_topic = predictedT ? { id: predictedT.id, name: predictedT.name } : null;
        g.item.topic_confidence = res.confidence;
        g.item.topic_label = res.label;
      });
    }

    // Step 3: Group questions by predicted topic to classify Subtopic
    const questionsByTopic = new Map();
    for (let i = 0; i < enriched.length; i++) {
      const item = enriched[i];
      if (!item.predicted_topic) continue;
      const tId = item.predicted_topic.id;
      if (!questionsByTopic.has(tId)) {
        questionsByTopic.set(tId, []);
      }
      questionsByTopic.get(tId).push({ index: i, item });
    }

    console.log(`[TaxonomyClassifier] Classifying subtopics across ${questionsByTopic.size} unique predicted topics...`);
    for (const [tId, group] of questionsByTopic.entries()) {
      const subtopics = this.subtopicsByTopic.get(tId) || [];
      if (subtopics.length === 0) {
        group.forEach(g => {
          g.item.predicted_subtopic = null;
          g.item.subtopic_confidence = null;
        });
        continue;
      }

      const subCleanMap = new Map();
      const subLabels = [];
      for (const s of subtopics) {
        const clean = cleanLabel(s.name);
        if (clean && !subCleanMap.has(clean)) {
          subCleanMap.set(clean, s);
          subLabels.push(clean);
        }
      }

      const groupTexts = group.map(g => g.item.question_text);
      const subResults = await classifyBatch({
        labels: subLabels,
        inputs: groupTexts,
        instructions: 'Identify the exact subtopic or granular formula/concept tested.'
      });

      group.forEach((g, idx) => {
        const res = subResults[idx] || {};
        const predictedS = subCleanMap.get(res.label);
        g.item.predicted_subtopic = predictedS ? { id: predictedS.id, name: predictedS.name } : null;
        g.item.subtopic_confidence = res.confidence;
        g.item.subtopic_label = res.label;
      });
    }

    return enriched;
  }
}
