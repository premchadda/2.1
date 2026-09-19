import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tax = JSON.parse(fs.readFileSync(path.join(__dirname, "full-taxonomy.json"), "utf8"));

const historyChapters = tax.chapters.filter(c => c.subject_id === 4);
console.log(`History Chapters (${historyChapters.length} total):`);
for (const c of historyChapters) {
  const tops = tax.topics.filter(t => t.chapter_id === c.id);
  console.log(`[Ch ${c.id}] ${c.title} -> Topics: ${tops.map(t => `[${t.id}] ${t.name}`).join(", ")}`);
}
