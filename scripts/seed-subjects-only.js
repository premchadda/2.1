import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

async function main() {
  try {
    const { pool, dbHelpers } = await import('../apps/backend/src/infrastructure/database/postgres-helpers.js');
    
    // Load subjects.json fixture
    const fixturePath = path.join(__dirname, "../apps/backend/src/infrastructure/database/seeders/_fixtures/subjects.json");
    const subjectsFixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    
    console.log(`Loaded ${subjectsFixture.length} subjects from fixture.`);
    
    for (const sub of subjectsFixture) {
      // Check if subject exists by slug
      const existing = await pool.query("SELECT id FROM subjects WHERE slug = $1", [sub.slug]);
      
      const insertData = {
        id: sub.id,
        name: sub.title,
        slug: sub.slug,
        icon: sub.icon || null,
        color: sub.color || null,
        description: sub.description || null,
        is_active: sub.is_active !== false,
        "order": sub.order || 0,
        parent_id: sub.parent_id || null,
        subject_group: sub.subjectGroup || null
      };
      
      if (existing.rows.length > 0) {
        // Update existing subject
        const id = existing.rows[0].id;
        console.log(`Subject "${sub.title}" already exists (ID: ${id}, Slug: ${sub.slug}). Updating attributes...`);
        
        await pool.query(
          `UPDATE subjects SET 
             name = $1, 
             icon = $2, 
             color = $3, 
             description = $4, 
             is_active = $5, 
             "order" = $6, 
             parent_id = $7, 
             subject_group = $8 
           WHERE id = $9`,
          [
            insertData.name,
            insertData.icon,
            insertData.color,
            insertData.description,
            insertData.is_active,
            insertData.order,
            insertData.parent_id,
            insertData.subject_group,
            id
          ]
        );
      } else {
        // Insert new subject
        console.log(`Inserting subject "${sub.title}" (Slug: ${sub.slug}, ID: ${sub.id})...`);
        await pool.query(
          `INSERT INTO subjects (id, name, slug, icon, color, description, is_active, "order", parent_id, subject_group)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            insertData.id,
            insertData.name,
            insertData.slug,
            insertData.icon,
            insertData.color,
            insertData.description,
            insertData.is_active,
            insertData.order,
            insertData.parent_id,
            insertData.subject_group
          ]
        );
      }
    }
    
    // Also, sync the ID sequence if subjects uses serial sequence
    const maxIdRes = await pool.query("SELECT MAX(id) FROM subjects");
    const maxId = maxIdRes.rows[0].max || 0;
    if (maxId > 0) {
      await pool.query(`SELECT setval(pg_get_serial_sequence('subjects', 'id'), $1)`, [maxId]);
      console.log(`Synced subjects ID sequence to max ID: ${maxId}`);
    }
    
    console.log("Subjects seeding completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
