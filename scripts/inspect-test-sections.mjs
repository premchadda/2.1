import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const tests = await pool.query(`
    SELECT t.id, t.title, count(q.id) as q_count,
           array_agg(DISTINCT q.section) as sections,
           array_agg(DISTINCT q.subject_id) as subjects
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    GROUP BY t.id, t.title
    ORDER BY t.id
    LIMIT 20;
  `);
  console.log("Sample tests with their sections and subjects:");
  for (const r of tests.rows) {
    console.log(`Test ${r.id}: "${r.title}" (${r.q_count} questions)`);
    console.log(`  Sections:`, r.sections);
    console.log(`  Subject IDs:`, r.subjects);
  }

  // Total tests with questions
  const totalTests = await pool.query(`SELECT COUNT(DISTINCT test_id) FROM questions WHERE test_id IS NOT NULL;`);
  console.log(`\nTotal tests with questions: ${totalTests.rows[0].count}`);

  // Total questions without test_id
  const noTest = await pool.query(`SELECT COUNT(*) FROM questions WHERE test_id IS NULL;`);
  console.log(`Total questions with test_id = NULL: ${noTest.rows[0].count}`);

  await pool.end();
}
main().catch(console.error);
