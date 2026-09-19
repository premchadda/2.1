import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tax = JSON.parse(fs.readFileSync(path.join(__dirname, "full-taxonomy.json"), "utf8"));

for (const s of tax.subjects) {
  const chs = tax.chapters.filter(c => c.subject_id === s.id);
  console.log(`\n=== Subject ${s.id}: ${s.name} (${chs.length} chapters) ===`);
  for (const c of chs) {
    const tops = tax.topics.filter(t => t.chapter_id === c.id);
    console.log(`  Ch [${c.id}] ${c.title} (${tops.length} topics)`);
  }
}
