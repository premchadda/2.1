import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, 'apps', 'backend', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

(async () => {
  console.log('Connecting to PostgreSQL to backfill missing fields...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    await client.query('BEGIN;');

    // 1. Backfill exams table
    console.log('--- 1. Backfilling exams table (slugs & descriptions) ---');
    const examUpdates = [
      { id: 2, slug: 'ssc-chsl' },
      { id: 3, slug: 'ssc-mts' },
      { id: 4, slug: 'ssc-gd-constable' },
      { id: 5, slug: 'ssc-stenographer', desc: 'SSC Stenographer exam recruits Grade C and Grade D stenographers in various central government ministries and departments.' },
      { id: 6, slug: 'ssc-cpo', desc: 'SSC CPO recruits Sub-Inspectors (SI) in Delhi Police, CAPFs, and Assistant Sub-Inspectors in CISF.' },
      { id: 7, slug: 'ssc-je', desc: 'SSC Junior Engineer recruits Civil, Mechanical, and Electrical engineers for government engineering departments.' },
      { id: 8, slug: 'ssc-selection-post', desc: 'SSC Selection Post recruitment for Matriculation, Higher Secondary, and Graduation level specialized posts.' },
      { id: 22, slug: 'rrb-group-d' },
      { id: 23, slug: 'rrb-alp' },
      { id: 24, slug: 'rrb-je', desc: 'RRB Junior Engineer recruits engineers for technical cadres across Indian Railways.' },
      { id: 25, slug: 'rrb-technician', desc: 'RRB Technician recruitment for various technical grades across railway zones.' }
    ];

    for (const eu of examUpdates) {
      if (eu.desc) {
        await client.query(`UPDATE exams SET slug = $1, description = COALESCE(description, $2) WHERE id = $3;`, [eu.slug, eu.desc, eu.id]);
      } else {
        await client.query(`UPDATE exams SET slug = $1 WHERE id = $2;`, [eu.slug, eu.id]);
      }
    }
    console.log(`Updated slugs and descriptions for ${examUpdates.length} exams.`);

    // 2. Backfill test_series table
    console.log('--- 2. Backfilling test_series metadata ---');
    await client.query(`
      UPDATE test_series 
      SET tags = ARRAY['ssc', 'cgl', 'tier-1', 'tier-2', 'mock', 'pyp', '2026'] 
      WHERE id = 1 AND (tags IS NULL OR array_length(tags, 1) = 0);
    `);
    await client.query(`
      UPDATE test_series 
      SET colour_hex = '10b981' 
      WHERE id = 4 AND (colour_hex IS NULL OR colour_hex = '');
    `);
    console.log('Test series metadata backfilled.');

    // 3. Backfill tests table
    console.log('--- 3. Backfilling tests missing languages, instructions, and configs ---');
    const testsLangRes = await client.query(`
      UPDATE tests 
      SET languages = '["English", "Hindi"]'::jsonb 
      WHERE languages IS NULL;
    `);
    console.log(`Updated languages on ${testsLangRes.rowCount} tests.`);

    const testsInstRes = await client.query(`
      UPDATE tests 
      SET instructions = '1. Total duration of the examination is displayed on the screen.\n2. The clock will be set at the server.\n3. Question palette displays question status.\n4. You can navigate between sections freely unless sectional timing applies.' 
      WHERE instructions IS NULL OR TRIM(instructions) = '';
    `);
    console.log(`Updated instructions on ${testsInstRes.rowCount} tests.`);

    await client.query(`
      UPDATE tests 
      SET timing_config = '{"hasSectionalTiming": true}'::jsonb 
      WHERE timing_config IS NULL;
    `);
    await client.query(`
      UPDATE tests 
      SET attempt_rules = '{"maxAttempts": 10, "allowReview": true}'::jsonb 
      WHERE attempt_rules IS NULL;
    `);

    // 4. Backfill test_sections subject_id mapping
    console.log('--- 4. Backfilling test_sections subject_id mapping ---');
    const secMappings = [
      { names: ['General Intelligence & Reasoning', 'Reasoning', 'Logical Reasoning', 'General Intelligence'], subject_id: 1 },
      { names: ['Quantitative Aptitude', 'Mathematics', 'Math', 'Maths', 'Arithmetic'], subject_id: 2 },
      { names: ['English Language', 'English', 'English Comprehension'], subject_id: 3 },
      { names: ['General Awareness', 'General Knowledge', 'GK', 'General Studies', 'Static GK'], subject_id: 11 },
      { names: ['General Science', 'Physics', 'Chemistry', 'Biology'], subject_id: 8 },
      { names: ['Computer Knowledge', 'Computer Awareness', 'Computer'], subject_id: 13 },
      { names: ['Statistics', 'Stat'], subject_id: 18 }
    ];

    for (const sm of secMappings) {
      const res = await client.query(`
        UPDATE test_sections 
        SET subject_id = $1 
        WHERE subject_id IS NULL 
          AND LOWER(TRIM(name)) = ANY($2);
      `, [sm.subject_id, sm.names.map(n => n.toLowerCase())]);
      console.log(`Mapped subject_id ${sm.subject_id} for sections: ${res.rowCount} rows updated.`);
    }

    await client.query('COMMIT;');
    console.log('\n=== ALL POSSIBLE FIELDS SUCCESSFULLY BACKFILLED AND COMMITTED! ===');

  } catch (err) {
    console.error('Backfill error:', err);
    try { await client.query('ROLLBACK;'); } catch (e) {}
    process.exit(1);
  } finally {
    await client.end();
  }
})();
