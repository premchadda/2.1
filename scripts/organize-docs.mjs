import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');

const subdirs = {
  core: path.join(docsDir, 'core'),
  specifications: path.join(docsDir, 'specifications'),
  audits: path.join(docsDir, 'audits'),
  visuals: path.join(docsDir, 'visuals'),
  referenceData: path.join(docsDir, 'reference-data'),
};

// Precise file mapping
const fileMapping = [
  {
    src: path.join(rootDir, 'Master Syllabus.txt'),
    dest: path.join(subdirs.referenceData, 'Master Syllabus.txt'),
  },
  {
    src: path.join(rootDir, 'UNIFIED_TRSTPREP_AUDIT.md'),
    dest: path.join(subdirs.audits, 'UNIFIED_TRSTPREP_AUDIT.md'),
  },
  {
    src: path.join(docsDir, 'ARCHITECTURE.md'),
    dest: path.join(subdirs.core, 'ARCHITECTURE.md'),
  },
  {
    src: path.join(docsDir, 'AI_ARCHITECTURE.md'),
    dest: path.join(subdirs.core, 'AI_ARCHITECTURE.md'),
  },
  {
    src: path.join(docsDir, 'AI_PROMPTS.md'),
    dest: path.join(subdirs.core, 'AI_PROMPTS.md'),
  },
  {
    src: path.join(docsDir, 'DEVELOPMENT.md'),
    dest: path.join(subdirs.core, 'DEVELOPMENT.md'),
  },
  {
    src: path.join(docsDir, 'SECURITY.md'),
    dest: path.join(subdirs.core, 'SECURITY.md'),
  },
  {
    src: path.join(docsDir, 'PRACTICE_LAB_PRD.md'),
    dest: path.join(subdirs.specifications, 'PRACTICE_LAB_PRD.md'),
  },
  {
    src: path.join(docsDir, 'PRACTICE_PAGE_UI_AUDIT.md'),
    dest: path.join(subdirs.audits, 'PRACTICE_PAGE_UI_AUDIT.md'),
  },
  {
    src: path.join(docsDir, 'exam.txt'),
    dest: path.join(subdirs.referenceData, 'exam.txt'),
  },
  {
    src: path.join(docsDir, 'SSC_CGL_Tier_I_2026_Free_Mock_Test.json'),
    dest: path.join(subdirs.referenceData, 'SSC_CGL_Tier_I_2026_Free_Mock_Test.json'),
  },
  {
    src: path.join(docsDir, 'ssc_cgl_prevyear_full.json'),
    dest: path.join(subdirs.referenceData, 'ssc_cgl_prevyear_full.json'),
  },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${path.relative(rootDir, dir)}`);
  }
}

function moveFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Skipped: ${path.relative(rootDir, src)} (file does not exist)`);
    return;
  }

  ensureDir(path.dirname(dest));

  try {
    fs.copyFileSync(src, dest);
    // Double check size and existence before deleting original
    if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) {
      fs.unlinkSync(src);
      console.log(`Successfully moved: ${path.relative(rootDir, src)} -> ${path.relative(rootDir, dest)}`);
    } else {
      console.error(`Verification failed for: ${path.relative(rootDir, src)}. Copy size mismatch.`);
    }
  } catch (err) {
    console.error(`Failed to move: ${path.relative(rootDir, src)}. Error: ${err.message}`);
  }
}

console.log('=== STARTING DOCUMENTATION REORGANIZATION ===\n');

// 1. Ensure all subdirectories exist
Object.values(subdirs).forEach(ensureDir);
console.log('');

// 2. Move mapped files
fileMapping.forEach(mapping => {
  moveFile(mapping.src, mapping.dest);
});

// 3. Move all root-level HTML files in docs/ to docs/visuals/
try {
  const files = fs.readdirSync(docsDir);
  files.forEach(file => {
    const fullPath = path.join(docsDir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && file.endsWith('.html')) {
      const destPath = path.join(subdirs.visuals, file);
      moveFile(fullPath, destPath);
    }
  });
} catch (err) {
  console.error(`Failed to scan docs directory: ${err.message}`);
}

console.log('\n=== DOCUMENTATION REORGANIZATION COMPLETED ===');
