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
  console.log("=== CHECKING CHAPTER-LEVEL MISCLASSIFICATIONS IN REASONING ===");

  const res = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.chapter_id, qc.title as current_chap, q.question_text
    FROM questions q
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    WHERE q.subject_id = 1;
  `);

  let mismatches = [];
  for (const q of res.rows) {
    const text = cleanText(q.question_text).toLowerCase();
    const chap = q.current_chap.toLowerCase();

    // Blood relation
    const isBlood = (text.includes("pointing to") || text.includes("introducing a") || text.includes("how is") && text.includes("related to")) &&
                    (text.includes("father") || text.includes("mother") || text.includes("sister") || text.includes("brother") || text.includes("daughter") || text.includes("son") || text.includes("uncle") || text.includes("aunt") || text.includes("nephew") || text.includes("niece") || text.includes("wife") || text.includes("husband"));
    if (isBlood && !chap.includes("blood relation")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 5: Blood Relations", snippet: text.slice(0, 70) });
      continue;
    }

    // Coding Decoding
    const isCoding = (text.includes("in a certain code") || text.includes("code language") || text.includes("is written as") || text.includes("is coded as")) &&
                     (text.includes("how will") || text.includes("how is") || text.includes("what is the code") || text.includes("code for"));
    if (isCoding && !chap.includes("coding-decoding") && !chap.includes("coding")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 2: Coding-Decoding", snippet: text.slice(0, 70) });
      continue;
    }

    // Seating Arrangement
    const isSeating = (text.includes("sitting around a") || text.includes("sitting in a circle") || text.includes("facing north") || text.includes("facing the center") || text.includes("seated in a row") || text.includes("sitting in a straight line") || text.includes("sitting on a circular table")) &&
                      (text.includes("immediate left") || text.includes("immediate right") || text.includes("third to the left") || text.includes("second to the right") || text.includes("between") || text.includes("opposite"));
    if (isSeating && !chap.includes("seating arrangement")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 7: Seating Arrangement", snippet: text.slice(0, 70) });
      continue;
    }

    // Direction Sense
    const isDirection = (text.includes("walks") || text.includes("starts walking") || text.includes("drives")) &&
                        (text.includes("turns left") || text.includes("turns right") || text.includes("towards north") || text.includes("towards east") || text.includes("towards south") || text.includes("towards west")) &&
                        (text.includes("in which direction") || text.includes("how far") || text.includes("starting point"));
    if (isDirection && !chap.includes("direction")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 6: Direction Sense", snippet: text.slice(0, 70) });
      continue;
    }

    // Syllogism
    const isSyllogism = (text.includes("statements:") || text.includes("statement:")) && 
                        (text.includes("conclusions:") || text.includes("conclusion:")) && 
                        (text.includes("all ") || text.includes("some ") || text.includes("no ")) &&
                        (text.includes("logically follow"));
    if (isSyllogism && !chap.includes("syllogism")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 9: Syllogism", snippet: text.slice(0, 70) });
      continue;
    }

    // Venn Diagram
    const isVenn = (text.includes("venn diagram") || text.includes("वेन आरेख")) && (text.includes("represents") || text.includes("relationship") || text.includes("classes"));
    if (isVenn && !chap.includes("venn")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 10: Logical Venn Diagrams", snippet: text.slice(0, 70) });
      continue;
    }

    // Dice & Cube
    const isDice = (text.includes("opposite to the face") || text.includes("opposite the face") || text.includes("two different positions of the same dice") || text.includes("folded to form a cube"));
    if (isDice && !chap.includes("cube") && !chap.includes("dice")) {
      mismatches.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentChap: q.current_chap, detectedChap: "Chapter 43: Cube & Dice", snippet: text.slice(0, 70) });
      continue;
    }
  }

  console.log(`\nFound ${mismatches.length} Reasoning questions in the WRONG Chapter!`);
  console.log("Sample chapter mismatches:");
  console.table(mismatches.slice(0, 20));

  await pool.end();
}

main().catch(console.error);
