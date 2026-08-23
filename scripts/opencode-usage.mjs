#!/usr/bin/env node
/**
 * opencode-usage.mjs — read-only usage reporter for opencode local DB
 * Reads C:\Users\mahic\.local\share\opencode\opencode.db (or $HOME/.local/share/opencode/opencode.db)
 * No external deps beyond better-sqlite3 (optional). Falls back to JSON error if driver missing.
 *
 * Usage:
 *   node scripts/opencode-usage.mjs            // markdown to stdout
 *   node scripts/opencode-usage.mjs --json     // JSON to stdout
 *   node scripts/opencode-usage.mjs --markdown // explicit markdown
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const DB_CANDIDATES = [
  path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db'),
  // Windows fallback
  path.join(process.env.LOCALAPPDATA || '', 'opencode', 'opencode.db'),
  'C:/Users/mahic/.local/share/opencode/opencode.db',
  path.join(os.homedir(), '.local', 'share', 'opencode', 'storage', 'opencode.db'),
];

function findDb() {
  for (const p of DB_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  // try homedir variation
  const alt = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
  if (fs.existsSync(alt)) return alt;
  return null;
}

function tryRequire(spec) {
  try { return require(spec); } catch { return null; }
}

function formatNum(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('en-US');
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(2)+'M';
  if (n >= 1_000) return (n/1_000).toFixed(1)+'k';
  return String(n);
}

function toDate(ms) {
  if (!ms) return '-';
  try { return new Date(Number(ms)).toISOString().slice(0,10); } catch { return String(ms); }
}

function toDateTime(ms) {
  if (!ms) return '-';
  try { return new Date(Number(ms)).toLocaleString(); } catch { return String(ms); }
}

async function main() {
  const args = process.argv.slice(2);
  const wantJson = args.includes('--json');
  const dbPath = findDb();
  if (!dbPath) {
    const msg = `No opencode DB found. Checked: ${DB_CANDIDATES.join(', ')}`;
    if (wantJson) console.log(JSON.stringify({ error: msg }, null, 2));
    else console.log(`# Opencode Usage\n\n> ${msg}\n\nChecked candidates:\n${DB_CANDIDATES.map(p=>`- ${p}`).join('\n')}`);
    process.exit(0);
  }

  let Database = tryRequire('better-sqlite3')
    || tryRequire('C:\\Users\\mahic\\AppData\\Roaming\\npm\\node_modules\\better-sqlite3')
    || tryRequire(path.join(os.homedir(), 'AppData','Roaming','npm','node_modules','better-sqlite3'))
    || tryRequire(path.join(process.cwd(), 'node_modules','better-sqlite3'))
    || tryRequire(path.join(os.homedir(), '.config','opencode','node_modules','better-sqlite3'));
  if (!Database) {
    const msg = `better-sqlite3 not found. Install with: npm i -g better-sqlite3  (DB at ${dbPath})`;
    if (wantJson) console.log(JSON.stringify({ error: msg, dbPath }, null, 2));
    else {
      console.log(`# Opencode Usage\n\n> DB: \`${dbPath}\`\n\n**Driver missing:** better-sqlite3 not installed.\nRun \`npm i -g better-sqlite3\` or \`npm i better-sqlite3\` in project.\n\nDB exists (${fs.existsSync(dbPath) ? fs.statSync(dbPath).size.toLocaleString()+' bytes' : 'missing'}) but cannot be read without driver.`);
      // still try to show file size
      try {
        const st = fs.statSync(dbPath);
        console.log(`\nDB size: ${formatNum(st.size)} bytes, modified: ${st.mtime.toLocaleString()}`);
      } catch {}
    }
    process.exit(0);
  }

  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (e) {
    const msg = `Failed to open DB ${dbPath}: ${e.message}`;
    if (wantJson) console.log(JSON.stringify({ error: msg }, null, 2));
    else console.log(`# Opencode Usage\n\n> ${msg}`);
    process.exit(0);
  }

  // Gather stats
  const totalSessions = db.prepare("SELECT COUNT(*) as c FROM session").get().c;
  const totalProjects = db.prepare("SELECT COUNT(*) as c FROM project").get().c;
  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(tokens_input),0) as sum_input,
      COALESCE(SUM(tokens_output),0) as sum_output,
      COALESCE(SUM(tokens_reasoning),0) as sum_reasoning,
      COALESCE(SUM(tokens_cache_read),0) as sum_cache_read,
      COALESCE(SUM(tokens_cache_write),0) as sum_cache_write,
      COALESCE(SUM(cost),0) as sum_cost
    FROM session
  `).get();

  const perDay = db.prepare(`
    SELECT date(time_created/1000, 'unixepoch') as day,
           COUNT(*) as sessions,
           SUM(tokens_input) as input,
           SUM(tokens_output) as output,
           SUM(tokens_cache_read) as cache_read
    FROM session GROUP BY day ORDER BY day DESC LIMIT 14
  `).all();

  const perModelSession = db.prepare(`
    SELECT 
      json_extract(model, '$.providerID') as provider,
      json_extract(model, '$.id') as model_id,
      COUNT(*) as sessions,
      SUM(tokens_input) as input,
      SUM(tokens_output) as output
    FROM session
    WHERE model IS NOT NULL
    GROUP BY provider, model_id
    ORDER BY sessions DESC
    LIMIT 20
  `).all();

  // message-level model counts (more granular than session.model) — slow (5s on 18k msgs), only with --full
  let perModelMessage = [];
  const wantFull = args.includes('--full') || args.includes('--full=true') || args.includes('-f');
  if (wantFull) {
    try {
      perModelMessage = db.prepare(`
        SELECT 
          json_extract(data, '$.model.providerID') as provider,
          json_extract(data, '$.model.modelID') as model_id,
          COUNT(*) as cnt
        FROM message
        WHERE json_extract(data, '$.model.modelID') IS NOT NULL
        GROUP BY provider, model_id
        ORDER BY cnt DESC
        LIMIT 20
      `).all();
    } catch {}
  }

  const perProject = db.prepare(`
    SELECT p.worktree as worktree, p.id as project_id,
            COUNT(s.id) as sessions,
            SUM(s.tokens_input) as input,
            SUM(s.tokens_output) as output
    FROM project p
    LEFT JOIN session s ON s.project_id = p.id
    GROUP BY p.id
    ORDER BY sessions DESC
  `).all();

  const totalRequests = db.prepare(`SELECT COUNT(*) as c FROM message`).get().c;

  const recent = db.prepare(`
    SELECT id, title, directory, 
            tokens_input, tokens_output, tokens_cache_read, tokens_cache_write,
            time_created, time_updated,
            json_extract(model, '$.id') as model_id,
            json_extract(model, '$.providerID') as provider
    FROM session
    ORDER BY time_updated DESC
    LIMIT 12
  `).all();

  const today = perDay[0] || null;
  const last7 = perDay.slice(0,7);
  const sum7Input = last7.reduce((a,b)=>a+(b.input||0),0);
  const sum7Output = last7.reduce((a,b)=>a+(b.output||0),0);
  const totalTokensUse = totals.sum_input + totals.sum_output;
  const cacheHitRate = (totals.sum_input + totals.sum_cache_read) > 0 ? (totals.sum_cache_read / (totals.sum_input + totals.sum_cache_read) * 100).toFixed(1) : '0.0';

  const out = {
    dbPath,
    generatedAt: new Date().toISOString(),
    totals: {
      sessions: totalSessions,
      projects: totalProjects,
      input: totals.sum_input,
      output: totals.sum_output,
      reasoning: totals.sum_reasoning,
      cacheRead: totals.sum_cache_read,
      cacheWrite: totals.sum_cache_write,
      cost: totals.sum_cost,
      totalTokens: totalTokensUse,
      cacheHitRate: parseFloat(cacheHitRate),
      requests: totalRequests,
    },
    today,
    last7Days: { input: sum7Input, output: sum7Output, sessions: last7.reduce((a,b)=>a+b.sessions,0) },
    perDay,
    perModelSession,
    perModelMessage,
    perProject,
    recent: recent.map(r=>({
      ...r,
      created: toDateTime(r.time_created),
      updated: toDateTime(r.time_updated),
    })),
  };

  if (wantJson) {
    console.log(JSON.stringify(out, null, 2));
    db.close();
    return;
  }

  // Markdown output for /usages command
  console.log(`# 📊 Opencode Usage Dashboard`);
  console.log(``);
  console.log(`> DB: \`${dbPath}\`  •  Generated: ${new Date().toLocaleString()}  •  Read-only`);
  console.log(``);
  console.log(`## Summary`);
  console.log(``);
  console.log(`| Metric | Value |`);
  console.log(`|---|---|`);
  console.log(`| **Total Sessions** | ${formatNum(totalSessions)} |`);
  console.log(`| **Projects** | ${formatNum(totalProjects)} |`);
  console.log(`| **Total Input Tokens** | ${formatNum(totals.sum_input)} (${formatTokens(totals.sum_input)}) |`);
  console.log(`| **Total Output Tokens** | ${formatNum(totals.sum_output)} (${formatTokens(totals.sum_output)}) |`);
  console.log(`| **Cache Read** | ${formatNum(totals.sum_cache_read)} |`);
  console.log(`| **Cache Write** | ${formatNum(totals.sum_cache_write)} |`);
  console.log(`| **Reasoning Tokens** | ${formatNum(totals.sum_reasoning)} |`);
  console.log(`| **Total Cost** | $${Number(totals.sum_cost).toFixed(2)} |`);
  console.log(``);
  if (today) {
    console.log(`### Today (${today.day})`);
    console.log(`Sessions: **${today.sessions}** • Input: **${formatNum(today.input)}** • Output: **${formatNum(today.output)}** • Cache read: ${formatNum(today.cache_read)}`);
    console.log(``);
  }
  console.log(`### Last 7 Days`);
  console.log(`Sessions: **${out.last7Days.sessions}** • Input: **${formatNum(sum7Input)}** • Output: **${formatNum(sum7Output)}**`);
  console.log(``);

  console.log(`## Daily Breakdown (last 14)`);
  console.log(``);
  console.log(`| Day | Sessions | Input | Output | Cache Read |`);
  console.log(`|---|---|---|---|---|`);
  perDay.forEach(d=>{
    console.log(`| ${d.day} | ${d.sessions} | ${formatNum(d.input)} | ${formatNum(d.output)} | ${formatNum(d.cache_read)} |`);
  });
  console.log(``);

  console.log(`## By Model (session.model)`);
  console.log(``);
  if (perModelSession.length) {
    console.log(`| Provider | Model | Sessions | Input | Output |`);
    console.log(`|---|---|---|---|---|`);
    perModelSession.forEach(m=>{
      const prov = m.provider || '-';
      const mid = m.model_id || '-';
      console.log(`| ${prov} | ${mid} | ${m.sessions} | ${formatNum(m.input)} | ${formatNum(m.output)} |`);
    });
  } else {
    console.log(`_No model data in session table_`);
  }
  console.log(``);

  if (perModelMessage.length) {
    console.log(`## By Model (message-level counts)`);
    console.log(``);
    console.log(`| Provider | Model | Messages |`);
    console.log(`|---|---|---|`);
    perModelMessage.forEach(m=>{
      console.log(`| ${m.provider||'-'} | ${m.model_id||'-'} | ${m.cnt} |`);
    });
    console.log(``);
  } else if (wantFull) {
    console.log(`## By Model (message-level counts)`);
    console.log(``);
    console.log(`_No message-level model data_`);
    console.log(``);
  } else {
    console.log(`## By Model (message-level counts)`);
    console.log(``);
    console.log(`_Skipped (slow 5s scan of 18k messages). Run with \`--full\` to include: \`node scripts/opencode-usage.mjs --full\` or dashboard \`http://localhost:4612/api/usage?full=1\`_`);
    console.log(``);
  }

  console.log(`## By Project`);
  console.log(``);
  console.log(`| Worktree | Sessions | Input | Output |`);
  console.log(`|---|---|---|---|`);
  perProject.forEach(p=>{
    const wt = p.worktree || p.project_id;
    console.log(`| \`${wt}\` | ${p.sessions||0} | ${formatNum(p.input)} | ${formatNum(p.output)} |`);
  });
  console.log(``);

  console.log(`## Recent Sessions (last 12 by updated)`);
  console.log(``);
  console.log(`| Updated | Title | Model | Input | Output | Cache Read |`);
  console.log(`|---|---|---|---|---|---|`);
  recent.forEach(r=>{
    const d = toDate(r.time_updated);
    const model = r.model_id ? `${r.provider}/${r.model_id}` : '-';
    const title = (r.title || '-').replace(/\|/g,' ').slice(0,60);
    console.log(`| ${d} | ${title} | ${model} | ${formatNum(r.tokens_input)} | ${formatNum(r.tokens_output)} | ${formatNum(r.tokens_cache_read)} |`);
  });
  console.log(``);
  console.log(`---`);
  console.log(`*Run with \`--json\` for machine-readable output. Dashboard server: \`node ~/.config/opencode/usage-dashboard/server.mjs\` → http://localhost:4612 (auto-refresh 60s)*`);
  console.log(`*Project script: \`node scripts/opencode-usage.mjs\`*`);

  db.close();
}

main().catch(e=>{
  console.error('Usage script error:', e);
  process.exit(1);
});
