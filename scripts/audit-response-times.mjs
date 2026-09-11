import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../apps/backend/.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

async function measureQuery(client, name, sql, params = []) {
  // Cold run (first execution)
  const coldStart = performance.now();
  const coldRes = await client.query(sql, params);
  const coldTime = performance.now() - coldStart;

  // Warm run (second execution)
  const warmStart = performance.now();
  const warmRes = await client.query(sql, params);
  const warmTime = performance.now() - warmStart;

  // Get query plan
  let scanType = 'N/A';
  let planCost = 'N/A';
  try {
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const explainRes = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
      const plan = explainRes.rows[0]['QUERY PLAN'][0]['Plan'];
      scanType = plan['Node Type'] || 'Unknown';
      planCost = plan['Total Cost'] || 'Unknown';
    }
  } catch (e) {
    scanType = 'Plan Error';
  }

  return {
    name,
    coldMs: parseFloat(coldTime.toFixed(1)),
    warmMs: parseFloat(warmTime.toFixed(1)),
    rowCount: coldRes.rowCount,
    scanType,
    planCost,
  };
}

async function runFullAudit() {
  console.log('================================================================================');
  console.log('⚡ TRSTPREP COMPREHENSIVE BACKEND & DATABASE RESPONSE TIME AUDIT');
  console.log('================================================================================');
  console.log(`Database Host: ${connectionString.split('@')[1]?.split('/')[0] || 'Remote Postgres'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('--------------------------------------------------------------------------------\n');

  const client = await pool.connect();

  try {
    // 1. Measure Raw Network Round-Trip Time
    console.log('📡 1. NETWORK & DB ROUND-TRIP LATENCY (Baseline)');
    const pings = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await client.query('SELECT 1');
      pings.push(performance.now() - t0);
    }
    const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
    console.log(`   Average Network RTT to DB: ${avgPing.toFixed(1)} ms (Min: ${Math.min(...pings).toFixed(1)}ms, Max: ${Math.max(...pings).toFixed(1)}ms)`);
    console.log('   *Insight: Any sequential waterfall of N queries incurs at least N × ~100ms baseline latency.\n');

    // 2. Define Query Test Suite across all pages and sections
    const suites = [
      {
        section: '🔑 Authentication & Session Verification',
        queries: [
          {
            name: 'User Lookup by ID (protect middleware)',
            sql: 'SELECT id, email, role, is_active, is_pro_user, name, avatar FROM users WHERE id = $1 LIMIT 1',
            params: [1],
          },
          {
            name: 'User Lookup by Email (login endpoint)',
            sql: 'SELECT id, email, password, role, is_active FROM users WHERE email = $1 LIMIT 1',
            params: ['admin@trstprep.com'],
          },
          {
            name: 'Active Session Check (user_sessions)',
            sql: 'SELECT id, is_active, created_at, last_active, last_activity FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
            params: [1],
          },
          {
            name: 'Unified Enrollments Summary (/api/auth/me)',
            sql: 'SELECT series_id, exam_id, study_material_id FROM enrollments WHERE user_id = $1 AND is_active = true',
            params: [1],
          },
          {
            name: 'Attempted Tests Payload (/api/auth/me)',
            sql: 'SELECT series_id, test_id, is_reattempt, status FROM attempts WHERE user_id = $1 AND is_completed = true',
            params: [1],
          },
        ],
      },
      {
        section: '🏠 Public Home & Landing Pages',
        queries: [
          {
            name: 'Public Platform Statistics',
            sql: `SELECT 
                    (SELECT COUNT(*) FROM tests WHERE is_active = true) as tests_count,
                    (SELECT COUNT(*) FROM questions WHERE is_active = true) as questions_count,
                    (SELECT COUNT(*) FROM attempts WHERE is_completed = true) as attempts_count,
                    (SELECT COUNT(*) FROM users WHERE is_active = true) as users_count`,
            params: [],
          },
          {
            name: 'Featured Exam Categories',
            sql: 'SELECT id, category_id, label, icon, slug, "order" FROM exam_categories WHERE is_active = true ORDER BY "order" ASC LIMIT 10',
            params: [],
          },
          {
            name: 'Active Exams List for Home',
            sql: 'SELECT id, category_id, exam_id, title, full_name, description FROM exams WHERE is_active = true ORDER BY id DESC LIMIT 12',
            params: [],
          },
          {
            name: 'Site Banners & Announcements',
            sql: 'SELECT id, title, subtitle, image_url, link, position, is_active FROM banners WHERE is_active = true LIMIT 5',
            params: [],
          },
          {
            name: 'Frequently Asked Questions (FAQ)',
            sql: 'SELECT id, question, answer, category, display_order FROM faqs WHERE is_active = true ORDER BY display_order ASC LIMIT 20',
            params: [],
          },
        ],
      },
      {
        section: '🎓 Exams, Stages & Taxonomies',
        queries: [
          {
            name: 'All Exam Categories with Meta',
            sql: 'SELECT id, category_id, label, icon, slug, "order", created_at FROM exam_categories WHERE is_active = true ORDER BY "order" ASC',
            params: [],
          },
          {
            name: 'Exam Details with Metadata',
            sql: 'SELECT id, category_id, exam_id, title, full_name, description, syllabus FROM exams WHERE is_active = true LIMIT 10',
            params: [],
          },
          {
            name: 'Exam Stages Hierarchy',
            sql: 'SELECT id, name, slug, description, icon, "order" FROM stages WHERE is_active = true ORDER BY "order" ASC LIMIT 25',
            params: [],
          },
          {
            name: 'Test Categories & Taxonomy Junction',
            sql: 'SELECT tc.id, tc.name, tc.slug, COUNT(tcs.test_series_id) as series_count FROM test_categories tc LEFT JOIN test_category_series tcs ON tcs.test_category_id = tc.id WHERE tc.is_active = true GROUP BY tc.id, tc.name, tc.slug ORDER BY tc.id ASC LIMIT 20',
            params: [],
          },
        ],
      },
      {
        section: '📚 Test Series & Tests Catalog',
        queries: [
          {
            name: 'Test Series Catalog with Counts',
            sql: 'SELECT id, title, slug, exam_id, total_tests, free_tests, price, is_active FROM test_series WHERE is_active = true ORDER BY id DESC LIMIT 15',
            params: [],
          },
          {
            name: 'Full Tests Listing with Section/Category Filters',
            sql: 'SELECT id, title, slug, series_id, duration, total_marks, total_questions, category, sub_category, type, status FROM tests WHERE is_active = true AND status = $1 ORDER BY id DESC LIMIT 20',
            params: ['published'],
          },
          {
            name: 'Previous Year Papers (PYP Tests)',
            sql: "SELECT id, title, slug, year, shift, total_marks, duration FROM tests WHERE (type ILIKE '%pyp%' OR title ILIKE '%pyp%' OR title ILIKE '%20%') AND is_active = true ORDER BY id DESC LIMIT 15",
            params: [],
          },
          {
            name: 'Single Test Details & Section Structure',
            sql: 'SELECT t.id, t.title, t.duration, t.total_marks, t.instructions, ts.id as section_id, ts.name as section_name, ts.total_questions as section_q_count FROM tests t LEFT JOIN test_sections ts ON ts.test_id = t.id WHERE t.id = $1',
            params: [1],
          },
        ],
      },
      {
        section: '📝 Test Engine & Exam Interface',
        queries: [
          {
            name: 'Test Questions Fetch (Exam Interface)',
            sql: 'SELECT q.id, q.question_text, q.options, q.type, q.marks, q.negative_marks, q.section_id FROM test_questions tq JOIN questions q ON q.id = tq.question_id WHERE tq.test_id = $1 ORDER BY tq.order_index ASC LIMIT 100',
            params: [1],
          },
          {
            name: 'Check Existing Ongoing Attempt',
            sql: 'SELECT id, status, start_time, duration FROM attempts WHERE test_id = $1 AND user_id = $2 AND is_completed = false ORDER BY id DESC LIMIT 1',
            params: [1, 1],
          },
          {
            name: 'Student Attempt Result Summary',
            sql: 'SELECT id, test_id, score, total_marks, accuracy, correct, wrong, unattempted, time_spent, submitted_at FROM attempts WHERE id = $1',
            params: [1],
          },
          {
            name: 'Test Leaderboard (Top 20 Performers)',
            sql: 'SELECT a.id, a.user_id, a.score, a.accuracy, a.time_spent, u.name, u.avatar FROM attempts a JOIN users u ON u.id = a.user_id WHERE a.test_id = $1 AND a.is_completed = true ORDER BY a.score DESC, a.time_spent ASC LIMIT 20',
            params: [1],
          },
        ],
      },
      {
        section: '📖 Study Materials & Learning Tree',
        queries: [
          {
            name: 'Subjects List with Hierarchy',
            sql: 'SELECT id, name, slug, icon, color, description FROM subjects WHERE is_active = true ORDER BY id ASC LIMIT 20',
            params: [],
          },
          {
            name: 'Subject Chapters & Topics Cascade',
            sql: 'SELECT sc.id as chapter_id, sc.title as chapter_title, st.id as topic_id, st.name as topic_name FROM subject_chapters sc LEFT JOIN subject_topics st ON st.chapter_id = sc.id WHERE sc.is_active = true ORDER BY sc.id ASC LIMIT 50',
            params: [],
          },
          {
            name: 'Subject Videos / Lectures',
            sql: 'SELECT id, title, study_material_id, duration, video_url, is_pro, order_index FROM subject_videos WHERE is_active = true ORDER BY order_index ASC LIMIT 20',
            params: [],
          },
        ],
      },
      {
        section: '🔬 Practice Lab & Spaced Repetition',
        queries: [
          {
            name: 'Practice Questions by Subject/Difficulty',
            sql: 'SELECT id, question_text, options, difficulty, type FROM questions WHERE subject_id = $1 AND is_active = true LIMIT 20',
            params: [1],
          },
          {
            name: 'Smart Revision Queue (Due Cards)',
            sql: 'SELECT id, user_id, question_id, schedule_day, due_at, status FROM revision_queue WHERE user_id = $1 AND due_at <= NOW() ORDER BY due_at ASC LIMIT 30',
            params: [1],
          },
          {
            name: 'Wrong Questions Review Queue',
            sql: 'SELECT id, user_id, test_id, question_id, wrong_count, last_seen_at FROM wrong_questions WHERE user_id = $1 ORDER BY wrong_count DESC LIMIT 25',
            params: [1],
          },
        ],
      },
      {
        section: '📊 Student Dashboard',
        queries: [
          {
            name: 'Student Completed Attempts History',
            sql: 'SELECT a.id, a.test_id, t.title as test_title, a.score, a.total_marks, a.accuracy, a.submitted_at FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.user_id = $1 AND a.is_completed = true ORDER BY a.submitted_at DESC LIMIT 10',
            params: [1],
          },
          {
            name: 'User Bookmarks & Saved Items',
            sql: 'SELECT id, user_id, item_type, item_id, notes, created_at FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
            params: [1],
          },
          {
            name: 'User Notifications Feed',
            sql: 'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15',
            params: [1],
          },
        ],
      },
      {
        section: '🛡️ Admin Panel & Management',
        queries: [
          {
            name: 'Admin Users Manager (Paginated + Filtered)',
            sql: 'SELECT id, email, name, role, is_active, is_pro_user, created_at FROM users ORDER BY id DESC LIMIT 25 OFFSET 0',
            params: [],
          },
          {
            name: 'Admin Audit Trail Logs',
            sql: 'SELECT id, user_id, action, resource, ip_address, status, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 25',
            params: [],
          },
          {
            name: 'Admin Realtime Active Sessions',
            sql: 'SELECT s.id, s.user_id, u.email, s.ip_address, s.user_agent, s.last_activity FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.is_active = true ORDER BY s.last_activity DESC LIMIT 25',
            params: [],
          },
          {
            name: 'Admin Deep Analytics (Funnel Aggregate)',
            sql: 'SELECT COUNT(DISTINCT u.id) as total_signups, COUNT(DISTINCT a.user_id) as active_test_takers, COUNT(a.id) as total_tests_submitted FROM users u LEFT JOIN attempts a ON a.user_id = u.id AND a.is_completed = true',
            params: [],
          },
        ],
      },
    ];

    const results = [];

    for (const suite of suites) {
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`📌 ${suite.section}`);
      console.log(`--------------------------------------------------------------------------------`);
      for (const q of suite.queries) {
        try {
          const res = await measureQuery(client, q.name, q.sql, q.params);
          results.push({ section: suite.section, ...res });
          const status = res.warmMs < 120 ? '⚡ FAST' : res.warmMs < 200 ? '⏱️ MODERATE' : '⚠️ SLOW';
          console.log(`  ${status.padEnd(11)} | Cold: ${String(res.coldMs + 'ms').padEnd(8)} | Warm: ${String(res.warmMs + 'ms').padEnd(8)} | Rows: ${String(res.rowCount).padEnd(4)} | Scan: ${res.scanType.padEnd(14)} | ${res.name}`);
        } catch (err) {
          console.log(`  ❌ ERROR     | ${q.name}: ${err.message}`);
          results.push({ section: suite.section, name: q.name, coldMs: 0, warmMs: 0, rowCount: 0, scanType: 'ERROR: ' + err.message });
        }
      }
      console.log('');
    }

    // Summary Statistics
    const validResults = results.filter(r => r.warmMs > 0);
    const avgCold = validResults.reduce((acc, r) => acc + r.coldMs, 0) / validResults.length;
    const avgWarm = validResults.reduce((acc, r) => acc + r.warmMs, 0) / validResults.length;
    const slowQueries = validResults.filter(r => r.warmMs >= 150);

    console.log('================================================================================');
    console.log('📊 AUDIT SUMMARY & BOTTLENECK ANALYSIS');
    console.log('================================================================================');
    console.log(`Total Queries Audited:      ${results.length}`);
    console.log(`Successful Queries:         ${validResults.length} / ${results.length}`);
    console.log(`Average Cold Response Time: ${avgCold.toFixed(1)} ms`);
    console.log(`Average Warm Response Time: ${avgWarm.toFixed(1)} ms`);
    console.log(`Slow Queries (>150ms):      ${slowQueries.length}`);
    if (slowQueries.length > 0) {
      console.log('\nIdentified Slow Queries:');
      slowQueries.forEach(sq => {
        console.log(` - [${sq.warmMs}ms] ${sq.name} (${sq.scanType})`);
      });
    }

    // Save JSON report
    fs.writeFileSync(
      path.join(__dirname, 'db_response_time_audit.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), avgPing, avgCold, avgWarm, results }, null, 2)
    );
    console.log('\n✅ Detailed results exported to scripts/db_response_time_audit.json');

  } finally {
    client.release();
    await pool.end();
  }
}

runFullAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
