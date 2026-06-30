// Re-export the pool and dbHelpers from the canonical database module.

import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

export { pool, dbHelpers };
export default pool;
