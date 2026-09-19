import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const res = await pool.query(`
    SELECT q.id, q.question_number, t.name as topic_name, q.question_text
    FROM questions q
    JOIN subject_topics t ON q.topic_id = t.id
    WHERE q.chapter_id = 12
    ORDER BY q.id;
  `);

  console.log(`Total questions in Chapter 12 ('Chapter 11: History'): ${res.rows.length}`);
  
  // Categorize by historical period
  const breakdown = {
    ivc: 0,
    vedic: 0,
    buddhism_jainism: 0,
    maurya: 0,
    post_maurya_gupta: 0,
    south_indian: 0,
    delhi_sultanate: 0,
    mughals: 0,
    marathas: 0,
    british_revolt: 0,
    national_movement: 0,
    other: 0
  };

  for (const r of res.rows) {
    const text = cleanText(r.question_text).toLowerCase();
    if (text.includes("indus") || text.includes("harappan") || text.includes("dholavira") || text.includes("lothal") || text.includes("mohenjo") || text.includes("coffin burial") || text.includes("mother goddess")) {
      breakdown.ivc++;
    } else if (text.includes("rigveda") || text.includes("vedic") || text.includes("upanishad") || text.includes("samaveda")) {
      breakdown.vedic++;
    } else if (text.includes("buddha") || text.includes("buddhism") || text.includes("jainism") || text.includes("tirthankara") || text.includes("mahavira")) {
      breakdown.buddhism_jainism++;
    } else if (text.includes("ashoka") || text.includes("maurya") || text.includes("chandragupta") || text.includes("kautilya") || text.includes("arthashastra")) {
      breakdown.maurya++;
    } else if (text.includes("gupta") || text.includes("samudragupta") || text.includes("shunga") || text.includes("kanishka") || text.includes("kushan")) {
      breakdown.post_maurya_gupta++;
    } else if (text.includes("vijayanagara") || text.includes("chola") || text.includes("pallava") || text.includes("pandya") || text.includes("rashtrakuta") || text.includes("talikota")) {
      breakdown.south_indian++;
    } else if (text.includes("sultanate") || text.includes("qutub") || text.includes("khilji") || text.includes("alauddin") || text.includes("tughlaq") || text.includes("razia") || text.includes("balban") || text.includes("lodi")) {
      breakdown.delhi_sultanate++;
    } else if (text.includes("babur") || text.includes("humayun") || text.includes("akbar") || text.includes("jahangir") || text.includes("shah jahan") || text.includes("aurangzeb") || text.includes("mughal") || text.includes("khanwa") || text.includes("rana sanga") || text.includes("panipat")) {
      breakdown.mughals++;
    } else if (text.includes("shivaji") || text.includes("maratha") || text.includes("peshwa")) {
      breakdown.marathas++;
    } else if (text.includes("plassey") || text.includes("buxar") || text.includes("1857") || text.includes("nana sahib") || text.includes("east india company") || text.includes("dalhousie") || text.includes("cornwallis") || text.includes("curzon") || text.includes("governor general") || text.includes("viceroy")) {
      breakdown.british_revolt++;
    } else if (text.includes("congress") || text.includes("gandhi") || text.includes("non-cooperation") || text.includes("quit india") || text.includes("civil disobedience") || text.includes("subhas") || text.includes("bhagat singh") || text.includes("tilak") || text.includes("nehru") || text.includes("swaraj") || text.includes("satyagraha") || text.includes("bahishkrit")) {
      breakdown.national_movement++;
    } else {
      breakdown.other++;
    }
  }

  console.log("Historical period breakdown of the 227 questions:");
  console.table(breakdown);

  await pool.end();
}

main().catch(console.error);
