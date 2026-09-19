import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function cleanText(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const res = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.question_text
    FROM questions q
    WHERE q.chapter_id = 12
    ORDER BY q.id;
  `);

  console.log(`Total questions in Chapter 12: ${res.rows.length}`);

  let mathCount = 0;
  let historyCount = 0;
  let caCount = 0;
  let otherCount = 0;

  for (const r of res.rows) {
    const text = cleanText(r.question_text).toLowerCase();
    
    // Math detection
    const isMath = text.includes("evaluate:") || text.includes("find the value of") || text.includes("simplify") ||
                   text.includes("mean proportional") || text.includes("ratio of") || text.includes("divided among") ||
                   text.includes("continued proportion") || text.includes("typist takes") || text.includes("salary of") ||
                   text.includes("ratio of the ages") || text.includes("if a : b") || text.includes("if 7 : 63") ||
                   text.includes("√") || text.includes("x⁴") || text.includes("x³") || text.includes("a³ + 1/a³") ||
                   text.includes("a⁴ + b⁴") || text.includes("a² + b²") || text.includes("÷");

    const isCA = text.includes("in october 2025") || text.includes("in march 2025") || text.includes("in 2024") || text.includes("in 2025");

    if (isMath) {
      mathCount++;
    } else if (isCA) {
      caCount++;
    } else {
      historyCount++;
    }
  }

  console.log(`Math questions in Chapter 12: ${mathCount}`);
  console.log(`Current Affairs questions in Chapter 12: ${caCount}`);
  console.log(`Actual History questions in Chapter 12: ${historyCount}`);

  await pool.end();
}

main().catch(console.error);
