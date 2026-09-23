import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// The 20 duplicate / phantom topics identified in the audit
const PHANTOM_TOPIC_IDS = [
  // Reasoning duplicate topics (duplicates of active topics in same chapter)
  1922, // Topic 6: Word Analogy (duplicate of 24)
  1923, // Topic 7: Number Analogy (duplicate of 25)
  1925, // Topic 9: Figure Analogy (duplicate of 27)
  1927, // Topic 5: Word Classification (duplicate of 31)
  1928, // Topic 6: Number Classification (duplicate of 32)
  1931, // Topic 5: Number Series (duplicate of 28)
  1935, // Topic 5: Letter Coding (duplicate of 34)
  1936, // Topic 6: Number Coding (duplicate of 35)
  1942, // Topic 6: Coded Relations (duplicate of 39)
  1966, // Topic 4: Linear Arrangement (duplicate of 46)
  1967, // Topic 5: Circular Arrangement (duplicate of 47)
  // Quant duplicate topics (duplicates of active topics in same chapter)
  1875, // Topic 19: Divisibility Rules (duplicate of 216)
  1879, // Topic 5: Basic Percentage (duplicate of 222)
  1881, // Topic 7: Successive Percentage (duplicate of 223)
  1896, // Topic 5: Trains (duplicate of 250)
  1903, // Topic 9: Polynomials (duplicate of 273)
  1909, // Topic 10: Quadrilaterals (duplicate of 278)
  1914, // Topic 7: Trigonometric Ratios (duplicate of 290)
  // Current Affairs duplicates (in Chapter 912)
  3048, // General Knowledge (GK) (duplicate of 3004)
  3049  // Topic 10: Current Affairs (duplicate of 3005)
];

// Subtopics of 1931 that are valuable descriptive subtopics to reparent to Topic 28 (Number Series)
const REPARENT_SUBTOPIC_IDS = [1069, 1070, 1071];

// The boilerplate dummy subtopics to soft-delete
const BOILERPLATE_SUBTOPIC_IDS = [
  2487, 2489, 2650, 2702, 2720, 2770, 2814, 2856, 2916, 2967,
  2982, 2986, 3018, 3107, 3261, 3279, 3336, 3399, 3473
];

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting Duplicate Topic Cleanup (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE TRANSACTION'})...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Pre-check: Ensure NO questions are attached to topics to be deleted
    const topicQCheck = await client.query(`
      SELECT topic_id, COUNT(*) as cnt
      FROM questions
      WHERE topic_id = ANY($1)
      GROUP BY topic_id
    `, [PHANTOM_TOPIC_IDS]);

    if (topicQCheck.rows.length > 0) {
      throw new Error(`ABORTING: Questions found on phantom topics! ${JSON.stringify(topicQCheck.rows)}`);
    }
    console.log('✔ Verified: 0 questions attached to phantom topics.');

    // 2. Pre-check: Ensure NO questions are attached to boilerplate subtopics
    const subtopicQCheck = await client.query(`
      SELECT subtopic_id, COUNT(*) as cnt
      FROM questions
      WHERE subtopic_id = ANY($1)
      GROUP BY subtopic_id
    `, [BOILERPLATE_SUBTOPIC_IDS]);

    if (subtopicQCheck.rows.length > 0) {
      throw new Error(`ABORTING: Questions found on boilerplate subtopics! ${JSON.stringify(subtopicQCheck.rows)}`);
    }
    console.log('✔ Verified: 0 questions attached to boilerplate subtopics.');

    // 3. Reparent valuable subtopics (1069, 1070, 1071) from Topic 1931 to Topic 28
    const reparentRes = await client.query(`
      UPDATE subject_subtopics
      SET topic_id = 28, updated_at = NOW()
      WHERE id = ANY($1)
      RETURNING id, name, slug, topic_id
    `, [REPARENT_SUBTOPIC_IDS]);
    console.log(`✔ Reparented ${reparentRes.rowCount} subtopics to Topic 28 (Number Series):`);
    for (const r of reparentRes.rows) {
      console.log(`   - Subtopic ID ${r.id}: "${r.name}" -> Now under Topic ID ${r.topic_id}`);
    }

    // 4. Soft-delete boilerplate subtopics
    const subtopicDeleteRes = await client.query(`
      UPDATE subject_subtopics
      SET 
        is_active = FALSE,
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_reason = 'duplicate_phantom_subtopic_cleanup',
        updated_at = NOW()
      WHERE id = ANY($1)
      RETURNING id, name
    `, [BOILERPLATE_SUBTOPIC_IDS]);
    console.log(`✔ Soft-deleted ${subtopicDeleteRes.rowCount} boilerplate dummy subtopics.`);

    // 5. Soft-delete phantom duplicate topics
    const topicDeleteRes = await client.query(`
      UPDATE subject_topics
      SET 
        is_active = FALSE,
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_reason = 'duplicate_phantom_topic_cleanup',
        updated_at = NOW()
      WHERE id = ANY($1)
      RETURNING id, name, chapter_id
    `, [PHANTOM_TOPIC_IDS]);
    console.log(`✔ Soft-deleted ${topicDeleteRes.rowCount} duplicate phantom topics:`);
    for (const r of topicDeleteRes.rows) {
      console.log(`   - Topic ID ${r.id}: "${r.name}" in Chapter ${r.chapter_id}`);
    }

    // 6. Post-validation check
    const activeTopicsCount = await client.query(`
      SELECT COUNT(*) as cnt FROM subject_topics WHERE is_deleted IS NOT TRUE
    `);
    const activeSubtopicsCount = await client.query(`
      SELECT COUNT(*) as cnt FROM subject_subtopics WHERE is_deleted IS NOT TRUE
    `);
    console.log(`\nPost-Cleanup Active Taxonomy Counts:`);
    console.log(`   - Active Topics: ${activeTopicsCount.rows[0].cnt}`);
    console.log(`   - Active Subtopics: ${activeSubtopicsCount.rows[0].cnt}`);

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log('\nDRY-RUN COMPLETE: Changes rolled back cleanly.');
    } else {
      await client.query('COMMIT');
      console.log('\n✔ COMMIT SUCCESSFUL: All duplicate topics and boilerplate subtopics cleaned up.');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during cleanup (rolled back):', err);
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
