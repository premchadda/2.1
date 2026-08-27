import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Scan Frontend Pages for Hardcoded Content
function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build' || item === '__tests__') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (/\.(jsx?|tsx?)$/i.test(item)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const frontendPages = scanDir(path.join(rootDir, 'apps', 'frontend', 'src', 'pages'));
const frontendHardcoded = [];

const suspiciousPatterns = [
  /mockData/i,
  /dummyData/i,
  /fakeData/i,
  /sampleQuestions/i,
  /lorem\s+ipsum/i,
  /\[\s*\{\s*id:\s*['"]?1['"]?,\s*title:\s*['"]Sample/i,
  /const\s+DUMMY_/i,
  /const\s+MOCK_/i
];

for (const fp of frontendPages) {
  const content = fs.readFileSync(fp, 'utf-8');
  const rel = path.relative(rootDir, fp).replace(/\\/g, '/');

  suspiciousPatterns.forEach(pat => {
    const m = content.match(pat);
    if (m) {
      frontendHardcoded.push({ file: rel, match: m[0] });
    }
  });
}

console.log('===============================================================');
console.log('1. FRONTEND PAGES HARDCODED SCAN:');
console.log('===============================================================');
if (frontendHardcoded.length === 0) {
  console.log('✅ ZERO mock/dummy/lorem data patterns found in frontend pages!');
} else {
  console.log('⚠️ Suspicious patterns found:', frontendHardcoded);
}

// 2. Query Live Backend Public Stats API
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', err => reject(err));
  });
}

(async () => {
  console.log('\n===============================================================');
  console.log('2. LIVE API RESPONSE VERIFICATION:');
  console.log('===============================================================');
  try {
    const stats = await fetchJson('http://localhost:5001/api/public-stats');
    console.log('GET /api/public-stats Response:');
    console.log(JSON.stringify(stats, null, 2));

    const testimonials = await fetchJson('http://localhost:5001/api/testimonials');
    console.log('\nGET /api/testimonials Response:');
    console.log(JSON.stringify(testimonials, null, 2));

  } catch (err) {
    console.log('API request error (is dev server running?):', err.message);
  }

  // 3. Database Check
  console.log('\n===============================================================');
  console.log('3. DATABASE INTEGRITY RECHECK:');
  console.log('===============================================================');
  const { fileURLToPath } = await import('url');
  const pg = (await import('pg')).default;
  const envContent = fs.readFileSync(path.join(rootDir, 'apps', 'backend', '.env'), 'utf-8');
  let dbUrl = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const platformStats = await client.query('SELECT id, label, value FROM platform_stats ORDER BY id;');
  console.log('Database platform_stats:');
  console.table(platformStats.rows);

  const testimonialsCount = await client.query('SELECT COUNT(*)::int as c FROM testimonials;');
  console.log(`Database unique testimonials count: ${testimonialsCount.rows[0].c}`);

  const activeUsers = await client.query('SELECT COUNT(*)::int as active_users FROM users WHERE is_active = true;');
  console.log(`Active real users count: ${activeUsers.rows[0].active_users}`);

  await client.end();
})();
