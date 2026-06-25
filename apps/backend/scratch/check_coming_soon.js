import { dbHelpers } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    console.log('Querying coming-soon-config...');
    const record = await dbHelpers.findOne("appSettings", {
      type: "comingSoonConfig",
    });
    console.log('Record found:', record);
  } catch (err) {
    console.error('Error querying coming-soon-config:', err);
  } finally {
    await dbHelpers.close();
  }
}
main();
