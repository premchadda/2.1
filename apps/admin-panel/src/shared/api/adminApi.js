// Unified adminAPI — both import paths (`shared/lib/api/adminAPI` and `shared/api/adminApi`) resolve to the same object
export { adminAPI } from "../lib/api/adminAPI.js";
export { adminAPI as default } from "../lib/api/adminAPI.js";
export { apiClient } from "../lib/dataService.js";
