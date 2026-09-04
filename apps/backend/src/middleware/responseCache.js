/**
 * Consolidated Response Cache Middleware
 * Unified with responseCache.middleware.js for in-flight request deduplication,
 * multi-tier caching (Redis + memory fallback), and user-scoped isolation.
 */
import { responseCache } from "./responseCache.middleware.js";

export default responseCache;
export { responseCache };
