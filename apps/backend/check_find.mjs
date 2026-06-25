import { dbHelpers } from './src/infrastructure/database/postgres-helpers.js'

async function run() {
  const chapters = await dbHelpers.find('chapters', { subjectId: 22, isActive: true });
  console.log("Found chapters:", chapters.length);
  
  const allChapters = await dbHelpers.find('chapters', {});
  console.log("Total chapters in DB:", allChapters.length);
}

run().then(() => process.exit(0)).catch(console.error)
