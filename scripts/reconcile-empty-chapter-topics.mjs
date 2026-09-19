import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../apps/backend/.env');
dotenv.config({ path: envPath });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/chapter\s*\d+\s*:\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTitle(text) {
  return text.replace(/chapter\s*\d+\s*:\s*/i, '').trim();
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- RECONCILING EMPTY CHAPTER TOPICS ---');

    // 1. Fetch chapters with 0 topics
    const emptyChaptersRes = await client.query(`
      SELECT sc.id, sc.title, sc.subject_id, s.name as subject_name
      FROM subject_chapters sc
      LEFT JOIN subject_topics st ON st.chapter_id = sc.id
      LEFT JOIN subjects s ON sc.subject_id = s.id
      WHERE st.id IS NULL
      ORDER BY sc.id;
    `);

    console.log(`Found ${emptyChaptersRes.rows.length} chapters with 0 topics.`);

    const createdTopics = {};

    for (const ch of emptyChaptersRes.rows) {
      const topicName = cleanTitle(ch.title);
      let topicSlug = slugify(ch.title);
      
      // Ensure unique slug
      const existingSlug = await client.query('SELECT id FROM subject_topics WHERE slug = $1', [topicSlug]);
      if (existingSlug.rows.length > 0) {
        topicSlug = `${topicSlug}-${ch.id}`;
      }

      const insertRes = await client.query(`
        INSERT INTO subject_topics (
          name, slug, subject, chapter_id, subject_id, is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, true, NOW(), NOW()
        ) RETURNING id, name, chapter_id;
      `, [topicName, topicSlug, ch.subject_name, ch.id, ch.subject_id]);

      createdTopics[ch.id] = insertRes.rows[0];
      console.log(`Created topic ID ${insertRes.rows[0].id} ("${topicName}") for Chapter ${ch.id} (${ch.title})`);
    }

    // 2. Re-assign questions for Chapter 63 whose topic_id is currently 1841
    if (createdTopics[63]) {
      const targetTopicId = createdTopics[63].id;
      const updateRes = await client.query(`
        UPDATE questions 
        SET topic_id = $1, updated_at = NOW()
        WHERE chapter_id = 63 AND topic_id != $1;
      `, [targetTopicId]);

      console.log(`Updated ${updateRes.rowCount} questions in Chapter 63 to topic_id ${targetTopicId} ("${createdTopics[63].name}").`);
    }

    await client.query('COMMIT');
    console.log('✅ Successfully committed chapter topic reconciliation.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error reconciling chapter topics:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
