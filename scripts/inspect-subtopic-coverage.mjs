import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("Checking subtopics for Topic 9 (Analogy):");
  const t9 = await pool.query(`SELECT id, name, topic_id FROM subject_subtopics WHERE topic_id = 9;`);
  console.log("Subtopics for topic 9:", t9.rows);

  // What topics have subtopics vs what topics don't?
  const topicsWithSubs = await pool.query(`
    SELECT COUNT(DISTINCT topic_id) as topics_with_subtopics FROM subject_subtopics;
  `);
  console.log("Distinct topic_ids in subject_subtopics:", topicsWithSubs.rows[0].topics_with_subtopics);

  const totalTopics = await pool.query(`
    SELECT COUNT(*) as total_topics FROM subject_topics;
  `);
  console.log("Total topics in subject_topics:", totalTopics.rows[0].total_topics);

  // How many subtopics per topic?
  const subtopicDistribution = await pool.query(`
    SELECT 
      CASE 
        WHEN sub_count = 0 THEN '0 subtopics'
        WHEN sub_count = 1 THEN '1 subtopic'
        WHEN sub_count = 2 THEN '2 subtopics'
        WHEN sub_count BETWEEN 3 AND 5 THEN '3-5 subtopics'
        ELSE '> 5 subtopics'
      END as range,
      COUNT(*) as topic_count
    FROM (
      SELECT t.id, COUNT(st.id) as sub_count
      FROM subject_topics t
      LEFT JOIN subject_subtopics st ON st.topic_id = t.id
      GROUP BY t.id
    ) dist
    GROUP BY range
    ORDER BY range;
  `);
  console.table(subtopicDistribution.rows);

  await pool.end();
}
main().catch(console.error);
