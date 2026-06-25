import { dbHelpers } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    console.log('Fetching appSettings...');
    const settings = await dbHelpers.find("appSettings");
    const existing = settings[0];
    if (existing) {
      console.log('Existing settings found. ID:', existing.id);
      const updated = await dbHelpers.updateById("appSettings", existing.id, {
        comingSoonConfig: { siteConfig: { maintenanceMode: true }, pages: [] }
      });
      console.log('Update result:', updated);
      
      const verified = await dbHelpers.find("appSettings");
      console.log('Verified comingSoonConfig:', verified[0].comingSoonConfig);
    } else {
      console.log('No settings found. Creating one...');
      const created = await dbHelpers.insertOne("appSettings", {
        comingSoonConfig: { siteConfig: { maintenanceMode: true }, pages: [] }
      });
      console.log('Create result:', created);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await dbHelpers.close();
  }
}
main();
