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
  console.log("=== DIAGNOSING FULL-TEXT MISCLASSIFICATIONS ===");

  // 1. Check questions in Reasoning (Subject 1) that are actually GS or Quant
  // Specifically: questions in Subject 1 that mention articles, constitution, dynasties, rivers, ministries, schemes, physics laws, etc.
  const reasoningQs = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.section, qc.title as chap_title, q.question_text
    FROM questions q
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    WHERE q.subject_id = 1;
  `);
  console.log(`Total questions currently in Reasoning (Subject 1): ${reasoningQs.rows.length}`);

  let reasoningFalsePositives = [];
  for (const q of reasoningQs.rows) {
    const text = cleanText(q.question_text).toLowerCase();
    
    // Check if it's GS despite having "statement"
    const isPolity = text.includes("constitution") || text.includes("article ") || text.includes("fundamental rights") || 
                     text.includes("fundamental duties") || text.includes("parliament") || text.includes("lok sabha") || 
                     text.includes("rajya sabha") || text.includes("amendment act") || text.includes("supreme court") ||
                     text.includes("high court") || text.includes("governor") || text.includes("president of india");
                     
    const isHistory = text.includes("dynasty") || text.includes("sultanate") || text.includes("mughal") || 
                      text.includes("british") || text.includes("battle of ") || text.includes("harappa") || 
                      text.includes("indus valley") || text.includes("vedic") || text.includes("buddhism") || 
                      text.includes("jainism") || text.includes("ashoka") || text.includes("mauryan") ||
                      text.includes("east india company") || text.includes("viceroy");
                      
    const isGeography = text.includes("tributary") || text.includes("himalayas") || text.includes("peninsular") || 
                        text.includes("river ") || text.includes("monsoon") || text.includes("soil") || 
                        text.includes("plateau") || text.includes("strait") || text.includes("latitude") || 
                        text.includes("longitude") || text.includes("cyclone") || text.includes("glacial landforms");

    const isEconomy = text.includes("gdp") || text.includes("inflation") || text.includes("reserve bank of india") || 
                      text.includes("rbi") || text.includes("monetary policy") || text.includes("fiscal deficit") ||
                      text.includes("five year plan") || text.includes("nabard") || text.includes("sebi");

    const isScience = text.includes("refraction") || text.includes("photosynthesis") || text.includes("chlorophyll") ||
                      text.includes("mitochondria") || text.includes("kinetic energy") || text.includes("potential energy") ||
                      text.includes("newton's") || text.includes("periodic table") || text.includes("atomic number");

    const isCA = text.includes("launched in 202") || text.includes("in december 202") || text.includes("in january 202") ||
                 text.includes("in february 202") || text.includes("in march 202") || text.includes("in april 202") ||
                 text.includes("in may 202") || text.includes("in june 202") || text.includes("in july 202") ||
                 text.includes("in august 202") || text.includes("in september 202") || text.includes("in october 202") ||
                 text.includes("in november 202") || text.includes("budget 202") || text.includes("sslv-");

    if (isPolity || isHistory || isGeography || isEconomy || isScience || isCA) {
      // Make sure it's not a genuine reasoning question that happens to mention a real-world entity in an analogy or syllogism
      const isRealReasoning = text.includes("logically follow") || text.includes("some ") && text.includes("all ") && text.includes("conclusion") ||
                              text.includes("sitting") && text.includes("facing") || text.includes("point to a") || text.includes("in a code") ||
                              text.includes("is coded as") || text.includes("replace the question mark") || text.includes("venn diagram");
      if (!isRealReasoning) {
        let detectedSubj = isPolity ? "Polity" : isHistory ? "History" : isGeography ? "Geography" : isEconomy ? "Economy" : isScience ? "Science" : "Current Affairs";
        reasoningFalsePositives.push({ id: q.id, test_id: q.test_id, q_num: q.question_number, chap: q.chap_title, detectedSubj, snippet: cleanText(q.question_text).slice(0, 70) });
      }
    }
  }

  console.log(`\nFound ${reasoningFalsePositives.length} GS questions currently trapped in Reasoning (Subject 1)!`);
  console.log("Sample of GS questions trapped in Reasoning:");
  console.table(reasoningFalsePositives.slice(0, 15));

  await pool.end();
}

main().catch(console.error);
