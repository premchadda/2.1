import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const taxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, "taxonomy-cache.json"), "utf-8"));

console.log("=== REASONING CHAPTERS (subject_id = 1) ===");
const reasoningChapters = taxonomy.chapters.filter(c => c.subject_id === 1);
for (const c of reasoningChapters) {
  const chTopics = taxonomy.topics.filter(t => t.chapter_id === c.id);
  console.log(`[Ch ${c.id}] ${c.title} (${chTopics.length} topics)`);
}

console.log("\n=== QUANT CHAPTERS (subject_id = 2) ===");
const quantChapters = taxonomy.chapters.filter(c => c.subject_id === 2);
for (const c of quantChapters.slice(0, 25)) {
  const chTopics = taxonomy.topics.filter(t => t.chapter_id === c.id);
  console.log(`[Ch ${c.id}] ${c.title} (${chTopics.length} topics)`);
}

console.log("\n=== ENGLISH CHAPTERS (subject_id = 3) ===");
const englishChapters = taxonomy.chapters.filter(c => c.subject_id === 3);
for (const c of englishChapters.slice(0, 20)) {
  const chTopics = taxonomy.topics.filter(t => t.chapter_id === c.id);
  console.log(`[Ch ${c.id}] ${c.title} (${chTopics.length} topics)`);
}
