import { pool } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    console.log('--- Row Level Security (RLS) Status ---');
    
    // Query list of tables and whether RLS is enabled
    const tablesRes = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);

    console.log(`\nTotal tables in public schema: ${tablesRes.rows.length}`);
    const rlsEnabled = tablesRes.rows.filter(r => r.rowsecurity);
    console.log(`Tables with RLS enabled (${rlsEnabled.length}):`);
    rlsEnabled.forEach(r => console.log(`  - ${r.tablename}`));

    // Query active policies
    console.log('\n--- Active Security Policies ---');
    const policiesRes = await pool.query(`
      SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    console.log(`Total active policies: ${policiesRes.rows.length}`);
    policiesRes.rows.forEach(p => {
      console.log(`\nTable: ${p.tablename}`);
      console.log(`  Policy: ${p.policyname}`);
      console.log(`  Command: ${p.cmd}`);
      const rolesStr = Array.isArray(p.roles) ? p.roles.join(', ') : JSON.stringify(p.roles);
      console.log(`  Roles: ${rolesStr}`);
      console.log(`  USING Qual: ${p.qual}`);
      if (p.with_check) {
        console.log(`  WITH CHECK: ${p.with_check}`);
      }
    });

  } catch (error) {
    console.error('Error checking RLS:', error);
  } finally {
    await pool.end();
  }
}

main();
