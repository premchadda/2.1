import pg from "pg";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../apps/backend/.env") });
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const chs = await pool.query(
    `SELECT id, subject_id, title FROM subject_chapters ORDER BY subject_id, order_index, id`
  );
  const tops = await pool.query(
    `SELECT id, chapter_id, name FROM subject_topics ORDER BY chapter_id, order_index, id`
  );
  const subs = await pool.query(
    `SELECT id, topic_id, name FROM subject_subtopics ORDER BY topic_id, order_index, id`
  );
  const topByChap = {};
  for (const t of tops.rows) (topByChap[t.chapter_id] ||= []).push(t);
  const subByTop = {};
  for (const s of subs.rows) (subByTop[s.topic_id] ||= []).push(s);

  const lines = [];
  for (const sid of [4, 5, 6, 7, 8, 9]) {
    lines.push(`\n##### SUBJECT ${sid} #####`);
    for (const c of chs.rows.filter((x) => x.subject_id === sid)) {
      lines.push(`CH ${c.id} | ${c.title}`);
      for (const t of topByChap[c.id] || []) {
        const subNames = (subByTop[t.id] || []).map((s) => s.name).join("; ");
        lines.push(`   TOP ${t.id} | ${t.name}${subNames ? `  <<${subNames}>>` : ""}`);
      }
    }
  }
  const dest = path.join(__dirname, "recon-taxonomy-4-9.txt");
  fs.writeFileSync(dest, lines.join("\n"));
  console.log("Wrote", dest, lines.length, "lines");
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});