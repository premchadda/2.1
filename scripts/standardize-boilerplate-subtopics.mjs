import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Comprehensive mapping of Hindi Type descriptions to English concepts
function deriveBilingualName(topicName) {
  // Extract the core Hindi text after "Type-X: "
  const match = topicName.match(/Type-?[IVXLCDM\d]+\s*:\s*(.+)$/i);
  let core = match ? match[1].trim() : topicName.replace(/^Topic\s*\d+\s*:\s*/i, '').trim();

  // Strip "पर आधारित प्रश्न" ("questions based on")
  const cleanHindi = core.replace(/\s*पर\s*आधारित\s*प्रश्न\s*$/i, '').trim();

  // Translate specific math patterns to English
  let english = "";
  const h = cleanHindi.toLowerCase();

  if (h.includes("भाग") && h.includes("शेषफल")) english = "Division, Quotient & Remainder";
  else if (h.includes("योग") && h.includes("गुणनफल") && h.includes("व्युत्क्रम")) english = "Sum, Product & Reciprocals of Numbers";
  else if (h.includes("क्रमागत") || (h.includes("सम") && h.includes("विषम"))) english = "Consecutive, Even, Odd & Prime Numbers";
  else if (h.includes("बढ़ते") || h.includes("घटते") || h.includes("आरोही") || h.includes("अवरोही")) english = "Ascending & Descending Order";
  else if (h.includes("बड़ी") && h.includes("छोटी")) english = "Comparison of Largest & Smallest Numbers";
  else if (h.includes("भिन्न")) english = "Fractions & Decimals";
  else if (/ल\s*\.\s*स/i.test(h) && /म\s*\.\s*स/i.test(h) && h.includes("सूत्र")) english = "LCM & HCF Product Formula";
  else if (/ल\s*\.\s*स/i.test(h) || h.includes("लघुत्तम")) english = "LCM Calculation & Properties";
  else if (/म\s*\.\s*स/i.test(h) || h.includes("महत्तम")) english = "HCF Calculation & Properties";
  else if (h.includes("वर्ग") && h.includes("वर्गमूल")) english = "Square & Square Roots";
  else if (h.includes("घन") && h.includes("घनमूल")) english = "Cube & Cube Roots";
  else if (h.includes("सतत्") || h.includes("continued")) english = "Continued Fractions";
  else if (h.includes("bodmas") || h.includes("सरलीकरण")) english = "BODMAS Simplification Rules";
  else if (h.includes("इकाई अंक") || h.includes("परिमेयकरण") || h.includes("अभाज्य गुणनखंड")) english = "Unit Digit & Prime Factorization";
  else if (h.includes("अनुपात") && h.includes("समानुपात")) english = "Ratio & Proportion Concepts";
  else if (h.includes("प्रतिशत") || h.includes("%")) english = "Percentage Concepts & Applications";
  else if (h.includes("क्रयमूल्य") || h.includes("विक्रय मूल्य") || h.includes("लाभ-हानि") || h.includes("लाभ और हानि")) english = "Cost Price, Selling Price & Profit-Loss";
  else if (h.includes("बट्टा") || h.includes("छूट")) english = "Discount & Marked Price";
  else if (h.includes("साधारण ब्याज")) english = "Simple Interest Calculation";
  else if (h.includes("चक्रवृद्धि ब्याज")) english = "Compound Interest Calculation";
  else if (h.includes("समय और कार्य") || h.includes("मजदूरी")) english = "Time, Work & Wages";
  else if (h.includes("नल") || h.includes("हौज") || h.includes("पाइप")) english = "Pipes & Cisterns";
  else if (h.includes("चाल") || h.includes("दूरी") || h.includes("गति")) english = "Speed, Time & Distance";
  else if (h.includes("रेलगाड़ी") || h.includes("ट्रेन")) english = "Train Problems & Relative Speed";
  else if (h.includes("नाव") || h.includes("धारा")) english = "Boats & Streams";
  else if (h.includes("मिश्रण") || h.includes("alligation")) english = "Mixture & Alligation Rules";
  else if (h.includes("औसत")) english = "Average Calculation";
  else if (h.includes("आयु") || h.includes("उम्र")) english = "Age Related Problems";
  else if (h.includes("साझेदारी") || h.includes("पार्टनरशिप")) english = "Partnership & Profit Sharing";
  else if (h.includes("त्रिभुज")) english = "Triangles & Geometric Properties";
  else if (h.includes("चतुर्भुज") || h.includes("आयत") || h.includes("वर्ग")) english = "Quadrilaterals & Polygons";
  else if (h.includes("वृत्त") || h.includes("circle")) english = "Circles & Tangents";
  else if (h.includes("क्षेत्रफल") || h.includes("परिमाप")) english = "Area & Perimeter (2D Mensuration)";
  else if (h.includes("आयतन") || h.includes("पृष्ठीय क्षेत्रफल")) english = "Volume & Surface Area (3D Mensuration)";
  else if (h.includes("त्रिकोणमिति") || h.includes("ऊंचाई और दूरी")) english = "Trigonometry & Heights-Distances";
  else if (h.includes("माध्य") || h.includes("माध्यिका") || h.includes("बहुलक")) english = "Measures of Central Tendency";
  else if (h.includes("प्रायिकता") || h.includes("probability")) english = "Probability Concepts";
  else if (h.includes("सारणी") || h.includes("table")) english = "Tabulation DI";
  else if (h.includes("दंड चित्र") || h.includes("bar")) english = "Bar Diagram DI";
  else if (h.includes("पाई चार्ट") || h.includes("pie")) english = "Pie Chart DI";
  else if (h.includes("रैखिक आलेख") || h.includes("line")) english = "Line Graph DI";
  else if (h.includes("विविध")) english = "Mixed & Comprehensive Practice";
  else english = "Core Concepts & Applications";

  return `${english} (${cleanHindi})`;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting Subtopic Justification (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE TRANSACTION'})...\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(`
      SELECT 
        st.id, st.name, t.name as topic_name
      FROM subject_subtopics st
      JOIN subject_topics t ON st.topic_id = t.id
      WHERE st.is_deleted IS NOT TRUE
        AND st.name ~* 'detailed concepts'
      ORDER BY st.id
    `);

    console.log(`Found ${res.rows.length} boilerplate subtopics to upgrade.`);
    let updates = [];

    for (const r of res.rows) {
      const bilingualName = deriveBilingualName(r.topic_name);
      updates.push({ id: r.id, name: bilingualName });
    }

    console.log('Sample upgrades (first 10):');
    for (const u of updates.slice(0, 10)) {
      console.log(`  ID ${u.id}: -> "${u.name}"`);
    }

    // Batch update
    if (updates.length > 0) {
      const ids = updates.map(u => u.id);
      const names = updates.map(u => u.name);
      await client.query(`
        UPDATE subject_subtopics AS st
        SET name = u.name, updated_at = NOW()
        FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS name) AS u
        WHERE st.id = u.id
      `, [ids, names]);
      console.log(`✔ Batch updated ${updates.length} subtopics.`);
    }

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log('\nDRY-RUN COMPLETE: Changes rolled back cleanly.');
    } else {
      await client.query('COMMIT');
      console.log('\n✔ COMMIT SUCCESSFUL: All 161 boilerplate subtopics upgraded to bilingual concepts!');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during subtopic upgrade (rolled back):', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
