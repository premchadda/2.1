import { dbHelpers } from './src/infrastructure/database/postgres-helpers.js'
import { findEntityByIdentifier } from './src/api/routes/helpers/entity-helpers.js'

async function run() {
  const material = await findEntityByIdentifier(dbHelpers, 'subjects', 'quantitative-aptitude', { slugFields: ['slug'] });
  console.log('Material ID:', material.id);
  const chapters = await dbHelpers.find('chapters', { subjectId: material.id, isActive: true });
  console.log('Chapters length:', chapters.length);
}

run().then(() => process.exit(0)).catch(console.error)
