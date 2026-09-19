import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("Searching for reasoning-like questions classified under GS (subjects 4..13)...");

  // Check 1: Explicit reasoning keywords and sentence structures in questions where subject_id IN (4,5,6,7,8,9,10,11,12,13)
  const reasoningPatterns = [
    // Syllogism
    `%Statements:%Conclusions:%`,
    `%Statements :%Conclusions :%`,
    `%कथन:%निष्कर्ष:%`,
    `%कथन :%निष्कर्ष :%`,
    `%Which of the following conclusions logically follow%`,
    `%निम्नलिखित में से कौन सा निष्कर्ष तार्किक रूप से%`,
    // Coding decoding
    `%code language%is written as%`,
    `%coded as%`,
    `%कूट भाषा में%`,
    `%के रूप में लिखा जाता है%`,
    // Blood relations
    `%Pointing to%said%`,
    `%Pointing towards%said%`,
    `%एक तस्वीर की ओर इशारा करते हुए%`,
    `%is the mother of%father of%`,
    `%is the brother of%sister of%`,
    // Direction sense
    `%walks%meters towards%turns left%`,
    `%walks%km towards%turns right%`,
    `%किलोमीटर चलता है%बाएं मुड़ता है%`,
    `%मीटर चलती है%दाएं मुड़ती है%`,
    // Analogy / Relation
    `%related to the third%in the same way as the second%`,
    `%उसी प्रकार संबंधित है जिस प्रकार दूसरा%`,
    `%Select the option that is related to%`,
    `%Select the letter-cluster that%`,
    `%Select the number-pair%`,
    `%अक्षर-समूह का चयन करें जो%`,
    // Series
    `%replace the question mark (?) in the following series%`,
    `%दी गई श्रृंखला में प्रश्न चिह्न (?) के स्थान पर%`,
    `%Select the number that can replace the question mark (?)%`,
    // Seating arrangement
    `%sitting around a circular table%`,
    `%sitting in a straight line%`,
    `%एक वृत्ताकार मेज के चारों ओर बैठे हैं%`,
    // Venn diagrams & Non-verbal
    `%Venn diagram%represents%`,
    `%वेन आरेख%दर्शाता है%`,
    `%mirror image of the given figure%`,
    `%दर्पण छवि%`,
    `%paper is folded and cut%`,
    `%figure is embedded in%`,
    // Math operations interchange
    `%If '+' means '-' and%`,
    `%If '+' means 'x'%`,
    `%signs should be interchanged%`
  ];

  const whereClauses = reasoningPatterns.map((_, i) => `q.question_text ILIKE $${i + 1}`).join(" OR ");

  const res = await pool.query(`
    SELECT q.id, q.subject_id, s.name as subject_name, q.chapter_id, sc.title as chapter_title,
           q.topic_id, q.question_text, q.options, q.test_id
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    LEFT JOIN subject_chapters sc ON q.chapter_id = sc.id
    WHERE q.subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (${whereClauses})
    LIMIT 50;
  `, reasoningPatterns);

  console.log(`Found ${res.rows.length} sample reasoning questions in GS subjects!`);
  for (const row of res.rows.slice(0, 10)) {
    console.log(`\n--- Question ID: ${row.id} | Subject: ${row.subject_id} (${row.subject_name}) | Chapter: ${row.chapter_title} ---`);
    console.log(`Text: ${row.question_text.slice(0, 250)}...`);
  }

  // Count total matching
  const countRes = await pool.query(`
    SELECT count(*)
    FROM questions q
    WHERE q.subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (${whereClauses})
  `, reasoningPatterns);
  console.log(`\nTotal questions in GS subjects matching strict reasoning patterns: ${countRes.rows[0].count}`);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
