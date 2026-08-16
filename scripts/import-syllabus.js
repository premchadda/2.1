import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

// Helper to convert string to URL-safe slug
function toSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

// Stack-based parser matching Python's logic
function parseLine(text) {
  const rstripped = text.replace(/[\r\n]+$/, '');
  if (!rstripped.trim()) return null;
  
  const lstripped = rstripped.trimStart();
  if (lstripped.length === 0 || /^[\s│─├└]+$/.test(rstripped)) {
    return null;
  }
  
  const match = rstripped.match(/^([ │]*)?([├└]──\s*)?(.*)$/);
  if (!match) return null;
  
  const prefix = match[1] || '';
  const marker = match[2] || '';
  const label = match[3].trim();
  
  const col = prefix.length;
  const isMarker = marker.length > 0;
  
  return {
    type: isMarker ? "marker" : "header",
    col,
    name: label
  };
}

function buildTree(lines) {
  const root = { name: "Root", children: [] };
  const stack = [{ col: -1000000000, isHeader: false, node: root }];
  
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    
    const isHeader = parsed.type === "header";
    if (isHeader) {
      while (stack.length > 0 && stack[stack.length - 1].col >= parsed.col) {
        stack.pop();
      }
    } else {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.isHeader) break;
        if (top.col >= parsed.col) {
          stack.pop();
        } else {
          break;
        }
      }
    }
    
    const parentNode = stack[stack.length - 1].node;
    let node = parentNode.children.find(c => c.name === parsed.name);
    if (!node) {
      node = { name: parsed.name, children: [] };
      parentNode.children.push(node);
    }
    
    stack.push({
      col: parsed.col,
      isHeader,
      node
    });
  }
  
  return root;
}

// Normalize & map subject names to DB records
const SUBJECT_MAP = {
  "mathematics": { id: 22, name: "Quantitative Aptitude" },
  "reasoning": { id: 2, name: "General Intelligence" },
  "english language & comprehension": { id: 3, name: "English Language" },
  "computer knowledge": { id: 15, name: "Computer Knowledge" },
  "history": { id: 12, name: "History" },
  "geography": { id: 13, name: "Geography" },
  "indian polity": { id: 16, name: "Polity" },
  "economics": { id: 17, name: "Economy" },
  "physics": { id: 8, name: "Physics" },
  "chemistry (रसायन विज्ञान)": { id: 9, name: "Chemistry" },
  "biology (जीव विज्ञान)": { id: 10, name: "Biology" },
  "static gk (स्थिर सामान्य ज्ञान)": { id: 30, name: "Static GK" },
  "current affairs (समसामयिक घटनाएँ)": { id: 11, name: "Current Affairs" }
};

async function main() {
  const dryRun = process.argv.includes("--execute") ? false : true;
  console.log(`=== SYLLABUS SYNC SCRIPT (${dryRun ? "DRY RUN MODE" : "EXECUTE MODE"}) ===\n`);
  
  try {
    const { pool } = await import('../apps/backend/src/infrastructure/database/postgres-helpers.js');
    
    // 1. Read and parse Master Syllabus.txt
    const filePath = path.join(__dirname, "../docs/reference-data/Master Syllabus.txt");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const rawTree = buildTree(fileContent.split('\n'));
    
    // Discard overview tree summary first so we don't match empty summary subjects
    rawTree.children = rawTree.children.filter(c => c.name !== "SSC + Railway Master Syllabus");

    // 2. Post-process to group flat Physics Units & Chapters under Physics
    // Helper to find the correct Physics subject node (not leaf nodes like Nobel Prize -> Physics)
    function findPhysicsSubjectNode(node) {
      if (node.name.toLowerCase() === "physics" && node.children && node.children.length > 0) {
        const hasUnitOrChapter = node.children.some(c => 
          c.name.toLowerCase().startsWith("unit ") || 
          c.name.toLowerCase().startsWith("chapter ")
        );
        if (hasUnitOrChapter) return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findPhysicsSubjectNode(child);
          if (found) return found;
        }
      }
      return null;
    }

    const physicsNode = findPhysicsSubjectNode(rawTree);
    if (physicsNode && physicsNode.children) {
      let currentPhysicsUnit = null;
      const cleanedChildren = [];
      
      for (const child of physicsNode.children) {
        const nameLower = child.name.toLowerCase();
        if (nameLower.startsWith("unit ")) {
          currentPhysicsUnit = child;
          cleanedChildren.push(child);
        } else if (nameLower.startsWith("chapter ") && currentPhysicsUnit) {
          currentPhysicsUnit.children.push(child);
        } else {
          cleanedChildren.push(child);
        }
      }
      physicsNode.children = cleanedChildren;
    }

    // Recursively find all subject nodes mapped in SUBJECT_MAP (only those with children)
    const identifiedSubjects = [];
    function findSubjectNodes(node) {
      const nameLower = node.name.toLowerCase();
      const mapInfo = SUBJECT_MAP[nameLower];
      if (mapInfo && node.children && node.children.length > 0) {
        identifiedSubjects.push({
          subjectNode: node,
          mapInfo
        });
        return;
      }
      if (node.children) {
        for (const child of node.children) {
          findSubjectNodes(child);
        }
      }
    }
    findSubjectNodes(rawTree);
    
    console.log(`Processed syllabus structure. Subjects identified (${identifiedSubjects.length}):`);
    identifiedSubjects.forEach(s => console.log(`- "${s.subjectNode.name}" maps to DB Subject: "${s.mapInfo.name}" (ID: ${s.mapInfo.id}) with ${s.subjectNode.children.length} sub-nodes`));
    console.log();
    
    let stats = {
      subjectsChecked: 0,
      unitsInserted: 0,
      unitsExisting: 0,
      chaptersInserted: 0,
      chaptersExisting: 0,
      topicsInserted: 0,
      topicsExisting: 0,
      subtopicsInserted: 0,
      subtopicsExisting: 0,
    };
    
    // 3. Import each Subject's tree
    for (const { subjectNode, mapInfo } of identifiedSubjects) {
      if (!mapInfo) {
        console.log(`⚠️ Skip unmapped subject node: "${subjectNode.name}"`);
        continue;
      }
      
      stats.subjectsChecked++;
      const subjectId = mapInfo.id;
      const subjectName = mapInfo.name;
      console.log(`\n--------------------------------------------------`);
      console.log(`Processing Subject: "${subjectName}" (ID: ${subjectId})`);
      console.log(`--------------------------------------------------`);
      
      // Traverse Units
      for (const unitNode of subjectNode.children) {
        const unitName = unitNode.name;
        const unitSlug = toSlug(unitName);
        
        // Check if unit exists
        const unitExists = await pool.query(
          "SELECT id FROM units WHERE subject_id = $1 AND (slug = $2 OR LOWER(name) = $3)",
          [subjectId, unitSlug, unitName.toLowerCase()]
        );
        
        let unitId;
        if (unitExists.rows.length > 0) {
          unitId = unitExists.rows[0].id;
          stats.unitsExisting++;
          // console.log(`  Unit: "${unitName}" already exists (ID: ${unitId})`);
        } else {
          stats.unitsInserted++;
          if (dryRun) {
            console.log(`  [DRY RUN] Will INSERT Unit: "${unitName}"`);
            unitId = 99999 + stats.unitsInserted; // dummy ID
          } else {
            const insertRes = await pool.query(
              `INSERT INTO units (name, slug, subject_id, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING id`,
              [unitName, unitSlug, subjectId]
            );
            unitId = insertRes.rows[0].id;
            console.log(`  Inserted Unit: "${unitName}" (ID: ${unitId})`);
          }
        }
        
        // Traverse Chapters
        for (const chapterNode of unitNode.children) {
          const chapterTitle = chapterNode.name;
          const chapterSlug = toSlug(chapterTitle);
          
          // Check if chapter exists
          const chapterExists = await pool.query(
            "SELECT id FROM chapters WHERE unit_id = $1 AND (slug = $2 OR LOWER(title) = $3)",
            [unitId, chapterSlug, chapterTitle.toLowerCase()]
          );
          
          let chapterId;
          if (chapterExists.rows.length > 0) {
            chapterId = chapterExists.rows[0].id;
            stats.chaptersExisting++;
          } else {
            stats.chaptersInserted++;
            if (dryRun) {
              console.log(`    [DRY RUN] Will INSERT Chapter: "${chapterTitle}"`);
              chapterId = 99999 + stats.chaptersInserted; // dummy ID
            } else {
              const uuid = crypto.randomUUID();
              const insertRes = await pool.query(
                `INSERT INTO chapters (unit_id, subject_id, title, slug, is_active, public_id_uuid, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW()) RETURNING id`,
                [unitId, subjectId, chapterTitle, chapterSlug, uuid]
              );
              chapterId = insertRes.rows[0].id;
              console.log(`    Inserted Chapter: "${chapterTitle}" (ID: ${chapterId})`);
            }
          }
          
          // Process Topics recursively
          for (const topicNode of chapterNode.children) {
            await processTopicOrSubtopic(pool, topicNode, null, chapterId, subjectId, subjectName, dryRun, stats, 1);
          }
        }
      }
    }
    
    console.log(`\n==================================================`);
    console.log(`SYNC RUN STATS:`);
    console.log(`  Subjects Checked:   ${stats.subjectsChecked}`);
    console.log(`  Units Inserted:     ${stats.unitsInserted}`);
    console.log(`  Units Existing:     ${stats.unitsExisting}`);
    console.log(`  Chapters Inserted:   ${stats.chaptersInserted}`);
    console.log(`  Chapters Existing:   ${stats.chaptersExisting}`);
    console.log(`  Topics Inserted:     ${stats.topicsInserted}`);
    console.log(`  Topics Existing:     ${stats.topicsExisting}`);
    console.log(`  Subtopics Inserted:  ${stats.subtopicsInserted}`);
    console.log(`  Subtopics Existing:  ${stats.subtopicsExisting}`);
    console.log(`==================================================\n`);
    
    // 4. Verify duplicate entries in the database
    await verifyDuplicatesInDb(pool);
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

// Helper to generate globally unique topic slug
async function generateUniqueTopicSlug(pool, baseSlug) {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const res = await pool.query("SELECT id FROM topics WHERE slug = $1", [slug]);
    if (res.rows.length === 0) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Recursive helper to process topics and subtopics
async function processTopicOrSubtopic(pool, node, parentTopicId, chapterId, subjectId, subjectName, dryRun, stats, depth) {
  const nodeName = node.name;
  
  // If the node has children, it is a Topic
  if (node.children && node.children.length > 0) {
    const topicSlug = toSlug(nodeName);
    
    // Check if topic exists under this parent context
    let existing;
    if (parentTopicId) {
      existing = await pool.query(
        "SELECT id FROM topics WHERE parent_topic_id = $1 AND (slug = $2 OR LOWER(name) = $3)",
        [parentTopicId, topicSlug, nodeName.toLowerCase()]
      );
    } else {
      existing = await pool.query(
        "SELECT id FROM topics WHERE chapter_id = $1 AND parent_topic_id IS NULL AND (slug = $2 OR LOWER(name) = $3)",
        [chapterId, topicSlug, nodeName.toLowerCase()]
      );
    }
    
    let topicId;
    if (existing.rows.length > 0) {
      topicId = existing.rows[0].id;
      stats.topicsExisting++;
    } else {
      stats.topicsInserted++;
      if (dryRun) {
        // console.log(`      [DRY RUN] Will INSERT Topic: "${nodeName}" (parentTopicId: ${parentTopicId}, chapterId: ${chapterId})`);
        topicId = 99999 + stats.topicsInserted;
      } else {
        const uniqueSlug = await generateUniqueTopicSlug(pool, topicSlug);
        const uuid = crypto.randomUUID();
        const insertRes = await pool.query(
          `INSERT INTO topics (name, slug, subject, subject_id, chapter_id, parent_topic_id, is_active, public_id_uuid, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW()) RETURNING id`,
          [nodeName, uniqueSlug, subjectName, subjectId, parentTopicId ? null : chapterId, parentTopicId, uuid]
        );
        topicId = insertRes.rows[0].id;
        // console.log(`      Inserted Topic: "${nodeName}" (ID: ${topicId})`);
      }
    }
    
    // Recurse on children
    for (const childNode of node.children) {
      await processTopicOrSubtopic(pool, childNode, topicId, chapterId, subjectId, subjectName, dryRun, stats, depth + 1);
    }
  } else {
    // If the node has NO children, it is a Subtopic
    const subtopicSlug = toSlug(nodeName);
    
    if (!parentTopicId) {
      // If a leaf node has no parentTopicId (directly under chapter?), treat it as a topic instead of subtopic
      // since subtopics MUST have a topic_id FK constraint!
      const topicSlug = toSlug(nodeName);
      const existing = await pool.query(
        "SELECT id FROM topics WHERE chapter_id = $1 AND parent_topic_id IS NULL AND (slug = $2 OR LOWER(name) = $3)",
        [chapterId, topicSlug, nodeName.toLowerCase()]
      );
      if (existing.rows.length > 0) {
        stats.topicsExisting++;
      } else {
        stats.topicsInserted++;
        if (dryRun) {
          // console.log(`      [DRY RUN] Will INSERT Leaf-Topic: "${nodeName}" (chapterId: ${chapterId})`);
        } else {
          const uniqueSlug = await generateUniqueTopicSlug(pool, topicSlug);
          const uuid = crypto.randomUUID();
          await pool.query(
            `INSERT INTO topics (name, slug, subject, subject_id, chapter_id, parent_topic_id, is_active, public_id_uuid, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NULL, true, $6, NOW(), NOW())`,
            [nodeName, uniqueSlug, subjectName, subjectId, chapterId, uuid]
          );
        }
      }
      return;
    }
    
    // Check if subtopic exists
    const existing = await pool.query(
      "SELECT id FROM subtopics WHERE topic_id = $1 AND (slug = $2 OR LOWER(name) = $3)",
      [parentTopicId, subtopicSlug, nodeName.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      stats.subtopicsExisting++;
    } else {
      stats.subtopicsInserted++;
      if (dryRun) {
        // console.log(`        [DRY RUN] Will INSERT Subtopic: "${nodeName}" (topicId: ${parentTopicId})`);
      } else {
        const uuid = crypto.randomUUID();
        await pool.query(
          `INSERT INTO subtopics (name, slug, topic_id, is_active, public_id_uuid, created_at, updated_at)
           VALUES ($1, $2, $3, true, $4, NOW(), NOW())`,
          [nodeName, subtopicSlug, parentTopicId, uuid]
        );
      }
    }
  }
}

// Verify duplicate things in DB
async function verifyDuplicatesInDb(pool) {
  console.log("=========================================");
  console.log("🔍 DB DUPLICATE VERIFICATION STATUS");
  console.log("=========================================\n");
  
  // 1. Duplicate Subjects
  const dupSubjects = await pool.query(`
    SELECT name, slug, COUNT(*) 
    FROM subjects 
    GROUP BY name, slug 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate Subjects (by Name/Slug): ${dupSubjects.rows.length}`);
  dupSubjects.rows.forEach(r => console.log(`  - Name: "${r.name}", Slug: "${r.slug}" (Count: ${r.count})`));
  
  // 2. Duplicate Units (by Subject + name or Slug)
  const dupUnits = await pool.query(`
    SELECT subject_id, name, COUNT(*) 
    FROM units 
    GROUP BY subject_id, name 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate Units (same subject + name): ${dupUnits.rows.length}`);
  dupUnits.rows.forEach(r => console.log(`  - SubjectID: ${r.subject_id}, Name: "${r.name}" (Count: ${r.count})`));
  
  // 3. Duplicate Chapters (same unit + title)
  const dupChapters = await pool.query(`
    SELECT unit_id, title, COUNT(*) 
    FROM chapters 
    GROUP BY unit_id, title 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate Chapters (same unit + title): ${dupChapters.rows.length}`);
  dupChapters.rows.forEach(r => console.log(`  - UnitID: ${r.unit_id}, Title: "${r.title}" (Count: ${r.count})`));
  
  // 4. Duplicate Topics (same parent topic / chapter + name)
  const dupTopics = await pool.query(`
    SELECT chapter_id, parent_topic_id, name, COUNT(*) 
    FROM topics 
    GROUP BY chapter_id, parent_topic_id, name 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate Topics (same chapter/parent + name): ${dupTopics.rows.length}`);
  
  // 5. Duplicate Subtopics (same topic + name)
  const dupSubtopics = await pool.query(`
    SELECT topic_id, name, COUNT(*) 
    FROM subtopics 
    GROUP BY topic_id, name 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate Subtopics (same topic + name): ${dupSubtopics.rows.length}`);
  console.log("\nAll duplicate checks completed.");
}

main();
