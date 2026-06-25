import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'backend', '.env') })

const dbUrl = process.env.DATABASE_URL
const client = new pg.Client({ 
  connectionString: dbUrl,
  ssl: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : { rejectUnauthorized: true }
})
await client.connect()

console.log('='.repeat(80))
console.log('FULL SUBJECT TAXONOMY FROM DATABASE')
console.log('='.repeat(80))
console.log()

// 1. SUBJECTS TABLE SCHEMA
console.log('### 1. SUBJECTS TABLE SCHEMA')
console.log()
const schemaResult = await client.query(`
  SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
  FROM information_schema.columns
  WHERE table_name = 'subjects'
  ORDER BY ordinal_position
`)

console.log('| Column | Type | Nullable | Default | Max Length |')
console.log('|--------|------|----------|---------|------------|')
for (const r of schemaResult.rows) {
  const maxLen = r.character_maximum_length ? `(${r.character_maximum_length})` : ''
  console.log(`| ${r.column_name} | ${r.data_type}${maxLen} | ${r.is_nullable} | ${r.column_default || '-'} | - |`)
}
console.log()

// 2. SUBJECTS WITH PARENT HIERARCHY
console.log('### 2. ALL SUBJECTS (with parent hierarchy)')
console.log()
const subjectsResult = await client.query(`
  SELECT 
    s.id,
    s.name,
    s.slug,
    s.parent_id,
    p.name as parent_name,
    s.description,
    s.is_active
  FROM subjects s
  LEFT JOIN subjects p ON s.parent_id = p.id
  ORDER BY 
    CASE WHEN s.parent_id IS NULL THEN 0 ELSE 1 END,
    s.parent_id NULLS FIRST,
    s.id
`)

console.log('| ID | Name | Slug | Parent ID | Parent Name | Description | Active |')
console.log('|----|------|------|-----------|-------------|-------------|--------|')
for (const r of subjectsResult.rows) {
  const desc = r.description ? r.description.substring(0, 40) : '-'
  console.log(`| ${r.id} | ${r.name} | ${r.slug} | ${r.parent_id || '-'} | ${r.parent_name || '-'} | ${desc} | ${r.is_active} |`)
}
console.log()

// 3. UNITS TABLE
console.log('### 3. UNITS (formerly subject_parts) TABLE')
console.log()
try {
  const unitsResult = await client.query(`
    SELECT 
      u.id,
      u.name,
      u.subject_id,
      s.name as subject_name,
      u.parent_id as part_id,
      u.is_active
    FROM units u
    LEFT JOIN subjects s ON u.subject_id = s.id
    ORDER BY u.subject_id, u.id
  `)
  
  console.log('| Unit ID | Name | Subject ID | Subject Name | Part ID | Active |')
  console.log('|---------|------|------------|--------------|---------|--------|')
  for (const r of unitsResult.rows) {
    console.log(`| ${r.id} | ${r.name} | ${r.subject_id} | ${r.subject_name} | ${r.part_id || '-'} | ${r.is_active} |`)
  }
  console.log()
} catch (e) {
  console.log('Units table not found or error:', e.message)
  console.log()
}

// 4. CHAPTERS TABLE
console.log('### 4. CHAPTERS TABLE (sample - first 20)')
console.log()
try {
  const chaptersResult = await client.query(`
    SELECT 
      c.id,
      c.title,
      c.subject_id,
      s.name as subject_name,
      c.unit_id,
      u.name as unit_name
    FROM chapters c
    LEFT JOIN subjects s ON c.subject_id = s.id
    LEFT JOIN units u ON c.unit_id = u.id
    WHERE c.is_active = true OR c.is_active IS NULL
    ORDER BY c.subject_id, c.unit_id, c.id
    LIMIT 20
  `)
  
  console.log('| Chapter ID | Title | Subject ID | Subject Name | Unit ID | Unit Name |')
  console.log('|------------|-------|------------|--------------|---------|-----------|')
  for (const r of chaptersResult.rows) {
    const title = r.title ? r.title.substring(0, 35) : '-'
    console.log(`| ${r.id} | ${title} | ${r.subject_id || '-'} | ${r.subject_name || '-'} | ${r.unit_id || '-'} | ${r.unit_name || '-'} |`)
  }
  console.log()
} catch (e) {
  console.log('Chapters table error:', e.message)
  console.log()
}

// 5. TOPICS TABLE
console.log('### 5. TOPICS TABLE (sample - first 20)')
console.log()
try {
  const topicsResult = await client.query(`
    SELECT 
      t.id,
      t.name,
      t.subject,
      t.parent_topic_id,
      t.is_active
    FROM topics t
    WHERE t.is_active = true OR t.is_active IS NULL
    ORDER BY t.subject, t.id
    LIMIT 20
  `)
  
  console.log('| Topic ID | Name | Subject | Parent Topic ID | Active |')
  console.log('|----------|------|---------|-----------------|--------|')
  for (const r of topicsResult.rows) {
    const name = r.name ? r.name.substring(0, 35) : '-'
    console.log(`| ${r.id} | ${name} | ${r.subject || '-'} | ${r.parent_topic_id || '-'} | ${r.is_active} |`)
  }
  console.log()
} catch (e) {
  console.log('Topics table error:', e.message)
  console.log()
}

// 6. HIERARCHY TREE
console.log('### 6. HIERARCHY TREE (Subjects -> Units -> Chapters)')
console.log()
const treeResult = await client.query(`
  SELECT 
    s.id as subject_id,
    s.name as subject_name,
    s.parent_id,
    p.name as parent_name,
    u.id as unit_id,
    u.name as unit_name,
    c.id as chapter_id,
    c.title as chapter_title
  FROM subjects s
  LEFT JOIN subjects p ON s.parent_id = p.id
  LEFT JOIN units u ON u.subject_id = s.id
  LEFT JOIN chapters c ON c.subject_id = s.id AND (c.unit_id = u.id OR (c.unit_id IS NULL AND u.id IS NULL))
  ORDER BY 
    CASE WHEN s.parent_id IS NULL THEN 0 ELSE 1 END,
    s.parent_id NULLS FIRST,
    s.id,
    u.id,
    c.id
`)

let lastSubject = null
let lastUnit = null
for (const r of treeResult.rows) {
  const subjectKey = `${r.subject_id}-${r.parent_id}`
  if (subjectKey !== lastSubject) {
    lastSubject = subjectKey
    const prefix = r.parent_id ? '  └── ' : ''
    console.log(`${prefix}Subject [${r.subject_id}]: ${r.subject_name}${r.parent_name ? ` (under ${r.parent_name})` : ''}`)
    lastUnit = null
  }
  
  if (r.unit_id && r.unit_id !== lastUnit) {
    lastUnit = r.unit_id
    console.log(`    Unit [${r.unit_id}]: ${r.unit_name}`)
  }
  
  if (r.chapter_id) {
    console.log(`      Chapter [${r.chapter_id}]: ${r.chapter_title}`)
  }
}
console.log()

// 7. COUNT STATISTICS
console.log('### 7. STATISTICS')
console.log()
const statsResult = await client.query(`
  SELECT 
    (SELECT COUNT(*) FROM subjects WHERE is_active = true) as total_subjects,
    (SELECT COUNT(*) FROM subjects WHERE is_active = true AND parent_id IS NULL) as standalone_subjects,
    (SELECT COUNT(*) FROM subjects WHERE is_active = true AND parent_id IS NOT NULL) as child_subjects,
    (SELECT COUNT(*) FROM units WHERE is_active = true) as total_units,
    (SELECT COUNT(*) FROM chapters WHERE is_active = true OR is_active IS NULL) as total_chapters,
    (SELECT COUNT(*) FROM topics WHERE is_active = true OR is_active IS NULL) as total_topics
`)

const stats = statsResult.rows[0]
console.log(`Total Subjects: ${stats.total_subjects}`)
console.log(`  - Standalone (parent_id = NULL): ${stats.standalone_subjects}`)
console.log(`  - Child (parent_id != NULL): ${stats.child_subjects}`)
console.log(`Total Units: ${stats.total_units}`)
console.log(`Total Chapters: ${stats.total_chapters}`)
console.log(`Total Topics: ${stats.total_topics}`)
console.log()

await client.end()
