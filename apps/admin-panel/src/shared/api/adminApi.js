// Stable admin-API entry point.
// Prefer importing the namespaced `adminAPI` object from `shared/lib/api/adminAPI.js`.
// This module is a compatibility layer so existing imports of `shared/api/adminApi`
// (named `adminAPI`, default `adminAPI`, or named `apiClient`) keep working.

export { adminAPI, default as adminAPIDefault } from "../lib/api/adminAPI.js";
export { apiClient } from "../lib/apiClient.js";

export default adminAPI;
