const { Pool } = require('pg');
require('dotenv').config({ path: 'apps/backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    // 1. Query exams related to SSC CGL
    const examRes = await pool.query(`
      SELECT id, name, slug, title
      FROM exams 
      WHERE slug ILIKE '%cgl%' OR name ILIKE '%cgl%' OR title ILIKE '%cgl%'
    `);
    console.log('\n=== SSC CGL Exams in Database ===');
    console.table(examRes.rows);

    // 2. Query test_sections related to SSC CGL or general Tier-I / Tier-II stages
    const sectionsRes = await pool.query(`
      SELECT 
        ts.id, 
        ts.name, 
        ts.exam_stage, 
        ts.paper, 
        ts.session, 
        ts.section_code, 
        ts.expected_questions, 
        ts.total_marks, 
        ts.time_limit / 60 AS duration_min, 
        ts.marks_per_question, 
        ts.negative_marks,
        ts.exam_id,
        e.name AS exam_name
      FROM test_sections ts
      LEFT JOIN exams e ON ts.exam_id::text = e.id::text OR ts.exam_id::text = e.slug
      ORDER BY ts.exam_stage NULLS LAST, ts.section_code NULLS LAST, ts.id ASC
    `);

    console.log(`\n=== All Test Sections in Database (${sectionsRes.rows.length} total) ===`);
    console.table(sectionsRes.rows);

    // 3. Query section presets hardcoded for SSC CGL in SECTION_PRESETS
    console.log('\n=== SSC CGL Preset Schemes in System ===');
    const presets = [
      {
        stage: 'SSC CGL Tier-I',
        sections: [
          { name: 'General Intelligence & Reasoning', questions: 25, marks: 50, duration: '15 min', neg: '-0.50' },
          { name: 'General Awareness', questions: 25, marks: 50, duration: '15 min', neg: '-0.50' },
          { name: 'Quantitative Aptitude', questions: 25, marks: 50, duration: '15 min', neg: '-0.50' },
          { name: 'English Comprehension', questions: 25, marks: 50, duration: '15 min', neg: '-0.50' },
        ]
      },
      {
        stage: 'SSC CGL Tier-II Paper-I (Session-I & Session-II)',
        sections: [
          { name: 'Mathematical Abilities (Section I-A)', questions: 30, marks: 90, duration: '60 min', neg: '-1.00' },
          { name: 'Reasoning & General Intelligence (Section I-B)', questions: 30, marks: 90, duration: '60 min', neg: '-1.00' },
          { name: 'English Language & Comprehension (Section II-A)', questions: 45, marks: 135, duration: '60 min', neg: '-1.00' },
          { name: 'General Awareness (Section II-B)', questions: 25, marks: 75, duration: '60 min', neg: '-1.00' },
          { name: 'Computer Knowledge Test (Section III - Qualifying)', questions: 20, marks: 60, duration: '15 min', neg: '-1.00' },
          { name: 'Data Entry Speed Test (DEST) (Section IV - Qualifying)', questions: 0, marks: 0, duration: '15 min', neg: '0' },
        ]
      },
      {
        stage: 'SSC CGL Tier-II Paper-II (Statistics)',
        sections: [
          { name: 'Statistics (Paper-II)', questions: 100, marks: 200, duration: '120 min', neg: '-0.50' }
        ]
      }
    ];

    presets.forEach(p => {
      console.log(`\n📌 ${p.stage}:`);
      console.table(p.sections);
    });

  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await pool.end();
  }
}

main();
