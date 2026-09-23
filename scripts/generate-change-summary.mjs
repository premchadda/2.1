import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonlPath = path.join(__dirname, 'out', 'classified-questions.jsonl');

async function analyze() {
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  let total = 0;
  let subjectSame = 0;
  let subjectChanged = 0;
  let subjectUncertain = 0;

  let chapterSame = 0;
  let chapterChanged = 0;
  let chapterNullResolved = 0;

  let topicSame = 0;
  let topicChanged = 0;
  let topicNullResolved = 0;

  let subtopicSame = 0;
  let subtopicChanged = 0;
  let subtopicNullResolved = 0;

  const subjectTransitions = {};
  const topChapterTransitions = {};

  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    const row = JSON.parse(line);

    // Subject analysis
    const actualSubj = row.actual_subject_id;
    const predSubj = row.predicted_subject?.id;
    const subjConf = row.subject_confidence || 0;

    if (subjConf >= 0.6 && predSubj && predSubj !== actualSubj) {
      subjectChanged++;
      const key = `${actualSubj} -> ${predSubj} (${row.predicted_subject?.name})`;
      subjectTransitions[key] = (subjectTransitions[key] || 0) + 1;
    } else if (predSubj === actualSubj) {
      subjectSame++;
    } else {
      subjectUncertain++;
    }

    // Chapter analysis
    if (!row.actual_chapter_id && row.predicted_chapter) {
      chapterNullResolved++;
    } else if (row.predicted_chapter && row.predicted_chapter.id === row.actual_chapter_id) {
      chapterSame++;
    } else if (row.predicted_chapter) {
      chapterChanged++;
      const chKey = `${row.actual_chapter_id} -> ${row.predicted_chapter.title}`;
      topChapterTransitions[chKey] = (topChapterTransitions[chKey] || 0) + 1;
    }

    // Topic analysis
    if (!row.actual_topic_id && row.predicted_topic) {
      topicNullResolved++;
    } else if (row.predicted_topic && row.predicted_topic.id === row.actual_topic_id) {
      topicSame++;
    } else if (row.predicted_topic) {
      topicChanged++;
    }

    // Subtopic analysis
    if (!row.actual_subtopic_id && row.predicted_subtopic) {
      subtopicNullResolved++;
    } else if (row.predicted_subtopic && row.predicted_subtopic.id === row.actual_subtopic_id) {
      subtopicSame++;
    } else if (row.predicted_subtopic) {
      subtopicChanged++;
    }
  }

  const sortedTransitions = Object.entries(subjectTransitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const sortedChTransitions = Object.entries(topChapterTransitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const summary = {
    total_questions: total,
    subjects: {
      retained_original: subjectSame,
      retained_percent: ((subjectSame / total) * 100).toFixed(1) + '%',
      high_conf_changes: subjectChanged,
      high_conf_change_percent: ((subjectChanged / total) * 100).toFixed(1) + '%',
      low_conf_kept_original: subjectUncertain,
      top_transitions: sortedTransitions
    },
    chapters: {
      exact_matches: chapterSame,
      match_percent: ((chapterSame / total) * 100).toFixed(1) + '%',
      reclassified: chapterChanged,
      reclassified_percent: ((chapterChanged / total) * 100).toFixed(1) + '%',
      missing_resolved: chapterNullResolved,
      top_chapter_reclassifications: sortedChTransitions
    },
    topics: {
      exact_matches: topicSame,
      match_percent: ((topicSame / total) * 100).toFixed(1) + '%',
      refined_or_changed: topicChanged,
      changed_percent: ((topicChanged / total) * 100).toFixed(1) + '%',
      missing_resolved: topicNullResolved
    },
    subtopics: {
      exact_matches: subtopicSame,
      match_percent: ((subtopicSame / total) * 100).toFixed(1) + '%',
      new_or_refined: subtopicChanged,
      missing_resolved: subtopicNullResolved
    }
  };

  console.log(JSON.stringify(summary, null, 2));

  fs.writeFileSync(
    path.join(__dirname, 'out', 'detailed-change-summary.json'),
    JSON.stringify(summary, null, 2)
  );
}

analyze();
