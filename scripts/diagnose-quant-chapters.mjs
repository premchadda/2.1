import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("=== CHECKING CHAPTER-LEVEL MISCLASSIFICATIONS IN QUANT ===");

  const res = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.chapter_id, qc.title as current_chap, q.question_text
    FROM questions q
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    WHERE q.subject_id = 2;
  `);

  let mismatches = [];
  for (const q of res.rows) {
    const text = cleanText(q.question_text).toLowerCase();
    const chap = q.current_chap.toLowerCase();

    // Time & Work
    const isWork = (text.includes("can do a piece of work") || text.includes("can complete a work") || text.includes("working together")) && 
                   (text.includes("in how many days") || text.includes("efficiency") || text.includes("days"));
    if (isWork && !chap.includes("time & work") && !chap.includes("work")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 13: Time & Work", snippet: text.slice(0, 70) });
      continue;
    }

    // Pipe & Cistern
    const isPipe = (text.includes("pipe a") || text.includes("pipe b") || text.includes("pipes a and b") || text.includes("inlet pipe") || text.includes("outlet pipe")) && 
                   (text.includes("cistern") || text.includes("tank") || text.includes("fill"));
    if (isPipe && !chap.includes("pipe")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 14: Pipe & Cistern", snippet: text.slice(0, 70) });
      continue;
    }

    // Profit & Loss / Discount
    const isProfitLoss = (text.includes("cost price") || text.includes("selling price") || text.includes("marked price") || text.includes("profit percentage") || text.includes("loss percentage") || text.includes("sold at a profit") || text.includes("sold at a loss") || text.includes("single discount equivalent"));
    if (isProfitLoss && !chap.includes("profit") && !chap.includes("loss") && !chap.includes("discount")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 6: Profit & Loss / Discount", snippet: text.slice(0, 70) });
      continue;
    }

    // Simple / Compound Interest
    const isInterest = (text.includes("simple interest") || text.includes("compound interest") || text.includes("compounded annually") || text.includes("compounded half-yearly"));
    if (isInterest && !chap.includes("interest")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 8/9: Simple/Compound Interest", snippet: text.slice(0, 70) });
      continue;
    }

    // LCM / HCF
    const isLCM = (text.includes("lcm") || text.includes("hcf") || text.includes("least common multiple") || text.includes("highest common factor") || text.includes("greatest common divisor"));
    if (isLCM && !chap.includes("lcm") && !chap.includes("hcf")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 2: LCM & HCF", snippet: text.slice(0, 70) });
      continue;
    }

    // Geometry / Mensuration
    const isMensuration = (text.includes("cylinder") || text.includes("cone") || text.includes("sphere") || text.includes("hemisphere") || text.includes("surface area") || text.includes("volume of the cone") || text.includes("volume of the sphere") || text.includes("radius of the circle"));
    if (isMensuration && !chap.includes("mensuration") && !chap.includes("geometry")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 23/24: Geometry/Mensuration", snippet: text.slice(0, 70) });
      continue;
    }

    // Speed Time Distance / Trains / Boat & Stream
    const isSpeed = (text.includes("speed of the train") || text.includes("train running at") || text.includes("crosses a pole") || text.includes("crosses a bridge") || text.includes("upstream") && text.includes("downstream"));
    if (isSpeed && !chap.includes("time & distance") && !chap.includes("boat & stream")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 15/16: Time & Distance / Boat & Stream", snippet: text.slice(0, 70) });
      continue;
    }
  }

  console.log(`\nFound ${mismatches.length} Quant questions in the WRONG Chapter!`);
  console.log("Sample chapter mismatches in Quant:");
  console.table(mismatches.slice(0, 20));

  await pool.end();
}

main().catch(console.error);
