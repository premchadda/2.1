import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Load taxonomy
const taxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, "full-taxonomy.json"), "utf8"));

const chaptersById = {};
for (const c of taxonomy.chapters) chaptersById[c.id] = c;

const topicsByChapter = {};
for (const top of taxonomy.topics) {
  if (!topicsByChapter[top.chapter_id]) topicsByChapter[top.chapter_id] = [];
  topicsByChapter[top.chapter_id].push(top);
}

const subtopicsByTopic = {};
for (const sub of taxonomy.subtopics) {
  if (!subtopicsByTopic[sub.topic_id]) subtopicsByTopic[sub.topic_id] = [];
  subtopicsByTopic[sub.topic_id].push(sub);
}

async function main() {
  console.log("=== FINAL HIERARCHY RECONCILIATION ===");

  // Find questions where topic does not belong to chapter OR subtopic does not belong to topic
  const badQuestions = await pool.query(`
    SELECT q.id, q.subject_id, q.chapter_id, q.topic_id, q.subtopic_id
    FROM questions q
    JOIN subject_topics t ON q.topic_id = t.id
    LEFT JOIN subject_subtopics st ON q.subtopic_id = st.id
    WHERE q.chapter_id != t.chapter_id OR q.topic_id != st.topic_id;
  `);

  console.log(`Found ${badQuestions.rows.length} questions needing hierarchy alignment.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const q of badQuestions.rows) {
      // 1. Pick valid topic under q.chapter_id
      const validTopics = topicsByChapter[q.chapter_id] || [];
      const newTopicId = validTopics[0]?.id || q.topic_id;
      const topicName = validTopics[0]?.name || null;

      // 2. Pick valid subtopic under newTopicId
      const validSubs = subtopicsByTopic[newTopicId] || [];
      const newSubtopicId = validSubs[0]?.id || null;

      await client.query(`
        UPDATE questions
        SET 
          topic_id = $1,
          subtopic_id = $2,
          topic = $3,
          updated_at = NOW()
        WHERE id = $4;
      `, [newTopicId, newSubtopicId, topicName, q.id]);
    }
    await client.query("COMMIT");
    console.log(`Aligned all ${badQuestions.rows.length} questions!`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Failed:", e);
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch(console.error);
