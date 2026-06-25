// Re-export the pool and dbHelpers from the canonical database module.
// This alias exists so that repository files imported from data/repositories/
// can use `import pool from '../database/db.js'` without modifying every import.

import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

export { pool, dbHelpers };
export default pool;
