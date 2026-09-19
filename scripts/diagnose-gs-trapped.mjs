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
  console.log("=== CHECKING REASONING/QUANT/ENGLISH TRAPPED IN GS ===");

  const gsQs = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.section, qs.name as subj_name, qc.title as chap_title, q.question_text
    FROM questions q
    JOIN subjects qs ON q.subject_id = qs.id
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    WHERE q.subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13);
  `);
  console.log(`Total questions in GS subjects: ${gsQs.rows.length}`);

  let trapped = [];
  for (const q of gsQs.rows) {
    const text = cleanText(q.question_text).toLowerCase();

    // 1. Definite Reasoning
    const isBloodRelation = (text.includes("pointing to") || text.includes("introducing a")) && 
                            (text.includes("he is the") || text.includes("she is the") || text.includes("brother") || text.includes("sister") || text.includes("mother") || text.includes("father") || text.includes("daughter") || text.includes("son"));
    const isSeating = (text.includes("sitting around a") || text.includes("sitting in a circle") || text.includes("facing north") || text.includes("facing the center") || text.includes("seated in a row") || text.includes("sitting in a straight line")) &&
                      (text.includes("immediate left") || text.includes("immediate right") || text.includes("third to the left") || text.includes("second to the right") || text.includes("between"));
    const isCoding = (text.includes("in a certain code") || text.includes("code language") || text.includes("is written as") || text.includes("is coded as")) &&
                     (text.includes("how will") || text.includes("how is") || text.includes("what is the code"));
    const isNumberSeries = (text.includes("replace the question mark") || text.includes("in place of '?'") || text.includes("in place of the question mark") || text.includes("wrong number in the")) &&
                           (text.includes("series") || text.includes("pattern"));
    const isAnalogy = (text.includes("select the option that is related to the third") || text.includes("related to the fifth") || text.includes("select the set in which the numbers are related")) &&
                      (text.includes("same way as") || text.includes("similar to"));
    const isDirection = (text.includes("walks") || text.includes("starts walking") || text.includes("drives")) &&
                        (text.includes("turns left") || text.includes("turns right") || text.includes("towards north") || text.includes("towards east") || text.includes("towards south") || text.includes("towards west")) &&
                        (text.includes("in which direction") || text.includes("how far"));
    const isVenn = (text.includes("venn diagram") || text.includes("वेन आरेख")) && 
                   (text.includes("represents") || text.includes("relationship") || text.includes("classes"));
    const isSyllogism = (text.includes("statements:") || text.includes("statement:")) && 
                        (text.includes("conclusions:") || text.includes("conclusion:")) && 
                        (text.includes("all ") || text.includes("some ") || text.includes("no ")) &&
                        (text.includes("logically follow"));
    const isDice = (text.includes("opposite to the face") || text.includes("opposite the face") || text.includes("two different positions of the same dice") || text.includes("folded to form a cube"));

    // 2. Definite Quant
    const isWorkTime = (text.includes("can do a piece of work") || text.includes("can complete a work") || text.includes("working together")) && 
                       (text.includes("in how many days") || text.includes("efficiency") || text.includes("days"));
    const isPipes = (text.includes("pipe a") || text.includes("pipe b") || text.includes("pipes a and b") || text.includes("inlet pipe") || text.includes("outlet pipe")) && 
                    (text.includes("cistern") || text.includes("tank") || text.includes("fill"));
    const isSI_CI = (text.includes("compound interest") || text.includes("simple interest") || text.includes("compounded annually") || text.includes("compounded half-yearly")) &&
                    (text.includes("sum of money") || text.includes("principal") || text.includes("rate of interest") || text.includes("per annum"));
    const isSpeedDist = (text.includes("speed of the train") || text.includes("train running at") || text.includes("crosses a platform") || text.includes("crosses a pole") || text.includes("boat travels upstream") || text.includes("speed of the boat in still water"));

    // 3. Definite English
    const isGrammarError = text.includes("the following sentence has been divided into parts") || 
                           text.includes("select the option that contains a grammatical error") ||
                           text.includes("parts of the following sentence have been given as options") ||
                           text.includes("select the most appropriate option to fill in the blank") ||
                           text.includes("select the most appropriate synonym of the given word") ||
                           text.includes("select the most appropriate antonym of the given word") ||
                           text.includes("select the option that expresses the given sentence in passive voice") ||
                           text.includes("select the option that expresses the given sentence in indirect speech");

    if (isBloodRelation || isSeating || isCoding || isNumberSeries || isAnalogy || isDirection || isVenn || isSyllogism || isDice) {
      trapped.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentSubj: q.subj_name, targetSubj: "Reasoning", snippet: cleanText(q.question_text).slice(0, 80) });
    } else if (isWorkTime || isPipes || isSI_CI || isSpeedDist) {
      trapped.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentSubj: q.subj_name, targetSubj: "Quantitative Aptitude", snippet: cleanText(q.question_text).slice(0, 80) });
    } else if (isGrammarError) {
      trapped.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, currentSubj: q.subj_name, targetSubj: "English Language", snippet: cleanText(q.question_text).slice(0, 80) });
    }
  }

  console.log(`\nFound ${trapped.length} high-confidence Reasoning/Quant/English questions trapped in GS subjects!`);
  console.table(trapped.slice(0, 20));

  await pool.end();
}

main().catch(console.error);
