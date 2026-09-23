import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonlPath = path.join(__dirname, 'out', 'classified-questions.jsonl');

const CANONICAL_SUBJECTS = {
  1: 'General Intelligence & Reasoning',
  2: 'Quantitative Aptitude',
  3: 'English Language',
  4: 'History',
  5: 'Polity',
  6: 'Geography',
  7: 'Economy',
  8: 'Physics',
  9: 'Chemistry',
  10: 'Biology',
  11: 'Static GK',
  12: 'Current Affairs',
  13: 'Computer Knowledge',
  18: 'Statistics',
  19: 'Finance & Economics'
};

async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  const subjects = {};

  for await (const line of rl) {
    if (!line.trim()) continue;
    const q = JSON.parse(line);

    const subjId = (q.predicted_subject && q.subject_confidence >= 0.6)
      ? q.predicted_subject.id
      : q.actual_subject_id;
    const subjName = CANONICAL_SUBJECTS[subjId] || `Subject ${subjId}`;

    if (!subjects[subjId]) {
      subjects[subjId] = {
        id: subjId,
        name: subjName,
        total_questions: 0,
        original_db_count: 0,
        moved_in: 0,
        moved_out: 0,
        chapters: {},
        top_topics: {}
      };
    }

    subjects[subjId].total_questions++;

    // Track movement
    if (q.actual_subject_id === subjId) {
      subjects[subjId].original_db_count++;
    } else {
      subjects[subjId].moved_in++;
    }

    // Chapters
    const chTitle = q.predicted_chapter?.title || 'Unassigned Chapter';
    subjects[subjId].chapters[chTitle] = (subjects[subjId].chapters[chTitle] || 0) + 1;

    // Topics
    const topName = q.predicted_topic?.name || 'Unassigned Topic';
    subjects[subjId].top_topics[topName] = (subjects[subjId].top_topics[topName] || 0) + 1;
  }

  // Also calculate moved_out from actual_subject_id perspective
  const rl2 = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  for await (const line of rl2) {
    if (!line.trim()) continue;
    const q = JSON.parse(line);
    const assignedSubjId = (q.predicted_subject && q.subject_confidence >= 0.6)
      ? q.predicted_subject.id
      : q.actual_subject_id;

    if (q.actual_subject_id !== assignedSubjId && subjects[q.actual_subject_id]) {
      subjects[q.actual_subject_id].moved_out++;
    }
  }

  const result = Object.values(subjects).sort((a, b) => b.total_questions - a.total_questions);

  const formatted = result.map(s => {
    const top5Chapters = Object.entries(s.chapters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));

    const top5Topics = Object.entries(s.top_topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      subject_id: s.id,
      name: s.name,
      total_questions: s.total_questions,
      share_percent: ((s.total_questions / 45178) * 100).toFixed(1) + '%',
      net_change: s.moved_in - s.moved_out,
      top_chapters: top5Chapters,
      top_topics: top5Topics
    };
  });

  console.log(JSON.stringify(formatted, null, 2));

  fs.writeFileSync(
    path.join(__dirname, 'out', 'subject-wise-report.json'),
    JSON.stringify(formatted, null, 2)
  );
}

run();
