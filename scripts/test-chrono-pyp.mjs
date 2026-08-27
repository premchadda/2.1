import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse dates from PYP titles like:
// "SSC CGL 2024 Tier 1 - 09 Sep 2024 - Shift 1"
// "RRB NTPC (UG) - 01/09/2025 - Shift 1"
// "NTPC - 3 April 2016 - Shift 2"
// "NTPC - 04 Jan 2021 - Shift 1"
function parsePypDateAndShift(title) {
  let year = 9999;
  let month = 12;
  let day = 31;
  let shift = 1;

  // Extract shift
  const shiftMatch = title.match(/shift\s*(\d+)/i);
  if (shiftMatch) {
    shift = parseInt(shiftMatch[1], 10);
  }

  // Format 1: DD Mon YYYY e.g. "09 Sep 2024", "3 April 2016"
  const textDateMatch = title.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (textDateMatch) {
    day = parseInt(textDateMatch[1], 10);
    const mStr = textDateMatch[2].toLowerCase().slice(0, 3);
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    month = months[mStr] || 1;
    year = parseInt(textDateMatch[3], 10);
    return { year, month, day, shift, hasDate: true };
  }

  // Format 2: DD/MM/YYYY e.g. "01/09/2025"
  const slashDateMatch = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDateMatch) {
    day = parseInt(slashDateMatch[1], 10);
    month = parseInt(slashDateMatch[2], 10);
    year = parseInt(slashDateMatch[3], 10);
    return { year, month, day, shift, hasDate: true };
  }

  // Format 3: Standalone Year like "2021", "2024"
  const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // Extract any trailing number (e.g. Previous Year 7)
  const numMatch = title.match(/(\d+)\s*$/);
  if (numMatch) {
    shift = parseInt(numMatch[1], 10);
  }

  return { year, month, day, shift, hasDate: false };
}

const mappingPath = path.join(rootDir, 'scripts', 'proposed_id_mapping.json');
if (fs.existsSync(mappingPath)) {
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  const pypTests = mapping.filter(m => 
    m.title.toLowerCase().includes('shift') || 
    m.title.toLowerCase().includes('previous year') ||
    m.title.includes('2016') ||
    m.title.includes('2021') ||
    m.title.includes('2024') ||
    m.title.includes('2025')
  );

  // Chronological sort
  const chronoSorted = [...pypTests].sort((a, b) => {
    const pA = parsePypDateAndShift(a.title);
    const pB = parsePypDateAndShift(b.title);

    if (pA.year !== pB.year) return pA.year - pB.year;
    if (pA.month !== pB.month) return pA.month - pB.month;
    if (pA.day !== pB.day) return pA.day - pB.day;
    if (pA.shift !== pB.shift) return pA.shift - pB.shift;
    return a.title.localeCompare(b.title);
  });

  console.log(`\n=== SAMPLE CHRONOLOGICAL PYP SORTING (RRB NTPC) ===`);
  const rrb = chronoSorted.filter(t => t.series.includes('RRB'));
  rrb.slice(0, 20).forEach((t, i) => {
    const d = parsePypDateAndShift(t.title);
    console.log(`  ${i+1}. [${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')} Shift ${d.shift}] "${t.title}"`);
  });

  console.log(`\n=== SAMPLE CHRONOLOGICAL PYP SORTING (SSC CGL 2024 & 2025) ===`);
  const ssc = chronoSorted.filter(t => t.series.includes('SSC'));
  ssc.slice(0, 20).forEach((t, i) => {
    const d = parsePypDateAndShift(t.title);
    console.log(`  ${i+1}. [${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')} Shift ${d.shift}] "${t.title}"`);
  });
}
