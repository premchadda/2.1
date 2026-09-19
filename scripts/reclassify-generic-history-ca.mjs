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

const subtopicsByTopic = {};
for (const sub of taxonomy.subtopics) {
  if (!subtopicsByTopic[sub.topic_id]) subtopicsByTopic[sub.topic_id] = [];
  subtopicsByTopic[sub.topic_id].push(sub);
}

const topicsByChapter = {};
for (const top of taxonomy.topics) {
  if (!topicsByChapter[top.chapter_id]) topicsByChapter[top.chapter_id] = [];
  topicsByChapter[top.chapter_id].push(top);
}

const chaptersById = {};
for (const ch of taxonomy.chapters) chaptersById[ch.id] = ch;

const topicsById = {};
for (const top of taxonomy.topics) topicsById[top.id] = top;

function cleanText(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function classifyHistoryOrGeneric(q) {
  const text = cleanText(q.question_text).toLowerCase();

  // 1. Math problems sitting in Chapter 12
  if (text.includes("mean proportional") || text.includes("ratio of") || text.includes("divided among") ||
      text.includes("continued proportion") || text.includes("if a : b") || text.includes("if 7 : 63") ||
      text.includes("2.8 : 3.8") || text.includes("ratio of the salaries") || text.includes("ratio of the ages")) {
    return { subject_id: 2, chap: 286, top: 731, reason: "Math: Ratio & Proportion" };
  }
  if (text.includes("x⁴") || text.includes("x³") || text.includes("a³ + 1/a³") || text.includes("a⁴ + b⁴") ||
      text.includes("a² + b²") || text.includes("find the value of (a³") || text.includes("x = 7 2/3") ||
      text.includes("if a = (3 +") || text.includes("if a = x + 2/x")) {
    return { subject_id: 2, chap: 297, top: 742, reason: "Math: Algebra" };
  }
  if (text.includes("evaluate:") || text.includes("simplify (0.4)") || text.includes("find the value of the following: 3 √") ||
      text.includes("typist takes 40 minutes")) {
    return { subject_id: 2, chap: 282, top: 727, reason: "Math: Simplification" };
  }

  // 2. Current Affairs in Chapter 12 or 11
  if (text.includes("pradhan mantri") || text.includes("yojana") || text.includes("pmay") || text.includes("pm-kusum") ||
      text.includes("eli scheme") || text.includes("pmjdy") || text.includes("pmfby") || text.includes("viksit bharat")) {
    return { subject_id: 12, chap: 901, top: 2911, reason: "CA: Government Schemes" };
  }
  if (text.includes("gaganyaan") || text.includes("isro") || text.includes("vikas engine") || text.includes("hlvm3")) {
    return { subject_id: 12, chap: 907, top: 2929, reason: "CA: Space Technology" };
  }
  if (text.includes("in october 2025") || text.includes("in march 2025") || text.includes("in november 2025") ||
      text.includes("in december 2025") || text.includes("haryana government officially notified hansi")) {
    return { subject_id: 12, chap: 127, top: 145, reason: "CA: National Affairs" };
  }

  // 3. Specific History chapters
  if (text.includes("indus") || text.includes("harappan") || text.includes("dholavira") || text.includes("lothal") ||
      text.includes("mohenjo") || text.includes("coffin burial") || text.includes("mother goddess") || text.includes("bronze artefact")) {
    return { subject_id: 4, chap: 645, top: 2163, reason: "History: Indus Valley Civilization" };
  }
  if (text.includes("rigveda") || text.includes("vedic") || text.includes("upanishad") || text.includes("samaveda")) {
    return { subject_id: 4, chap: 646, top: 2170, reason: "History: Vedic Period" };
  }
  if (text.includes("buddha") || text.includes("buddhism") || text.includes("jainism") || text.includes("tirthankara") || text.includes("mahavira")) {
    return { subject_id: 4, chap: 648, top: 2182, reason: "History: Buddhism & Jainism" };
  }
  if (text.includes("ashoka") || text.includes("maurya") || text.includes("chandragupta") || text.includes("kautilya") || text.includes("arthashastra")) {
    return { subject_id: 4, chap: 649, top: 2186, reason: "History: Mauryan Empire" };
  }
  if (text.includes("shunga") || text.includes("kanishka") || text.includes("kushan") || text.includes("satavahana")) {
    return { subject_id: 4, chap: 650, top: 2191, reason: "History: Post Mauryan Period" };
  }
  if (text.includes("gupta") || text.includes("samudragupta") || text.includes("nalanda")) {
    return { subject_id: 4, chap: 651, top: 2195, reason: "History: Gupta Empire" };
  }
  if (text.includes("vijayanagara") || text.includes("chola") || text.includes("pallava") || text.includes("pandya") ||
      text.includes("talikota") || text.includes("rashtrakuta") || text.includes("gurjara-pratihara") || text.includes("tripartite struggle")) {
    return { subject_id: 4, chap: 652, top: 2205, reason: "History: South Indian Kingdoms & Medieval" };
  }
  if (text.includes("sultanate") || text.includes("qutub") || text.includes("khilji") || text.includes("alauddin") ||
      text.includes("tughlaq") || text.includes("razia") || text.includes("balban") || text.includes("lodi")) {
    return { subject_id: 4, chap: 653, top: 2206, reason: "History: Delhi Sultanate" };
  }
  if (text.includes("babur") || text.includes("humayun") || text.includes("akbar") || text.includes("jahangir") ||
      text.includes("shah jahan") || text.includes("aurangzeb") || text.includes("mughal") || text.includes("khanwa") ||
      text.includes("khanua") || text.includes("rana sanga") || text.includes("panipat") || text.includes("medini rai")) {
    return { subject_id: 4, chap: 654, top: 2211, reason: "History: Mughal Empire" };
  }
  if (text.includes("shivaji") || text.includes("maratha") || text.includes("peshwa")) {
    return { subject_id: 4, chap: 657, top: 2226, reason: "History: Maratha Empire" };
  }
  if (text.includes("plassey") || text.includes("buxar") || text.includes("battle in 1741") || text.includes("defeat of the dutch") ||
      text.includes("1857") || text.includes("nana sahib") || text.includes("east india company") || text.includes("dalhousie") ||
      text.includes("cornwallis") || text.includes("curzon") || text.includes("governor general") || text.includes("viceroy")) {
    return { subject_id: 4, chap: (text.includes("1857") || text.includes("nana sahib")) ? 660 : 658, top: (text.includes("1857") || text.includes("nana sahib")) ? 2238 : 2231, reason: "History: European Expansion / 1857" };
  }
  if (text.includes("congress") || text.includes("gandhi") || text.includes("non-cooperation") || text.includes("quit india") ||
      text.includes("civil disobedience") || text.includes("subhas") || text.includes("bhagat singh") || text.includes("tilak") ||
      text.includes("nehru") || text.includes("swaraj") || text.includes("satyagraha") || text.includes("bahishkrit") ||
      text.includes("swadeshi") || text.includes("freedom")) {
    return { subject_id: 4, chap: 661, top: 2241, reason: "History: Indian National Movement" };
  }

  // Fallback for remaining history questions: map to Ancient/Medieval/Modern
  return { subject_id: 4, chap: 144, top: 179, reason: "History: Modern India fallback" };
}

async function run() {
  console.log("=== RECLASSIFYING QUESTIONS FROM GENERIC CHAPTERS 11 & 12 ===");

  const res = await pool.query(`
    SELECT q.id, q.chapter_id, q.topic_id, q.subject_id, q.question_text
    FROM questions q
    WHERE q.chapter_id IN (11, 12)
    ORDER BY q.id;
  `);

  console.log(`Found ${res.rows.length} questions in Chapter 11 and 12.`);

  const updates = [];
  for (const q of res.rows) {
    const target = classifyHistoryOrGeneric(q);
    const subs = subtopicsByTopic[target.top] || [];
    const subtopId = subs[0]?.id || null;

    const chapTitle = chaptersById[target.chap]?.title || null;
    const topName = topicsById[target.top]?.name || null;

    updates.push({
      id: q.id,
      subject_id: target.subject_id,
      chapter_id: target.chap,
      topic_id: target.top,
      subtopic_id: subtopId,
      subject: target.subject_id,
      chapter: chapTitle,
      topic: topName,
      reason: target.reason,
      snippet: cleanText(q.question_text).slice(0, 60)
    });
  }

  console.log("Sample proposed reclassifications:");
  console.table(updates.slice(0, 15).map(u => ({
    QID: u.id,
    Subj: u.subject_id,
    Chap: u.chapter,
    Top: u.topic,
    Reason: u.reason,
    Snippet: u.snippet
  })));

  // Apply updates inside a transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const u of updates) {
      await client.query(`
        UPDATE questions
        SET 
          subject_id = $1,
          chapter_id = $2,
          topic_id = $3,
          subtopic_id = $4,
          subject = $5,
          chapter = $6,
          topic = $7,
          updated_at = NOW()
        WHERE id = $8;
      `, [
        u.subject_id,
        u.chapter_id,
        u.topic_id,
        u.subtopic_id,
        u.subject,
        u.chapter,
        u.topic,
        u.id
      ]);
    }
    await client.query("COMMIT");
    console.log(`\nSuccessfully reclassified all ${updates.length} questions!`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed, rolled back:", err);
  } finally {
    client.release();
  }

  // Deactivate or check remaining count in Chapter 11 and Chapter 12
  const checkCh11 = await pool.query(`SELECT COUNT(*) FROM questions WHERE chapter_id = 11;`);
  const checkCh12 = await pool.query(`SELECT COUNT(*) FROM questions WHERE chapter_id = 12;`);
  console.log(`\nQuestions remaining in Chapter 11: ${checkCh11.rows[0].count}`);
  console.log(`Questions remaining in Chapter 12: ${checkCh12.rows[0].count}`);

  if (checkCh12.rows[0].count === '0') {
    // Mark generic Chapter 12 and Topic 19 inactive so they don't show up in syllabus/practice tree
    await pool.query(`UPDATE subject_chapters SET is_active = false WHERE id = 12;`);
    await pool.query(`UPDATE subject_topics SET is_active = false WHERE chapter_id = 12;`);
    console.log("Marked Chapter 12 ('Chapter 11: History') and Topic 19 ('Topic 1: History') as INACTIVE (is_active=false).");
  }

  if (checkCh11.rows[0].count === '0') {
    await pool.query(`UPDATE subject_chapters SET is_active = false WHERE id = 11;`);
    await pool.query(`UPDATE subject_topics SET is_active = false WHERE chapter_id = 11;`);
    console.log("Marked Chapter 11 ('Chapter 1: Current Affairs') and Topic 18 ('Topic 1: Current Affairs') as INACTIVE (is_active=false).");
  }

  await pool.end();
}

run().catch(console.error);
