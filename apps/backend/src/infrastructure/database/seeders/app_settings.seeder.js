import BaseSeeder from './BaseSeeder.js';

export default class AppSettingsSeeder extends BaseSeeder {
  static table = 'app_settings';
  static fixtureFile = 'app_settings.json';
  static columns = ['key', 'value', 'description'];

  static toRow(row) {
    return row;
  }

  static async run(pool, opts) {
    const fixture = this.loadFixture();
    const rows = [
      { key: 'navigation_config', value: JSON.stringify(fixture.navigation_config ?? []), description: 'Navigation configuration' },
      { key: 'coming_soon_config', value: JSON.stringify(fixture.coming_soon_config ?? {}), description: 'Coming soon feature flags' },
      { key: 'site_config', value: JSON.stringify(fixture.site_config ?? {}), description: 'Site-wide configuration' },
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        await client.query(
          `INSERT INTO app_settings (key, value, description)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value,
                 description = EXCLUDED.description,
                 updated_at = NOW()`,
          [row.key, row.value, row.description]
        );
      }
      await client.query('COMMIT');
      opts?.logger?.log?.(`[seed:AppSettingsSeeder] upserted ${rows.length} setting(s)`);
      return { inserted: rows.length, skipped: 0 };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
