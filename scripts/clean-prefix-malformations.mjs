import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Justified bilingual names for the 10 subject-mirror and 5 generic misc chapters
const CHAPTER_UPGRADES = {
  // Subject-mirror chapters
  12: "Chapter 11: Overview of Indian Historical Eras (भारतीय इतिहास: एक समग्र परिचय)",
  13: "Chapter 14: Fundamentals of Physical Geography (भौतिक भूगोल के मूलभूत सिद्धांत)",
  211: "Chapter 32: General Physics & Measurements (सामान्य भौतिकी एवं भौतिक मापन)",
  212: "Chapter 19: General Chemistry Principles (सामान्य रसायन विज्ञान के सिद्धांत)",
  213: "Chapter 29: Foundations of Biological Sciences (सामान्य जीव विज्ञान की मूलभूत अवधारणाएं)",
  517: "Chapter 12: Indian Polity & Constitutional Framework (भारतीय राजव्यवस्था एवं संवैधानिक ढांचा)",
  154: "Chapter 9: CPU & Control Unit Architecture (सीपीयू एवं नियंत्रण इकाई संरचना)",
  519: "Chapter 21: Static GK Essentials & Culture (स्थिर सामान्य ज्ञान एवं भारतीय संस्कृति)",
  11: "Chapter 1: Current Affairs & Contemporary Events (समसामयिक घटनाएँ एवं समकालीन परिदृश्य)",
  
  // Generic Misc chapters
  526: "Chapter 31: Non-Verbal & Emerging Reasoning (अशाब्दिक एवं विशिष्ट तर्कशक्ति)",
  529: "Chapter 37: Applied Verbal Ability & Idioms (व्यावहारिक मौखिक योग्यता एवं मुहावरे)",
  516: "Chapter 9: Interdisciplinary General Awareness (अंतर्विषयक सामान्य जागरूकता)",
  303: "Chapter 20: Specialized & Hybrid Quantitative Topics (विशिष्ट एवं प्रकीर्ण गणितीय अनुप्रयोग)"
};

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting Phase A: Naming Justification & Prefix Cleaning (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE TRANSACTION'})...\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Upgrade the 13 subject-mirror and generic misc chapters to bilingual justified titles
    console.log('--- 1. Upgrading Subject-Mirror & Generic Chapters to Bilingual Titles ---');
    for (const [idStr, newTitle] of Object.entries(CHAPTER_UPGRADES)) {
      const id = Number(idStr);
      const res = await client.query(`
        UPDATE subject_chapters
        SET title = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, title
      `, [newTitle, id]);
      if (res.rows.length > 0) {
        console.log(`✔ Ch ID ${id} -> "${res.rows[0].title}"`);
      }
    }

    // 2. Clean 262 Double Prefix Topics: "Topic \d+: Topic: ..."
    console.log('\n--- 2. Cleaning Double-Prefix Topics ("Topic X: Topic: ...") ---');
    const doubleRes = await client.query(`
      UPDATE subject_topics
      SET name = REGEXP_REPLACE(name, '^Topic\\s*\\d*\\s*:\\s*Topic\\s*:\\s*', '', 'i'), updated_at = NOW()
      WHERE is_deleted IS NOT TRUE
        AND name ~* '^Topic\\s*\\d*\\s*:\\s*Topic\\s*:'
      RETURNING id
    `);
    console.log(`✔ Cleaned ${doubleRes.rowCount} double-prefix topics.`);

    // 3. Clean 119 "Topic: <Name>" topics (starts with Topic: without number)
    console.log('\n--- 3. Cleaning "Topic: <Name>" topics ---');
    const topicColonRes = await client.query(`
      UPDATE subject_topics
      SET name = REGEXP_REPLACE(name, '^Topic\\s*:\\s*', '', 'i'), updated_at = NOW()
      WHERE is_deleted IS NOT TRUE
        AND name ~* '^Topic\\s*:\\s*'
        AND name !~* '^Topic\\s*\\d'
      RETURNING id
    `);
    console.log(`✔ Cleaned ${topicColonRes.rowCount} "Topic: <Name>" topics.`);

    // 4. Clean 76 "Chapter X:" embedded as topic name
    console.log('\n--- 4. Cleaning "Chapter X:" embedded as Topic Names ---');
    const chapterInTopicRes = await client.query(`
      UPDATE subject_topics
      SET name = REGEXP_REPLACE(name, '^Chapter\\s*\\d+\\s*:\\s*', '', 'i'), updated_at = NOW()
      WHERE is_deleted IS NOT TRUE
        AND name ~* '^Chapter\\s*\\d+\\s*:\\s*'
      RETURNING id
    `);
    console.log(`✔ Cleaned ${chapterInTopicRes.rowCount} topics with embedded "Chapter X:".`);

    // 5. Clean malformed subtopics: "Topic: ...", "Subtopic X: Subtopic: ...", "Subtopic: ..."
    console.log('\n--- 5. Cleaning Malformed Subtopics ("Topic: ...", "Subtopic: ...") ---');
    const subtopicRes = await client.query(`
      UPDATE subject_subtopics
      SET name = REGEXP_REPLACE(
        REGEXP_REPLACE(name, '^Topic\\s*:\\s*', '', 'i'),
        '^Subtopic\\s*\\d*\\s*:\\s*Subtopic\\s*:\\s*', '', 'i'
      ), updated_at = NOW()
      WHERE is_deleted IS NOT TRUE
        AND (
          name ~* '^Topic\\s*:\\s*'
          OR name ~* '^Subtopic\\s*\\d*\\s*:\\s*Subtopic\\s*:'
        )
      RETURNING id
    `);
    console.log(`✔ Cleaned ${subtopicRes.rowCount} malformed subtopics.`);

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log('\nDRY-RUN COMPLETE: Changes rolled back cleanly.');
    } else {
      await client.query('COMMIT');
      console.log('\n✔ COMMIT SUCCESSFUL: All malformed prefixes cleaned and chapters upgraded.');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during clean-up (rolled back):', err);
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
