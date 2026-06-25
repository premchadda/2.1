import BaseSeeder from './BaseSeeder.js';

/**
 * Seeds the app_settings singleton row. Unlike other seeders this is
 * upsert-by-id=1: we always want a single active row.
 */
export default class AppSettingsSeeder extends BaseSeeder {
  static table = 'app_settings';
  static fixtureFile = 'app_settings.json';
  static columns = ['navigation_config', 'coming_soon_config', 'site_config', 'is_active'];

  static valueFor(row, column) {
    if (column === 'navigation_config') return JSON.stringify(row.navigation_config ?? []);
    if (column === 'coming_soon_config') return JSON.stringify(row.coming_soon_config ?? {});
    if (column === 'site_config') return JSON.stringify(row.site_config ?? {});
    return row[column] ?? null;
  }

  static async run(pool, opts) {
    const row = this.loadFixture();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO app_settings (navigation_config, coming_soon_config, site_config, is_active)
         VALUES ($1::jsonb, $2::jsonb, $3::jsonb, $4)
         ON CONFLICT (id) DO UPDATE
           SET navigation_config = EXCLUDED.navigation_config,
               coming_soon_config = EXCLUDED.coming_soon_config,
               site_config       = EXCLUDED.site_config,
               is_active         = EXCLUDED.is_active,
               updated_at        = NOW()
         WHERE app_settings.id = (SELECT MIN(id) FROM app_settings)
         RETURNING id;`,
        [
          JSON.stringify(row.navigation_config ?? []),
          JSON.stringify(row.coming_soon_config ?? {}),
          JSON.stringify(row.site_config ?? {}),
          row.is_active ?? true,
        ]
      );
      await client.query('COMMIT');
      opts?.logger?.log?.(`[seed:AppSettingsSeeder] upserted singleton id=${result.rows[0]?.id ?? '?'}`);
      return { inserted: 1, skipped: 0 };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
