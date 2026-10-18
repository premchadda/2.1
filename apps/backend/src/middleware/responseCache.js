/**
 * Deprecated import alias — there is only ONE response-cache implementation.
 *
 * The real middleware (multi-tier Redis + in-memory cache, in-flight request
 * deduplication, user-scoped isolation, `invalidateResponseCache`, `swrCache`)
 * lives in ./responseCache.middleware.js. This file is a pure re-export kept
 * only because four public routers still import the shorter path.
 *
 * Earlier audit notes described "two responseCache implementations" — that was
 * wrong; there is one implementation plus this alias.
 *
 * To migrate, import from ./responseCache.middleware.js instead. Public routes
 * that need to use it today:
 *   exams-public.js, live-tests-public.js, pyp-public.js, test-series-public.js
 *
 * NOTE: also referenced from app-port5001.js, which uses the middleware variant.
 */
import { responseCache } from "./responseCache.middleware.js";

export default responseCache;
export { responseCache };
