/**
 * Master Parallel Multi-Agent Question Taxonomy Audit Orchestrator
 * Spawns and manages 6 concurrent worker agents across partitioned subject territories,
 * adhering to .agents/rules/MULTI_AGENT_DEPLOYMENT_RULE.md.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit=') || a === '--limit');
const limitVal = limitArg ? (limitArg.includes('=') ? limitArg.split('=')[1] : args[args.indexOf('--limit') + 1]) : null;
const noResume = args.includes('--no-resume');

const AGENT_CONFIGS = [
  { id: '1', name: 'Reasoning', subjects: '1', out: 'scripts/out/audit-agent-1-reasoning.jsonl' },
  { id: '2', name: 'Quant', subjects: '2', out: 'scripts/out/audit-agent-2-quant.jsonl' },
  { id: '3', name: 'English', subjects: '3', out: 'scripts/out/audit-agent-3-english.jsonl' },
  { id: '4', name: 'GK & CA', subjects: '11,12', out: 'scripts/out/audit-agent-4-gk-ca.jsonl' },
  { id: '5', name: 'Polity & History', subjects: '4,5', out: 'scripts/out/audit-agent-5-polity-history.jsonl' },
  { id: '6', name: 'Sciences & Tech', subjects: '6,7,8,9,10,13', out: 'scripts/out/audit-agent-6-sciences-tech.jsonl' },
];

console.log('========================================================================');
console.log('       TRSTPREP MASTER MULTI-AGENT TAXONOMY REAUDIT ORCHESTRATOR        ');
console.log('========================================================================');
console.log(`Active Agents: ${AGENT_CONFIGS.length}`);
if (limitVal) console.log(`Limit: ${limitVal} questions per agent`);
console.log('Starting parallel execution...\n');

const startTime = Date.now();

function runAgent(cfg) {
  return new Promise((resolve, reject) => {
    const workerScript = path.join(__dirname, 'lib/worker-audit-agent.mjs');
    const workerArgs = [
      workerScript,
      '--agent-id', cfg.id,
      '--subjects', cfg.subjects,
      '--out', cfg.out,
    ];
    if (limitVal) workerArgs.push('--limit', limitVal);
    if (noResume) workerArgs.push('--no-resume');

    const proc = spawn('node', workerArgs, {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stdout.on('data', data => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        console.log(`[AGENT-${cfg.id}: ${cfg.name}] ${line}`);
      }
    });

    proc.stderr.on('data', data => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        console.error(`[AGENT-${cfg.id} ERROR] ${line}`);
      }
    });

    proc.on('close', code => {
      if (code === 0) {
        console.log(`>>> [AGENT-${cfg.id}: ${cfg.name}] Completed successfully!`);
        resolve();
      } else {
        console.error(`>>> [AGENT-${cfg.id}: ${cfg.name}] Exited with code ${code}!`);
        reject(new Error(`Agent ${cfg.id} failed with exit code ${code}`));
      }
    });
  });
}

async function orchestrate() {
  try {
    await Promise.all(AGENT_CONFIGS.map(runAgent));

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nAll 6 Agents completed successfully in ${durationSec}s!`);
    console.log('Now triggering consolidation of findings...\n');

    // Run consolidation
    const consolidatorScript = path.join(__dirname, 'consolidate-audit-findings.mjs');
    const consProc = spawn('node', [consolidatorScript], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });

    consProc.on('close', code => {
      if (code === 0) {
        console.log('\nMaster Reaudit and Consolidation Pipeline Finished 100% Successfully!');
      } else {
        console.error(`Consolidation script exited with error code ${code}`);
      }
    });

  } catch (err) {
    console.error('Fatal error in orchestration:', err);
    process.exit(1);
  }
}

orchestrate();
