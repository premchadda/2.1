import { dbHelpers } from './src/infrastructure/database/postgres-helpers.js'

async function checkInheritance() {
  const parts = await dbHelpers.pool.query("SELECT * FROM subject_parts WHERE subject_id != 22 AND name ILIKE '%quant%'");
  console.log("Other quant parts:", parts.rows);
}

checkQuant().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) });
