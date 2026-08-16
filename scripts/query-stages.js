import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/backend/.env
const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

async function main() {
  try {
    const { dbHelpers } = await import('../apps/backend/src/infrastructure/database/postgres-helpers.js');
    
    const series = await dbHelpers.find('test_series', {});
    console.log('SERIES COUNT:', series.length);
    console.log('SERIES FIELDS (FIRST ITEM):', JSON.stringify(series[0], null, 2));
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
