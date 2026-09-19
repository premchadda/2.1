import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import crypto from 'crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== STEP 2: SEEDING MISSING SUBTOPICS FOR THE 17 TOPICS ===");

  const missingTopics = await pool.query(`
    SELECT t.id, t.name, t.slug, t.chapter_id
    FROM subject_topics t
    LEFT JOIN subject_subtopics st ON st.topic_id = t.id AND (st.is_deleted IS NOT TRUE)
    WHERE st.id IS NULL
    ORDER BY t.id;
  `);

  console.log(`Found ${missingTopics.rows.length} topics without any active subtopics.`);

  for (const t of missingTopics.rows) {
    const subtopicName = `${t.name} (Concepts & Practice)`;
    const subtopicSlug = `${t.slug || t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-concepts-practice`;
    const uuid = crypto.randomUUID();
    const publicId = `stp_${uuid}`;

    const res = await pool.query(`
      INSERT INTO subject_subtopics (
        name, slug, topic_id, stage_ids, order_index, is_active,
        public_id_uuid, _orphaned, is_deleted, created_at, updated_at
      ) VALUES (
        $1, $2, $3, '{}', 1, true,
        $4, false, false, NOW(), NOW()
      )
      RETURNING id, name, topic_id, public_id;
    `, [subtopicName, subtopicSlug, t.id, uuid]);

    console.log(`Created Subtopic [${res.rows[0].id}] "${res.rows[0].name}" (public_id: ${res.rows[0].public_id}) for Topic [${t.id}]`);
  }

  // Verify
  const recheck = await pool.query(`
    SELECT COUNT(*) as remaining_empty
    FROM subject_topics t
    LEFT JOIN subject_subtopics st ON st.topic_id = t.id AND (st.is_deleted IS NOT TRUE)
    WHERE st.id IS NULL;
  `);
  console.log(`Remaining topics with 0 subtopics: ${recheck.rows[0].remaining_empty}`);

  await pool.end();
}

main().catch(console.error);
