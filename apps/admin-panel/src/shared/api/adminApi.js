// Unified adminAPI — both import paths (`shared/lib/api/adminAPI` and `shared/api/adminApi`) resolve to the same object
// DEPRECATED: import from `shared/lib/api/adminAPI.js` directly; this shim avoids circular via dataService
export { adminAPI } from "../lib/api/adminAPI.js";
export { adminAPI as default } from "../lib/api/adminAPI.js";
export { apiClient } from "../lib/apiClient.js";
