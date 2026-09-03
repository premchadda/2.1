#!/usr/bin/env node
/**
 * scripts/sync-repo-brain.mjs
 * Auto-refresh the Live Snapshot section of docs/REPO_BRAIN.html after
 * graphify updates. Updates ONLY data-driven spans marked with
 * <span data-brain="key">…</span> — prose is never touched.
 *
 * Usage:
 *   node scripts/sync-repo-brain.mjs          # update in place
 *   node scripts/sync-repo-brain.mjs --check  # exit 1 if stale (CI guard)
 *
 * Wired to: .husky/post-commit (after the graphify graph rebuild).
 * Graph source: graphify-out/graph.json + GRAPH_REPORT.md
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAIN = join(ROOT, 'docs', 'REPO_BRAIN.html');
const GRAPH = join(ROOT, 'graphify-out', 'graph.json');
const REPORT = join(ROOT, 'graphify-out', 'GRAPH_REPORT.md');
const CHECK_ONLY = process.argv.includes('--check');

// ---------- helpers ----------
const sh = (cmd) => {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countTree = (dir, { exclude = ['node_modules', 'graphify-out', '.git'] } = {}) => {
  if (!existsSync(dir)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (exclude.includes(e.name)) continue;
      if (e.isFile()) n++;
      else if (e.isDirectory()) walk(join(d, e.name));
    }
  };
  walk(dir);
  return n;
};
const countTreeSuffix = (dir, suffix, { exclude = ['node_modules', 'graphify-out', '.git'] } = {}) => {
  if (!existsSync(dir)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (exclude.includes(e.name)) continue;
      if (e.isFile()) { if (e.name.toLowerCase().endsWith(suffix)) n++; }
      else if (e.isDirectory()) walk(join(d, e.name));
    }
  };
  walk(dir);
  return n;
};
const countTop = (dir, suffix) => {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((f) => statSync(join(dir, f)).isFile() && (!suffix || f.toLowerCase().endsWith(suffix)))
    .length;
};

// ---------- gather facts ----------
const facts = {};

// git
facts.head = sh('git rev-parse --short HEAD') || 'unknown';
const headDate = sh('git log -1 --format=%ci');
const d = new Date(headDate);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
facts.refreshed = isNaN(d.getTime())
  ? `${new Date().getDate()} ${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`
  : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

// graph
if (existsSync(GRAPH)) {
  const g = JSON.parse(readFileSync(GRAPH, 'utf8'));
  const deg = {};
  for (const l of g.links || []) {
    deg[l.source] = (deg[l.source] || 0) + 1;
    deg[l.target] = (deg[l.target] || 0) + 1;
  }
  facts.graph_nodes = String(g.nodes.length);
  facts.graph_edges = String((g.links || []).length);

  // God-node degrees: match label, prefer the expected canonical source file,
  // fall back to the highest-degree hit (labels like `pool` exist in many files).
  const godSpecs = [
    ['node_postgreshelpers', 'PostgresHelpers', 'infrastructure/database/postgres-helpers.js'],
    ['node_dbhelpers', 'dbHelpers', 'infrastructure/database/postgres-helpers.js'],
    ['node_dataservice', 'DataService', 'shared/lib/dataService.js'],
    ['node_app_port5001', 'app-port5001.js', 'app-port5001.js'],
    ['node_pool', 'pool', 'infrastructure/database/postgres-helpers.js'],
    ['node_protect', 'protect()', 'middleware/auth.middleware.js'],
    ['node_sanitizeerrormessage', 'sanitizeErrorMessage()', 'utils/sanitizeError.js'],
    ['node_admin', 'admin()', 'middleware/auth.middleware.js'],
    ['node_responsecache', 'responseCache()', 'middleware/responseCache.middleware.js'],
    ['node_getredisclient', 'getRedisClient()', 'cache/redisClient.js'],
  ];
  const nodes = g.nodes.filter((n) => n && typeof n === 'object' && n.label);
  for (const [key, label, fileHint] of godSpecs) {
    const hits = nodes.filter((n) => n.label === label)
      .map((n) => ({ n, d: deg[n.id] || 0 }));
    if (!hits.length) continue;
    const canonical = hits.find((h) => (h.n.source_file || '').endsWith(fileHint));
    const best = canonical || hits.sort((a, b) => b.d - a.d)[0];
    facts[key] = String(best.d);
  }

  // communities from node attributes (to_json annotates community ids)
  const comms = new Set();
  for (const n of g.nodes) { if (n && n.community !== undefined) comms.add(n.community); }
  if (comms.size) facts.graph_communities = String(comms.size);
}

// report fallback for graph summary + communities (regex on summary line)
if (existsSync(REPORT)) {
  const rpt = readFileSync(REPORT, 'utf8');
  const m = rpt.match(/^- (\d+) nodes · (\d+) edges · (\d+) communities/m);
  if (m) {
    if (!facts.graph_nodes) facts.graph_nodes = m[1];
    if (!facts.graph_edges) facts.graph_edges = m[2];
    facts.graph_communities = m[3];
  }
}

// filesystem counts (methodology: exclude graphify-out artifacts, node_modules)
const BE = join(ROOT, 'apps', 'backend', 'src');
const FE = join(ROOT, 'apps', 'frontend', 'src');
const AD = join(ROOT, 'apps', 'admin-panel', 'src');

facts.backend_src_files = String(countTree(BE));
facts.backend_route_files = String(countTop(join(BE, 'api', 'routes'), '.js'));
facts.backend_module_route_files = String(countTreeSuffix(join(BE, 'modules'), '.routes.js'));
facts.backend_middleware = String(countTop(join(BE, 'middleware'), '.js'));
facts.migration_files = String(countTop(
  join(BE, 'infrastructure', 'database', 'migrations'), '.sql'));
facts.frontend_src_files = String(countTree(FE));
facts.frontend_pages = String(countTreeSuffix(join(FE, 'pages'), '.jsx'));
facts.admin_src_files = String(countTree(AD));
facts.scripts_files = String(countTop(join(ROOT, 'scripts'), null));
facts.workflows = String(countTop(join(ROOT, '.github', 'workflows'), '.yml'));
facts.backend_tests = String(
  countTop(join(ROOT, 'apps', 'backend', 'test'), null) +
  countTop(join(BE, '__tests__'), null)
);

// API mount entries (app.use('...') with a string path in the composition root)
const entry = readFileSync(join(BE, 'app-port5001.js'), 'utf8');
facts.api_mounts = String((entry.match(/app\.use\(\s*['"]/g) || []).length);

// compose services (top-level 2-space keys, minus volumes/networks)
try {
  const dc = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8');
  const svc = (dc.match(/^ {2}[a-zA-Z0-9_-]+:\s*$/gm) || [])
    .map((s) => s.trim().replace(/:$/, ''))
    .filter((k) => !/net$|data$|-certs$|-www$|-uploads$|-spool$/.test(k));
  facts.compose_services = String(svc.length);
} catch { /* keep */ }

// ---- sanity guard: refuse obviously broken values ----
for (const k of ['graph_nodes', 'backend_src_files', 'frontend_src_files', 'admin_src_files']) {
  const v = parseInt(facts[k] || '0', 10);
  if (!v || v < 20) {
    console.error(`[sync-repo-brain] sanity check failed for ${k}=${facts[k]} — aborting without write.`);
    process.exit(1);
  }
}

// ---------- apply to HTML ----------
let html = readFileSync(BRAIN, 'utf8');
let changed = 0;
let unchanged = 0;
const seen = new Set();
html = html.replace(/<span data-brain="([^"]+)"[^>]*>([^<]*)<\/span>/g,
  (m, key, old) => {
    const value = facts[key];
    if (value === undefined) return m; // unknown key (e.g. literal examples in prose)
    seen.add(key);
    if (old === value) { unchanged++; return m; }
    changed++;
    return m.replace(/>[^<]*</, `>${value}<`);
  });

// title date (plain text — no spans inside <title>)
const titleRe = /(<title>Trstprep V2\.1 — Repo Brain \(Updated )([^<]+?)(\)<\/title>)/;
if (titleRe.test(html)) {
  const cur = html.match(titleRe)[2];
  if (cur !== facts.refreshed) {
    html = html.replace(titleRe, `$1${facts.refreshed}$3`);
    changed++;
  }
}

const missing = Object.keys(facts).filter((k) => !seen.has(k) && k !== 'refreshed');
if (missing.length) console.log(`[sync-repo-brain] note: no spans for keys: ${missing.join(', ')}`);

if (!changed) {
  console.log(`[sync-repo-brain] up to date (${unchanged} spans verified, ${seen.size} keys).`);
  process.exit(0);
}
if (CHECK_ONLY) {
  console.log(`[sync-repo-brain] --check: ${changed} span(s) stale.`);
  process.exit(1);
}
writeFileSync(BRAIN, html, 'utf8');
console.log(`[sync-repo-brain] refreshed ${changed} value(s) (${unchanged} already current): HEAD ${facts.head}, ${facts.graph_nodes} nodes / ${facts.graph_edges} edges / ${facts.graph_communities} communities, ${facts.migration_files} migrations.`);
